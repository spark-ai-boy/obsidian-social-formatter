import { App, Component, MarkdownRenderer, TFile } from "obsidian";
import { copyRichHtml } from "./clipboard";
import { prepareMarkdown } from "./markdown";
import { normalizeRenderedContent } from "./normalize";
import { themeCss, themeRootClasses } from "./themes";
import { adoptShadowStyles } from "./shadow";
import type {
  CopyResult,
  RenderOptions,
  RenderResult,
  SocialTheme,
} from "./types";

const RESET_CSS = `
:host { display: block; }
.sf-content { box-sizing: border-box; }
.sf-content * { box-sizing: border-box; }
`;

const STYLE_PROPERTIES = [
  "display",
  "box-sizing",
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "font-variant",
  "line-height",
  "letter-spacing",
  "word-spacing",
  "text-align",
  "text-indent",
  "text-decoration-line",
  "text-decoration-color",
  "text-decoration-style",
  "text-underline-offset",
  "text-transform",
  "text-shadow",
  "white-space",
  "word-break",
  "overflow-wrap",
  "vertical-align",
  "color",
  "background-color",
  "background-image",
  "background-repeat",
  "background-size",
  "background-position",
  "background-clip",
  "-webkit-background-clip",
  "-webkit-text-fill-color",
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "border-top-width",
  "border-top-style",
  "border-top-color",
  "border-right-width",
  "border-right-style",
  "border-right-color",
  "border-bottom-width",
  "border-bottom-style",
  "border-bottom-color",
  "border-left-width",
  "border-left-style",
  "border-left-color",
  "border-top-left-radius",
  "border-top-right-radius",
  "border-bottom-right-radius",
  "border-bottom-left-radius",
  "box-shadow",
  "list-style-type",
  "list-style-position",
  "border-collapse",
  "border-spacing",
  "overflow-x",
  "opacity",
  "visibility",
  "max-width",
] as const;

const KEEP_ATTRIBUTES = new Set([
  "href",
  "src",
  "alt",
  "title",
  "width",
  "height",
  "colspan",
  "rowspan",
  "start",
  "type",
  "value",
]);

function normalizeCssValue(property: string, value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed === "none") {
    return property === "display" || property === "list-style-type" ? "none" : "";
  }
  if (trimmed === "normal" || trimmed === "auto") return "";
  if (property === "text-align") {
    if (trimmed === "start") return "left";
    if (trimmed === "end") return "right";
  }
  if (trimmed === "rgba(0, 0, 0, 0)" || trimmed === "transparent") return "";
  if (/^0(px|em|rem|%)?$/.test(trimmed) && !property.includes("color")) return "";
  if (property === "opacity" && trimmed === "1") return "";
  if (property === "visibility" && trimmed === "visible") return "";
  if (property === "overflow-x" && trimmed === "visible") return "";
  if (property === "vertical-align" && trimmed === "baseline") return "";
  if (property === "background-repeat" && trimmed === "repeat") return "";
  if (property === "background-position" && trimmed === "0% 0%") return "";
  if (
    (property === "background-clip" || property === "-webkit-background-clip") &&
    trimmed === "border-box"
  ) {
    return "";
  }
  if (property === "border-collapse" && trimmed === "separate") return "";
  if (property === "list-style-position" && trimmed === "outside") return "";
  if (property === "text-decoration-style" && trimmed === "solid") return "";
  return trimmed;
}

function collectComputedStyle(element: Element, root: boolean): string {
  const computed = window.getComputedStyle(element);
  const declarations: string[] = [];
  const tag = element.tagName;
  const isList = tag === "UL" || tag === "OL" || tag === "LI";
  const decorationLine = computed.getPropertyValue("text-decoration-line");
  for (const property of STYLE_PROPERTIES) {
    if (
      (property === "text-decoration-color" || property === "text-decoration-style") &&
      (!decorationLine || decorationLine === "none")
    ) {
      continue;
    }
    if (
      (property === "list-style-type" || property === "list-style-position") &&
      !isList
    ) {
      continue;
    }
    if (
      (property === "border-collapse" || property === "border-spacing") &&
      tag !== "TABLE"
    ) {
      continue;
    }
    if (property === "-webkit-text-fill-color") {
      const color = computed.getPropertyValue("color").trim();
      const fill = computed.getPropertyValue(property).trim();
      if (color === fill) continue;
    }
    if (property.startsWith("border-") && property.endsWith("-color")) {
      const width = computed.getPropertyValue(property.replace("-color", "-width"));
      if (width === "0px") continue;
    }
    const value = normalizeCssValue(property, computed.getPropertyValue(property));
    if (value) declarations.push(`${property}:${value}`);
  }

  if (root) {
    declarations.push("width:100%");
    declarations.push("margin-left:auto", "margin-right:auto");
  }
  if (tag === "IMG") {
    declarations.push("max-width:100%", "height:auto", "display:block");
    declarations.push("margin-left:auto", "margin-right:auto");
  }
  if (tag === "TABLE") declarations.push("width:100%");
  if (tag === "A" && !element.getAttribute("href")) declarations.push("text-decoration:none");
  if (element.classList.contains("sf-code-bar")) {
    declarations.push("line-height:0", "font-size:0");
  }
  if (element.classList.contains("sf-code-dot")) {
    const width = computed.getPropertyValue("width");
    const height = computed.getPropertyValue("height");
    if (width) declarations.push(`width:${width}`);
    if (height) declarations.push(`height:${height}`);
  }

  return Array.from(new Set(declarations)).join(";");
}

function copyAttributes(original: Element, clone: Element): void {
  for (const attribute of Array.from(clone.attributes)) {
    const name = attribute.name.toLowerCase();
    if (name === "style") continue;
    if (!KEEP_ATTRIBUTES.has(name)) {
      clone.removeAttribute(attribute.name);
    }
  }
  if (clone.tagName === "IMG") {
    const src = original.getAttribute("src");
    if (src) clone.setAttribute("src", src);
    const alt = original.getAttribute("alt");
    if (alt) clone.setAttribute("alt", alt);
  }
  if (clone.tagName === "A") {
    const href = original.getAttribute("href");
    if (href) clone.setAttribute("href", href);
    else clone.removeAttribute("href");
  }
}

export function inlineStyledHtml(root: HTMLElement): string {
  const cloneRoot = root.cloneNode(true) as HTMLElement;
  const originals = [root, ...Array.from(root.querySelectorAll("*"))];
  const clones = [cloneRoot, ...Array.from(cloneRoot.querySelectorAll("*"))];

  for (let i = 0; i < originals.length; i += 1) {
    const original = originals[i];
    const clone = clones[i];
    if (!original || !clone) continue;
    const style = collectComputedStyle(original, i === 0);
    copyAttributes(original, clone);
    if (style) clone.setAttribute("style", style);
    else clone.removeAttribute("style");
    clone.removeAttribute("class");
    clone.removeAttribute("id");
  }

  if (cloneRoot.tagName !== "SECTION") {
    const section = createEl("section");
    for (const attribute of Array.from(cloneRoot.attributes)) {
      section.setAttribute(attribute.name, attribute.value);
    }
    while (cloneRoot.firstChild) section.appendChild(cloneRoot.firstChild);
    return section.outerHTML;
  }
  // This is generated, sanitized clipboard HTML, not an app UI insertion.
  return cloneRoot.outerHTML;
}

export class SocialExporter {
  readonly host: HTMLElement;
  private readonly shadow: ShadowRoot;
  private readonly contentElement: HTMLElement;
  private readonly app: App;
  private readonly file: TFile;
  private readonly theme: SocialTheme;
  private readonly readMarkdown?: () => string | Promise<string>;
  private warnings: string[] = [];
  private rendered = false;

  constructor(
    app: App,
    file: TFile,
    theme: SocialTheme,
    readMarkdown?: () => string | Promise<string>,
  ) {
    this.app = app;
    this.file = file;
    this.theme = theme;
    this.readMarkdown = readMarkdown;
    this.host = createEl("div");
    this.host.className = "sf-render-host";
    this.shadow = this.host.attachShadow({ mode: "open" });
    this.contentElement = createEl("section");
    this.shadow.append(this.contentElement);
  }

  get element(): HTMLElement {
    return this.contentElement;
  }

  getWarnings(): string[] {
    return [...this.warnings];
  }

  async render(options: RenderOptions): Promise<RenderResult> {
    const markdown = this.readMarkdown
      ? await this.readMarkdown()
      : await this.app.vault.cachedRead(this.file);
    const prepared = await prepareMarkdown(this.app, this.file, markdown, options);
    const renderHost = createEl("div");
    const component = new Component();
    component.load();
    try {
      await MarkdownRenderer.render(
        this.app,
        prepared.markdown,
        renderHost,
        this.file.path,
        component,
      );
    } finally {
      component.unload();
    }

    const normalized = normalizeRenderedContent(
      renderHost,
      prepared.imageByToken,
      prepared.warnings,
    );

    if (options.includeTitle && prepared.title) {
      const firstHeading = renderHost.querySelector("h1");
      if (
        firstHeading &&
        (firstHeading.textContent ?? "").trim() === prepared.title.trim()
      ) {
        normalized.warnings.push("正文已有一级标题，复制标题后可能出现重复");
      }
      const title = createEl("h1");
      title.className = "sf-title";
      title.textContent = prepared.title;
      renderHost.prepend(title);
    }

    if (prepared.localImageCount > 0) {
      normalized.warnings.push(
        `已内嵌 ${prepared.localImageCount} 张本地图片（Base64）。若平台没有自动上传，请在编辑器中重新插入图片。`,
      );
    }

    adoptShadowStyles(this.shadow, `${RESET_CSS}\n${themeCss(this.theme)}`);
    this.contentElement.className = themeRootClasses(this.theme);
    // The normalized tree is already sanitized; move nodes instead of re-parsing HTML.
    this.contentElement.replaceChildren(...Array.from(renderHost.childNodes));
    this.warnings = Array.from(new Set(normalized.warnings));
    this.rendered = true;

    return {
      plainText: this.contentElement.innerText,
      warnings: this.getWarnings(),
      imageCount: prepared.imageCount,
      localImageCount: prepared.localImageCount,
    };
  }

  getCopyHtml(): string {
    if (!this.rendered) throw new Error("内容尚未渲染");
    return inlineStyledHtml(this.contentElement);
  }

  getPlainText(): string {
    return this.contentElement.innerText;
  }

  async copy(): Promise<CopyResult> {
    if (!this.rendered) throw new Error("内容尚未渲染");
    const html = this.getCopyHtml();
    const text = this.getPlainText();
    return copyRichHtml(html, text);
  }
}
