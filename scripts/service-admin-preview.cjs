// Loopback-only UI QA. Never connects to Firebase or uses real account credentials.
const http = require("node:http"),
  fs = require("node:fs"),
  path = require("node:path");
const { createFixture } = require("./service-admin-fixture.cjs");
const root = path.resolve(__dirname, ".."),
  port = Number(process.argv[2] || 5198);
const assets = new Set([
  "/js/service-admin.js",
  "/js/service-admin.css",
  "/js/browser-compat.js",
  "/js/ui-icons.js",
  "/js/liquid-tabs.js",
  "/js/tab-touch.css",
  "/js/app-shell.css",
  "/js/home-polish.css",
  "/js/glass-design.css",
  "/js/capsule-standby.css",
  "/js/button-motion.css",
  "/js/button-motion.js",
  "/assets/sudo-app-icon.svg",
  "/assets/fonts/apple-gothic-regular.woff2",
  "/assets/fonts/apple-gothic-semibold.woff2",
  "/assets/fonts/apple-gothic-bold.woff2",
  "/assets/fonts/pretendard-medium.woff2",
]);
(async () => {
  const { createHandler } = await import(
    "../netlify/functions/serviceAdmin.mjs"
  );
  const handler = createHandler(createFixture());
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://127.0.0.1:" + port);
    if (url.pathname === "/api/serviceAdmin" && req.method === "POST") {
      let body = "";
      for await (const chunk of req) {
        body += chunk;
        if (body.length > 20000) {
          res.writeHead(413).end();
          return;
        }
      }
      const answer = await handler({
        httpMethod: "POST",
        headers: {
          authorization: req.headers.authorization,
          origin: "https://prime-edu.vercel.app",
        },
        body,
      });
      res.writeHead(answer.statusCode, answer.headers).end(answer.body);
      return;
    }
    if (url.pathname === "/" || url.pathname === "/service-admin.html") {
      let html = fs.readFileSync(path.join(root, "service-admin.html"), "utf8");
      html = html
        .replace(
          /<script src="https:\/\/www.gstatic.com\/firebasejs\/[^"]+"><\/script>/g,
          "",
        )
        .replace(
          /<script src="js\/(?:firebase-config|class-hub-firebase)[^"]*"><\/script>/g,
          "",
        );
      const mode =
          url.searchParams.get("mode") === "student" ? "student" : "admin",
        dark = url.searchParams.get("theme") === "dark";
      const accent = [
        "green",
        "blue",
        "gray",
        "red",
        "purple",
        "orange",
      ].includes(url.searchParams.get("accent"))
        ? url.searchParams.get("accent")
        : "green";
      html = html
        .replace(
          'localStorage.getItem("classHubTheme")',
          JSON.stringify(dark ? "dark" : "light"),
        )
        .replace(
          'localStorage.getItem("schemsHomePreferences.v1")',
          JSON.stringify(JSON.stringify({ accent })),
        );
      const stub = `<script>document.documentElement.dataset.theme=${JSON.stringify(dark ? "dark" : "light")};let fixtureOwner=${JSON.stringify(mode)},fixtureListener;const fixtureUser=()=>fixtureOwner?{uid:fixtureOwner,getIdToken:async()=>fixtureOwner}:null;window.ClassHubFirebase={init:()=>true,getCurrentUser:fixtureUser,onAuthStateChanged:f=>{fixtureListener=f;f(fixtureUser())},signOut:async()=>{fixtureOwner=null;fixtureListener(null)},signIn:async()=>{fixtureOwner='admin';fixtureListener(fixtureUser())}};</script>`;
      html = html.replace(
        '<script src="js/ui-icons.js',
        stub + '<script src="js/ui-icons.js',
      );
      html = html.replace(
        '<header class="manage-header">',
        '<p style="margin:12px 28px;color:#788496;font-size:12px">[검수] 예시 데이터 · 실제 계정 변경 없음</p><header class="manage-header">',
      );
      res
        .writeHead(200, {
          "Content-Type": "text/html;charset=utf-8",
          "Cache-Control": "no-store",
        })
        .end(html);
      return;
    }
    if (assets.has(url.pathname)) {
      res
        .writeHead(200, {
          "Content-Type": url.pathname.endsWith(".css")
            ? "text/css"
            : url.pathname.endsWith(".woff2")
              ? "font/woff2"
              : url.pathname.endsWith(".svg")
                ? "image/svg+xml"
                : "text/javascript",
          "Cache-Control": "no-store",
        })
        .end(fs.readFileSync(path.join(root, url.pathname)));
      return;
    }
    res.writeHead(404).end();
  });
  server.listen(port, "127.0.0.1", () =>
    console.log(
      "Synthetic service management preview: http://127.0.0.1:" + port,
    ),
  );
})();
