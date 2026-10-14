const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm");
const read = (name) =>
  fs.readFileSync(path.join(__dirname, "..", name), "utf8");
const html = read("service-admin.html"),
  main = read("index.html"),
  css = read("js/service-admin.css"),
  js = read("js/service-admin.js");
for (const asset of [
  "app-shell.css",
  "home-polish.css",
  "glass-design.css",
  "capsule-standby.css",
  "button-motion.css",
  "tab-touch.css",
]) {
  assert(html.includes("js/" + asset), "administrator uses shared " + asset);
  assert(main.includes("js/" + asset), "main uses shared " + asset);
}
assert(
  !css.includes("--shell-blue: var(--primary)"),
  "no separate/cyclic accent palette",
);
assert(css.includes("--primary: var(--shell-blue)"));
assert(css.includes("--surface: var(--shell-card)"));
assert(css.includes("font-family: var(--app-font)"));
assert(js.includes("PrimeButtonMotion?.init()"));
assert(read("js/glass-design.css").includes(".manage-card,.manage-modal .modal-sheet"));
assert(html.includes("manage-brand-mark") && html.includes("record-chevron"));
assert(css.includes("@supports not (translate: 1px)"));
const bootstrap = [
  ...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi),
].filter((m) => !/\bsrc\s*=/.test(m[1]))[0][2];
new Function(bootstrap);
for (const mode of ["light", "dark", "auto", null])
  for (const accent of [
    "green",
    "blue",
    "gray",
    "red",
    "purple",
    "orange",
    "bad",
  ]) {
    let systemDark = true,
      systemListener,
      storageListener;
    const data = new Map([
      ["classHubTheme", mode],
      ["schemsHomePreferences.v1", JSON.stringify({ accent })],
    ]);
    const element = { dataset: {} },
      media = {
        get matches() {
          return systemDark;
        },
        addEventListener(name, f) {
          systemListener = f;
        },
      };
    vm.runInNewContext(bootstrap, {
      localStorage: { getItem: (key) => data.get(key) },
      document: { documentElement: element },
      matchMedia: () => media,
      window: {
        addEventListener(name, f) {
          storageListener = f;
        },
      },
    });
    assert.equal(element.dataset.theme, mode === "light" ? "light" : "dark");
    assert.equal(element.dataset.accent, accent === "bad" ? "green" : accent);
    data.set("classHubTheme", "light");
    storageListener({ key: "classHubTheme" });
    assert.equal(element.dataset.theme, "light");
    data.set("classHubTheme", "auto");
    systemDark = false;
    systemListener();
    assert.equal(element.dataset.theme, "light");
    systemDark = true;
    systemListener();
    assert.equal(element.dataset.theme, "dark");
  }
console.log(
  "Administrator visual parity: shared surfaces/fonts/capsules/motion and all six theme accents, storage/system synchronization passed.",
);
