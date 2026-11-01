import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("obsidian", () => {
  class TFile {}
  return {
    TFile,
    normalizePath: (path: string) => path.replace(/\/+/g, "/"),
  };
});

import { prepareMarkdown } from "../src/markdown";
import type { TFile } from "obsidian";

const file = {
  path: "notes/article.md",
  basename: "article",
  parent: { path: "notes" },
} as unknown as TFile;

const app = {
  metadataCache: {
    getFirstLinkpathDest: () => null,
  },
  vault: {
    getAbstractFileByPath: () => null,
  },
} as never;

describe("prepareMarkdown", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("removes frontmatter and keeps the title", async () => {
    const result = await prepareMarkdown(
      app,
      file,
      "---\ntitle: 我的标题\n---\n\n正文",
      { includeTitle: false, maxImageBytes: 1024 },
    );
    expect(result.markdown).toBe("\n正文");
    expect(result.title).toBe("我的标题");
  });

  it("turns external markdown images into tokens", async () => {
    const result = await prepareMarkdown(
      app,
      file,
      "![cover](https://example.com/a.png)",
      { includeTitle: false, maxImageBytes: 1024 },
    );
    expect(result.images).toHaveLength(1);
    expect(result.images[0].src).toBe("https://example.com/a.png");
    expect(result.images[0].alt).toBe("cover");
    expect(result.markdown).toContain("![SFIMG_");
  });

  it("uses a Markdown image title as caption", async () => {
    const result = await prepareMarkdown(
      app,
      file,
      '![alt](https://example.com/a.png "这是图注")',
      { includeTitle: false, maxImageBytes: 1024 },
    );
    expect(result.images[0].alt).toBe("alt");
    expect(result.images[0].caption).toBe("这是图注");
  });

  it("parses wiki image width and alt", async () => {
    const result = await prepareMarkdown(
      app,
      file,
      "![[photo.png|300]]\n\n![[another.png|说明文字]]",
      { includeTitle: false, maxImageBytes: 1024 },
    );
    expect(result.images).toHaveLength(2);
    expect(result.images[0].width).toBe(300);
    expect(result.images[1].alt).toBe("说明文字");
  });

  it("does not touch image syntax inside fenced or inline code", async () => {
    const source = [
      "`![inline](https://example.com/a.png)`",
      "",
      "```md",
      "![fenced](https://example.com/b.png)",
      "```",
    ].join("\n");
    const result = await prepareMarkdown(app, file, source, {
      includeTitle: false,
      maxImageBytes: 1024,
    });
    expect(result.images).toHaveLength(0);
    expect(result.markdown).toContain("![inline](https://example.com/a.png)");
    expect(result.markdown).toContain("![fenced](https://example.com/b.png)");
  });

  it("warns about note transclusions", async () => {
    const result = await prepareMarkdown(app, file, "![[Other note]]", {
      includeTitle: false,
      maxImageBytes: 1024,
    });
    expect(result.warnings.some((warning) => warning.includes("嵌入笔记"))).toBe(true);
    expect(result.markdown).toContain("嵌入笔记");
  });

  it("strips Obsidian comments", async () => {
    const result = await prepareMarkdown(
      app,
      file,
      "before %%hidden%% after\n\n<!-- html comment -->",
      { includeTitle: false, maxImageBytes: 1024 },
    );
    expect(result.markdown).not.toContain("hidden");
    expect(result.markdown).not.toContain("html comment");
    expect(result.markdown).toContain("before  after");
  });
});
