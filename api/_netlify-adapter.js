function readBody(req) {
  if (typeof req.body === "string") return req.body;
  if (req.body && typeof req.body === "object") return JSON.stringify(req.body);
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

async function invokeNetlifyHandler(req, res, handlerPath) {
  try {
    const mod = typeof handlerPath === "function" ? await handlerPath() : await import(handlerPath);
    const body = await readBody(req);
    const result = await mod.handler({
      httpMethod: req.method,
      headers: req.headers,
      body,
    });
    for (const [key, value] of Object.entries(result.headers || {})) {
      res.setHeader(key, value);
    }
    res.status(result.statusCode || 200).send(result.body || "");
  } catch (error) {
    // Do not log credentials, user messages or provider URLs containing keys.
    console.error("API invocation failed", { code: error?.code || "HANDLER_FAILURE" });
    res.status(503).json({ error: "스도 서버를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.", code: "SERVICE_UNAVAILABLE" });
  }
}

module.exports = { invokeNetlifyHandler };
