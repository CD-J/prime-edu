import { baseRules, callOpenAI, fail, headers, json, parseAiJson, parseBody } from "./study-ai-core.mjs";
import { learnerPersonalization } from './learner-personalization.mjs';

export async function handler(event) {
  try {
    const body = parseBody(event);
    if (body.preflight) return { statusCode: 204, headers, body: "" };
    const topic = String(body.topic || "").trim();
    if (topic.length < 2) return json(400, { error: "읽고 싶은 주제를 두 글자 이상 입력해주세요." });

    const content = await callOpenAI(
      `${baseRules}
너는 중·고등학생을 위한 독서 큐레이터입니다. 실제 출간 여부를 확신하는 도서만 추천하고, 확실하지 않은 제목이나 저자는 만들지 마세요.
학생이 명시한 주제, 카테고리, 읽기 수준, 선호를 우선해 서로 다른 책을 정확히 3권 추천하세요. 학습 배경은 추천 이유에 활용하되 입력 주제를 바꾸지 마세요. 각 설명은 두 문장 이내로 간결하게 작성하세요.
ISBN, 가격, 재고, 판매 링크처럼 실시간 확인이 필요한 정보는 제공하지 마세요.
반드시 JSON만 출력하세요.
스키마:
{
  "summary": "추천 방향을 설명하는 한 문장",
  "books": [
    {
      "title": "정확한 도서명",
      "author": "저자명",
      "category": "분야",
      "reason": "이 학생에게 추천하는 이유",
      "learningPoint": "읽으며 생각할 질문 또는 학습 포인트"
    }
  ]
}`,
      `주제: ${topic}
카테고리: ${body.category || "문학"}
읽기 수준: ${body.level || "중학생 권장"}
선호: ${body.preference || "특별한 선호 없음"}
학습자 수준: ${body.learnerProfile?.level || "진단 전"}${learnerPersonalization(body.learnerProfile?.selfReport)}`,
    );
    const result = parseAiJson(content);
    return json(200, {
      summary: String(result.summary || ""),
      books: Array.isArray(result.books) ? result.books.slice(0, 3) : [],
    });
  } catch (error) {
    return fail(error);
  }
}
