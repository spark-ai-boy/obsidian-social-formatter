import { describe, expect, it } from "vitest";
import type { TFile as ObsidianTFile } from "obsidian";
import { TFile } from "./mocks/obsidian";
import { prepareMarkdown } from "../src/markdown";

describe("local images", () => {
  it("keeps caption and alt when embedding a local image", async () => {
    const imageFile = new TFile();
    imageFile.path = "assets/cover.png";
    imageFile.name = "cover.png";
    imageFile.basename = "cover";
    imageFile.extension = "png";
    imageFile.stat = { ctime: 0, mtime: 0, size: 4 };
    const sourceFile = new TFile() as unknown as ObsidianTFile;
    sourceFile.path = "notes/article.md";
    sourceFile.basename = "article";
    sourceFile.parent = { path: "notes" } as never;
    const app = {
      metadataCache: { getFirstLinkpathDest: () => imageFile },
      vault: {
        getAbstractFileByPath: () => null,
        readBinary: async () => new Uint8Array([1, 2, 3, 4]).buffer,
      },
    } as never;
    const result = await prepareMarkdown(
      app,
      sourceFile,
      '![本地封面](assets/cover.png "本地图片的图注")',
      { includeTitle: false, maxImageBytes: 1024 },
    );
    expect(result.images).toHaveLength(1);
    expect(result.images[0].alt).toBe("本地封面");
    expect(result.images[0].caption).toBe("本地图片的图注");
    expect(result.images[0].src).toMatch(/^data:image\/png;base64,/);
  });
});
