import { App, TFile, normalizePath } from "obsidian";
import {
  arrayBufferToBase64,
  formatBytes,
  mimeFromPath,
} from "./utils";

export interface ImageAsset {
  token: string;
  src: string;
  alt: string;
  caption?: string;
  width?: number;
  local: boolean;
  sourcePath: string;
  skippedReason?: string;
}

export interface ImageResolution {
  asset: ImageAsset;
  warning?: string;
}

const TOKEN_ALT = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
const TOTAL_EMBED_BUDGET = 28 * 1024 * 1024;

function isExternalSource(source: string): boolean {
  return /^(https?:|data:|mailto:)/i.test(source);
}

function stripQueryAndHash(source: string): string {
  return source.split("#")[0].split("?")[0];
}

function decodeLink(source: string): string {
  try {
    return decodeURIComponent(source);
  } catch {
    return source;
  }
}

export function resolveVaultImage(
  app: App,
  sourceFile: TFile,
  target: string,
): TFile | null {
  const clean = decodeLink(stripQueryAndHash(target.trim()));
  if (!clean || isExternalSource(clean)) return null;

  const direct = app.metadataCache.getFirstLinkpathDest(clean, sourceFile.path);
  if (direct instanceof TFile) return direct;

  const relativePath = sourceFile.parent
    ? normalizePath(`${sourceFile.parent.path}/${clean}`)
    : normalizePath(clean);
  const byPath = app.vault.getAbstractFileByPath(relativePath);
  if (byPath instanceof TFile) return byPath;

  const vaultPath = app.vault.getAbstractFileByPath(normalizePath(clean));
  if (vaultPath instanceof TFile) return vaultPath;

  return null;
}

export async function resolveImageAsset(options: {
  app: App;
  file: TFile;
  target: string;
  alt: string;
  caption?: string;
  width?: number;
  token: string;
  maxImageBytes: number;
  embeddedBytes: { value: number };
}): Promise<ImageResolution> {
  const { app, file, target, alt, caption, width, token, maxImageBytes } = options;
  const source = target.trim();
  const makeAsset = (src: string, local: boolean): ImageAsset => ({
    token,
    src,
    alt,
    caption,
    width,
    local,
    sourcePath: source,
  });

  if (isExternalSource(source)) {
    return { asset: makeAsset(source, false) };
  }

  if (/^app:\/\//i.test(source)) {
    return {
      asset: makeAsset("", false),
      warning: `无法内嵌 Obsidian 资源地址：${source}`,
    };
  }

  const imageFile = resolveVaultImage(app, file, source);
  if (!imageFile) {
    return {
      asset: makeAsset("", false),
      warning: `找不到图片：${source}`,
    };
  }

  const size = imageFile.stat?.size ?? 0;
  if (size > maxImageBytes) {
    return {
      asset: makeAsset("", true),
      warning: `图片「${imageFile.name}」${formatBytes(size)}，超过单张上限 ${formatBytes(maxImageBytes)}，已跳过`,
    };
  }
  if (options.embeddedBytes.value + size > TOTAL_EMBED_BUDGET) {
    return {
      asset: makeAsset("", true),
      warning: `图片「${imageFile.name}」超出本次导出的内嵌总量上限，已跳过`,
    };
  }

  try {
    const buffer = await app.vault.readBinary(imageFile);
    options.embeddedBytes.value += buffer.byteLength;
    const mime = mimeFromPath(imageFile.path);
    if (mime === "application/octet-stream") {
      return {
        asset: makeAsset("", true),
        warning: `不支持的图片格式：${imageFile.name}`,
      };
    }
    const dataUrl = `data:${mime};base64,${arrayBufferToBase64(buffer)}`;
    return {
      asset: makeAsset(dataUrl, true),
      warning:
        mime === "image/svg+xml"
          ? `「${imageFile.name}」是 SVG，部分平台可能无法显示`
          : undefined,
    };
  } catch (error) {
    return {
      asset: makeAsset("", true),
      warning: `读取图片「${imageFile.name}」失败：${String(error)}`,
    };
  }
}

export function createImageMarkdown(token: string): string {
  return `![${token}](${TOKEN_ALT})`;
}
