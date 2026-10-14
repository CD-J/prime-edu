export const NEIS_SOURCE = 'https://open.neis.go.kr/portal/data/service/selectServicePage.do?infId=OPEN17020190531110010104913&infSeq=2';
const cache = new Map();
const text = (value, size = 180) => String(value || '').trim().slice(0, size);
export function officialWebsite(value) {
  try { const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : ''; }
  catch { return ''; }
}
export function schoolMetadata(row) {
  return { name: text(row.SCHUL_NM, 80), schoolCode: text(row.SD_SCHUL_CODE, 12), officeCode: text(row.ATPT_OFCDC_SC_CODE, 8), kind: text(row.SCHUL_KND_SC_NM, 30), address: text(row.ORG_RDNMA), schoolType: text(row.HS_SC_NM || row.SCHUL_KND_SC_NM, 40), establishment: text(row.FOND_SC_NM, 30), website: officialWebsite(text(row.HMPG_ADRES)), source: NEIS_SOURCE };
}
export async function fetchSchools(params, fetcher = fetch) {
  const query = new URLSearchParams({ Type: 'json', pIndex: '1', pSize: '50', SCHUL_KND_SC_NM: '고등학교', ...params });
  if (process.env.NEIS_API_KEY) query.set('KEY', process.env.NEIS_API_KEY);
  const key = JSON.stringify(params);
  const saved = cache.get(key);
  if (saved && Date.now() - saved.time < 21600000) return saved.value;
  let response, data;
  try {
    response = await fetcher(`https://open.neis.go.kr/hub/schoolInfo?${query}`, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error();
    data = await response.json();
  } catch { throw Object.assign(new Error('공식 학교 정보에 연결하지 못했어요. 잠시 후 다시 검색해주세요.'), { statusCode: 503 }); }
  const result = data?.RESULT || data?.schoolInfo?.[0]?.head?.find(row => row.RESULT)?.RESULT;
  if (result?.CODE && !['INFO-000', 'INFO-200'].includes(result.CODE)) throw Object.assign(new Error('학교 정보 제공이 일시 중단됐어요. 관리자에게 알려주세요.'), { statusCode: 503 });
  const schools = (data?.schoolInfo?.[1]?.row || []).filter(row => row.SCHUL_KND_SC_NM === '고등학교').map(schoolMetadata);
  const total = Number(data?.schoolInfo?.[0]?.head?.find(row => row.list_total_count)?.list_total_count || 0);
  const value = { schools, limited: total > schools.length, total, dataAsOf: new Intl.DateTimeFormat('sv-SE', { timeZone:'Asia/Seoul' }).format(new Date()), source: NEIS_SOURCE };
  cache.set(key, { time: Date.now(), value });
  if (cache.size > 128) cache.delete(cache.keys().next().value);
  return value;
}
export async function resolveHighSchool(target) {
  if (!/^[A-Z]\d{2}$/.test(String(target?.officeCode || '')) || !/^\d{5,12}$/.test(String(target?.schoolCode || ''))) throw Object.assign(new Error('검색 결과에서 목표 고등학교를 선택해주세요.'), { statusCode: 400 });
  const result = await fetchSchools({ ATPT_OFCDC_SC_CODE: target.officeCode, SD_SCHUL_CODE: target.schoolCode });
  const school = result.schools.find(row => row.officeCode === target.officeCode && row.schoolCode === target.schoolCode);
  if (!school) throw Object.assign(new Error('목표 학교의 공식 정보를 확인하지 못했어요. 학교를 다시 선택해주세요.'), { statusCode: 400 });
  return { school, dataAsOf: result.dataAsOf };
}
