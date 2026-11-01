import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type SocialFormatterPlugin from "../main";
import { getAllThemes, getDefaultThemeForPlatform } from "../themes";
import type { Platform, SocialTheme } from "../types";
import { PLATFORM_LABELS } from "../types";
import { cloneTheme } from "../utils";
import { ConfirmModal } from "./ConfirmModal";
import { el } from "./dom";
import { ThemeEditorModal } from "./ThemeEditorModal";

export class SocialFormatterSettingTab extends PluginSettingTab {
  private readonly plugin: SocialFormatterPlugin;

  constructor(app: App, plugin: SocialFormatterPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.classList.add("sf-settings");

    containerEl.appendChild(
      el(
        "p",
        "sf-settings-description",
        "把 Markdown 笔记转换为公众号、今日头条的排版样式，复制富文本后直接粘贴到平台编辑器。",
      ),
    );

    this.renderGeneral(containerEl);
    this.renderThemeLibrary(containerEl);
    this.renderAbout(containerEl);
  }

  private renderGeneral(containerEl: HTMLElement): void {
    const themes = getAllThemes(this.plugin.settings.customThemes);
    new Setting(containerEl)
      .setName("默认样式")
      .setDesc("打开预览时优先使用的样式。")
      .addDropdown((dropdown) => {
        for (const platform of ["wechat", "toutiao"] as Platform[]) {
          const group = dropdown.selectEl.createEl("optgroup", {
            attr: { label: PLATFORM_LABELS[platform] },
          });
          for (const theme of themes.filter((item) => item.platform === platform)) {
            const option = document.createElement("option");
            option.value = theme.id;
            option.textContent = theme.builtin ? theme.name : `${theme.name}（自定义）`;
            group.appendChild(option);
          }
        }
        dropdown.setValue(this.plugin.settings.defaultThemeId);
        dropdown.onChange(async (value) => {
          this.plugin.settings.defaultThemeId = value;
          const theme = this.plugin.getThemeById(value);
          if (theme) this.plugin.settings.lastThemeByPlatform[theme.platform] = value;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("复制时包含笔记标题")
      .setDesc("公众号和头条通常在发布后台单独填写标题，默认关闭。")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.includeTitle)
          .onChange(async (value) => {
            this.plugin.settings.includeTitle = value;
            await this.plugin.saveSettings();
          }),
      );

    let imageDesc: Setting;
    imageDesc = new Setting(containerEl)
      .setName("单张图片上限")
      .setDesc(`本地图片会转为 Base64 内嵌；当前上限 ${this.plugin.settings.maxImageMB} MB。`)
      .addSlider((slider) =>
        slider
          .setLimits(1, 30, 1)
          .setValue(this.plugin.settings.maxImageMB)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.maxImageMB = value;
            imageDesc.setDesc(`本地图片会转为 Base64 内嵌；当前上限 ${value} MB。`);
            await this.plugin.saveSettings();
          }),
      );

    containerEl.appendChild(
      el(
        "p",
        "sf-settings-note",
        "本地图片会内嵌为 Base64。多数平台编辑器不会自动上传这些图片；粘贴后若图片丢失，请在平台编辑器中重新插入。",
      ),
    );
  }

  private renderThemeLibrary(containerEl: HTMLElement): void {
    new Setting(containerEl).setName("样式库").setHeading();
    containerEl.appendChild(
      el("p", "sf-settings-description", "内置样式不可修改，可以复制为自定义样式后调整颜色、字体、间距和 CSS。"),
    );

    const themes = getAllThemes(this.plugin.settings.customThemes);
    const builtins = themes.filter((theme) => theme.builtin);
    const customs = this.plugin.settings.customThemes;

    new Setting(containerEl).setName("内置样式").setHeading();
    for (const theme of builtins) {
      const setting = new Setting(containerEl)
        .setName(theme.name)
        .setDesc(`${PLATFORM_LABELS[theme.platform]} · 内置`);
      setting.addButton((button) =>
        button.setButtonText("复制并编辑").onClick(() => {
          this.openEditor(this.plugin.newCustomThemeFrom(theme), true);
        }),
      );
    }

    new Setting(containerEl).setName("自定义样式").setHeading();
    if (!customs.length) {
      containerEl.appendChild(
        el("p", "sf-settings-note", "还没有自定义样式。可以从上面的内置样式复制，或新建一个。"),
      );
    }
    for (const theme of customs) {
      const setting = new Setting(containerEl)
        .setName(theme.name)
        .setDesc(`${PLATFORM_LABELS[theme.platform]} · 自定义`);
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
          .setWarning()
          .onClick(() => {
            new ConfirmModal(
              this.app,
              "删除自定义样式",
              `确定删除「${theme.name}」吗？此操作无法撤销。`,
              async () => {
                await this.plugin.deleteCustomTheme(theme.id);
                this.display();
              },
              "删除",
            ).open();
          }),
      );
    }

    const createRow = el("div", "sf-create-row");
    for (const platform of ["wechat", "toutiao"] as Platform[]) {
      const button = el(
        "button",
        "sf-button",
        `新建${platform === "wechat" ? "公众号" : "头条"}样式`,
      );
      button.type = "button";
      button.addEventListener("click", () => {
        const base = getDefaultThemeForPlatform(platform);
        const theme = this.plugin.newCustomThemeFrom(base);
        theme.name = platform === "wechat" ? "我的公众号样式" : "我的头条样式";
        this.openEditor(theme, true);
      });
      createRow.appendChild(button);
    }
    containerEl.appendChild(createRow);
  }

  private renderAbout(containerEl: HTMLElement): void {
    new Setting(containerEl).setName("关于").setHeading();
    const about = el("div", "sf-about");
    about.appendChild(
      el(
        "p",
        undefined,
        "复制时会读取预览中的最终计算样式，逐元素写入内联 style，因此自定义 CSS 也会被带进剪贴板。伪元素不会写入复制结果。",
      ),
    );
    const links = el("p", "sf-about-links");
    const wechat = el("a", undefined, "公众号样式参考文章");
    wechat.href = "https://mp.weixin.qq.com/s/y05u-hdREu2h5YPhzP1MPQ";
    wechat.target = "_blank";
    wechat.rel = "noopener noreferrer";
    const toutiao = el("a", undefined, "今日头条样式参考文章");
    toutiao.href = "https://www.toutiao.com/article/7697815646809227791/";
    toutiao.target = "_blank";
    toutiao.rel = "noopener noreferrer";
    links.append(wechat, el("span", undefined, " · "), toutiao);
    about.appendChild(links);
    containerEl.appendChild(about);
  }

  private openEditor(theme: SocialTheme, isNew: boolean): void {
    try {
      new ThemeEditorModal(this.app, this.plugin, theme, isNew, () => {
        this.display();
      }).open();
    } catch (error) {
      new Notice(`无法打开样式编辑器：${String(error)}`);
    }
  }
}
