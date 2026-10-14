// Bounded, request-local resilience. Never stores keys/prompts or rotates accounts.
export const AI_DEADLINE_MS = 40000;
export function createBudget(now = Date.now, options = {}) {
  return { now, deadline: now() + (options.deadlineMs || AI_DEADLINE_MS), requests: 0, maxRequests: 5, requestTimeoutMs: options.requestTimeoutMs || 22000 };
}
export function connectionError(timeout = false) {
  return Object.assign(new Error(timeout ? 'AI 응답이 늦어지고 있어요. 입력은 유지되니 다시 시도해주세요.' : 'AI 서버에 잠시 연결하지 못했어요. 다시 시도해주세요.'), {
    statusCode: timeout ? 504 : 502, code: timeout ? 'AI_CONNECTION_TIMEOUT' : 'AI_NETWORK_ERROR', retryable: true,
  });
}
export function providerError(status, result) {
  const raw = String(result?.error?.message || '');
  const reason = String(result?.error?.status || result?.error?.details?.find(d => d?.reason)?.reason || '');
  let message = 'AI 요청을 처리하지 못했어요. 다시 시도해주세요.', code = 'PROVIDER_FAILURE', retryable = false;
  if (status === 401 || status === 403 || /API.key.*(invalid|expired|not valid)|key.*(invalid|expired|leaked)|API_KEY_INVALID/i.test(raw + reason)) {
    message = 'AI 연결 설정을 확인해야 해요. 관리자에게 알려주세요.'; code = 'AI_KEY_REJECTED';
  } else if (status === 402 || /billing|prepay|credit balance|paid plan|free tier.*(not available|not supported)/i.test(raw)) {
    message = 'AI 제공 계정의 이용 설정을 확인해야 해요.'; code = 'AI_BILLING_UNAVAILABLE';
  } else if (status === 429) {
    message = 'AI 사용 한도에 도달했어요. 잠시 후 다시 시도해주세요.'; code = 'AI_QUOTA_EXCEEDED';
    // Only a specifically identified short rate limit may be retried, never daily/spend quotas.
    const quota = /daily|per.?day|spend|insufficient_quota|limit:\s*0|GenerateRequestsPerDay/i.test(raw);
    const rate = /per.?minute|per.?second|rate.?limit|GenerateRequestsPerMinute/i.test(raw);
    if (rate && !quota) { code = 'AI_RATE_LIMITED'; retryable = true; }
  } else if (status === 404) {
    message = 'AI 모델 설정을 확인해야 해요.'; code = 'AI_MODEL_UNAVAILABLE';
  } else if ([408, 500, 502, 503, 504].includes(status)) {
    message = 'AI 서버가 잠시 불안정해요. 다시 시도해주세요.'; code = 'AI_TEMPORARY_UNAVAILABLE'; retryable = true;
  } else if (status === 400) {
    message = 'AI 요청 설정을 확인해야 해요.'; code = 'AI_REQUEST_REJECTED';
  }
  return Object.assign(new Error(message), {
    statusCode: status === 429 ? 429 : 502, code, retryable, providerStatus: status,
    providerReason: /^[A-Z_]{1,40}$/.test(reason) ? reason : undefined,
  });
}
export function retryDelay(response, result, attempt, random = Math.random, now = Date.now) {
  const header = response?.headers?.get?.('retry-after');
  let delay = header ? (Number.isFinite(Number(header)) ? Number(header) * 1000 : Date.parse(header) - now()) : 0;
  const info = result?.error?.details?.find(d => String(d?.['@type'] || '').endsWith('RetryInfo'));
  const seconds = /^([\d.]+)s$/.exec(String(info?.retryDelay || ''));
  if (seconds) delay = Math.max(delay || 0, Number(seconds[1]) * 1000);
  return Math.max(500 * 2 ** attempt + Math.floor(random() * 250), Math.max(0, delay || 0));
}
export async function requestJson(url, options, budget, dependencies = {}) {
  const fetcher = dependencies.fetcher || globalThis.fetch;
  const wait = dependencies.wait || (ms => new Promise(resolve => setTimeout(resolve, ms)));
  const random = dependencies.random || Math.random;
  let last;
  for (let attempt = 0; attempt < 2; attempt++) {
    const remaining = budget.deadline - budget.now();
    if (remaining <= 0 || budget.requests >= budget.maxRequests) throw last || connectionError(true);
    budget.requests++;
    let response, result;
    try {
      // Includes body consumption; shares the deadline across retry/failover/continuation.
      response = await fetcher(url, { ...options, signal: AbortSignal.timeout(Math.max(1, Math.floor(Math.min(budget.requestTimeoutMs || 22000, remaining)))) });
      result = await response.json().catch(error => { if (error?.name === 'TimeoutError' || error?.name === 'AbortError') throw error; return null; });
      if (budget.now() >= budget.deadline) throw connectionError(true);
      if (!response.ok) throw providerError(response.status, result);
      if (!result || typeof result !== 'object' || Array.isArray(result)) {
        throw Object.assign(new Error('AI 응답 형식이 올바르지 않아요. 다시 시도해주세요.'), { statusCode: 502, code: 'AI_INVALID_RESPONSE', retryable: true });
      }
      return result;
    } catch (error) {
      last = error?.code && error?.statusCode ? error : connectionError(error?.name === 'TimeoutError' || error?.name === 'AbortError');
      const delay = retryDelay(response, result, attempt, random, budget.now);
      last.retryAfterMs = delay;
      // A slow model must leave time for the caller's alternate model. Repeating
      // the same timed-out request consumed the entire deadline before failover.
      if (!last.retryable || last.code === 'AI_CONNECTION_TIMEOUT' || attempt === 1 || delay > 5000 || budget.requests >= budget.maxRequests || budget.deadline - budget.now() <= delay + 1000) throw last;
      await wait(delay);
    }
  }
  throw last;
}
