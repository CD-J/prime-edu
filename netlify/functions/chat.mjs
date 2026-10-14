import { callMessages, headers } from "./study-ai-core.mjs";
import { SUDO_IDENTITY, moduleActions, chatInput } from './sudo-system.mjs';
import { verifyChatAccount, throttleChat } from './chat-auth.mjs';

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "POST만 지원합니다." }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "잘못된 요청입니다." }) };
  }

  try {
    const input = chatInput(body);
    const uid = await verifyChatAccount(event.headers);
    throttleChat(uid, event.headers);
    const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date());
    const systemText = `${SUDO_IDENTITY}\n오늘 날짜(한국): ${today}\n<학교와 학습 참고 데이터>\n${input.context || '등록된 데이터 없음'}\n</학교와 학습 참고 데이터>\n<이전 대화 참고>\n${uid ? input.memory : '로그인하지 않아 계정 기억을 사용하지 않습니다.'}\n</이전 대화 참고>`;
    const reply = await callMessages(
      systemText,
      input.messages,
      false,
      {interactive:true,maxOutputTokens:2048},
    );
    return { statusCode: 200, headers, body: JSON.stringify({ reply, actions: moduleActions(input.messages.at(-1).content), persona: 'sudo', memoryUsed: Boolean(uid && input.memory) }) };
  } catch (error) {
    console.error("Chat function error", { code: error.code || 'PROVIDER_FAILURE', status: error.statusCode || 500 });
    return {
      statusCode: error.statusCode || 500,
      headers:{...headers,...(error.retryAfterMs?{'Retry-After':String(Math.ceil(error.retryAfterMs/1000))}:{})},
      body: JSON.stringify({ error: error.message || "서버 오류가 발생했습니다.", code: error.code || 'PROVIDER_FAILURE', retryable: Boolean(error.retryable),retryAfterMs:error.retryAfterMs||0 }),
    };
  }
}
