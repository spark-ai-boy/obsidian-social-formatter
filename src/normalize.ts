import type { ImageAsset } from "./images";

export interface NormalizeResult {
  warnings: string[];
}

const UNSAFE_SELECTOR = [
  "script",
  "style",
  "link",
  "meta",
  "iframe",
  "object",
  "embed",
  "form",
  "textarea",
  "select",
  "button",
  "canvas",
  "svg",
  "video",
  "audio",
  ".copy-code-button",
  ".edit-block-button",
  ".heading-collapse-indicator",
  ".collapse-indicator",
  ".markdown-embed-link",
  ".file-embed",
  ".frontmatter",
  ".mod-frontmatter",
].join(",");

const ALLOWED_ATTRIBUTES = new Set([
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

function make<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const element = createEl(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function unwrap(element: Element): void {
  const parent = element.parentNode;
  if (!parent) return;
  while (element.firstChild) parent.insertBefore(element.firstChild, element);
  element.remove();
}

function isSfElement(element: Element): boolean {
  return Array.from(element.classList).some((name) => name.startsWith("sf-"));
}

function cleanClassName(element: Element): void {
  const keep = Array.from(element.classList).filter((name) => name.startsWith("sf-"));
  if (keep.length) {
    element.className = keep.join(" ");
  } else {
    element.removeAttribute("class");
  }
}

function cleanAttributes(element: Element): void {
  for (const attribute of Array.from(element.attributes)) {
    const name = attribute.name.toLowerCase();
    if (name === "class" || ALLOWED_ATTRIBUTES.has(name)) continue;
    element.removeAttribute(attribute.name);
  }
  if (element.tagName === "A") {
    const href = element.getAttribute("href") ?? "";
    if (!href || /^(javascript|data|file|app|obsidian):/i.test(href)) {
      element.removeAttribute("href");
    }
  }
}

function replaceWithText(element: Element, text: string): void {
  element.replaceWith(document.createTextNode(text));
}

function convertTaskCheckboxes(container: HTMLElement): void {
  for (const input of Array.from(container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'))) {
    const checked = input.checked || input.hasAttribute("checked");
    const marker = make("span", "sf-checkbox", checked ? "☑" : "☐");
    const parentItem = input.closest("li");
    if (parentItem) {
      parentItem.classList.add("sf-task-item");
      parentItem.parentElement?.classList.add("sf-task-list");
    }
    input.replaceWith(marker);
  }
}

function handleMathAndDiagrams(container: HTMLElement, warnings: string[]): void {
  const mathSelector = "mjx-container, .math, .katex, .katex-display, .MathJax";
  const mathNodes = Array.from(container.querySelectorAll(mathSelector)).filter(
    (element) => !element.parentElement?.closest(mathSelector),
  );
  if (mathNodes.length) {
    warnings.push("检测到公式，已转换为可复制的文本，平台编辑器中可能无法保持公式排版");
  }
  for (const element of mathNodes) {
    const tex =
      element.getAttribute("data-math") ||
      element.getAttribute("aria-label") ||
      element.textContent?.trim() ||
      "公式";
    element.replaceWith(make("code", "sf-math", tex));
  }

  const diagrams = Array.from(
    container.querySelectorAll(".mermaid, .block-language-mermaid, .excalidraw, .canvas"),
  );
  if (diagrams.length) {
    warnings.push("检测到 Mermaid / Excalidraw / Canvas 图表，已替换为文字占位符");
  }
  for (const element of diagrams) {
    element.replaceWith(make("span", "sf-math", "[图表]"));
  }
}

function handleCallouts(container: HTMLElement): void {
  for (const callout of Array.from(container.querySelectorAll(".callout"))) {
    if (!container.contains(callout)) continue;
    const type = (callout.getAttribute("data-callout") || "note")
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "");
    const titleInner = callout.querySelector(".callout-title-inner");
    const title = (titleInner?.textContent ?? "").trim() || "提示";
    const content = callout.querySelector(".callout-content");
    const box = make("div", `sf-callout sf-callout-${type || "note"}`);
    const titleNode = make("div", "sf-callout-title", title);
    const body = make("div", "sf-callout-body");
    if (content) {
      while (content.firstChild) body.appendChild(content.firstChild);
    } else {
      for (const child of Array.from(callout.children)) {
        if (child !== callout.querySelector(".callout-title")) {
          body.appendChild(child);
        }
      }
    }
    box.append(titleNode, body);
    callout.replaceWith(box);
  }
}

function macWindowBar(): HTMLElement {
  const bar = make("div", "sf-code-bar");
  for (const color of ["red", "yellow", "green"]) {
    const dot = make("span", `sf-code-dot sf-code-dot-${color}`);
    dot.setAttribute("aria-hidden", "true");
    bar.appendChild(dot);
  }
  return bar;
}

function handleCodeBlocks(container: HTMLElement): void {
  for (const pre of Array.from(container.querySelectorAll("pre"))) {
    if (!container.contains(pre)) continue;
    if (pre.parentElement?.classList.contains("sf-code-window")) continue;
    const code = pre.querySelector("code");
    const text = (code ?? pre).textContent ?? "";
    const nextPre = make("pre", "sf-code-block");
    const nextCode = make("code");
    nextCode.textContent = text.replace(/\n$/, "");
    nextPre.appendChild(nextCode);
    const window = make("div", "sf-code-window");
    window.append(macWindowBar(), nextPre);
    pre.replaceWith(window);
  }
}

function imageFigure(asset: ImageAsset): HTMLElement | null {
  if (!asset.src) return null;
  const image = make("img", "sf-image");
  image.src = asset.src;
  image.alt = asset.alt;
  if (asset.width) image.setAttribute("width", String(asset.width));

  const figure = make("figure", "sf-figure");
  figure.appendChild(image);
  if (asset.caption) {
    figure.appendChild(make("figcaption", undefined, asset.caption));
  }
  return figure;
}

function handleImages(
  container: HTMLElement,
  imageByToken: Map<string, ImageAsset>,
  warnings: string[],
): void {
  for (const image of Array.from(container.querySelectorAll("img"))) {
    if (!container.contains(image)) continue;
    const alt = image.getAttribute("alt") ?? "";
    const asset = imageByToken.get(alt);
    if (asset) {
      const figure = imageFigure(asset);
      if (!figure) {
        const missing = make("span", "sf-image-missing", `图片缺失：${asset.sourcePath}`);
        const parent = image.parentElement;
        if (
          parent?.tagName === "P" &&
          parent.querySelectorAll("img").length === 1 &&
          parent.textContent?.trim() === ""
        ) {
          parent.replaceWith(missing);
        } else {
          image.replaceWith(missing);
        }
        continue;
      }
      const parent = image.parentElement;
      const canUseFigure =
        parent?.tagName === "P" &&
        parent.querySelectorAll("img").length === 1 &&
        parent.textContent?.trim() === "" &&
        !parent.querySelector("a");
      if (canUseFigure && parent) {
        parent.replaceWith(figure);
      } else {
        const innerImage = figure.querySelector("img");
        if (innerImage) image.replaceWith(innerImage);
      }
      continue;
    }

    const src = image.getAttribute("src") || image.getAttribute("data-src") || "";
    if (!src || /^app:\/\//i.test(src)) {
      warnings.push(`无法读取图片地址：${src || "(空)"}`);
      image.replaceWith(make("span", "sf-image-missing", "图片无法内嵌"));
      continue;
    }
    image.classList.add("sf-image");
  }
}

function handleLinks(container: HTMLElement): void {
  for (const link of Array.from(container.querySelectorAll("a"))) {
    if (!container.contains(link)) continue;
    const href = link.getAttribute("href") ?? "";
    const text = link.textContent ?? "";
    const isTag = link.classList.contains("tag");
    if (isTag) {
      link.replaceWith(make("span", "sf-tag", text));
      continue;
    }
    const internal =
      link.classList.contains("internal-link") ||
      !href ||
      href.startsWith("#") ||
      /^(app|obsidian|file):/i.test(href) ||
      /^javascript:/i.test(href);
    if (internal) {
      unwrap(link);
      continue;
    }
    const anchor = make("a", "sf-link");
    anchor.setAttribute("href", href);
    while (link.firstChild) anchor.appendChild(link.firstChild);
    link.replaceWith(anchor);
  }
}

function handleTables(container: HTMLElement): void {
  for (const table of Array.from(container.querySelectorAll("table"))) {
    if (!container.contains(table)) continue;
    if (table.parentElement?.classList.contains("sf-table-wrap")) continue;
    table.className = "sf-table";
    for (const cell of Array.from(table.querySelectorAll("th, td"))) {
      const align =
        cell.getAttribute("align") ?? (cell as HTMLElement).style.textAlign;
      if (align === "center" || align === "right") {
        cell.classList.add(`sf-align-${align}`);
      }
    }
    const wrapper = make("div", "sf-table-wrap");
    table.replaceWith(wrapper);
    wrapper.appendChild(table);
  }
}

function handleRemainingEmbeds(container: HTMLElement, warnings: string[]): void {
  for (const embed of Array.from(
    container.querySelectorAll(".internal-embed, .markdown-embed, .media-embed, .image-embed"),
  )) {
    if (!container.contains(embed)) continue;
    if (embed.querySelector("img, figure, .sf-image-missing")) {
      unwrap(embed);
      continue;
    }
    const text = (embed.textContent ?? "").trim();
    if (text) {
      warnings.push(`嵌入内容未展开：${text.slice(0, 60)}`);
      replaceWithText(embed, text);
    } else {
      warnings.push("已移除无法转换的嵌入内容");
      embed.remove();
    }
  }
}

function unwrapUnsupported(container: HTMLElement): void {
  const unwrapTags = new Set([
    "DIV",
    "SPAN",
    "SECTION",
    "ARTICLE",
    "HEADER",
    "FOOTER",
    "ASIDE",
    "NAV",
    "MAIN",
    "DETAILS",
    "SUMMARY",
    "CENTER",
    "FONT",
    "PICTURE",
    "SOURCE",
    "LABEL",
    "FIELDSET",
  ]);
  for (const element of Array.from(container.querySelectorAll("*"))) {
    if (!container.contains(element)) continue;
    if (unwrapTags.has(element.tagName) && !isSfElement(element)) {
      unwrap(element);
    }
  }
}

function removeEmptyParagraphs(container: HTMLElement): void {
  for (const paragraph of Array.from(container.querySelectorAll("p"))) {
    if (!paragraph.textContent?.trim() && !paragraph.querySelector("img, br, hr, code")) {
      paragraph.remove();
    }
  }
}

function finalizeAttributes(container: HTMLElement): void {
  for (const element of Array.from(container.querySelectorAll("*"))) {
    cleanClassName(element);
    cleanAttributes(element);
  }
}

export function normalizeRenderedContent(
  container: HTMLElement,
  imageByToken: Map<string, ImageAsset>,
  initialWarnings: string[],
): NormalizeResult {
  const warnings = [...initialWarnings];

  const walker = container.ownerDocument.createTreeWalker(container, NodeFilter.SHOW_COMMENT);
  const comments: Comment[] = [];
  while (walker.nextNode()) comments.push(walker.currentNode as Comment);
  for (const comment of comments) comment.remove();

  convertTaskCheckboxes(container);
  handleMathAndDiagrams(container, warnings);

  for (const element of Array.from(container.querySelectorAll(UNSAFE_SELECTOR))) {
    if (!container.contains(element)) continue;
    if (element.matches("iframe, video, audio, object, embed")) {
      warnings.push(`${element.tagName.toLowerCase()} 媒体内容无法复制到社交平台，已移除`);
    }
    element.remove();
  }

  handleCallouts(container);
  handleCodeBlocks(container);
  handleImages(container, imageByToken, warnings);
  handleLinks(container);
  handleTables(container);
  handleRemainingEmbeds(container, warnings);

  const footnotes = container.querySelector(".footnotes");
  footnotes?.classList.add("sf-footnotes");

  for (const quote of Array.from(container.querySelectorAll("blockquote"))) {
    quote.classList.add("sf-quote");
  }

  unwrapUnsupported(container);
  removeEmptyParagraphs(container);
  finalizeAttributes(container);

  for (const table of Array.from(container.querySelectorAll("table"))) {
    table.classList.add("sf-table");
  }

  return { warnings: Array.from(new Set(warnings)) };
}
