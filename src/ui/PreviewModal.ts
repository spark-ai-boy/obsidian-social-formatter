import { App, Modal, Notice, TFile, setIcon } from "obsidian";
import type SocialFormatterPlugin from "../main";
import { SocialExporter } from "../exporter";
import { getAllThemes, getDefaultThemeForPlatform } from "../themes";
import { copyPlainText } from "../clipboard";
import type { Platform, SocialTheme } from "../types";
import { PLATFORM_LABELS, PLATFORM_SHORT_LABELS } from "../types";
import { el, iconButton } from "./dom";
import { ThemeEditorModal } from "./ThemeEditorModal";

export class PreviewModal extends Modal {
  private readonly plugin: SocialFormatterPlugin;
  private readonly file: TFile;
  private platform: Platform;
  private themeId: string;
  private includeTitle: boolean;
  private exporter?: SocialExporter;
  private renderToken = 0;
  private readonly themeByPlatform: Partial<Record<Platform, string>> = {};
  private readonly platformButtons: Partial<Record<Platform, HTMLButtonElement>> = {};

  private themeSelect!: HTMLSelectElement;
  private titleToggle!: HTMLInputElement;
  private copyButton!: HTMLButtonElement;
  private copyHtmlButton!: HTMLButtonElement;
  private defaultButton!: HTMLButtonElement;
  private editButton!: HTMLButtonElement;
  private previewMount!: HTMLElement;
  private previewPaper!: HTMLElement;
  private warningBox!: HTMLElement;
  private statusEl!: HTMLElement;
  private themeLabel!: HTMLElement;
  private chromeEl!: HTMLElement;
  private originalBadge!: HTMLElement;
  private authorEl!: HTMLElement;
  private accountEl!: HTMLElement;
  private timeEl!: HTMLElement;
  private locationEl!: HTMLElement;
  private avatarEl!: HTMLElement;
  private accountNameEl!: HTMLElement;
  private accountDescEl!: HTMLElement;
  private actionsEl!: HTMLElement;
  private mobile = false;

  constructor(app: App, plugin: SocialFormatterPlugin, file: TFile, initialThemeId?: string) {
    super(app);
    this.plugin = plugin;
    this.file = file;
    const defaultTheme =
      plugin.getThemeById(plugin.settings.defaultThemeId) ??
      getDefaultThemeForPlatform("wechat");
    const initial =
      (initialThemeId ? plugin.getThemeById(initialThemeId) : undefined) ??
      defaultTheme;
    this.themeId = initial.id;
    this.platform = initial.platform;
    this.includeTitle = plugin.settings.includeTitle;
    this.themeByPlatform[initial.platform] = initial.id;
  }

  onOpen(): void {
    this.modalEl.classList.add("sf-preview-modal");
    this.contentEl.classList.add("sf-preview-content");
    this.contentEl.empty();

    const header = el("div", "sf-preview-header");
    const heading = el("div", "sf-preview-heading");
    heading.appendChild(el("h2", undefined, "社交平台排版"));
    const fileLabel = el("p", "sf-file-path", this.file.path);
    fileLabel.title = this.file.path;
    heading.appendChild(fileLabel);
    header.appendChild(heading);
    iconButton(
      header,
      "settings",
      "打开插件设置",
      () => {
        this.close();
        this.plugin.openSettings();
      },
      "sf-header-settings",
    );
    this.contentEl.appendChild(header);

    const toolbar = el("div", "sf-toolbar");
    const segmented = el("div", "sf-segmented");
    for (const platform of ["wechat", "toutiao"] as Platform[]) {
      const button = el("button", "sf-segment", PLATFORM_SHORT_LABELS[platform]);
      button.type = "button";
      button.dataset.platform = platform;
      button.addEventListener("click", () => this.switchPlatform(platform));
      segmented.appendChild(button);
      this.platformButtons[platform] = button;
    }
    toolbar.appendChild(segmented);

    const themeGroup = el("div", "sf-toolbar-group");
    themeGroup.appendChild(el("span", "sf-toolbar-label", "样式"));
    this.themeSelect = el("select", "sf-select sf-theme-select");
    this.themeSelect.addEventListener("change", () => {
      this.themeId = this.themeSelect.value;
      this.themeByPlatform[this.platform] = this.themeId;
      this.plugin.saveThemeSelection(this.platform, this.themeId);
      this.updateDefaultButton();
      void this.render();
    });
    themeGroup.appendChild(this.themeSelect);
    toolbar.appendChild(themeGroup);

    this.editButton = el("button", "sf-button sf-button-quiet", "复制并编辑");
    this.editButton.type = "button";
    this.editButton.addEventListener("click", () => this.editCurrentTheme());
    toolbar.appendChild(this.editButton);

    this.defaultButton = el("button", "sf-icon-button", "");
    this.defaultButton.type = "button";
    this.defaultButton.setAttribute("aria-label", "设为默认样式");
    this.defaultButton.setAttribute("title", "设为默认样式");
    const star = el("span", "sf-icon");
    star.textContent = "☆";
    this.defaultButton.appendChild(star);
    this.defaultButton.addEventListener("click", () => void this.setAsDefault());
    toolbar.appendChild(this.defaultButton);

    toolbar.appendChild(el("span", "sf-toolbar-spacer"));

    const mobileButton = el("button", "sf-button sf-button-quiet", "手机预览");
    mobileButton.type = "button";
    mobileButton.addEventListener("click", () => {
      this.mobile = !this.mobile;
      this.previewPaper.classList.toggle("is-mobile", this.mobile);
      mobileButton.classList.toggle("is-active", this.mobile);
      mobileButton.textContent = this.mobile ? "桌面预览" : "手机预览";
    });
    toolbar.appendChild(mobileButton);
    this.contentEl.appendChild(toolbar);

    this.warningBox = el("div", "sf-warning-box");
    this.warningBox.hidden = true;
    this.contentEl.appendChild(this.warningBox);

    const previewArea = el("div", "sf-preview-area");
    const previewMeta = el("div", "sf-preview-meta");
    this.themeLabel = el("span", "sf-theme-label", "");
    previewMeta.appendChild(this.themeLabel);
    this.statusEl = el("span", "sf-status", "正在准备…");
    previewMeta.appendChild(this.statusEl);
    previewArea.appendChild(previewMeta);

    const scroll = el("div", "sf-preview-scroll");
    this.previewPaper = el("div", "sf-preview-paper");
    this.previewMount = el("div", "sf-preview-mount");
    this.buildPlatformChrome();
    this.previewPaper.appendChild(this.chromeEl);
    scroll.appendChild(this.previewPaper);
    previewArea.appendChild(scroll);
    this.contentEl.appendChild(previewArea);

    const footer = el("div", "sf-preview-footer");
    const titleControl = el("label", "sf-switch");
    this.titleToggle = el("input");
    this.titleToggle.type = "checkbox";
    this.titleToggle.checked = this.includeTitle;
    this.titleToggle.addEventListener("change", () => {
      this.includeTitle = this.titleToggle.checked;
      this.plugin.settings.includeTitle = this.includeTitle;
      void this.plugin.saveSettings();
      void this.render();
    });
    titleControl.append(this.titleToggle, el("span", undefined, "包含笔记标题"));
    titleControl.title = "公众号和头条的标题通常在发布后台单独填写，默认不复制标题。";
    footer.appendChild(titleControl);
    footer.appendChild(el("span", "sf-shortcut-hint", "⌘/Ctrl + Enter 复制"));

    footer.appendChild(el("span", "sf-footer-spacer"));

    this.copyHtmlButton = el("button", "sf-button sf-button-quiet", "复制 HTML 源码");
    this.copyHtmlButton.type = "button";
    this.copyHtmlButton.addEventListener("click", () => void this.copyHtmlSource());
    footer.appendChild(this.copyHtmlButton);

    this.copyButton = el("button", "sf-button sf-button-primary sf-copy-button", "复制到剪贴板");
    this.copyButton.type = "button";
    this.copyButton.addEventListener("click", () => void this.copy());
    footer.appendChild(this.copyButton);
    this.contentEl.appendChild(footer);

    this.scope.register(["Mod"], "Enter", () => {
      if (!this.copyButton.disabled) void this.copy();
      return false;
    });

    this.updatePlatformButtons();
    this.refreshThemeSelect();
    this.updateDefaultButton();
    this.updateThemeLabel();
    void this.render();
  }

  onClose(): void {
    this.renderToken += 1;
    this.exporter = undefined;
    this.contentEl.empty();
  }

  private currentTheme(): SocialTheme {
    return (
      this.plugin.getThemeById(this.themeId) ??
      getDefaultThemeForPlatform(this.platform)
    );
  }

  private switchPlatform(platform: Platform): void {
    if (platform === this.platform) return;
    this.themeByPlatform[this.platform] = this.themeId;
    this.platform = platform;
    this.themeId =
      this.themeByPlatform[platform] ??
      this.plugin.getLastThemeIdForPlatform(platform);
    if (!this.plugin.getThemeById(this.themeId) || this.currentTheme().platform !== platform) {
      this.themeId = this.plugin.getDefaultThemeIdForPlatform(platform);
    }
    this.updatePlatformButtons();
    this.refreshThemeSelect();
    this.updateDefaultButton();
    this.updateThemeLabel();
    void this.render();
  }

  private buildPlatformChrome(): void {
    this.chromeEl = el("div", "sf-platform-chrome is-wechat");

    const header = el("div", "sf-platform-header");
    const badgeRow = el("div", "sf-platform-badge-row");
    this.originalBadge = el("span", "sf-original-badge", "原创");
    badgeRow.append(this.originalBadge, el("span", "sf-preview-badge", "平台预览"));
    const byline = el("div", "sf-platform-byline");
    this.authorEl = el("span", "sf-platform-author");
    this.accountEl = el("span", "sf-platform-account");
    this.timeEl = el("span", "sf-platform-time");
    this.locationEl = el("span", "sf-platform-location");
    byline.append(
      this.authorEl,
      el("span", "sf-platform-dot", "·"),
      this.accountEl,
      el("span", "sf-platform-dot", "·"),
      this.timeEl,
      el("span", "sf-platform-dot", "·"),
      this.locationEl,
    );
    header.append(badgeRow, byline);

    const footer = el("div", "sf-platform-footer");
    const accountCard = el("div", "sf-account-card");
    this.avatarEl = el("span", "sf-account-avatar");
    const accountCopy = el("div", "sf-account-copy");
    this.accountNameEl = el("strong", "sf-account-name");
    this.accountDescEl = el("span", "sf-account-desc");
    accountCopy.append(this.accountNameEl, this.accountDescEl);
    accountCard.append(
      this.avatarEl,
      accountCopy,
      el("span", "sf-follow-button", "关注"),
    );
    this.actionsEl = el("div", "sf-platform-actions");
    footer.append(accountCard, this.actionsEl);

    this.chromeEl.append(header, this.previewMount, footer);
  }

  private updatePlatformChrome(): void {
    if (!this.chromeEl) return;
    const isToutiao = this.platform === "toutiao";
    this.chromeEl.classList.toggle("is-wechat", !isToutiao);
    this.chromeEl.classList.toggle("is-toutiao", isToutiao);
    const meta = this.previewMeta();
    this.authorEl.textContent = meta.author;
    this.accountEl.textContent = meta.account;
    this.timeEl.textContent = meta.time;
    this.locationEl.textContent = meta.location;
    this.avatarEl.textContent = meta.account.trim().slice(0, 1).toUpperCase() || "S";
    this.accountNameEl.textContent = meta.account;
    this.accountDescEl.textContent = isToutiao
      ? "分享热点与深度内容"
      : "分享笔记与效率工具";

    this.actionsEl.empty();
    const actions: Array<[string, string]> = isToutiao
      ? [
          ["heart", "点赞"],
          ["message-square", "评论"],
          ["share-2", "分享"],
          ["bookmark", "收藏"],
        ]
      : [
          ["heart", "点赞"],
          ["share-2", "转发"],
          ["thumbs-up", "推荐"],
          ["message-square", "评论"],
        ];
    for (const [icon, label] of actions) {
      const action = el("span", "sf-platform-action");
      const iconEl = el("span", "sf-platform-action-icon");
      setIcon(iconEl, icon);
      action.append(iconEl, el("span", undefined, label));
      this.actionsEl.appendChild(action);
    }
  }

  private previewMeta(): {
    author: string;
    account: string;
    time: string;
    location: string;
  } {
    const frontmatter = this.app.metadataCache.getFileCache(this.file)?.frontmatter as
      | Record<string, unknown>
      | undefined;
    const text = (value: unknown): string =>
      typeof value === "string" && value.trim() ? value.trim() : "";
    const author = text(frontmatter?.author) || this.plugin.manifest.author;
    const account = text(frontmatter?.account) || this.plugin.manifest.name;
    const location = text(frontmatter?.location) || "上海";
    const published =
      text(frontmatter?.published) || text(frontmatter?.date);
    const time =
      published ||
      new Intl.DateTimeFormat("zh-CN", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }).format(new Date());
    return { author, account, time, location };
  }

  private updatePlatformButtons(): void {
    for (const [platform, button] of Object.entries(this.platformButtons)) {
      button.classList.toggle("is-active", platform === this.platform);
    }
  }

  private refreshThemeSelect(): void {
    this.themeSelect.empty();
    const themes = getAllThemes(this.plugin.settings.customThemes).filter(
      (theme) => theme.platform === this.platform,
    );
    for (const theme of themes) {
      const option = el("option");
      option.value = theme.id;
      option.textContent = theme.builtin ? theme.name : `${theme.name} · 自定义`;
      this.themeSelect.appendChild(option);
    }
    if (!themes.some((theme) => theme.id === this.themeId)) {
      this.themeId = themes[0]?.id ?? getDefaultThemeForPlatform(this.platform).id;
    }
    this.themeSelect.value = this.themeId;
    this.updateThemeLabel();
  }

  private updateThemeLabel(): void {
    if (!this.themeLabel) return;
    const theme = this.currentTheme();
    this.themeLabel.textContent = theme.builtin
      ? theme.name
      : `${PLATFORM_LABELS[this.platform]} · ${theme.name.replace(
          /^(公众号|头条)\s*·\s*/,
          "",
        )}`;
    this.editButton.textContent = theme.builtin ? "复制并编辑" : "编辑样式";
  }

  private updateDefaultButton(): void {
    if (!this.defaultButton) return;
    const isDefault = this.plugin.settings.defaultThemeId === this.themeId;
    this.defaultButton.classList.toggle("is-default", isDefault);
    this.defaultButton.setAttribute(
      "aria-label",
      isDefault ? "当前默认样式" : "设为默认样式",
    );
    this.defaultButton.setAttribute(
      "title",
      isDefault ? "当前默认样式" : "设为默认样式",
    );
    this.defaultButton.firstElementChild &&
      (this.defaultButton.firstElementChild.textContent = isDefault ? "★" : "☆");
  }

  private async setAsDefault(): Promise<void> {
    const theme = this.currentTheme();
    this.themeId = theme.id;
    this.plugin.settings.defaultThemeId = theme.id;
    this.plugin.settings.lastThemeByPlatform[theme.platform] = theme.id;
    await this.plugin.saveSettings();
    this.updateDefaultButton();
    new Notice("已设为默认样式");
  }

  private editCurrentTheme(): void {
    const current = this.currentTheme();
    const isNew = current.builtin;
    const editable = isNew ? this.plugin.newCustomThemeFrom(current) : current;
    const modal = new ThemeEditorModal(
      this.app,
      this.plugin,
      editable,
      isNew,
      (saved) => {
        this.platform = saved.platform;
        this.themeId = saved.id;
        this.themeByPlatform[saved.platform] = saved.id;
        this.plugin.saveThemeSelection(saved.platform, saved.id);
        this.updatePlatformButtons();
        this.refreshThemeSelect();
        this.updateDefaultButton();
        this.updateThemeLabel();
        void this.render();
      },
    );
    modal.open();
  }

  private async render(): Promise<void> {
    const token = ++this.renderToken;
    const theme = this.currentTheme();
    this.themeSelect.value = theme.id;
    this.previewPaper.setCssProps({
      "--sf-paper-width": `${Math.min(940, Math.max(420, theme.tokens.contentWidth + 80))}px`,
    });
    this.updatePlatformChrome();
    this.updateThemeLabel();
    this.copyButton.disabled = true;
    this.copyHtmlButton.disabled = true;
    this.copyButton.textContent = "正在生成…";
    this.statusEl.textContent = "正在排版…";
    this.warningBox.hidden = true;
    this.warningBox.empty();
    this.previewMount.empty();
    for (const stale of Array.from(this.previewPaper.querySelectorAll(".sf-loading"))) {
      stale.remove();
    }

    const loading = el("div", "sf-loading");
    loading.appendChild(el("div", "sf-spinner"));
    loading.appendChild(el("p", undefined, "正在读取笔记并转换样式…"));
    this.previewPaper.appendChild(loading);

    const exporter = new SocialExporter(this.app, this.file, theme, () =>
      this.plugin.readMarkdown(this.file),
    );
    this.previewMount.appendChild(exporter.host);

    try {
      const result = await exporter.render({
        includeTitle: this.includeTitle,
        maxImageBytes: this.plugin.settings.maxImageMB * 1024 * 1024,
      });
      if (token !== this.renderToken) {
        exporter.host.remove();
        return;
      }
      this.exporter = exporter;
      this.copyButton.disabled = false;
      this.copyHtmlButton.disabled = false;
      this.copyButton.textContent = "复制到剪贴板";
      const imageInfo =
        result.imageCount > 0
          ? ` · 图片 ${result.imageCount} 张${result.localImageCount ? `（${result.localImageCount} 张已内嵌）` : ""}`
          : " · 无图片";
      this.statusEl.textContent = `已生成${imageInfo}`;
      this.renderWarnings(result.warnings);
    } catch (error) {
      if (token !== this.renderToken) return;
      this.exporter = undefined;
      this.copyButton.textContent = "复制到剪贴板";
      this.statusEl.textContent = "排版失败";
      this.previewMount.empty();
      const box = el("div", "sf-error-box");
      box.appendChild(el("h3", undefined, "生成失败"));
      box.appendChild(el("p", undefined, String(error)));
      this.previewMount.appendChild(box);
      new Notice(`排版失败：${String(error)}`);
    } finally {
      loading.remove();
    }
  }

  private renderWarnings(warnings: string[]): void {
    this.warningBox.empty();
    if (!warnings.length) {
      this.warningBox.hidden = true;
      return;
    }
    this.warningBox.hidden = false;
    const title = el("strong", undefined, "复制前请留意");
    this.warningBox.appendChild(title);
    const list = el("ul");
    for (const warning of warnings) {
      list.appendChild(el("li", undefined, warning));
    }
    this.warningBox.appendChild(list);
  }

  private async copy(): Promise<void> {
    if (!this.exporter) return;
    this.copyButton.disabled = true;
    this.copyButton.textContent = "正在复制…";
    try {
      const result = await this.exporter.copy();
      if (result.mode === "rich") {
        new Notice("已复制富文本，可直接粘贴到平台编辑器");
      } else {
        new Notice("系统只允许写入纯文本，已复制纯文本版本", 6000);
      }
    } catch (error) {
      new Notice(`复制失败：${String(error)}`, 6000);
    } finally {
      this.copyButton.disabled = false;
      this.copyButton.textContent = "复制到剪贴板";
    }
  }

  private async copyHtmlSource(): Promise<void> {
    if (!this.exporter) return;
    try {
      await copyPlainText(this.exporter.getCopyHtml());
      new Notice("HTML 源码已复制");
    } catch (error) {
      new Notice(`复制失败：${String(error)}`);
    }
  }
}
