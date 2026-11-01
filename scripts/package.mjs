import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
const dist = path.join(root, "dist");
const output = path.join(dist, `obsidian-social-formatter-${pkg.version}.zip`);
const files = [
  "main.js",
  "manifest.json",
  "styles.css",
  "README.md",
  "LICENSE",
  "docs",
];

mkdirSync(dist, { recursive: true });
rmSync(output, { force: true });
execFileSync("zip", ["-q", "-r", output, ...files], { cwd: root, stdio: "inherit" });
console.log(`Created ${path.relative(root, output)}`);
