import { baseRules, callOpenAI, fail, headers, json, parseAiJson, parseBody } from "./study-ai-core.mjs";

export async function handler(event) {
  try {
    const body = parseBody(event);
    if (body.preflight) return { statusCode: 204, headers, body: "" };
    const content = await callOpenAI(
      `${baseRules}
반드시 JSON만 출력하세요. 스키마: {"summary":"요약","tasks":[{"date":"YYYY-MM-DD","subject":"과목","title":"할 일","reason":"추천 이유","minutes":30,"priority":"높음|보통|낮음"}]}
mode가 long이면 가까운 시험과 일정 사이에 여러 날짜로 과제를 분산하고, routine이면 selectedDate 하루에만 순서대로 배치하세요.`,
      `목표: ${body.goal || "오늘 공부 계획"}
가능 시간: ${body.availableMinutes || 90}분
집중 영역: ${body.focus || "시험 대비"}
오답 개념: ${(body.weakConcepts || []).join(", ") || "없음"}
계획 모드: ${body.mode || "routine"}
기준 날짜: ${body.selectedDate || new Date().toISOString().slice(0, 10)}
학습자 진단: ${JSON.stringify(body.learnerProfile || {})}

맥락:
${body.context || "없음"}`,
    );
    const plan = parseAiJson(content);
    if (!Array.isArray(plan?.tasks) || !plan.tasks.length || plan.tasks.some(t => !t || typeof t.title !== 'string' || !t.title.trim() || !Number.isFinite(Number(t.minutes)) || Number(t.minutes) <= 0)) {
      throw Object.assign(new Error('AI 계획을 제대로 받지 못했어요. 다시 시도해주세요.'), { statusCode: 502, code: 'AI_INVALID_RESPONSE', retryable: false });
    }
    return json(200, plan);
  } catch (error) {
    return fail(error);
  }
}
