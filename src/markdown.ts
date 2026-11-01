import { App, TFile } from "obsidian";
import type { RenderOptions } from "./types";
import { createImageMarkdown, resolveImageAsset, type ImageAsset } from "./images";
import { mimeFromPath, stripFrontmatter, titleFromMarkdown } from "./utils";

export interface PreparedMarkdown {
  markdown: string;
  images: ImageAsset[];
  imageByToken: Map<string, ImageAsset>;
  title: string;
  warnings: string[];
  imageCount: number;
  localImageCount: number;
}

const IMAGE_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "svg",
  "bmp",
  "avif",
]);

function isImagePath(path: string): boolean {
  const ext = path.split("#")[0].split("?")[0].split(".").pop()?.toLowerCase() ?? "";
  return IMAGE_EXTENSIONS.has(ext) || mimeFromPath(path).startsWith("image/");
}

function protectCode(markdown: string): { text: string; restore: (value: string) => string } {
  const blocks: string[] = [];
  const placeholder = (value: string): string => {
    const index = blocks.push(value) - 1;
    return `@@SF_PROTECTED_${index}@@`;
  };

  const lines = markdown.split("\n");
  const output: string[] = [];
  let fenceChar = "";
  let fenceLength = 0;
  let fenceLines: string[] = [];

  for (const line of lines) {
    if (!fenceChar) {
      const open = line.match(/^\s{0,3}(?:>\s*)?(`{3,}|~{3,})/);
      if (open) {
        fenceChar = open[1][0];
        fenceLength = open[1].length;
        fenceLines = [line];
        continue;
      }
      output.push(
        line.replace(/(`+)([^`\n]*?)\1/g, (match) => placeholder(match)),
      );
    } else {
      fenceLines.push(line);
      const close = line.match(/^\s{0,3}(?:>\s*)?(`{3,}|~{3,})\s*$/);
      if (close && close[1][0] === fenceChar && close[1].length >= fenceLength) {
        output.push(placeholder(fenceLines.join("\n")));
        fenceChar = "";
        fenceLength = 0;
        fenceLines = [];
      }
    }
  }

  if (fenceChar && fenceLines.length) {
    output.push(placeholder(fenceLines.join("\n")));
  }

  return {
    text: output.join("\n"),
    restore: (value: string) =>
      value.replace(/@@SF_PROTECTED_(\d+)@@/g, (_match, index: string) => blocks[Number(index)] ?? ""),
  };
}

async function replaceAsync(
  input: string,
  regex: RegExp,
  replacer: (match: RegExpExecArray) => Promise<string>,
): Promise<string> {
  let result = "";
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  regex.lastIndex = 0;
  while ((match = regex.exec(input)) !== null) {
    result += input.slice(lastIndex, match.index);
    result += await replacer(match);
    lastIndex = match.index + match[0].length;
    if (match[0].length === 0) regex.lastIndex += 1;
  }
  result += input.slice(lastIndex);
  return result;
}

function parseWikiImage(inner: string): { target: string; alt: string; width?: number } {
  const parts = inner.split("|");
  const target = (parts.shift() ?? "").trim();
  let alt = "";
  let width: number | undefined;
  for (const part of parts) {
    const trimmed = part.trim();
    const dimension = trimmed.match(/^(\d+)(?:x\d+)?$/);
    if (dimension) {
      width = Number(dimension[1]);
    } else if (trimmed) {
      alt = alt ? `${alt} ${trimmed}` : trimmed;
    }
  }
  return { target, alt, width };
}

export async function prepareMarkdown(
  app: App,
  file: TFile,
  markdown: string,
  options: RenderOptions,
): Promise<PreparedMarkdown> {
  const warnings: string[] = [];
  const images: ImageAsset[] = [];
  const imageByToken = new Map<string, ImageAsset>();
  const embeddedBytes = { value: 0 };
  const tokenPrefix = `SFIMG_${Math.random().toString(36).slice(2, 8)}_`;

  const stripped = stripFrontmatter(markdown);
  const title = titleFromMarkdown(markdown, file.basename);
  const protectedCode = protectCode(stripped.body);

  let text = protectedCode.text;
  text = text.replace(/<!--[\s\S]*?-->/g, "");
  text = text.replace(/%%[\s\S]*?%%/g, "");

  const addImage = async (
    target: string,
    alt: string,
    width: number | undefined,
    caption?: string,
  ): Promise<string> => {
    const token = `${tokenPrefix}${images.length}`;
    const resolution = await resolveImageAsset({
      app,
      file,
      target,
      alt,
      caption,
      width,
      token,
      maxImageBytes: options.maxImageBytes,
      embeddedBytes,
    });
    images.push(resolution.asset);
    imageByToken.set(token, resolution.asset);
    if (resolution.warning) warnings.push(resolution.warning);
    return createImageMarkdown(token);
  };

  text = await replaceAsync(
    text,
    /!\[([^\]\n]*)\]\(\s*<?([^\s)>]+)>?(?:\s+["']([^"']*)["'])?\s*\)/g,
    async (match) => {
      const source = match[2]?.trim() ?? "";
      if (!source) return match[0];
      const normalized = /^\/\//.test(source) ? `https:${source}` : source;
      return addImage(
        normalized,
        match[1]?.trim() ?? "",
        undefined,
        match[3]?.trim() || undefined,
      );
    },
  );

  text = await replaceAsync(
    text,
    /!\[\[([^\]\n]+?)\]\]/g,
    async (match) => {
      const parsed = parseWikiImage(match[1] ?? "");
      if (!parsed.target || !isImagePath(parsed.target)) return match[0];
      return addImage(parsed.target, parsed.alt, parsed.width);
    },
  );

  text = text.replace(/!\[\[([^\]\n]+?)\]\]/g, (_match, inner: string) => {
    const target = inner.split("|")[0].trim();
    warnings.push(`嵌入笔记未展开：${target}`);
    return `〔嵌入笔记：${target}〕`;
  });

  text = protectedCode.restore(text);
  const localImageCount = images.filter((image) => image.local && image.src).length;
  const remoteImageCount = images.filter(
    (image) => image.src && !image.local && /^https?:\/\//i.test(image.src),
  ).length;
  if (remoteImageCount > 0) {
    warnings.push(
      `${remoteImageCount} 张远程图片保留原链接；若平台限制外链，粘贴后可能需要手动上传。`,
    );
  }

  return {
    markdown: text,
    images,
    imageByToken,
    title,
    warnings,
    imageCount: images.length,
    localImageCount,
  };
}
