import { describe, expect, it } from "vitest";
import {
  BUILTIN_THEMES,
  createCustomTheme,
  getDefaultThemeForPlatform,
  normalizeTokens,
  themeCss,
  themeRootClasses,
} from "../src/themes";

describe("themes", () => {
  it("ships two themes per platform", () => {
    expect(BUILTIN_THEMES.filter((theme) => theme.platform === "wechat")).toHaveLength(2);
    expect(BUILTIN_THEMES.filter((theme) => theme.platform === "toutiao")).toHaveLength(2);
  });

  it("creates a detached custom copy", () => {
    const base = getDefaultThemeForPlatform("wechat");
    const copy = createCustomTheme(base, "Mine");
    expect(copy.builtin).toBe(false);
    expect(copy.name).toBe("Mine");
    expect(copy.tokens).not.toBe(base.tokens);
    copy.tokens.accentColor = "#000000";
    expect(base.tokens.accentColor).not.toBe("#000000");
  });

  it("clamps invalid token values", () => {
    const base = getDefaultThemeForPlatform("toutiao");
    const tokens = normalizeTokens(
      {
        fontSize: Number.NaN,
        lineHeight: 99,
        letterSpacing: -2,
        accentColor: "not a color",
        headingStyle: "nonsense" as never,
      },
      base.tokens,
    );
    expect(tokens.fontSize).toBe(base.tokens.fontSize);
    expect(tokens.lineHeight).toBe(2.8);
    expect(tokens.letterSpacing).toBe(-0.05);
    expect(tokens.accentColor).toBe(base.tokens.accentColor);
    expect(tokens.headingStyle).toBe(base.tokens.headingStyle);
  });

  it("generates theme css and root classes", () => {
    const theme = getDefaultThemeForPlatform("wechat");
    const css = themeCss(theme);
    expect(css).toContain("--sf-accent:");
    expect(css).toContain(".sf-content p");
    expect(css).toContain(".sf-code-window");
    expect(css).toContain(".sf-code-dot");
    expect(css).toContain("#ff5f57");
    expect(themeRootClasses(theme)).toContain("sf-content");
    expect(themeRootClasses(theme)).toContain("sf-quote-bar");
  });
});
