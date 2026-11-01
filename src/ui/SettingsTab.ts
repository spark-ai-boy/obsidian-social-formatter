import {
  App,
  Notice,
  PluginSettingTab,
  Setting,
  type SettingDefinition,
  type SettingDefinitionItem,
} from "obsidian";
import type SocialFormatterPlugin from "../main";
import { getAllThemes, getDefaultThemeForPlatform } from "../themes";
import type { Platform, SocialTheme } from "../types";
import { PLATFORM_LABELS } from "../types";
import { cloneTheme } from "../utils";
import { ConfirmModal } from "./ConfirmModal";
import { ThemeEditorModal } from "./ThemeEditorModal";

export class SocialFormatterSettingTab extends PluginSettingTab {
  private readonly plugin: SocialFormatterPlugin;

  constructor(app: App, plugin: SocialFormatterPlugin) {
    super(app, plugin);
    this.plugin = plugin;
    this.icon = "share-2";
  }

  getSettingDefinitions(): SettingDefinitionItem[] {
    return [
      {
        type: "group",
        items: [
          {
            name: "默认样式",
            desc: "打开预览时优先使用的样式。",
            control: {
              type: "dropdown",
              key: "defaultThemeId",
              options: this.themeOptions(),
            },
          },
          {
            name: "复制时包含笔记标题",
            desc: "公众号和头条通常在发布后台单独填写标题，默认关闭。",
            control: {
              type: "toggle",
              key: "includeTitle",
            },
          },
          {
            name: "单张图片上限",
            desc: "本地图片会转为 Base64 内嵌。",
            control: {
              type: "slider",
              key: "maxImageMB",
              min: 1,
              max: 30,
              step: 1,
            },
          },
        ],
      },
      {
        type: "group",
        heading: "内置样式",
        items: getAllThemes(this.plugin.settings.customThemes)
          .filter((theme) => theme.builtin)
          .map((theme) => this.themeDefinition(theme, true)),
      },
      {
        type: "group",
        heading: "自定义样式",
        items: [
          ...(this.plugin.settings.customThemes.length
            ? this.plugin.settings.customThemes.map((theme) =>
                this.themeDefinition(theme, false),
              )
            : [
                {
                  name: "还没有自定义样式",
                  desc: "可以从内置样式复制，或新建一个。",
                } satisfies SettingDefinition,
              ]),
          {
            name: "新建样式",
            desc: "从平台默认样式开始，创建一份可编辑的副本。",
            render: (setting) => {
              this.addCreateButton(setting, "wechat");
              this.addCreateButton(setting, "toutiao");
            },
          },
        ],
      },
      {
        type: "group",
        heading: "关于",
        items: [this.aboutDefinition()],
      },
    ];
  }

  getControlValue(key: string): unknown {
    switch (key) {
      case "defaultThemeId":
        return this.plugin.settings.defaultThemeId;
      case "includeTitle":
        return this.plugin.settings.includeTitle;
      case "maxImageMB":
        return this.plugin.settings.maxImageMB;
      default:
        return undefined;
    }
  }

  async setControlValue(key: string, value: unknown): Promise<void> {
    switch (key) {
      case "defaultThemeId": {
        const id = String(value);
        const theme = this.plugin.getThemeById(id);
        if (!theme) return;
        this.plugin.settings.defaultThemeId = id;
        this.plugin.settings.lastThemeByPlatform[theme.platform] = id;
        break;
      }
      case "includeTitle":
        this.plugin.settings.includeTitle = value === true;
        break;
      case "maxImageMB":
        this.plugin.settings.maxImageMB = Math.min(
          30,
          Math.max(1, Number(value) || 8),
        );
        break;
      default:
        return;
    }
    await this.plugin.saveSettings();
  }

  private themeOptions(): Record<string, string> {
    const options: Record<string, string> = {};
    for (const platform of ["wechat", "toutiao"] as Platform[]) {
      for (const theme of getAllThemes(this.plugin.settings.customThemes).filter(
        (item) => item.platform === platform,
      )) {
        const cleanName = theme.name.replace(/^(公众号|头条)\s*·\s*/, "");
        options[theme.id] = `${PLATFORM_LABELS[platform]} · ${cleanName}${
          theme.builtin ? "" : "（自定义）"
        }`;
      }
    }
    return options;
  }

  private themeDefinition(theme: SocialTheme, builtin: boolean): SettingDefinition {
    return {
      name: theme.name,
      desc: `${PLATFORM_LABELS[theme.platform]} · ${builtin ? "内置" : "自定义"}`,
      aliases: [theme.name, PLATFORM_LABELS[theme.platform], "theme", "style"],
      render: (setting) => {
        if (builtin) {
          setting.addButton((button) =>
            button.setButtonText("复制并编辑").onClick(() => {
              this.openEditor(this.plugin.newCustomThemeFrom(theme), true);
            }),
          );
          return;
        }
        setting.addButton((button) =>
          button.setButtonText("编辑").onClick(() => {
            this.openEditor(cloneTheme(theme), false);
          }),
        );
        setting.addButton((button) =>
          button.setButtonText("复制").onClick(() => {
            const copy = this.plugin.newCustomThemeFrom(theme);
            copy.name = `${theme.name} 副本`;
            this.openEditor(copy, true);
          }),
        );
        setting.addButton((button) =>
          button
            .setButtonText("删除")
            .setDestructive()
            .onClick(() => {
              new ConfirmModal(
                this.app,
                "删除自定义样式",
                `确定删除「${theme.name}」吗？此操作无法撤销。`,
                async () => {
                  await this.plugin.deleteCustomTheme(theme.id);
                  this.update();
                },
                "删除",
              ).open();
            }),
        );
      },
    };
  }

  private addCreateButton(setting: Setting, platform: Platform): void {
    setting.addButton((button) =>
      button
        .setButtonText(
          platform === "wechat" ? "新建公众号样式" : "新建头条样式",
        )
        .onClick(() => {
          const base = getDefaultThemeForPlatform(platform);
          const theme = this.plugin.newCustomThemeFrom(base);
          theme.name = platform === "wechat" ? "我的公众号样式" : "我的头条样式";
          this.openEditor(theme, true);
        }),
    );
  }

  private aboutDefinition(): SettingDefinition {
    return {
      name: "Social Formatter",
      desc: "复制时读取最终计算样式，逐元素写入内联 style，因此自定义 CSS 也会被带进剪贴板。伪元素不会写入复制结果。",
    };
  }

  private openEditor(theme: SocialTheme, isNew: boolean): void {
    try {
      new ThemeEditorModal(this.app, this.plugin, theme, isNew, () => {
        this.update();
      }).open();
    } catch (error) {
      new Notice(`无法打开样式编辑器：${String(error)}`);
    }
  }
}
