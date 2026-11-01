import type { CopyResult } from "./types";

export async function copyRichHtml(html: string, text: string): Promise<CopyResult> {
  if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([text], { type: "text/plain" }),
        }),
      ]);
      return { mode: "rich", htmlLength: html.length };
    } catch {
      // Fall back to plain text when the platform rejects rich clipboard writes.
    }
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return { mode: "plain", htmlLength: html.length };
  }

  throw new Error("无法访问系统剪贴板");
}

export async function copyPlainText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  throw new Error("无法访问系统剪贴板");
}
