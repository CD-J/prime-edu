import { createVerify } from 'node:crypto';
let certificates = null;
let certificateExpires = 0;
const buckets = new Map();

export async function verifyChatAccount(headers = {}) {
  const authorization = headers.authorization || headers.Authorization || '';
  if (!authorization) return null;
  const token = authorization.replace(/^Bearer\s+/i, '');
  const denied = () => Object.assign(new Error('로그인 상태가 만료됐습니다. 다시 로그인해주세요.'), { statusCode: 401, code: 'AUTH_EXPIRED' });
  try {
    const parts = token.split('.');
    if (parts.length !== 3) throw denied();
    const head = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
    const claim = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    const project = process.env.FIREBASE_PROJECT_ID || 'scheplan';
    const now = Math.floor(Date.now() / 1000);
    if (head.alg !== 'RS256' || !head.kid || claim.aud !== project || claim.iss !== `https://securetoken.google.com/${project}` || typeof claim.sub !== 'string' || !claim.sub || claim.sub.length > 128 || !Number.isFinite(claim.exp) || !Number.isFinite(claim.iat) || claim.exp <= now || claim.iat > now + 60) throw denied();
    if (!certificates || Date.now() > certificateExpires) {
      const res = await fetch('https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com', { signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw Object.assign(new Error('로그인 확인 서버에 연결하지 못했습니다. 다시 시도해주세요.'), { statusCode: 503, code: 'AUTH_UNAVAILABLE' });
      certificates = await res.json();
      certificateExpires = Date.now() + Math.min(Number(res.headers.get('cache-control')?.match(/max-age=(\d+)/)?.[1] || 300), 3600) * 1000;
    }
    const verify = createVerify('RSA-SHA256'); verify.update(`${parts[0]}.${parts[1]}`); verify.end();
    if (!certificates[head.kid] || !verify.verify(certificates[head.kid], Buffer.from(parts[2], 'base64url'))) throw denied();
    return claim.sub;
  } catch (error) {
    if (error.statusCode === 503) throw error;
    throw denied();
  }
}

// Per-instance burst protection; durable organization-wide quotas remain a separate ops task.
export function throttleChat(uid, headers = {}, now = Date.now()) {
  const key = uid ? `uid:${uid}` : `guest:${String(headers['x-forwarded-for'] || 'unknown').split(',')[0].trim()}`;
  const old = buckets.get(key);
  const bucket = old && now - old.started < 60000 ? old : { started: now, count: 0 };
  bucket.count++; buckets.set(key, bucket);
  if (buckets.size > 2000) for (const [id, value] of buckets) if (now - value.started >= 60000) buckets.delete(id);
  if (bucket.count > (uid ? 12 : 6)) throw Object.assign(new Error('질문이 잠시 몰렸어요. 1분 안에 다시 시도할 수 있어요.'), { statusCode: 429, code: 'RATE_LIMITED',retryable:true,retryAfterMs:Math.max(1000,60000-(now-bucket.started)) });
}
