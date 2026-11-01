export type Platform = "wechat" | "toutiao";

export type TextAlign = "left" | "justify";
export type TitleAlign = "left" | "center";
export type HeadingStyle = "plain" | "bar" | "underline" | "pill";
export type QuoteStyle = "bar" | "card";
export type CodeStyle = "dark" | "light";

export interface ThemeTokens {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  paragraphGap: number;
  contentWidth: number;
  contentPaddingX: number;
  contentPaddingY: number;
  textAlign: TextAlign;
  textColor: string;
  headingColor: string;
  strongColor: string;
  mutedColor: string;
  accentColor: string;
  accentSoftColor: string;
  backgroundColor: string;
  borderColor: string;
  titleSize: number;
  titleAlign: TitleAlign;
  h1Size: number;
  h2Size: number;
  h3Size: number;
  headingWeight: number;
  strongWeight: number;
  headingStyle: HeadingStyle;
  quoteStyle: QuoteStyle;
  codeStyle: CodeStyle;
  borderRadius: number;
  imageRadius: number;
}

export interface SocialTheme {
  id: string;
  name: string;
  platform: Platform;
  builtin: boolean;
  tokens: ThemeTokens;
  customCss: string;
}

export interface FormatterSettings {
  defaultThemeId: string;
  lastThemeByPlatform: Partial<Record<Platform, string>>;
  includeTitle: boolean;
  maxImageMB: number;
  customThemes: SocialTheme[];
}

export interface RenderOptions {
  includeTitle: boolean;
  maxImageBytes: number;
}

export interface RenderResult {
  plainText: string;
  warnings: string[];
  imageCount: number;
  localImageCount: number;
}

export interface CopyResult {
  mode: "rich" | "plain";
  htmlLength: number;
}

export const PLATFORM_LABELS: Record<Platform, string> = {
  wechat: "微信公众号",
  toutiao: "今日头条",
};

export const PLATFORM_SHORT_LABELS: Record<Platform, string> = {
  wechat: "公众号",
  toutiao: "头条",
};
