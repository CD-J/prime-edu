import { schoolMetadata } from "./school-catalog-core.mjs";
const cache = new Map();
export async function adminSchools(input, fetcher = fetch) {
  const kind =
    input.level === "high"
      ? "고등학교"
      : input.level === "middle"
        ? "중학교"
        : null;
  if (!kind)
    throw Object.assign(Error("학교급을 확인해주세요."), {
      statusCode: 400,
      code: "INVALID_SCHOOL",
    });
  const params = {
    Type: "json",
    pIndex: "1",
    pSize: "50",
    SCHUL_KND_SC_NM: kind,
  };
  if (input.school) {
    if (
      !/^[A-Z]\d{2}$/.test(input.school.officeCode || "") ||
      !/^\d{5,12}$/.test(input.school.schoolCode || "")
    )
      throw Object.assign(Error("검색 결과에서 학교를 선택해주세요."), {
        statusCode: 400,
        code: "INVALID_SCHOOL",
      });
    Object.assign(params, {
      ATPT_OFCDC_SC_CODE: input.school.officeCode,
      SD_SCHUL_CODE: input.school.schoolCode,
    });
  } else {
    const query = String(input.query || "").trim();
    if (query.length < 2 || query.length > 80 || /[<>\x00-\x1f]/.test(query))
      throw Object.assign(Error("학교 이름을 2자 이상 입력해주세요."), {
        statusCode: 400,
        code: "INVALID_SCHOOL",
      });
    params.SCHUL_NM = query;
  }
  const key = JSON.stringify(params),
    saved = cache.get(key);
  if (saved && Date.now() - saved.time < 3600000) return saved.rows;
  if (process.env.NEIS_API_KEY) params.KEY = process.env.NEIS_API_KEY;
  let data;
  try {
    const res = await fetcher(
      "https://open.neis.go.kr/hub/schoolInfo?" + new URLSearchParams(params),
      { signal: AbortSignal.timeout(10000) },
    );
    if (!res.ok) throw Error();
    data = await res.json();
    const code =
      data.RESULT?.CODE ||
      data.schoolInfo?.[0]?.head?.find((v) => v.RESULT)?.RESULT?.CODE;
    if (code && !["INFO-000", "INFO-200"].includes(code)) throw Error();
  } catch {
    throw Object.assign(Error("공식 학교 정보에 연결하지 못했어요."), {
      statusCode: 503,
      code: "SCHOOL_UNAVAILABLE",
    });
  }
  const rows = (data.schoolInfo?.[1]?.row || [])
    .filter((row) => row.SCHUL_KND_SC_NM === kind)
    .map(schoolMetadata);
  cache.set(key, { time: Date.now(), rows });
  if (cache.size > 100) cache.delete(cache.keys().next().value);
  return rows;
}
