import { readFileSync, writeFileSync } from "node:fs";
import assert from "node:assert";

import * as mod from "../lib/markdown.js";
const { isMissingParent } = mod;

assert.ok(typeof isMissingParent === "function", "isMissingParent 未导出");

// 真实的报错文案
assert.equal(isMissingParent("parent block not found: 20261020020020-qrogrca"), true);
assert.equal(isMissingParent("Parent block not found: abc"), true);
assert.equal(isMissingParent("not found"), true);
console.log("1. 能识别 parent block not found OK");

// 不能把连接错误误判成文档丢失
assert.equal(isMissingParent("fetch failed"), false);
assert.equal(isMissingParent("connect timeout"), false);
assert.equal(isMissingParent("http 500"), false);
assert.equal(isMissingParent(""), false);
assert.equal(isMissingParent(undefined), false);
console.log("2. 不误判连接错误 OK");

console.log("\n全部断言通过");
process.exit(0);
