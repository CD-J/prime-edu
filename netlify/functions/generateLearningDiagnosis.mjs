import { baseRules, callOpenAI, fail, headers, json, parseAiJson, parseBody } from "./study-ai-core.mjs";

export async function handler(event) {
  try {
    const body = parseBody(event);
    if (body.preflight) return { statusCode: 204, headers, body: "" };
    const content = await callOpenAI(
      `${baseRules}
학습 기록을 바탕으로 개인 맞춤형 진단을 만드세요. 반드시 JSON만 출력하세요.
스키마: {"summary":"진단 요약","level":"진단 준비 중|기초 보강|성장 구간|안정권","strengths":["강점"],"weaknesses":["취약 개념"],"recommendedDifficulty":"쉬움|중간|어려움","nextPath":["다음 학습 단계"],"restAlert":"휴식 또는 학습 방식 전환 제안"}
정답률, 오답 유형, 학습 시간, 완료 루틴을 종합해 판단하세요.`,
      JSON.stringify({
        context: body.context,
        learnerProfile: body.learnerProfile,
        attempts: (body.attempts || []).slice(0, 12),
        sessions: (body.sessions || []).slice(0, 12),
        tasks: (body.tasks || []).slice(0, 12),
      }).slice(0, 12000),
    );
    return json(200, parseAiJson(content));
  } catch (error) {
    return fail(error);
  }
}
