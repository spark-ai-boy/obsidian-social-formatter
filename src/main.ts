import {
  FuzzySuggestModal,
  MarkdownView,
  Notice,
  Plugin,
  TFile,
} from "obsidian";
import { SocialExporter } from "./exporter";
import type {
  FormatterSettings,
  Platform,
  SocialTheme,
} from "./types";
import {
  createCustomTheme,
  getAllThemes,
  getBuiltinTheme,
  getDefaultThemeForPlatform,
  getThemeById as findThemeById,
  normalizeCustomTheme,
  normalizeTokens,
} from "./themes";
import { clamp } from "./utils";
import { PreviewModal } from "./ui/PreviewModal";
import { SocialFormatterSettingTab } from "./ui/SettingsTab";

const DEFAULT_SETTINGS: FormatterSettings = {
  defaultThemeId: "wechat-classic",
  lastThemeByPlatform: {},
  includeTitle: false,
  maxImageMB: 8,
  customThemes: [],
};

class NotePickerModal extends FuzzySuggestModal<TFile> {
  private readonly files: TFile[];
  private readonly onChoose: (file: TFile) => void;

  constructor(app: import("obsidian").App, files: TFile[], onChoose: (file: TFile) => void) {
    super(app);
    this.files = files;
    this.onChoose = onChoose;
    this.setPlaceholder("选择要排版的 Markdown 笔记");
  }

  getItems(): TFile[] {
    return this.files;
  }

  getItemText(item: TFile): string {
    return item.path;
  }

  onChooseItem(item: TFile): void {
    this.onChoose(item);
  }
}

export default class SocialFormatterPlugin extends Plugin {
  settings: FormatterSettings = { ...DEFAULT_SETTINGS };

  async onload(): Promise<void> {
    await this.loadSettings();

    this.addRibbonIcon("share-2", "社交平台排版", () => {
      this.openPreview();
    });

    this.addCommand({
      id: "open-social-preview",
      name: "打开社媒排版预览",
      callback: () => this.openPreview(),
    });

    this.addCommand({
      id: "copy-as-wechat",
      name: "复制为公众号样式",
      callback: () => void this.copyAs("wechat"),
    });

    this.addCommand({
      id: "copy-as-toutiao",
      name: "复制为今日头条样式",
      callback: () => void this.copyAs("toutiao"),
    });

    this.addSettingTab(new SocialFormatterSettingTab(this.app, this));
  }

  async loadSettings(): Promise<void> {
    const data = (await this.loadData()) as Partial<FormatterSettings> | null;
    const customThemes = Array.isArray(data?.customThemes)
      ? data.customThemes
          .map((theme) => normalizeCustomTheme(theme))
          .filter((theme): theme is SocialTheme => theme !== null)
      : [];
    const defaultThemeId =
      typeof data?.defaultThemeId === "string" &&
      findThemeById(data.defaultThemeId, customThemes)
        ? data.defaultThemeId
        : DEFAULT_SETTINGS.defaultThemeId;
    const lastThemeByPlatform: Partial<Record<Platform, string>> = {};
    if (data?.lastThemeByPlatform && typeof data.lastThemeByPlatform === "object") {
      for (const platform of ["wechat", "toutiao"] as Platform[]) {
        const id = data.lastThemeByPlatform[platform];
        if (typeof id === "string" && findThemeById(id, customThemes)) {
          lastThemeByPlatform[platform] = id;
        }
      }
    }
    this.settings = {
      defaultThemeId,
      lastThemeByPlatform,
      includeTitle: data?.includeTitle === true,
      maxImageMB: clamp(Number(data?.maxImageMB ?? DEFAULT_SETTINGS.maxImageMB), 1, 30),
      customThemes,
    };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  getThemeById(id: string): SocialTheme | undefined {
    return findThemeById(id, this.settings.customThemes);
  }

  getDefaultThemeIdForPlatform(platform: Platform): string {
    const preferred = this.getThemeById(this.settings.defaultThemeId);
    if (preferred && preferred.platform === platform) return preferred.id;
    const themes = getAllThemes(this.settings.customThemes).filter(
      (theme) => theme.platform === platform,
    );
    return themes[0]?.id ?? getDefaultThemeForPlatform(platform).id;
  }

  getLastThemeIdForPlatform(platform: Platform): string {
    const id = this.settings.lastThemeByPlatform[platform];
    if (id) {
      const theme = this.getThemeById(id);
      if (theme?.platform === platform) return id;
    }
    return this.getDefaultThemeIdForPlatform(platform);
  }

  saveThemeSelection(platform: Platform, id: string): void {
    this.settings.lastThemeByPlatform[platform] = id;
    void this.saveSettings();
  }

  newCustomThemeFrom(base: SocialTheme): SocialTheme {
    return createCustomTheme(base);
  }

  async saveCustomTheme(theme: SocialTheme): Promise<void> {
    const base = getDefaultThemeForPlatform(theme.platform);
    const normalized: SocialTheme = {
      ...theme,
      builtin: false,
      tokens: normalizeTokens(theme.tokens, base.tokens),
      customCss: theme.customCss ?? "",
    };
    const index = this.settings.customThemes.findIndex((item) => item.id === normalized.id);
    if (index >= 0) {
      this.settings.customThemes[index] = normalized;
    } else {
      this.settings.customThemes.push(normalized);
    }
    this.settings.lastThemeByPlatform[normalized.platform] = normalized.id;
    await this.saveSettings();
  }

  async deleteCustomTheme(id: string): Promise<void> {
    const deleted = this.settings.customThemes.find((theme) => theme.id === id);
    this.settings.customThemes = this.settings.customThemes.filter((theme) => theme.id !== id);
    for (const platform of ["wechat", "toutiao"] as Platform[]) {
      if (this.settings.lastThemeByPlatform[platform] === id) {
        delete this.settings.lastThemeByPlatform[platform];
      }
    }
    if (this.settings.defaultThemeId === id) {
      this.settings.defaultThemeId = deleted
        ? getDefaultThemeForPlatform(deleted.platform).id
        : DEFAULT_SETTINGS.defaultThemeId;
    }
    await this.saveSettings();
  }

  openSettings(): void {
    const setting = (this.app as unknown as {
      setting?: { open(): void; openTabById(id: string): void };
    }).setting;
    if (setting) {
      setting.open();
      window.setTimeout(() => {
        try {
          setting.openTabById(this.manifest.id);
        } catch {
          // The settings modal may still be opening in a popout window.
        }
      }, 50);
      return;
    }
    new Notice("请从 Obsidian 设置 → 第三方插件中打开设置");
  }

  async readMarkdown(file: TFile): Promise<string> {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (view?.file?.path === file.path && view.editor) {
      return view.editor.getValue();
    }
    return this.app.vault.cachedRead(file);
  }

  getActiveMarkdownFile(): TFile | null {
    const file = this.app.workspace.getActiveFile();
    if (file instanceof TFile && file.extension === "md") return file;
    return null;
  }

  pickNote(onChoose: (file: TFile) => void): void {
    const files = this.app.vault
      .getMarkdownFiles()
      .slice()
      .sort((a, b) => a.path.localeCompare(b.path));
    if (!files.length) {
      new Notice("当前库中没有 Markdown 笔记");
      return;
    }
    new NotePickerModal(this.app, files, onChoose).open();
  }

  openPreview(file?: TFile, themeId?: string): void {
    const target = file ?? this.getActiveMarkdownFile();
    if (!target) {
      this.pickNote((picked) => this.openPreview(picked, themeId));
      return;
    }
    new PreviewModal(this.app, this, target, themeId).open();
  }

  async copyAs(platform: Platform): Promise<void> {
    const file = this.getActiveMarkdownFile();
    if (!file) {
      this.pickNote((picked) => {
        void this.copyFileAs(picked, platform);
      });
      return;
    }
    await this.copyFileAs(file, platform);
  }

  private async copyFileAs(file: TFile, platform: Platform): Promise<void> {
    const theme =
      this.getThemeById(this.getLastThemeIdForPlatform(platform)) ??
      getBuiltinTheme(getDefaultThemeForPlatform(platform).id) ??
      getDefaultThemeForPlatform(platform);
    const notice = new Notice("正在排版并复制…", 0);
    const exporter = new SocialExporter(this.app, file, theme, () =>
      this.readMarkdown(file),
    );
    exporter.host.style.cssText =
      "position:fixed;left:-100000px;top:0;width:720px;opacity:0;pointer-events:none;";
    document.body.appendChild(exporter.host);
    try {
      await exporter.render({
        includeTitle: this.settings.includeTitle,
        maxImageBytes: this.settings.maxImageMB * 1024 * 1024,
      });
      const result = await exporter.copy();
      notice.hide();
      if (result.mode === "rich") {
        const hasLocalImages = exporter
          .getWarnings()
          .some((warning) => warning.includes("Base64"));
        new Notice(
          `已复制为${platform === "wechat" ? "公众号" : "今日头条"}样式${
            hasLocalImages ? "；本地图片若未自动上传，请重新插入" : ""
          }`,
          hasLocalImages ? 7000 : 4000,
        );
      } else {
        new Notice("系统只允许写入纯文本，已复制纯文本版本", 6000);
      }
    } catch (error) {
      notice.hide();
      new Notice(`复制失败：${String(error)}`, 6000);
    } finally {
      exporter.host.remove();
    }
  }
}
