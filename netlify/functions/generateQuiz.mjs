import { baseRules, callOpenAI, fail, headers, json, parseAiJson, parseBody } from "./study-ai-core.mjs";
import { learnerPersonalization } from './learner-personalization.mjs';

export async function handler(event) {
  try {
    const body = parseBody(event);
    if (body.preflight) return { statusCode: 204, headers, body: "" };
    if (!body.noteText || String(body.noteText).trim().length < 20) return json(400, { error: "퀴즈를 만들 필기 내용이 충분하지 않습니다." });
    const content = await callOpenAI(
      `${baseRules}
필기 기반 확인 퀴즈를 만드세요. 반드시 JSON만 출력하세요.
스키마: {"title":"제목","questions":[{"type":"multiple_choice|short_answer|essay","concept":"개념","question":"문제","options":["A","B","C","D"],"answer":"정답","explanation":"해설","conceptReview":"핵심 개념","commonMistake":"자주 하는 실수","nextPractice":"다음 연습"}]}
각 문항에 정확한 정답과 학생 눈높이의 짧고 명확한 해설을 포함하세요. 명시한 과목·단원과 필기를 우선하고, 학습 배경은 표현과 분량 조정에만 활용하세요. 배경 진도 때문에 다른 과목으로 바꾸지 마세요.`,
      `과목: ${body.subject || "미지정"}
단원: ${body.unit || "미지정"}
난이도: ${body.difficulty || "중간"}
문항 수: ${body.count || 5}${learnerPersonalization(body.learningContext)}

필기:
${String(body.noteText).slice(0, 8000)}`,
    );
    return json(200, parseAiJson(content));
  } catch (error) {
    return fail(error);
  }
}
