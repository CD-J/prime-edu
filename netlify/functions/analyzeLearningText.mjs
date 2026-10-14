import { baseRules, callOpenAI, fail, headers, json, parseAiJson, parseBody } from "./study-ai-core.mjs";

export async function handler(event) {
  try {
    const body = parseBody(event);
    if (body.preflight) return { statusCode: 204, headers, body: "" };
    const text = String(body.text || "").trim();
    const type = body.type === "reflection" ? "reflection" : "concept";
    const subject = String(body.subject || "").trim().slice(0, 40);
    const unit = String(body.unit || "").trim().slice(0, 80);
    if (text.length < 10) return json(400, { error: "분석할 내용을 10자 이상 입력하세요." });
    const content = await callOpenAI(
      `${baseRules}
학생이 작성한 ${type === "reflection" ? "학습 성찰" : "개념 필기"}를 분석하세요.
원문에 없는 사실을 만들지 말고 중학생도 이해할 수 있는 한국어로 작성하세요.
${type === "concept" ? `과목은 "${subject || "미지정"}", 단원은 "${unit || "미지정"}"입니다.
visualThinking은 필기의 중심 개념 하나와 서로 겹치지 않는 2~4개의 핵심 가지로 구성하세요.
각 가지의 detail은 정의·원리·예시·주의점 중 필기에 실제로 드러난 내용을 한 문장으로 정리하세요.` : ""}
반드시 JSON만 출력하세요.
{
  "summary": "핵심 요약 2~4문장",
  "keywords": ["핵심 키워드 1", "핵심 키워드 2", "핵심 키워드 3"],
  "feedback": "${type === "reflection" ? "잘한 점, 보완할 점, 다음 학습 행동을 포함한 피드백" : "이해를 확인할 질문 또는 보완할 개념"}",
  "visualThinking": ${type === "concept" ? `{
    "center": "중심 개념",
    "branches": [
      { "title": "핵심 가지", "detail": "한 문장 설명" }
    ]
  }` : "null"}
}`,
      text.slice(0, 7000),
    );
    const result = parseAiJson(content);
    const visualSource = result.visualThinking && typeof result.visualThinking === "object" ? result.visualThinking : {};
    return json(200, {
      summary: String(result.summary || ""),
      keywords: (Array.isArray(result.keywords) ? result.keywords : []).slice(0, 8).map(String),
      feedback: String(result.feedback || ""),
      visualThinking: type === "concept" ? {
        center: String(visualSource.center || unit || subject || "핵심 개념").slice(0, 60),
        branches: (Array.isArray(visualSource.branches) ? visualSource.branches : [])
          .slice(0, 4)
          .map((branch) => ({
            title: String(branch?.title || "").slice(0, 40),
            detail: String(branch?.detail || "").slice(0, 220),
          }))
          .filter((branch) => branch.title && branch.detail),
      } : null,
    });
  } catch (error) {
    return fail(error);
  }
}
