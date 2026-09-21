import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const expected = process.env.PUPPETEER_PROVIDER;
const providers = {
  puppeteer: { name: "puppeteer-core", version: "23.6.0" },
  rebrowser: { name: "rebrowser-puppeteer-core", version: "23.6.101" },
};

assert.ok(expected in providers, "PUPPETEER_PROVIDER must be puppeteer or rebrowser");

let packageDirectory = dirname(fileURLToPath(import.meta.resolve("puppeteer-core")));
let packageBody;
for (let depth = 0; depth < 12; depth += 1) {
  try {
    const candidate = JSON.parse(await readFile(join(packageDirectory, "package.json"), "utf8"));
    if (candidate.name && candidate.version) {
      packageBody = candidate;
      break;
    }
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }
  }
  packageDirectory = dirname(packageDirectory);
}
assert.ok(packageBody, "could not locate the installed puppeteer-core package metadata");
assert.equal(packageBody.name, providers[expected].name);
assert.equal(packageBody.version, providers[expected].version);

const puppeteer = await import("puppeteer-core");
assert.equal(typeof puppeteer.default?.connect, "function");
assert.equal(typeof puppeteer.default?.launch, "function");
assert.equal(typeof puppeteer.TargetType, "object");

process.stdout.write(`${packageBody.name}@${packageBody.version} preserves Steel's runtime import contract\n`);
