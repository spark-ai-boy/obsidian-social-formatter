export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/\n/g, " ");
}

export function isSafeCssColor(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 80) return false;
  return /^(#[0-9a-f]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\)|[a-z]{3,24})$/i.test(trimmed);
}

export function safeCssColor(value: unknown, fallback: string): string {
  return isSafeCssColor(value) ? (value as string).trim() : fallback;
}

export function safeFontFamily(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim().replace(/[\r\n{};]/g, "");
  if (!trimmed || trimmed.length > 240) return fallback;
  return trimmed;
}

export function cssNumber(value: number, fallback: number, min: number, max: number): number {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return clamp(number, min, max);
}

export function mimeFromPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const mimes: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    bmp: "image/bmp",
    avif: "image/avif",
  };
  return mimes[ext] ?? "application/octet-stream";
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
}

export function stripFrontmatter(markdown: string): { body: string; frontmatter: string } {
  const normalized = markdown.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  if (!normalized.startsWith("---\n")) {
    return { body: normalized, frontmatter: "" };
  }
  const end = normalized.indexOf("\n---", 4);
  if (end === -1) return { body: normalized, frontmatter: "" };
  const after = normalized.indexOf("\n", end + 4);
  const frontmatter = normalized.slice(0, after === -1 ? normalized.length : after + 1);
  return {
    body: normalized.slice(after === -1 ? normalized.length : after + 1),
    frontmatter,
  };
}

export function titleFromMarkdown(markdown: string, fallback: string): string {
  const frontmatter = stripFrontmatter(markdown).frontmatter;
  const match = frontmatter.match(/^title\s*:\s*(.+?)\s*$/m);
  if (match) {
    return match[1].replace(/^["']|["']$/g, "").trim() || fallback;
  }
  return fallback;
}

export function debounce<T extends (...args: never[]) => void>(fn: T, wait: number): T {
  let timer: number | undefined;
  return ((...args: never[]) => {
    if (timer !== undefined) window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      timer = undefined;
      fn(...args);
    }, wait);
  }) as T;
}

export function cloneTheme<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
