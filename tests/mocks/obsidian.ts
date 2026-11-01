export class TFile {
  path = "";
  name = "";
  basename = "";
  extension = "";
  stat = { ctime: 0, mtime: 0, size: 0 };
  parent: { path: string } | null = null;
}

export class TAbstractFile {}

export function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\/|\/$/g, "");
}

export class Component {
  load(): void {}
  unload(): void {}
  addChild<T>(child: T): T {
    return child;
  }
}

export class MarkdownRenderer {
  static async render(): Promise<void> {}
}

export class App {}
export class Notice {
  constructor(_message?: string, _duration?: number) {}
  hide(): void {}
}
