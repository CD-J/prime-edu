const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm");
const document = {
  readyState: "loading",
  querySelector: () => null,
  querySelectorAll: () => [],
  getElementById: () => null,
  addEventListener() {},
};
const window = { addEventListener() {} };
const source = fs
  .readFileSync(require.resolve("../js/study-ai.js"), "utf8")
  .replace(/\}\)\(\);\s*$/, "window.__mergeById=mergeById;})();");
vm.runInNewContext(source, {
  window,
  document,
  console,
  CustomEvent: class {},
  AbortController,
  setTimeout,
  clearTimeout,
  requestAnimationFrame() {},
});
const merge = (remote, local) =>
  JSON.parse(JSON.stringify(window.__mergeById(remote, local)));
const local = {
  id: "note",
  title: "local old",
  content: "unsynced body",
  reviewProgress: { one: { updatedAt: "2026-10-14" } },
};
let merged = merge(
  [
    {
      id: "note",
      title: "admin rename",
      content: "remote old",
      adminTitleVersion: "v1",
    },
  ],
  [local],
)[0];
assert.equal(merged.title, "admin rename");
assert.equal(merged.content, "unsynced body");
assert.equal(merged.reviewProgress.one.updatedAt, "2026-10-14");
merged = merge(
  [{ id: "note", title: "admin rename", adminTitleVersion: "v1" }],
  [{ ...merged, title: "student later rename" }],
)[0];
assert.equal(
  merged.title,
  "student later rename",
  "same admin version does not repeatedly overwrite local changes",
);
merged = merge([{ id: "note", adminTitleVersion: "v2" }], [merged])[0];
assert(
  !Object.hasOwn(merged, "title"),
  "undo of formerly untitled note clears stale cached title",
);
assert.equal(merged.content, "unsynced body");
assert.equal(
  merge([{ id: "other", title: "other account" }], [])[0].id,
  "other",
);
assert.equal(
  merge([{ id: "note", title: "remote regular" }], [local])[0].title,
  "local old",
  "ordinary merge behavior stays unchanged",
);
console.log(
  "PASS admin title sync: fresh rename/undo version, retained local content/review progress, same-version local edits, untouched ordinary merge.",
);
