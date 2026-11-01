/**
 * Apply CSS to a shadow root through a constructed stylesheet.
 * Construct the sheet in the same document as the shadow root so popout
 * windows can adopt it without cross-document errors.
 */
export function adoptShadowStyles(shadow: ShadowRoot, css: string): void {
  const win = shadow.host.ownerDocument.defaultView as
    | (Window & typeof globalThis)
    | null;
  const SheetConstructor = win?.CSSStyleSheet ?? CSSStyleSheet;
  const sheet = new SheetConstructor();
  try {
    sheet.replaceSync(css);
  } catch {
    // Custom CSS may contain @import, which replaceSync rejects. Drop imports
    // rather than breaking the whole preview.
    sheet.replaceSync(css.replace(/@import\b[^;]*;/g, ""));
  }
  shadow.adoptedStyleSheets = [sheet];
}
