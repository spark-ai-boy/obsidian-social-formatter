import { App, Modal, Notice } from "obsidian";
import type SocialFormatterPlugin from "../main";
import {
  getDefaultThemeForPlatform,
  normalizeTokens,
  SAMPLE_HTML,
  themeCss,
  themeRootClasses,
} from "../themes";
import type { SocialTheme, ThemeTokens } from "../types";
import { cloneTheme, cssNumber } from "../utils";
import { ConfirmModal } from "./ConfirmModal";
import { el, labeledField, sectionTitle } from "./dom";

const PREVIEW_RESET = `
:host { display: block; }
.sf-content { box-sizing: border-box; }
.sf-content * { box-sizing: border-box; }
`;

type ThemeKey = keyof ThemeTokens;

interface FieldOptions {
  hint?: string;
  suffix?: string;
}

export class ThemeEditorModal extends Modal {
  private readonly plugin: SocialFormatterPlugin;
  private theme: SocialTheme;
  private readonly isNew: boolean;
  private readonly onSaved: (theme: SocialTheme) => void;
  private formEl!: HTMLElement;
  private previewHost!: HTMLElement;
  private nameInput!: HTMLInputElement;
  private cssInput!: HTMLTextAreaElement;
  private saveButton!: HTMLButtonElement;
  private previewFrame: number | undefined;

  constructor(
    app: App,
    plugin: SocialFormatterPlugin,
    theme: SocialTheme,
    isNew: boolean,
    onSaved: (theme: SocialTheme) => void,
  ) {
    super(app);
    this.plugin = plugin;
    this.theme = cloneTheme(theme);
    this.theme.builtin = false;
    this.isNew = isNew;
    this.onSaved = onSaved;
  }

  onOpen(): void {
    this.modalEl.classList.add("sf-editor-modal");
    this.contentEl.classList.add("sf-editor-content");
    this.contentEl.empty();

    const header = el("div", "sf-editor-header");
    const titleWrap = el("div");
    titleWrap.appendChild(el("h2", undefined, this.isNew ? "新建自定义样式" : "编辑自定义样式"));
    titleWrap.appendChild(
      el(
        "p",
        "sf-muted",
        "所有样式都会在复制时展开为内联样式，平台编辑器无需加载 CSS。",
      ),
    );
    header.appendChild(titleWrap);
    this.contentEl.appendChild(header);

    const layout = el("div", "sf-editor-layout");
    this.formEl = el("div", "sf-editor-form");
    layout.appendChild(this.formEl);

    const previewPane = el("aside", "sf-editor-preview");
    const previewHeader = el("div", "sf-preview-label");
    previewHeader.appendChild(el("span", undefined, "实时预览"));
    previewHeader.appendChild(el("span", "sf-badge", "样例内容"));
    previewPane.appendChild(previewHeader);
    const paper = el("div", "sf-theme-preview-paper");
    this.previewHost = el("div", "sf-theme-preview-host");
    paper.appendChild(this.previewHost);
    previewPane.appendChild(paper);
    previewPane.appendChild(
      el(
        "p",
        "sf-preview-note",
        "预览与复制使用同一套样式；伪元素（::before/::after）不会写入复制结果。",
      ),
    );
    layout.appendChild(previewPane);
    this.contentEl.appendChild(layout);

    const footer = el("div", "sf-editor-footer");
    const cancel = el("button", "sf-button", "取消");
    cancel.type = "button";
    cancel.addEventListener("click", () => this.close());
    const reset = el("button", "sf-button", "恢复平台默认值");
    reset.type = "button";
    reset.addEventListener("click", () => this.resetToPlatformDefaults());
    this.saveButton = el("button", "sf-button sf-button-primary", "保存样式");
    this.saveButton.type = "button";
    this.saveButton.addEventListener("click", () => void this.save());
    footer.append(cancel, reset, el("span", "sf-footer-spacer"), this.saveButton);
    this.contentEl.appendChild(footer);

    this.buildForm();
    this.scope.register(["Mod"], "Enter", () => {
      void this.save();
      return false;
    });
    this.schedulePreview();
  }

  onClose(): void {
    if (this.previewFrame !== undefined) cancelAnimationFrame(this.previewFrame);
    this.contentEl.empty();
  }

  private buildForm(): void {
    this.formEl.empty();

    const basics = el("section", "sf-editor-section");
    sectionTitle(basics, "基本信息");
    this.nameInput = el("input", "sf-text-input");
    this.nameInput.type = "text";
    this.nameInput.value = this.theme.name;
    this.nameInput.placeholder = "例如：我的公众号风格";
    this.nameInput.addEventListener("input", () => {
      this.theme.name = this.nameInput.value;
      this.nameInput.classList.remove("is-invalid");
    });
    labeledField(basics, "样式名称", this.nameInput);

    const platform = el("select", "sf-select");
    platform.createEl("option", { value: "wechat", text: "微信公众号" });
    platform.createEl("option", { value: "toutiao", text: "今日头条" });
    platform.value = this.theme.platform;
    platform.addEventListener("change", () => {
      this.theme.platform = platform.value === "toutiao" ? "toutiao" : "wechat";
      this.schedulePreview();
    });
    labeledField(
      basics,
      "所属平台",
      platform,
      "平台只用于分组和默认宽度，不会重置当前样式。",
    );
    this.formEl.appendChild(basics);

    const colors = el("section", "sf-editor-section");
    sectionTitle(colors, "颜色");
    const colorGrid = el("div", "sf-field-grid");
    this.addColorField(colorGrid, "强调色", "accentColor");
    this.addColorField(colorGrid, "强调色浅底", "accentSoftColor");
    this.addColorField(colorGrid, "正文颜色", "textColor");
    this.addColorField(colorGrid, "标题颜色", "headingColor");
    this.addColorField(colorGrid, "加粗颜色", "strongColor");
    this.addColorField(colorGrid, "次要文字", "mutedColor");
    this.addColorField(colorGrid, "背景颜色", "backgroundColor");
    this.addColorField(colorGrid, "边框颜色", "borderColor");
    colors.appendChild(colorGrid);
    this.formEl.appendChild(colors);

    const typography = el("section", "sf-editor-section");
    sectionTitle(typography, "正文排版");
    const typeGrid = el("div", "sf-field-grid");
    const fontFamily = el("input", "sf-text-input");
    fontFamily.type = "text";
    fontFamily.value = this.theme.tokens.fontFamily;
    fontFamily.addEventListener("input", () => {
      this.setToken("fontFamily", fontFamily.value);
    });
    labeledField(typeGrid, "字体", fontFamily, "可填写系统字体或字体栈。");

    this.addNumberField(typeGrid, "正文字号", "fontSize", 11, 28, 0.5, { suffix: "px" });
    this.addNumberField(typeGrid, "行高", "lineHeight", 1.1, 2.8, 0.01, { suffix: "倍" });
    this.addNumberField(typeGrid, "字间距", "letterSpacing", -0.05, 0.3, 0.01, { suffix: "em" });
    this.addNumberField(typeGrid, "段落间距", "paragraphGap", 0, 48, 1, { suffix: "px" });
    this.addNumberField(typeGrid, "内容宽度", "contentWidth", 320, 900, 1, { suffix: "px" });
    this.addNumberField(typeGrid, "左右留白", "contentPaddingX", 0, 64, 1, { suffix: "px" });
    this.addNumberField(typeGrid, "上下留白", "contentPaddingY", 0, 64, 1, { suffix: "px" });
    this.addSelectField(typeGrid, "正文对齐", "textAlign", [
      ["justify", "两端对齐"],
      ["left", "左对齐"],
    ]);
    typography.appendChild(typeGrid);
    this.formEl.appendChild(typography);

    const headings = el("section", "sf-editor-section");
    sectionTitle(headings, "标题");
    const headingGrid = el("div", "sf-field-grid");
    this.addSelectField(headingGrid, "标题装饰", "headingStyle", [
      ["plain", "无装饰"],
      ["bar", "左侧色条"],
      ["underline", "下划线"],
      ["pill", "胶囊底色"],
    ]);
    this.addNumberField(headingGrid, "标题字号", "titleSize", 16, 44, 1, { suffix: "px" });
    this.addSelectField(headingGrid, "标题对齐", "titleAlign", [
      ["center", "居中"],
      ["left", "左对齐"],
    ]);
    this.addNumberField(headingGrid, "H1 字号", "h1Size", 16, 40, 1, { suffix: "px" });
    this.addNumberField(headingGrid, "H2 字号", "h2Size", 15, 36, 1, { suffix: "px" });
    this.addNumberField(headingGrid, "H3 字号", "h3Size", 14, 32, 1, { suffix: "px" });
    this.addSelectField(headingGrid, "标题字重", "headingWeight", [
      ["500", "中等 500"],
      ["600", "半粗 600"],
      ["700", "加粗 700"],
      ["800", "特粗 800"],
    ]);
    this.addSelectField(headingGrid, "加粗字重", "strongWeight", [
      ["500", "中等 500"],
      ["600", "半粗 600"],
      ["700", "加粗 700"],
      ["800", "特粗 800"],
    ]);
    headings.appendChild(headingGrid);
    this.formEl.appendChild(headings);

    const blocks = el("section", "sf-editor-section");
    sectionTitle(blocks, "区块样式");
    const blockGrid = el("div", "sf-field-grid");
    this.addSelectField(blockGrid, "引用样式", "quoteStyle", [
      ["bar", "左侧色条"],
      ["card", "卡片"],
    ]);
    this.addSelectField(blockGrid, "代码主题", "codeStyle", [
      ["dark", "深色"],
      ["light", "浅色"],
    ]);
    this.addNumberField(blockGrid, "圆角", "borderRadius", 0, 24, 1, { suffix: "px" });
    this.addNumberField(blockGrid, "图片圆角", "imageRadius", 0, 32, 1, { suffix: "px" });
    blocks.appendChild(blockGrid);
    this.formEl.appendChild(blocks);

    const advanced = el("section", "sf-editor-section");
    sectionTitle(
      advanced,
      "自定义 CSS",
      "作用域自动限制在当前预览内，可直接覆盖标签和 .sf-* 类；支持主题变量。",
    );
    const variables = el(
      "div",
      "sf-css-vars",
      "--sf-accent, --sf-accent-soft, --sf-text, --sf-heading, --sf-strong, --sf-muted, --sf-bg, --sf-border, --sf-font, --sf-font-size, --sf-line-height, --sf-letter-spacing, --sf-paragraph-gap, --sf-content-width, --sf-heading-weight, --sf-strong-weight, --sf-h1-size, --sf-h2-size, --sf-h3-size, --sf-radius, --sf-image-radius",
    );
    advanced.appendChild(variables);
    this.cssInput = el("textarea", "sf-code-input");
    this.cssInput.spellcheck = false;
    this.cssInput.value = this.theme.customCss;
    this.cssInput.placeholder = `.sf-content h2 {
  letter-spacing: 0.02em;
}
.sf-content a {
  border-bottom: 1px solid currentColor;
}`;
    this.cssInput.addEventListener("input", () => {
      this.theme.customCss = this.cssInput.value;
      this.schedulePreview();
    });
    advanced.appendChild(this.cssInput);
    this.formEl.appendChild(advanced);
  }

  private addColorField(parent: HTMLElement, label: string, key: ThemeKey): void {
    const wrapper = el("div", "sf-color-control");
    const color = el("input", "sf-color-input-native");
    color.type = "color";
    const text = el("input", "sf-text-input sf-color-text");
    text.type = "text";
    const current = String(this.theme.tokens[key]);
    color.value = /^#[0-9a-f]{6}$/i.test(current) ? current : "#000000";
    text.value = current;

    const apply = (value: string): void => {
      if (!/^(#[0-9a-f]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\)|[a-z]{3,24})$/i.test(value.trim())) {
        text.classList.add("is-invalid");
        return;
      }
      this.setToken(key, value.trim() as never);
      text.value = value.trim();
      if (/^#[0-9a-f]{6}$/i.test(value.trim())) color.value = value.trim();
      text.classList.remove("is-invalid");
    };

    color.addEventListener("input", () => apply(color.value));
    text.addEventListener("input", () => apply(text.value));
    text.addEventListener("blur", () => {
      const fallback = String(this.theme.tokens[key]);
      text.value = fallback;
      text.classList.remove("is-invalid");
    });

    wrapper.append(color, text);
    labeledField(parent, label, wrapper);
  }

  private addNumberField(
    parent: HTMLElement,
    label: string,
    key: ThemeKey,
    min: number,
    max: number,
    step: number,
    options: FieldOptions = {},
  ): void {
    const wrapper = el("div", "sf-number-control");
    const input = el("input", "sf-text-input");
    input.type = "number";
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(this.theme.tokens[key]);
    input.addEventListener("input", () => {
      if (input.value === "") return;
      const value = Number(input.value);
      if (Number.isFinite(value)) {
        this.setToken(key, cssNumber(value, min, min, max) as never);
      }
    });
    input.addEventListener("blur", () => {
      const value = cssNumber(Number(input.value), min, min, max);
      this.setToken(key, value as never);
      input.value = String(value);
    });
    wrapper.appendChild(input);
    if (options.suffix) wrapper.appendChild(el("span", "sf-suffix", options.suffix));
    labeledField(parent, label, wrapper, options.hint);
  }

  private addSelectField(
    parent: HTMLElement,
    label: string,
    key: ThemeKey,
    options: Array<[string, string]>,
  ): void {
    const select = el("select", "sf-select");
    for (const [value, text] of options) {
      select.createEl("option", { value, text });
    }
    select.value = String(this.theme.tokens[key]);
    select.addEventListener("change", () => {
      const numeric = key === "headingWeight" || key === "strongWeight";
      this.setToken(key, (numeric ? Number(select.value) : select.value) as never);
    });
    labeledField(parent, label, select);
  }

  private setToken(key: ThemeKey, value: ThemeTokens[ThemeKey]): void {
    (this.theme.tokens as unknown as Record<string, unknown>)[key] = value;
    this.schedulePreview();
  }

  private schedulePreview(): void {
    if (this.previewFrame !== undefined) cancelAnimationFrame(this.previewFrame);
    this.previewFrame = requestAnimationFrame(() => {
      this.previewFrame = undefined;
      this.renderPreview();
    });
  }

  private renderPreview(): void {
    if (!this.previewHost.isConnected) return;
    const shadow = this.previewHost.shadowRoot ?? this.previewHost.attachShadow({ mode: "open" });
    shadow.replaceChildren();
    const style = document.createElement("style");
    style.textContent = `${PREVIEW_RESET}\n${themeCss(this.theme)}`;
    const content = document.createElement("section");
    content.className = themeRootClasses(this.theme);
    const parsed = new DOMParser().parseFromString(SAMPLE_HTML, "text/html");
    content.replaceChildren(...Array.from(parsed.body.childNodes));
    shadow.append(style, content);
  }

  private resetToPlatformDefaults(): void {
    const apply = (): void => {
      const base = getDefaultThemeForPlatform(this.theme.platform);
      this.theme.tokens = cloneTheme(base.tokens);
      this.theme.customCss = "";
      this.buildForm();
      this.schedulePreview();
      new Notice("已恢复平台默认值，保存后生效");
    };
    if (this.isNew) {
      apply();
      return;
    }
    new ConfirmModal(
      this.app,
      "恢复平台默认值？",
      "当前样式的大部分设置会被重置，保存后才会写入。",
      apply,
      "恢复",
    ).open();
  }

  private async save(): Promise<void> {
    const name = this.nameInput.value.trim();
    if (!name) {
      this.nameInput.classList.add("is-invalid");
      this.nameInput.focus();
      new Notice("请先填写样式名称");
      return;
    }
    const base = getDefaultThemeForPlatform(this.theme.platform);
    this.theme.name = name;
    this.theme.tokens = normalizeTokens(this.theme.tokens, base.tokens);
    this.theme.customCss = this.cssInput.value;
    this.theme.builtin = false;
    this.saveButton.disabled = true;
    try {
      await this.plugin.saveCustomTheme(this.theme);
      this.onSaved(this.theme);
      new Notice(this.isNew ? "自定义样式已创建" : "自定义样式已保存");
      this.close();
    } catch (error) {
      new Notice(`保存样式失败：${String(error)}`);
    } finally {
      this.saveButton.disabled = false;
    }
  }
}
