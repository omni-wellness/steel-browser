import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const expected = process.env.PUPPETEER_PROVIDER;
const providers = {
  puppeteer: { name: "puppeteer-core", version: "23.6.0" },
  rebrowser: { name: "rebrowser-puppeteer-core", version: "23.6.101" },
};

assert.ok(expected in providers, "PUPPETEER_PROVIDER must be puppeteer or rebrowser");

const packageUrl = new URL("../../node_modules/puppeteer-core/package.json", import.meta.url);
const packageBody = JSON.parse(await readFile(packageUrl, "utf8"));
assert.equal(packageBody.name, providers[expected].name);
assert.equal(packageBody.version, providers[expected].version);

const puppeteer = await import("puppeteer-core");
assert.equal(typeof puppeteer.default?.connect, "function");
assert.equal(typeof puppeteer.default?.launch, "function");
assert.equal(typeof puppeteer.TargetType, "object");

process.stdout.write(`${packageBody.name}@${packageBody.version} preserves Steel's runtime import contract\n`);
