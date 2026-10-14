import { SUDO_IDENTITY } from './sudo-system.mjs';
import { createBudget, requestJson } from './ai-provider-transport.mjs';
export { providerError } from './ai-provider-transport.mjs';
export const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TEXT_OUTPUT_TOKENS = 4096;
const JSON_OUTPUT_TOKENS = 4096;
const CONTINUE_ON_TRUNCATION = "Continue exactly from where the previous answer stopped. Do not restart or repeat earlier content.";

export const baseRules = SUDO_IDENTITY;

export function parseBody(event) {
  if (event.httpMethod === "OPTIONS") return { preflight: true };
  if (event.httpMethod !== "POST") {
    const error = new Error("POST만 지원합니다.");
    error.statusCode = 405;
    throw error;
  }
  try {
    return JSON.parse(event.body || "{}");
  } catch {
    const error = new Error("잘못된 요청입니다.");
    error.statusCode = 400;
    throw error;
  }
}

export function json(statusCode, body) {
  return { statusCode, headers, body: JSON.stringify(body) };
}

function getRuntime() {
  const apiKey = process.env.AI_API_KEY || process.env.OPENAI_API_KEY || process.env.GROQ_API_KEY;
  if (!apiKey) {
    const error = new Error("AI가 아직 설정되지 않았습니다. Vercel 환경 변수에 AI_API_KEY를 추가해주세요.");
    error.statusCode = 500;
    throw error;
  }
  const provider = String(process.env.AI_PROVIDER || (process.env.GROQ_API_KEY ? 'groq' : process.env.OPENAI_API_KEY ? "openai" : "gemini")).toLowerCase();
  if (!['gemini', 'openai', 'groq'].includes(provider)) throw Object.assign(new Error('AI 제공사 설정을 확인해주세요.'), { statusCode: 503, code: 'AI_CONFIG_INVALID' });
  let model = process.env.AI_MODEL || process.env.OPENAI_MODEL || "";
  // Google's legacy 3.5 Flash alias now redirects to 3.6; use the active ID explicitly.
  if (provider === 'gemini' && model === 'gemini-3.5-flash') model = 'gemini-3.6-flash';
  return { apiKey, provider, model };
}

async function callGemini(apiKey, systemText, messages, model, jsonMode, budget, options = {}) {
  const geminiModel = model || "gemini-3.6-flash";
  let contents = messages.map((message) => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: String(message.content || "") }],
  }));
  let fullReply = "";

  for (let attempt = 0; attempt < (jsonMode ? 1 : 3); attempt += 1) {
    const result = await requestJson(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiModel)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemText }] },
        contents,
        generationConfig: {
          temperature: jsonMode ? 0.2 : 0.35,
          maxOutputTokens: options.maxOutputTokens || (jsonMode ? JSON_OUTPUT_TOKENS : TEXT_OUTPUT_TOKENS),
          // Flash 2.5 supports disabling thinking for responsive conversation;
          // structured learning tools retain a bounded reasoning budget.
          ...(/^gemini-2\.5-flash(?:-|$)/.test(geminiModel) ? { thinkingConfig: { thinkingBudget: jsonMode ? 1024 : 0 } } : {}),
          ...(/^gemini-3(?:\.\d+)?-flash(?:-|$)/.test(geminiModel) ? { thinkingConfig: { thinkingLevel: options.interactive && /flash-lite/.test(geminiModel) ? 'minimal' : 'low' } } : {}),
          ...(jsonMode ? { responseMimeType: "application/json" } : {}),
        },
      }),
    }, budget);
    const candidate = result.candidates?.[0] || {};
    const reply = candidate.content?.parts?.filter(part => !part.thought).map((part) => part.text || "").join("\n").trim();
    if (!reply) throw Object.assign(new Error('AI 답변이 비어 있어요. 다시 시도해주세요.'), { statusCode: 502, code: 'AI_EMPTY_RESPONSE', retryable: false });
    fullReply = `${fullReply}${fullReply ? "\n" : ""}${reply}`.trim();
    if (candidate.finishReason !== "MAX_TOKENS") return fullReply;
    if (jsonMode) throw Object.assign(new Error('AI 결과를 끝까지 받지 못했어요. 다시 시도해주세요.'), { statusCode: 502, code: 'AI_RESPONSE_TRUNCATED', retryable: false });

    contents = [
      ...contents,
      { role: "model", parts: [{ text: reply }] },
      { role: "user", parts: [{ text: CONTINUE_ON_TRUNCATION }] },
    ];
  }

  return fullReply;
}

async function callOpenAIChat(apiKey, systemText, messages, model, jsonMode, provider, budget, options = {}) {
  let openAiMessages = [
    { role: "system", content: systemText },
    ...messages.map((message) => ({
      role: message.role === "assistant" ? "assistant" : "user",
      content: String(message.content || ""),
    })),
  ];
  let fullReply = "";

  for (let attempt = 0; attempt < (jsonMode ? 1 : 3); attempt += 1) {
    const result = await requestJson(provider === 'groq' ? 'https://api.groq.com/openai/v1/chat/completions' : process.env.OPENAI_BASE_URL || "https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model || (provider === 'groq' ? 'openai/gpt-oss-20b' : "gpt-4o-mini"),
        messages: openAiMessages,
        temperature: jsonMode ? 0.2 : 0.35,
        max_tokens: options.maxOutputTokens || (jsonMode ? JSON_OUTPUT_TOKENS : TEXT_OUTPUT_TOKENS),
        ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
      }),
    }, budget);
    const choice = result.choices?.[0] || {};
    const reply = choice.message?.content || "";
    fullReply = `${fullReply}${fullReply ? "\n" : ""}${reply}`.trim();
    if (!reply.trim()) throw Object.assign(new Error('AI 답변이 비어 있어요. 다시 시도해주세요.'), { statusCode: 502, code: 'AI_EMPTY_RESPONSE', retryable: false });
    if (choice.finish_reason !== "length") return fullReply;
    if (jsonMode) throw Object.assign(new Error('AI 결과를 끝까지 받지 못했어요. 다시 시도해주세요.'), { statusCode: 502, code: 'AI_RESPONSE_TRUNCATED', retryable: false });

    openAiMessages = [
      ...openAiMessages,
      { role: "assistant", content: reply },
      { role: "user", content: CONTINUE_ON_TRUNCATION },
    ];
  }

  return fullReply || "{}";
}

export async function callMessages(systemText, messages, jsonMode = true, options = {}) {
  const runtime = getRuntime();
  const budget = createBudget(Date.now, options.interactive ? { deadlineMs: 32000, requestTimeoutMs: 12000 } : {});
  if (runtime.provider !== 'gemini') return callOpenAIChat(runtime.apiKey, systemText, messages, runtime.model, jsonMode, runtime.provider, budget, options);
  try { return await callGemini(runtime.apiKey, systemText, messages, runtime.model, jsonMode, budget, options); }
  catch (error) {
    const fallback = process.env.AI_FALLBACK_MODEL || (/^gemini-3(?:\.\d+)?-flash(?:-|$)/.test(runtime.model || 'gemini-3.6-flash') ? 'gemini-3.5-flash-lite' : '');
    // Same existing provider/key only. Never fail over authentication, billing or quotas.
    if (!fallback || fallback === runtime.model || !['AI_TEMPORARY_UNAVAILABLE', 'AI_NETWORK_ERROR', 'AI_CONNECTION_TIMEOUT'].includes(error.code) || error.retryAfterMs > 5000 || budget.deadline - budget.now() < 1000 || budget.requests >= budget.maxRequests) throw error;
    console.warn('AI transient model failover', { code: error.code, providerStatus: error.providerStatus, model: runtime.model, fallback });
    budget.requestTimeoutMs = 22000;
    return callGemini(runtime.apiKey, systemText, messages, fallback, jsonMode, budget, options);
  }
}

export async function callOpenAI(systemText, userText, jsonMode = true, options = {}) {
  return callMessages(systemText, [{ role: "user", content: userText }], jsonMode, options);
}

export function parseAiJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = String(text || "").match(/\{[\s\S]*\}/);
    try { if (match) return JSON.parse(match[0]); } catch {}
    throw Object.assign(new Error('AI 결과 형식이 올바르지 않아요. 다시 시도해주세요.'), { statusCode: 502, code: 'AI_INVALID_RESPONSE', retryable: false });
  }
}

export function fail(error) {
  // Status/reason only: never log prompts, provider URLs or credentials.
  console.error('AI handler failed', { code: error?.code || 'PROVIDER_FAILURE', status: error?.statusCode || 500, providerStatus: error?.providerStatus, providerReason: error?.providerReason });
  return json(error.statusCode || 500, { error: error.message || "서버 오류가 발생했습니다.", code: error?.code || 'PROVIDER_FAILURE', retryable: Boolean(error?.retryable) });
}
