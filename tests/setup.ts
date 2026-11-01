if (typeof globalThis.createEl !== "function") {
  globalThis.createEl = ((tag: string) =>
    document.createElement(tag)) as typeof createEl;
}
