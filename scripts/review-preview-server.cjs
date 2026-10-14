// Isolated, loopback-only UI preview. No credentials, cloud or paid AI requests.
const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '..');
const port = Number(process.env.PRIME_REVIEW_PORT) || 5192;
http.createServer((req,res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (req.method !== 'GET') {req.resume();res.writeHead(405);res.end('Preview is read-only.');return;}
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); } catch { res.writeHead(400);res.end();return; }
  if (pathname.startsWith('/api/') || pathname.includes('firebase-config')) {res.writeHead(200, {'Content-Type':'text/javascript'});res.end('window.FIREBASE_CONFIG = {};');return;}
  const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(root + path.sep) || /(^|[\\/])\./.test(path.relative(root,file)) || !/\.(html|js|css|svg|png|jpg|woff2?|ttf|cjs)$/.test(file) || /[\\/]node_modules[\\/]/.test(file)) {res.writeHead(404);res.end();return;}
  fs.readFile(file, (error,data) => {
    if (error) {res.writeHead(404);res.end();return;}
    if (file === path.join(root,'index.html')) {
      let html = data.toString().replace(/<script src="https:\/\/www\.gstatic\.com\/firebasejs[^\"]+"><\/script>/g, '');
      if (url.searchParams.has('reviewqa')) html = html.replace('<script src="js/study-ai.js', '<script src="scripts/review-fixture.js"></script><script src="js/study-ai.js');
      if (url.searchParams.has('activityqa')) html = html.replace('<script src="js/study-ai.js', '<script src="scripts/connected-fixture.js"></script><script src="js/study-ai.js');
      if (url.searchParams.has('recoveryqa')) html = html.replace('<script src="js/study-ai.js', '<script src="scripts/recovery-fixture.js"></script><script src="js/study-ai.js');
      if (url.searchParams.has('continuityqa')) html = html.replace('<script src="js/study-ai.js', '<script src="scripts/continuity-fixture.js"></script><script src="js/study-ai.js');
      data = Buffer.from(html);
    }
    res.writeHead(200, {'Cache-Control':'no-store','Content-Type':({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2','.ttf':'font/ttf'})[path.extname(file)] || 'text/plain'});
    res.end(data);
  });
}).listen(port,'127.0.0.1',()=>console.log(`Review preview http://127.0.0.1:${port}/?reviewqa (synthetic local records; cloud disabled)`));
