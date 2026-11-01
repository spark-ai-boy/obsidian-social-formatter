import type {
  CodeStyle,
  HeadingStyle,
  Platform,
  QuoteStyle,
  SocialTheme,
  ThemeTokens,
} from "./types";
import {
  cloneTheme,
  cssNumber,
  safeCssColor,
  safeFontFamily,
} from "./utils";

const SANS_STACK =
  '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif';
const MONO_STACK =
  '"SFMono-Regular", "Operator Mono", Consolas, Monaco, Menlo, monospace';

const WECHAT_CLASSIC_TOKENS: ThemeTokens = {
  fontFamily:
    'Georgia, "Microsoft YaHei", "PingFang SC", "PingFangSC-light", serif',
  fontSize: 15,
  lineHeight: 1.8,
  letterSpacing: 0.08,
  paragraphGap: 16,
  contentWidth: 677,
  contentPaddingX: 10,
  contentPaddingY: 0,
  textAlign: "justify",
  textColor: "#333333",
  headingColor: "#000000",
  strongColor: "#000000",
  mutedColor: "#7a7a7a",
  accentColor: "#e46918",
  accentSoftColor: "#efefef",
  backgroundColor: "#ffffff",
  borderColor: "#e5e5e5",
  titleSize: 28,
  titleAlign: "center",
  h1Size: 24,
  h2Size: 22,
  h3Size: 18,
  headingWeight: 700,
  strongWeight: 700,
  headingStyle: "plain",
  quoteStyle: "bar",
  codeStyle: "dark",
  borderRadius: 5,
  imageRadius: 4,
};

const WECHAT_GREEN_TOKENS: ThemeTokens = {
  fontFamily: SANS_STACK,
  fontSize: 16,
  lineHeight: 1.8,
  letterSpacing: 0.03,
  paragraphGap: 18,
  contentWidth: 677,
  contentPaddingX: 12,
  contentPaddingY: 8,
  textAlign: "justify",
  textColor: "#3a3a3a",
  headingColor: "#111111",
  strongColor: "#111111",
  mutedColor: "#888888",
  accentColor: "#07c160",
  accentSoftColor: "#eaf9f1",
  backgroundColor: "#ffffff",
  borderColor: "#e8e8e8",
  titleSize: 30,
  titleAlign: "center",
  h1Size: 26,
  h2Size: 21,
  h3Size: 18,
  headingWeight: 600,
  strongWeight: 600,
  headingStyle: "pill",
  quoteStyle: "card",
  codeStyle: "dark",
  borderRadius: 10,
  imageRadius: 8,
};

const TOUTIAO_NEWS_TOKENS: ThemeTokens = {
  fontFamily: SANS_STACK,
  fontSize: 18,
  lineHeight: 1.72,
  letterSpacing: 0,
  paragraphGap: 12,
  contentWidth: 720,
  contentPaddingX: 20,
  contentPaddingY: 0,
  textAlign: "justify",
  textColor: "#222222",
  headingColor: "#222222",
  strongColor: "#222222",
  mutedColor: "#6f7073",
  accentColor: "#0062cc",
  accentSoftColor: "#f5f7fa",
  backgroundColor: "#ffffff",
  borderColor: "#e5e5e5",
  titleSize: 28,
  titleAlign: "left",
  h1Size: 24,
  h2Size: 21,
  h3Size: 19,
  headingWeight: 600,
  strongWeight: 600,
  headingStyle: "plain",
  quoteStyle: "bar",
  codeStyle: "light",
  borderRadius: 6,
  imageRadius: 6,
};

const TOUTIAO_MINIMAL_TOKENS: ThemeTokens = {
  fontFamily: SANS_STACK,
  fontSize: 17,
  lineHeight: 1.8,
  letterSpacing: 0.01,
  paragraphGap: 16,
  contentWidth: 720,
  contentPaddingX: 20,
  contentPaddingY: 8,
  textAlign: "left",
  textColor: "#1f2329",
  headingColor: "#000000",
  strongColor: "#000000",
  mutedColor: "#777777",
  accentColor: "#ff403a",
  accentSoftColor: "#fff0ef",
  backgroundColor: "#ffffff",
  borderColor: "#eeeeee",
  titleSize: 30,
  titleAlign: "left",
  h1Size: 24,
  h2Size: 21,
  h3Size: 18,
  headingWeight: 600,
  strongWeight: 600,
  headingStyle: "underline",
  quoteStyle: "card",
  codeStyle: "light",
  borderRadius: 8,
  imageRadius: 8,
};

export const BUILTIN_THEMES: SocialTheme[] = [
  {
    id: "wechat-classic",
    name: "公众号 · 经典",
    platform: "wechat",
    builtin: true,
    tokens: cloneTheme(WECHAT_CLASSIC_TOKENS),
    customCss: "",
  },
  {
    id: "wechat-green",
    name: "公众号 · 清新绿",
    platform: "wechat",
    builtin: true,
    tokens: cloneTheme(WECHAT_GREEN_TOKENS),
    customCss: "",
  },
  {
    id: "toutiao-news",
    name: "头条 · 资讯",
    platform: "toutiao",
    builtin: true,
    tokens: cloneTheme(TOUTIAO_NEWS_TOKENS),
    customCss: "",
  },
  {
    id: "toutiao-minimal",
    name: "头条 · 简约",
    platform: "toutiao",
    builtin: true,
    tokens: cloneTheme(TOUTIAO_MINIMAL_TOKENS),
    customCss: "",
  },
];

export function getBuiltinTheme(id: string): SocialTheme | undefined {
  return BUILTIN_THEMES.find((theme) => theme.id === id);
}

export function getAllThemes(customThemes: SocialTheme[]): SocialTheme[] {
  return [...BUILTIN_THEMES, ...customThemes];
}

export function getThemeById(
  id: string,
  customThemes: SocialTheme[],
): SocialTheme | undefined {
  return getAllThemes(customThemes).find((theme) => theme.id === id);
}

export function getDefaultThemeForPlatform(platform: Platform): SocialTheme {
  return BUILTIN_THEMES.find((theme) => theme.platform === platform) ?? BUILTIN_THEMES[0];
}

export function createCustomTheme(
  base: SocialTheme,
  name?: string,
): SocialTheme {
  const suffix = Math.random().toString(36).slice(2, 8);
  return {
    id: `custom-${Date.now().toString(36)}-${suffix}`,
    name: name ?? `${base.name} · 自定义`,
    platform: base.platform,
    builtin: false,
    tokens: cloneTheme(base.tokens),
    customCss: base.customCss,
  };
}

export function normalizeCustomTheme(input: unknown): SocialTheme | null {
  if (!input || typeof input !== "object") return null;
  const value = input as Partial<SocialTheme>;
  if (typeof value.id !== "string" || typeof value.name !== "string") return null;
  const platform: Platform = value.platform === "toutiao" ? "toutiao" : "wechat";
  const base = getDefaultThemeForPlatform(platform);
  const tokens = normalizeTokens(value.tokens, base.tokens);
  return {
    id: value.id,
    name: value.name.trim() || "未命名样式",
    platform,
    builtin: false,
    tokens,
    customCss: typeof value.customCss === "string" ? value.customCss : "",
  };
}

export function normalizeTokens(
  input: Partial<ThemeTokens> | undefined,
  fallback: ThemeTokens,
): ThemeTokens {
  const source = input ?? {};
  const headingStyles: HeadingStyle[] = ["plain", "bar", "underline", "pill"];
  const quoteStyles: QuoteStyle[] = ["bar", "card"];
  const codeStyles: CodeStyle[] = ["dark", "light"];
  return {
    fontFamily: safeFontFamily(source.fontFamily ?? "", fallback.fontFamily),
    fontSize: cssNumber(source.fontSize ?? fallback.fontSize, fallback.fontSize, 11, 28),
    lineHeight: cssNumber(source.lineHeight ?? fallback.lineHeight, fallback.lineHeight, 1.1, 2.8),
    letterSpacing: cssNumber(source.letterSpacing ?? fallback.letterSpacing, fallback.letterSpacing, -0.05, 0.3),
    paragraphGap: cssNumber(source.paragraphGap ?? fallback.paragraphGap, fallback.paragraphGap, 0, 48),
    contentWidth: cssNumber(source.contentWidth ?? fallback.contentWidth, fallback.contentWidth, 320, 900),
    contentPaddingX: cssNumber(source.contentPaddingX ?? fallback.contentPaddingX, fallback.contentPaddingX, 0, 64),
    contentPaddingY: cssNumber(source.contentPaddingY ?? fallback.contentPaddingY, fallback.contentPaddingY, 0, 64),
    textAlign: source.textAlign === "left" ? "left" : "justify",
    textColor: safeCssColor(source.textColor ?? "", fallback.textColor),
    headingColor: safeCssColor(source.headingColor ?? "", fallback.headingColor),
    strongColor: safeCssColor(source.strongColor ?? "", fallback.strongColor),
    mutedColor: safeCssColor(source.mutedColor ?? "", fallback.mutedColor),
    accentColor: safeCssColor(source.accentColor ?? "", fallback.accentColor),
    accentSoftColor: safeCssColor(source.accentSoftColor ?? "", fallback.accentSoftColor),
    backgroundColor: safeCssColor(source.backgroundColor ?? "", fallback.backgroundColor),
    borderColor: safeCssColor(source.borderColor ?? "", fallback.borderColor),
    titleSize: cssNumber(source.titleSize ?? fallback.titleSize, fallback.titleSize, 16, 44),
    titleAlign: source.titleAlign === "center" ? "center" : "left",
    h1Size: cssNumber(source.h1Size ?? fallback.h1Size, fallback.h1Size, 16, 40),
    h2Size: cssNumber(source.h2Size ?? fallback.h2Size, fallback.h2Size, 15, 36),
    h3Size: cssNumber(source.h3Size ?? fallback.h3Size, fallback.h3Size, 14, 32),
    headingWeight: cssNumber(source.headingWeight ?? fallback.headingWeight, fallback.headingWeight, 400, 800),
    strongWeight: cssNumber(source.strongWeight ?? fallback.strongWeight, fallback.strongWeight, 400, 800),
    headingStyle: headingStyles.includes(source.headingStyle as HeadingStyle)
      ? (source.headingStyle as HeadingStyle)
      : fallback.headingStyle,
    quoteStyle: quoteStyles.includes(source.quoteStyle as QuoteStyle)
      ? (source.quoteStyle as QuoteStyle)
      : fallback.quoteStyle,
    codeStyle: codeStyles.includes(source.codeStyle as CodeStyle)
      ? (source.codeStyle as CodeStyle)
      : fallback.codeStyle,
    borderRadius: cssNumber(source.borderRadius ?? fallback.borderRadius, fallback.borderRadius, 0, 24),
    imageRadius: cssNumber(source.imageRadius ?? fallback.imageRadius, fallback.imageRadius, 0, 32),
  };
}

function headingStyleCss(tokens: ThemeTokens): string {
  const common = `
.sf-content h1,
.sf-content h2,
.sf-content h3,
.sf-content h4,
.sf-content h5,
.sf-content h6 {
  color: var(--sf-heading);
  font-weight: var(--sf-heading-weight);
  line-height: 1.45;
  letter-spacing: -0.005em;
  text-align: left;
}
.sf-content h1 { font-size: var(--sf-h1-size); margin: 32px 0 16px; }
.sf-content h2 { font-size: var(--sf-h2-size); margin: 30px 0 14px; }
.sf-content h3 { font-size: var(--sf-h3-size); margin: 24px 0 12px; }
.sf-content h4,
.sf-content h5,
.sf-content h6 { font-size: 1em; margin: 20px 0 10px; }
`;

  switch (tokens.headingStyle) {
    case "bar":
      return `${common}
.sf-content h1,
.sf-content h2,
.sf-content h3 {
  border-left: 4px solid var(--sf-accent);
  padding-left: 12px;
}
.sf-content h4,
.sf-content h5,
.sf-content h6 {
  border-left: 3px solid var(--sf-accent);
  padding-left: 10px;
}`;
    case "underline":
      return `${common}
.sf-content h1,
.sf-content h2 {
  border-bottom: 2px solid var(--sf-accent);
  padding-bottom: 6px;
}
.sf-content h3 {
  border-bottom: 1px solid var(--sf-border);
  padding-bottom: 4px;
}`;
    case "pill":
      return `${common}
.sf-content h2,
.sf-content h3 {
  display: inline-block;
  color: var(--sf-accent);
  background: var(--sf-accent-soft);
  border-radius: 999px;
  padding: 5px 14px;
}
.sf-content h2 { margin: 28px 0 16px; }
.sf-content h3 { margin: 22px 0 12px; }`;
    case "plain":
    default:
      return common;
  }
}

function quoteStyleCss(tokens: ThemeTokens): string {
  const base = `
.sf-content blockquote {
  margin: 20px 0;
  padding: 14px 18px;
  border-radius: var(--sf-radius);
  color: var(--sf-muted);
}
.sf-content blockquote p {
  margin: 0 0 8px;
  color: inherit;
}
.sf-content blockquote p:last-child { margin-bottom: 0; }
.sf-content blockquote blockquote { margin: 10px 0; }
`;
  if (tokens.quoteStyle === "card") {
    return `${base}
.sf-content blockquote {
  background: var(--sf-accent-soft);
  border: 1px solid var(--sf-border);
}`;
  }
  return `${base}
.sf-content blockquote {
  background: var(--sf-accent-soft);
  border-left: 3px solid var(--sf-accent);
}`;
}

function codeStyleCss(tokens: ThemeTokens): string {
  const dark = tokens.codeStyle === "dark";
  return `
.sf-content pre.sf-code-block {
  margin: 20px 0;
  padding: 16px;
  border-radius: var(--sf-radius);
  background: ${dark ? "#282c34" : "#fafafa"};
  color: ${dark ? "#abb2bf" : "#24292f"};
  border: ${dark ? "0" : "1px solid var(--sf-border)"};
  box-shadow: ${dark ? "0 2px 10px rgba(0, 0, 0, 0.28)" : "none"};
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
  font-family: ${MONO_STACK};
  font-size: 0.82em;
  line-height: 1.65;
  text-align: left;
  -webkit-overflow-scrolling: touch;
}
.sf-content pre.sf-code-block code {
  display: block;
  padding: 0;
  margin: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  line-height: inherit;
  white-space: inherit;
  word-break: inherit;
}
`;
}

export function themeRootClasses(theme: SocialTheme): string {
  return `sf-content sf-quote-${theme.tokens.quoteStyle} sf-code-${theme.tokens.codeStyle}`;
}

export function themeCss(theme: SocialTheme): string {
  const tokens = theme.tokens;
  const headingStyle = headingStyleCss(tokens);
  const quoteStyle = quoteStyleCss(tokens);
  const codeStyle = codeStyleCss(tokens);

  return `
.sf-content {
  --sf-accent: ${tokens.accentColor};
  --sf-accent-soft: ${tokens.accentSoftColor};
  --sf-text: ${tokens.textColor};
  --sf-heading: ${tokens.headingColor};
  --sf-strong: ${tokens.strongColor};
  --sf-muted: ${tokens.mutedColor};
  --sf-bg: ${tokens.backgroundColor};
  --sf-border: ${tokens.borderColor};
  --sf-font: ${tokens.fontFamily};
  --sf-font-size: ${tokens.fontSize}px;
  --sf-line-height: ${tokens.lineHeight};
  --sf-letter-spacing: ${tokens.letterSpacing}em;
  --sf-paragraph-gap: ${tokens.paragraphGap}px;
  --sf-content-width: ${tokens.contentWidth}px;
  --sf-heading-weight: ${tokens.headingWeight};
  --sf-strong-weight: ${tokens.strongWeight};
  --sf-h1-size: ${tokens.h1Size}px;
  --sf-h2-size: ${tokens.h2Size}px;
  --sf-h3-size: ${tokens.h3Size}px;
  --sf-radius: ${tokens.borderRadius}px;
  --sf-image-radius: ${tokens.imageRadius}px;
  box-sizing: border-box;
  width: 100%;
  max-width: var(--sf-content-width);
  margin: 0 auto;
  padding: ${tokens.contentPaddingY}px ${tokens.contentPaddingX}px;
  background: var(--sf-bg);
  color: var(--sf-text);
  font-family: var(--sf-font);
  font-size: var(--sf-font-size);
  line-height: var(--sf-line-height);
  letter-spacing: var(--sf-letter-spacing);
  text-align: ${tokens.textAlign};
  word-break: break-word;
  overflow-wrap: break-word;
  -webkit-font-smoothing: antialiased;
}
.sf-content * { box-sizing: border-box; }
.sf-content > :first-child { margin-top: 0 !important; }
.sf-content > :last-child { margin-bottom: 0 !important; }
.sf-content p {
  margin: 0 0 var(--sf-paragraph-gap);
  padding: 0;
  color: var(--sf-text);
  font-size: inherit;
  line-height: inherit;
  letter-spacing: inherit;
  text-align: inherit;
}
.sf-content p:empty { display: none; }
${headingStyle}
.sf-content .sf-title {
  color: var(--sf-heading);
  font-size: ${tokens.titleSize}px;
  font-weight: var(--sf-heading-weight);
  line-height: 1.35;
  letter-spacing: -0.01em;
  text-align: ${tokens.titleAlign};
  margin: 0 0 28px;
  padding: 0;
}
.sf-content strong,
.sf-content b {
  color: var(--sf-strong);
  font-weight: var(--sf-strong-weight);
}
.sf-content em,
.sf-content i { font-style: italic; }
.sf-content del,
.sf-content s,
.sf-content strike { text-decoration: line-through; }
.sf-content mark {
  color: inherit;
  background: var(--sf-accent-soft);
  border-radius: 2px;
  padding: 0 2px;
}
.sf-content .sf-tag {
  color: var(--sf-accent);
  font-weight: var(--sf-strong-weight);
}
.sf-content .sf-math {
  font-family: ${MONO_STACK};
  font-size: 0.9em;
  color: var(--sf-accent);
  background: var(--sf-accent-soft);
  border-radius: 4px;
  padding: 2px 5px;
  word-break: break-all;
}
.sf-content a {
  color: var(--sf-accent);
  text-decoration: underline;
  text-underline-offset: 2px;
  word-break: break-all;
}
.sf-content ul,
.sf-content ol {
  margin: 0 0 var(--sf-paragraph-gap);
  padding-left: 1.55em;
}
.sf-content ul { list-style: disc; }
.sf-content ol { list-style: decimal; }
.sf-content li {
  margin: 0 0 0.35em;
  padding-left: 0.1em;
  color: var(--sf-text);
}
.sf-content li > p { margin: 0 0 0.35em; }
.sf-content li > p:last-child { margin-bottom: 0; }
.sf-content li > ul,
.sf-content li > ol { margin-top: 0.35em; margin-bottom: 0; }
.sf-content .sf-task-list {
  list-style: none;
  padding-left: 0;
}
.sf-content .sf-task-item { list-style: none; }
.sf-content .sf-checkbox {
  display: inline-block;
  color: var(--sf-accent);
  font-weight: var(--sf-strong-weight);
  margin-right: 0.35em;
}
.sf-content code {
  font-family: ${MONO_STACK};
  font-size: 0.9em;
  color: var(--sf-accent);
  background: var(--sf-accent-soft);
  border-radius: 4px;
  padding: 2px 5px;
  word-break: break-all;
}
${codeStyle}
${quoteStyle}
.sf-content hr {
  border: 0;
  border-top: 1px solid var(--sf-border);
  margin: 26px 0;
  height: 0;
  background: transparent;
}
.sf-content img,
.sf-content video {
  display: block;
  max-width: 100%;
  height: auto;
  margin: 18px auto;
  border-radius: var(--sf-image-radius);
}
.sf-content figure {
  margin: 20px 0;
  padding: 0;
  text-align: center;
}
.sf-content figure img { margin: 0 auto; }
.sf-content figcaption {
  margin-top: 8px;
  color: var(--sf-muted);
  font-size: 0.82em;
  line-height: 1.6;
  text-align: center;
}
.sf-content table {
  width: 100%;
  margin: 20px 0;
  border-collapse: collapse;
  border-spacing: 0;
  font-size: 0.92em;
  line-height: 1.6;
  table-layout: auto;
}
.sf-content th,
.sf-content td {
  border: 1px solid var(--sf-border);
  padding: 8px 10px;
  text-align: left;
  vertical-align: top;
}
.sf-content th {
  background: var(--sf-accent-soft);
  color: var(--sf-heading);
  font-weight: var(--sf-strong-weight);
}
.sf-content .sf-align-center { text-align: center; }
.sf-content .sf-align-right { text-align: right; }
.sf-content .sf-table-wrap {
  width: 100%;
  overflow-x: auto;
  margin: 20px 0;
}
.sf-content .sf-table-wrap table { margin: 0; }
.sf-content .sf-callout {
  margin: 20px 0;
  padding: 14px 16px;
  background: var(--sf-accent-soft);
  border-left: 3px solid var(--sf-accent);
  border-radius: var(--sf-radius);
  color: var(--sf-text);
}
.sf-content .sf-callout-title {
  color: var(--sf-accent);
  font-weight: var(--sf-strong-weight);
  line-height: 1.5;
  margin: 0 0 6px;
}
.sf-content .sf-callout-body > :last-child { margin-bottom: 0; }
.sf-content .sf-callout-warning { background: #fff8e6; border-left-color: #f59e0b; }
.sf-content .sf-callout-warning .sf-callout-title { color: #b45309; }
.sf-content .sf-callout-danger,
.sf-content .sf-callout-failure,
.sf-content .sf-callout-bug { background: #fff1f0; border-left-color: #ef4444; }
.sf-content .sf-callout-danger .sf-callout-title,
.sf-content .sf-callout-failure .sf-callout-title,
.sf-content .sf-callout-bug .sf-callout-title { color: #b91c1c; }
.sf-content .sf-callout-success,
.sf-content .sf-callout-tip { background: #eefbf3; border-left-color: #22c55e; }
.sf-content .sf-callout-success .sf-callout-title,
.sf-content .sf-callout-tip .sf-callout-title { color: #15803d; }
.sf-content .sf-callout-quote { background: var(--sf-accent-soft); border-left-color: var(--sf-muted); }
.sf-content .sf-callout-quote .sf-callout-title { color: var(--sf-muted); }
.sf-content .sf-footnotes {
  margin-top: 28px;
  padding-top: 14px;
  border-top: 1px solid var(--sf-border);
  color: var(--sf-muted);
  font-size: 0.85em;
}
.sf-content .sf-footnotes h4 { color: var(--sf-muted); font-size: 1em; }
.sf-content .sf-image-missing {
  display: block;
  margin: 16px 0;
  padding: 12px;
  border: 1px dashed var(--sf-border);
  border-radius: var(--sf-radius);
  color: var(--sf-muted);
  font-size: 0.85em;
  text-align: center;
}
${theme.customCss ?? ""}
`;
}

export const SAMPLE_HTML = `
<h1 class="sf-title">把 Obsidian 笔记发布到更多地方</h1>
<p>这是一段正文示例，用来展示字号、行高、颜色和段间距。你可以在这里放入<strong>重点内容</strong>、<a href="https://example.com">站外链接</a>，以及行内代码 <code>npm run build</code>。</p>
<h2>二级标题</h2>
<p>写作时专注于 Markdown，发布前再选择平台样式。正文会转换成内联样式，复制后可以直接粘贴到编辑器里。</p>
<blockquote><p>好的排版不喧宾夺主，它只是让内容更容易被读完。</p></blockquote>
<h3>三级标题</h3>
<ul><li>支持列表、引用、代码块与表格</li><li>支持自定义颜色、字体与间距</li></ul>
<pre class="sf-code-block"><code>const theme = "wechat-classic";
await copyRichHtml(theme);</code></pre>
<figure><img alt="示例图片" src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2MDAiIGhlaWdodD0iMjAwIj48cmVjdCB3aWR0aD0iNjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2YyZjRmNyIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIyNCIgZmlsbD0iIzg4OCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSI+56S65L6L5Zu+54mHPC90ZXh0Pjwvc3ZnPg==" /></figure>
<p>最后一段，检查段落下边距和整体阅读节奏。</p>
`;
