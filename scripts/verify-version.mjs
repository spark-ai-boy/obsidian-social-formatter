import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (file) => JSON.parse(readFileSync(path.join(root, file), "utf8"));

const pkg = readJson("package.json");
const manifest = readJson("manifest.json");
const versions = readJson("versions.json");
const version = String(manifest.version ?? "").trim();
const tag = (process.argv[2] ?? "").replace(/^refs\/tags\//, "");

const fail = (message) => {
  console.error(`Version check failed: ${message}`);
  process.exit(1);
};

if (!version) fail("manifest.json is missing a version");
if (pkg.version !== version) {
  fail(`package.json is ${pkg.version}, manifest.json is ${version}`);
}
if (!versions[version]) {
  fail(`versions.json has no entry for ${version}`);
}
if (manifest.minAppVersion !== versions[version]) {
  fail(
    `manifest.minAppVersion is ${manifest.minAppVersion}, versions.json["${version}"] is ${versions[version]}`,
  );
}
if (tag && tag !== version) {
  fail(`git tag is ${tag}, manifest.json is ${version}`);
}

console.log(
  `Version OK: ${version} (Obsidian >= ${manifest.minAppVersion})${tag ? `, tag ${tag}` : ""}`,
);
