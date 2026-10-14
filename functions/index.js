const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret, defineString } = require("firebase-functions/params");

const aiApiKey = defineSecret("AI_API_KEY");
const aiProvider = defineString("AI_PROVIDER", { default: "gemini" });
const aiModel = defineString("AI_MODEL", { default: "" });
const TEXT_OUTPUT_TOKENS = 4096;
const JSON_OUTPUT_TOKENS = 4096;
const CONTINUE_ON_TRUNCATION = "Continue exactly from where the previous answer stopped. Do not restart or repeat earlier content.";

const BASE_RULES = `당신은 Prime Edu의 AI 도우미 '스도'입니다. 중학생의 개인 학습을 돕습니다.
시간표, 학사일정, 급식, 개인 일정, D-day, 학습 기록, 오답 개념을 함께 보고 학생이 오늘 실제로 실행할 수 있는 공부를 설계합니다.

공통 규칙:
- 이름을 물으면 '스도'라고 소개하세요. 매 답변마다 자기소개나 서비스 소개를 반복하지 마세요.
- 학생에게 과도한 공부량을 강요하지 말고 실행 가능한 단위로 쪼개세요.
- 날짜, 요일, 교시, 과목, 분량을 구체적으로 말하세요.
- 데이터에 없는 학교 일정은 추측하지 말고 "등록된 일정에 없습니다"라고 말하세요.
- AI 결과는 학생이 수정하고 검토할 수 있는 초안임을 자연스럽게 안내하세요.
- AI 생성 결과는 수업자료, 교과서, 선생님 설명과 비교해 검증하도록 안내하세요.
- 공부나 학교생활 고민에는 먼저 감정을 짧게 공감하고, 학생이 지금 할 수 있는 작은 행동과 도움을 요청할 사람을 함께 제안하세요.
- 너는 전문 상담사나 의료인이 아닙니다. 자해·자살·폭력·학대처럼 즉각적인 위험이 드러나면 혼자 해결하려 하지 말고 보호자, 교사, 전문상담교사 또는 긴급 도움 기관에 즉시 알리도록 분명히 안내하세요.
- 한국어로 친절하고 간결하게 답하세요.`;

function setCors(res) {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
}

function handlePreflight(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return true;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "POST만 지원합니다." });
    return true;
  }
  return false;
}

function getRuntime() {
  const apiKey = aiApiKey.value();
  if (!apiKey) {
    const error = new Error("AI가 아직 설정되지 않았습니다. Firebase에 AI_API_KEY 시크릿을 추가해주세요.");
    error.status = 500;
    throw error;
  }
  return {
    apiKey,
    provider: (aiProvider.value() || "gemini").toLowerCase(),
    model: aiModel.value() || "",
  };
}

function buildSystemText(extra, context) {
  const today = new Date().toISOString().split("T")[0];
  return `${BASE_RULES}

${extra || ""}

오늘 날짜: ${today}

=== 현재 학습/학교 데이터 ===
${context || "데이터 없음"}`;
}

async function callGemini(apiKey, systemText, messages, model, jsonMode = false) {
  const geminiModel = model || "gemini-2.0-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`;
  let contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: String(m.content || "") }],
  }));
  let fullReply = "";

  for (let attempt = 0; attempt < (jsonMode ? 1 : 3); attempt += 1) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemText }] },
        contents,
        generationConfig: {
          temperature: jsonMode ? 0.2 : 0.35,
          maxOutputTokens: jsonMode ? JSON_OUTPUT_TOKENS : TEXT_OUTPUT_TOKENS,
          ...(jsonMode ? { responseMimeType: "application/json" } : {}),
        },
      }),
    });
    const result = await response.json();
    if (!response.ok) {
      console.error("Gemini error:", result);
      throw new Error(result?.error?.message || "Gemini API 오류");
    }
    const candidate = result.candidates?.[0] || {};
    const reply = candidate.content?.parts?.map((part) => part.text || "").join("\n").trim();
    if (!reply) throw new Error("Gemini 응답이 비어 있습니다.");
    fullReply = `${fullReply}${fullReply ? "\n" : ""}${reply}`.trim();
    if (candidate.finishReason !== "MAX_TOKENS") return fullReply;

    contents = [
      ...contents,
      { role: "model", parts: [{ text: reply }] },
      { role: "user", parts: [{ text: CONTINUE_ON_TRUNCATION }] },
    ];
  }

  return fullReply;
}

async function callOpenAI(apiKey, systemText, messages, model, jsonMode = false) {
  let openAiMessages = [
    { role: "system", content: systemText },
    ...messages.map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content || ""),
    })),
  ];
  let fullReply = "";

  for (let attempt = 0; attempt < (jsonMode ? 1 : 3); attempt += 1) {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model || "gpt-4o-mini",
        messages: openAiMessages,
        temperature: jsonMode ? 0.2 : 0.35,
        max_tokens: jsonMode ? JSON_OUTPUT_TOKENS : TEXT_OUTPUT_TOKENS,
        ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
      }),
    });
    const result = await response.json();
    if (!response.ok) {
      console.error("OpenAI error:", result);
      throw new Error(result?.error?.message || "OpenAI API 오류");
    }
    const choice = result.choices?.[0] || {};
    const reply = choice.message?.content || "";
    fullReply = `${fullReply}${fullReply ? "\n" : ""}${reply}`.trim();
    if (choice.finish_reason !== "length") return fullReply || "응답을 생성하지 못했습니다.";

    openAiMessages = [
      ...openAiMessages,
      { role: "assistant", content: reply },
      { role: "user", content: CONTINUE_ON_TRUNCATION },
    ];
  }

  return fullReply || "응답을 생성하지 못했습니다.";
}

async function callAI({ systemText, messages, jsonMode = false }) {
  const runtime = getRuntime();
  return runtime.provider === "openai"
    ? callOpenAI(runtime.apiKey, systemText, messages, runtime.model, jsonMode)
    : callGemini(runtime.apiKey, systemText, messages, runtime.model, jsonMode);
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = String(text || "").match(/\{[\s\S]*\}/);
    if (!match) throw new Error("AI가 JSON 형식으로 응답하지 않았습니다.");
    return JSON.parse(match[0]);
  }
}

function safeError(res, error) {
  console.error("AI function error:", error);
  res.status(error.status || 500).json({ error: error.message || "AI 처리 중 오류가 발생했습니다." });
}

exports.chat = onRequest(
  { secrets: [aiApiKey], cors: true, region: "asia-northeast3", maxInstances: 10 },
  async (req, res) => {
    if (handlePreflight(req, res)) return;
    const { messages, scheduleContext } = req.body || {};
    if (!Array.isArray(messages) || !messages.length) {
      res.status(400).json({ error: "메시지가 필요합니다." });
      return;
    }
    try {
      const systemText = buildSystemText(
        `너는 학교생활 도우미이면서 학습 코치입니다.
일정·시간표·급식 질문에는 정확히 답하고, 공부 계획·복습·퀴즈 요청에는 학생이 바로 실행할 수 있는 다음 행동을 제안하세요.
학교생활이나 공부 고민에는 판단하지 않고 먼저 들어준 뒤, 감정을 정리할 질문과 부담 없는 다음 행동을 제안하세요.`,
        scheduleContext,
      );
      const reply = await callAI({ systemText, messages });
      res.status(200).json({ reply });
    } catch (error) {
      safeError(res, error);
    }
  },
);

exports.generateStudyPlan = onRequest(
  { secrets: [aiApiKey], cors: true, region: "asia-northeast3", maxInstances: 10 },
  async (req, res) => {
    if (handlePreflight(req, res)) return;
    const { goal, availableMinutes, focus, context, weakConcepts, mode, selectedDate, learnerProfile } = req.body || {};
    try {
      const systemText = buildSystemText(
        `반드시 JSON만 출력하세요.
스키마:
{
  "summary": "오늘 계획 한 줄 요약",
  "tasks": [
    {
      "date": "YYYY-MM-DD",
      "subject": "과목",
      "title": "할 일",
      "reason": "추천 이유",
      "minutes": 30,
      "priority": "높음|보통|낮음"
    }
  ]
}
tasks는 3~6개, 전체 시간은 학생 가능 시간 안에 맞추세요.
mode가 long이면 가까운 시험과 일정 사이에 여러 날짜로 과제를 분산하고, routine이면 selectedDate 하루에만 순서대로 배치하세요.`,
        context,
      );
      const content = await callAI({
        systemText,
        jsonMode: true,
        messages: [
          {
            role: "user",
            content: `목표: ${goal || "오늘 공부 계획"}
가능 시간: ${availableMinutes || 90}분
집중 영역: ${focus || "시험 대비와 숙제"}
최근 오답 개념: ${(weakConcepts || []).join(", ") || "없음"}
계획 모드: ${mode || "routine"}
기준 날짜: ${selectedDate || new Date().toISOString().slice(0, 10)}
학습자 진단: ${JSON.stringify(learnerProfile || {})}`,
          },
        ],
      });
      res.status(200).json(parseJson(content));
    } catch (error) {
      safeError(res, error);
    }
  },
);

exports.generateQuiz = onRequest(
  { secrets: [aiApiKey], cors: true, region: "asia-northeast3", maxInstances: 10 },
  async (req, res) => {
    if (handlePreflight(req, res)) return;
    const { subject, unit, difficulty, count, noteText } = req.body || {};
    if (!noteText || String(noteText).trim().length < 20) {
      res.status(400).json({ error: "퀴즈를 만들 필기 내용이 충분하지 않습니다." });
      return;
    }
    try {
      const systemText = `${BASE_RULES}

너는 중학생의 필기를 바탕으로 확인 퀴즈를 만드는 AI입니다.
반드시 JSON만 출력하세요.
스키마:
{
  "title": "퀴즈 제목",
  "questions": [
    {
      "type": "multiple_choice|short_answer|essay",
      "concept": "핵심 개념",
      "question": "문제",
      "options": ["선택지1", "선택지2", "선택지3", "선택지4"],
      "answer": "정답",
      "explanation": "해설",
      "conceptReview": "핵심 개념 보충 설명",
      "commonMistake": "자주 하는 실수",
      "nextPractice": "다음 연습 제안"
    }
  ]
}
객관식, 단답형, 서술형을 섞되 객관식 options는 4개로 만드세요.
각 문항에 정확한 정답과 학생 눈높이의 짧고 명확한 해설을 포함하세요.`;
      const content = await callAI({
        systemText,
        jsonMode: true,
        messages: [
          {
            role: "user",
            content: `과목: ${subject || "미지정"}
단원: ${unit || "미지정"}
난이도: ${difficulty || "중간"}
문항 수: ${Math.max(2, Math.min(Number(count) || 5, 10))}

필기:
${String(noteText).slice(0, 8000)}`,
          },
        ],
      });
      res.status(200).json(parseJson(content));
    } catch (error) {
      safeError(res, error);
    }
  },
);

exports.gradeQuiz = onRequest(
  { secrets: [aiApiKey], cors: true, region: "asia-northeast3", maxInstances: 10 },
  async (req, res) => {
    if (handlePreflight(req, res)) return;
    const { quiz, answers, durationSec, learnerProfile } = req.body || {};
    if (!quiz || !Array.isArray(quiz.questions) || !Array.isArray(answers)) {
      res.status(400).json({ error: "퀴즈와 답안이 필요합니다." });
      return;
    }
    try {
      const systemText = `${BASE_RULES}

너는 중학생 답안을 채점하고 오답 개념을 추출하는 AI입니다.
반드시 JSON만 출력하세요.
스키마:
{
  "score": 0,
  "total": 5,
  "feedback": "전체 피드백",
  "weakConcepts": ["복습할 개념"],
  "details": [
    {
      "question": "문제",
      "concept": "관련 개념",
      "answer": "학생 답",
      "correctAnswer": "정답",
      "correct": true,
      "errorType": "개념 혼동|조건 누락|계산/절차 실수|용어 이해 부족|근거 부족|이해 완료",
      "conceptReview": "핵심 개념 보충 설명",
      "commonMistake": "자주 하는 실수",
      "nextPractice": "다음 연습 제안",
      "explanation": "최종 해설"
    }
  ],
  "recommendedNext": "다음 학습 추천"
}`;
      const content = await callAI({
        systemText,
        jsonMode: true,
        messages: [
          {
            role: "user",
            content: JSON.stringify({ quiz, answers, durationSec, learnerProfile }).slice(0, 12000),
          },
        ],
      });
      res.status(200).json(parseJson(content));
    } catch (error) {
      safeError(res, error);
    }
  },
);

exports.generateLearningDiagnosis = onRequest(
  { secrets: [aiApiKey], cors: true, region: "asia-northeast3", maxInstances: 10 },
  async (req, res) => {
    if (handlePreflight(req, res)) return;
    const { context, learnerProfile, attempts, sessions, tasks } = req.body || {};
    try {
      const systemText = buildSystemText(
        `너는 중학생의 학습 기록을 진단하는 AI입니다.
반드시 JSON만 출력하세요.
스키마:
{
  "summary": "진단 요약",
  "level": "진단 준비 중|기초 보강|성장 구간|안정권",
  "strengths": ["강점"],
  "weaknesses": ["취약 개념"],
  "recommendedDifficulty": "쉬움|중간|어려움",
  "nextPath": ["다음 학습 단계"],
  "restAlert": "휴식 또는 학습 방식 전환 제안"
}
정답률, 오답 유형, 학습 시간, 완료 루틴을 종합해 판단하세요.`,
        context,
      );
      const content = await callAI({
        systemText,
        jsonMode: true,
        messages: [
          {
            role: "user",
            content: JSON.stringify({
              learnerProfile,
              attempts: (attempts || []).slice(0, 12),
              sessions: (sessions || []).slice(0, 12),
              tasks: (tasks || []).slice(0, 12),
            }).slice(0, 12000),
          },
        ],
      });
      res.status(200).json(parseJson(content));
    } catch (error) {
      safeError(res, error);
    }
  },
);

exports.recommendBooks = onRequest(
  { secrets: [aiApiKey], cors: true, region: "asia-northeast3", maxInstances: 10 },
  async (req, res) => {
    if (handlePreflight(req, res)) return;
    const { topic, category, level, preference, learnerProfile } = req.body || {};
    if (String(topic || "").trim().length < 2) {
      res.status(400).json({ error: "읽고 싶은 주제를 두 글자 이상 입력해주세요." });
      return;
    }
    try {
      const systemText = `${BASE_RULES}

너는 중·고등학생을 위한 독서 큐레이터입니다. 실제 출간 여부를 확신하는 도서만 추천하고, 확실하지 않은 제목이나 저자는 만들지 마세요.
학생의 주제, 카테고리, 읽기 수준, 선호를 반영해 서로 다른 책을 정확히 3권 추천하세요. 각 설명은 두 문장 이내로 간결하게 작성하세요.
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
}`;
      const content = await callAI({
        systemText,
        jsonMode: true,
        messages: [{
          role: "user",
          content: `주제: ${String(topic).trim()}
카테고리: ${category || "문학"}
읽기 수준: ${level || "중학생 권장"}
선호: ${preference || "특별한 선호 없음"}
학습자 수준: ${learnerProfile?.level || "진단 전"}`,
        }],
      });
      const result = parseJson(content);
      res.status(200).json({
        summary: String(result.summary || ""),
        books: Array.isArray(result.books) ? result.books.slice(0, 3) : [],
      });
    } catch (error) {
      safeError(res, error);
    }
  },
);

function normalizeAdmissionBand(value) {
  return ["reach", "match", "safe"].includes(value) ? value : "match";
}

function clampAdmissionNumber(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

const retiredRecommendAdmissions = onRequest(
  { secrets: [aiApiKey], cors: true, region: "asia-northeast3", maxInstances: 10 },
  async (req, res) => {
    if (handlePreflight(req, res)) return;
    const body = req.body || {};
    if (!["middle", "high"].includes(body.schoolLevel)) {
      res.status(400).json({ error: "학교급을 중학교 또는 고등학교로 선택하세요." });
      return;
    }
    const maxGrade = body.gradeSystem === "grade9" ? 9 : 5;
    const average = Number(body.average);
    if (!Number.isFinite(average) || average < 1 || average > maxGrade) {
      res.status(400).json({ error: `평균 성적은 1~${maxGrade} 범위로 입력하세요.` });
      return;
    }
    const input = {
      mode: body.mode === "detailed" ? "detailed" : "quick",
      schoolLevel: body.schoolLevel,
      gradeSystem: String(body.gradeSystem || ""),
      average,
      region: String(body.region || "").slice(0, 60),
      interest: String(body.interest || "").slice(0, 80),
      track: String(body.track || "").slice(0, 80),
      subjects: String(body.subjects || "").slice(0, 1200),
      mockExam: String(body.mockExam || "").slice(0, 400),
    };
    const isMiddle = input.schoolLevel === "middle";
    const officialUrl = isMiddle ? "https://www.schoolinfo.go.kr/" : "https://www.adiga.kr/";
    try {
      const content = await callAI({
        systemText: `${BASE_RULES}

당신은 대한민국 중·고등학생의 진학 탐색을 돕는 AI입니다.
개인정보 없이 익명 성적 요약, 지역, 관심 분야만 분석합니다.
실제로 존재하는 ${isMiddle ? "고등학교" : "대학과 학과"}를 최대 6개 추천하세요.
실시간 공식 입결 자료가 제공되지 않았으므로 모든 결과는 AI 추정입니다.
상향(reach), 적정(match), 안정(safe)을 고르게 제시하고 합격을 단정하지 마세요.
중학생 결과의 신뢰도는 low, 고등학생 결과는 low 또는 medium만 사용하세요.
반드시 JSON만 출력하세요.
{
  "summary": "탐색 요약",
  "recommendations": [{
    "institutionName": "실제 기관명",
    "program": "학과 또는 학교 유형",
    "region": "지역",
    "band": "reach|match|safe",
    "probabilityRange": {"min": 20, "max": 45},
    "confidence": "low|medium",
    "reasons": ["근거 1", "근거 2"],
    "improvementGoal": "보완 목표"
  }]
}`,
        jsonMode: true,
        messages: [{ role: "user", content: JSON.stringify(input) }],
      });
      const parsed = parseJson(content);
      const recommendations = (Array.isArray(parsed.recommendations) ? parsed.recommendations : [])
        .slice(0, 6)
        .map((item) => {
          const min = clampAdmissionNumber(item?.probabilityRange?.min, 5, 90);
          const max = clampAdmissionNumber(item?.probabilityRange?.max, min + 5, 95);
          return {
            institutionName: String(item.institutionName || "추천 기관"),
            program: String(item.program || ""),
            region: String(item.region || input.region || ""),
            band: normalizeAdmissionBand(item.band),
            probabilityRange: { min, max },
            confidence: isMiddle ? "low" : (item.confidence === "medium" ? "medium" : "low"),
            estimateBasis: "ai_inference",
            reasons: (Array.isArray(item.reasons) ? item.reasons : []).slice(0, 3).map(String),
            improvementGoal: String(item.improvementGoal || "최신 모집요강과 성적 반영 방식을 확인하세요."),
            officialUrl,
            sourceLabel: isMiddle ? "학교알리미에서 재확인" : "대입정보포털 어디가에서 재확인",
          };
        });
      if (!recommendations.length) {
        res.status(502).json({ error: "추천 결과가 비어 있습니다. 조건을 더 구체적으로 입력해 주세요." });
        return;
      }
      res.status(200).json({
        summary: String(parsed.summary || "입력한 성적과 희망 조건을 기준으로 탐색 범위를 정리했습니다."),
        calculation: { average, gradeSystem: input.gradeSystem, mode: input.mode },
        recommendations,
        dataDate: new Date().toISOString().slice(0, 10),
        disclaimer: "AI 진학 탐색 보조자료이며 합격을 보장하지 않습니다. 최신 모집요강과 공식 자료를 반드시 확인하세요.",
      });
    } catch (error) {
      safeError(res, error);
    }
  },
);
