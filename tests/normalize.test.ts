import { describe, expect, it } from "vitest";
import { normalizeRenderedContent } from "../src/normalize";
import type { ImageAsset } from "../src/images";

function normalize(html: string, images = new Map<string, ImageAsset>()) {
  const container = document.createElement("div");
  container.innerHTML = html;
  const result = normalizeRenderedContent(container, images, []);
  return { container, warnings: result.warnings };
}

describe("normalizeRenderedContent", () => {
  it("converts task checkboxes and removes unsafe markup", () => {
    const { container } = normalize(
      '<ul class="contains-task-list"><li class="task-list-item"><input type="checkbox" checked> Done</li></ul><script>alert(1)</script>',
    );
    expect(container.querySelector("input")).toBeNull();
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector(".sf-checkbox")?.textContent).toBe("☑");
    expect(container.querySelector(".sf-task-list")).not.toBeNull();
  });

  it("unwraps internal links and keeps external links", () => {
    const { container } = normalize(
      '<p><a class="internal-link" href="app://x/y">内部链接</a> <a href="https://example.com">外部</a></p>',
    );
    expect(container.querySelector(".internal-link")).toBeNull();
    expect(container.textContent).toContain("内部链接");
    const link = container.querySelector("a.sf-link");
    expect(link?.getAttribute("href")).toBe("https://example.com");
    expect(link?.textContent).toBe("外部");
  });

  it("preserves formatting and images inside external links", () => {
    const token = "SFIMG_link_0";
    const images = new Map<string, ImageAsset>([
      [
        token,
        {
          token,
          src: "https://example.com/a.png",
          alt: "",
          local: false,
          sourcePath: "https://example.com/a.png",
        },
      ],
    ]);
    const { container } = normalize(
      `<p><a href="https://example.com"><img alt="${token}" src="data:image/gif;base64,R0lGOD"><strong>说明</strong></a></p>`,
      images,
    );
    const link = container.querySelector("a.sf-link");
    expect(link).not.toBeNull();
    expect(link?.querySelector("img")?.getAttribute("src")).toBe(
      "https://example.com/a.png",
    );
    expect(link?.querySelector("strong")?.textContent).toBe("说明");
  });

  it("converts callouts into portable markup", () => {
    const { container } = normalize(
      '<div class="callout" data-callout="warning"><div class="callout-title"><div class="callout-title-inner">注意</div></div><div class="callout-content"><p>内容</p></div></div>',
    );
    const callout = container.querySelector(".sf-callout-warning");
    expect(callout).not.toBeNull();
    expect(callout?.querySelector(".sf-callout-title")?.textContent).toBe("注意");
    expect(callout?.querySelector(".sf-callout-body")?.textContent).toContain("内容");
  });

  it("rebuilds code blocks without syntax classes", () => {
    const { container } = normalize(
      '<pre class="language-ts"><code><span class="token keyword">const</span> x = 1;</code></pre>',
    );
    const pre = container.querySelector("pre.sf-code-block");
    expect(pre?.querySelector("code")?.textContent).toBe("const x = 1;");
    expect(pre?.querySelector("span")).toBeNull();
    expect(container.querySelector(".sf-code-window")).not.toBeNull();
    expect(container.querySelectorAll(".sf-code-dot")).toHaveLength(3);
    expect(container.querySelector(".sf-code-dot-red")).not.toBeNull();
    expect(container.querySelector(".sf-code-dot-yellow")).not.toBeNull();
    expect(container.querySelector(".sf-code-dot-green")).not.toBeNull();
  });

  it("wraps tables and removes inline styles", () => {
    const { container } = normalize(
      '<table style="width:10px"><tbody><tr><th align="center" style="color:red">H</th><td align="right">V</td></tr></tbody></table>',
    );
    const wrapper = container.querySelector(".sf-table-wrap");
    expect(wrapper).not.toBeNull();
    expect(wrapper?.querySelector("table.sf-table")).not.toBeNull();
    expect(wrapper?.querySelector("th")?.classList.contains("sf-align-center")).toBe(true);
    expect(wrapper?.querySelector("td")?.classList.contains("sf-align-right")).toBe(true);
    expect(container.querySelector("[style]")).toBeNull();
  });

  it("inserts embedded local images and figures", () => {
    const token = "SFIMG_test_0";
    const images = new Map<string, ImageAsset>([
      [
        token,
        {
          token,
          src: "data:image/png;base64,AAAA",
          alt: "图片说明",
          caption: "图片说明",
          local: true,
          sourcePath: "photo.png",
        },
      ],
    ]);
    const { container } = normalize(`<p><img alt="${token}" src="data:image/gif;base64,R0lGOD"></p>`, images);
    const figure = container.querySelector("figure.sf-figure");
    expect(figure).not.toBeNull();
    expect(figure?.querySelector("img")?.getAttribute("src")).toBe("data:image/png;base64,AAAA");
    expect(figure?.querySelector("figcaption")?.textContent).toBe("图片说明");
  });

  it("reports missing local images", () => {
    const token = "SFIMG_test_1";
    const images = new Map<string, ImageAsset>([
      [
        token,
        {
          token,
          src: "",
          alt: "",
          local: true,
          sourcePath: "missing.png",
        },
      ],
    ]);
    const { container } = normalize(`<p><img alt="${token}" src="data:image/gif;base64,R0lGOD"></p>`, images);
    expect(container.querySelector(".sf-image-missing")?.textContent).toContain("missing.png");
  });
});
