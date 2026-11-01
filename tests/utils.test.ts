import { describe, expect, it } from "vitest";
import {
  arrayBufferToBase64,
  escapeHtml,
  formatBytes,
  mimeFromPath,
  stripFrontmatter,
  titleFromMarkdown,
} from "../src/utils";

describe("utils", () => {
  it("strips YAML frontmatter", () => {
    const result = stripFrontmatter("---\ntitle: Hello\ntags: [a]\n---\n\nBody");
    expect(result.body).toBe("\nBody");
    expect(result.frontmatter).toContain("title: Hello");
  });

  it("keeps a note without frontmatter intact", () => {
    expect(stripFrontmatter("# Title\n\nBody").body).toBe("# Title\n\nBody");
  });

  it("prefers the frontmatter title", () => {
    expect(titleFromMarkdown('---\ntitle: "A title"\n---\nBody', "file")).toBe("A title");
    expect(titleFromMarkdown("Body", "file")).toBe("file");
  });

  it("escapes HTML", () => {
    expect(escapeHtml('<a href="x">&</a>')).toBe(
      "&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;",
    );
  });

  it("maps image mime types", () => {
    expect(mimeFromPath("a.PNG")).toBe("image/png");
    expect(mimeFromPath("a.webp")).toBe("image/webp");
    expect(mimeFromPath("a.pdf")).toBe("application/octet-stream");
  });

  it("formats bytes and base64", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(arrayBufferToBase64(new Uint8Array([104, 105]).buffer)).toBe("aGk=");
  });
});
