import type { CopyResult } from "./types";

function fallbackWithExecCommand(html: string): boolean {
  const container = document.createElement("div");
  container.setAttribute("contenteditable", "true");
  container.style.cssText =
    "position:fixed;left:-99999px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;";
  const parsed = new DOMParser().parseFromString(html, "text/html");
  container.replaceChildren(...Array.from(parsed.body.childNodes));
  document.body.appendChild(container);

  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(container);
  const previous = selection?.rangeCount ? selection.getRangeAt(0) : null;
  selection?.removeAllRanges();
  selection?.addRange(range);

  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch {
    copied = false;
  }

  selection?.removeAllRanges();
  if (previous) selection?.addRange(previous);
  container.remove();
  return copied;
}

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
      // Fall through to the selection based fallback.
    }
  }

  if (fallbackWithExecCommand(html)) {
    return { mode: "rich", htmlLength: html.length };
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
