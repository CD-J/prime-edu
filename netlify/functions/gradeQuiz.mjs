import { baseRules, callOpenAI, fail, headers, json, parseAiJson, parseBody } from "./study-ai-core.mjs";

export async function handler(event) {
  try {
    const body = parseBody(event);
    if (body.preflight) return { statusCode: 204, headers, body: "" };
    const content = await callOpenAI(
      `${baseRules}
학생 답안을 채점하고 오답 개념을 추출하세요. 반드시 JSON만 출력하세요.
스키마: {"score":0,"total":5,"feedback":"피드백","weakConcepts":["개념"],"details":[{"question":"문제","concept":"개념","answer":"학생 답","correctAnswer":"정답","correct":true,"errorType":"개념 혼동|조건 누락|계산/절차 실수|용어 이해 부족|근거 부족|이해 완료","conceptReview":"핵심 개념","commonMistake":"자주 하는 실수","nextPractice":"다음 연습","explanation":"최종 해설"}],"recommendedNext":"다음 학습 추천"}`,
      JSON.stringify({ quiz: body.quiz, answers: body.answers, durationSec: body.durationSec, learnerProfile: body.learnerProfile }).slice(0, 12000),
    );
    return json(200, parseAiJson(content));
  } catch (error) {
    return fail(error);
  }
}
