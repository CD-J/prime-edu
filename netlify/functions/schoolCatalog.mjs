import { parseBody, json, headers, fail } from './study-ai-core.mjs';
import { verifyChatAccount, throttleChat } from './chat-auth.mjs';
import { fetchSchools } from './school-catalog-core.mjs';
export async function handler(event) {
  try {
    const input = parseBody(event);
    if (input.preflight) return { statusCode: 204, headers, body: '' };
    const query = String(input.query || '').trim();
    if (query.length < 2 || query.length > 80 || /[<>\x00-\x1f]/.test(query)) return json(400, { error: '학교 이름을 2–80자로 입력해주세요.' });
    const uid = await verifyChatAccount(event.headers); throttleChat(uid, event.headers);
    return json(200, await fetchSchools({ SCHUL_NM: query }));
  } catch (error) { return fail(error); }
}
