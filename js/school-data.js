(function () {
  const API_ROOT = "https://open.neis.go.kr/hub";
  const CACHE_PREFIX = "primeEduSchoolData.v1";
  const CACHE_MAX_AGE_MS = 6 * 60 * 60 * 1000;

  function clean(value) {
    return String(value ?? "").trim();
  }

  function compactDate(value) {
    return clean(value).replaceAll("-", "");
  }

  function cacheKey(type, parts) {
    return `${CACHE_PREFIX}.${type}.${parts.map(clean).join(".")}`;
  }

  function readCacheRecord(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || "null");
    } catch {
      return null;
    }
  }

  function readCache(key) {
    return readCacheRecord(key)?.value ?? null;
  }

  function writeCache(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify({ savedAt: new Date().toISOString(), value }));
    } catch {
      /* Storage can be unavailable in restricted browser modes. */
    }
  }

  function clearCache() {
    try {
      Object.keys(localStorage)
        .filter((key) => key.startsWith(`${CACHE_PREFIX}.`) || key.startsWith("meal.v2."))
        .forEach((key) => localStorage.removeItem(key));
    } catch {
      /* ignore */
    }
  }

  async function request(endpoint, params) {
    const query = new URLSearchParams({ Type: "json", pIndex: "1", pSize: "1000", ...params });
    const response = await fetch(`${API_ROOT}/${endpoint}?${query.toString()}`);
    if (!response.ok) throw new Error(`학교 정보 API 오류: ${response.status}`);
    const result = await response.json();
    const topLevelResult = result?.RESULT;
    if (topLevelResult) {
      if (topLevelResult.CODE === "INFO-200") return { rows: [], total: 0 };
      throw new Error(topLevelResult.MESSAGE || `학교 정보 API 오류: ${topLevelResult.CODE}`);
    }
    const block = result?.[endpoint];
    const head = block?.[0]?.head;
    const resultCode = head?.find((item) => item.RESULT)?.RESULT?.CODE;
    if (resultCode && !["INFO-000", "INFO-200"].includes(resultCode)) {
      const message = head?.find((item) => item.RESULT)?.RESULT?.MESSAGE;
      throw new Error(message || "학교 정보를 불러오지 못했습니다.");
    }
    const total = Number(head?.find((item) => item.list_total_count)?.list_total_count || 0);
    return { rows: block?.[1]?.row || [], total };
  }

  async function cachedRequest(type, parts, loader) {
    const key = cacheKey(type, parts);
    const saved = readCacheRecord(key);
    if (saved?.savedAt && Date.now() - new Date(saved.savedAt).getTime() < CACHE_MAX_AGE_MS) {
      return { value: saved.value || [], cached: true };
    }
    try {
      const value = await loader();
      writeCache(key, value);
      return { value, cached: false };
    } catch (error) {
      const cached = readCache(key);
      if (cached) return { value: cached, cached: true, error };
      throw error;
    }
  }

  async function searchSchools(query, schoolLevel) {
    const name = clean(query);
    if (name.length < 2) return [];
    const { rows } = await request("schoolInfo", { SCHUL_NM: name });
    const expected = schoolLevel === "high" ? "고등학교" : "중학교";
    return rows
      .filter((row) => clean(row.SCHUL_KND_SC_NM).includes(expected))
      .slice(0, 20)
      .map((row) => ({
        name: clean(row.SCHUL_NM),
        address: clean(row.ORG_RDNMA),
        officeCode: clean(row.ATPT_OFCDC_SC_CODE),
        schoolCode: clean(row.SD_SCHUL_CODE),
        kind: clean(row.SCHUL_KND_SC_NM),
      }));
  }

  function profileParts(profile) {
    return [
      profile?.school?.officeCode,
      profile?.school?.schoolCode,
      profile?.schoolLevel,
      profile?.grade,
      profile?.classNo,
    ];
  }

  async function fetchTimetable(profile, from, to) {
    const endpoint = profile.schoolLevel === "high" ? "hisTimetable" : "misTimetable";
    const params = {
      ATPT_OFCDC_SC_CODE: profile.school.officeCode,
      SD_SCHUL_CODE: profile.school.schoolCode,
      GRADE: String(profile.grade),
      CLASS_NM: String(profile.classNo),
      TI_FROM_YMD: compactDate(from),
      TI_TO_YMD: compactDate(to),
    };
    return cachedRequest("timetable-v2", [...profileParts(profile), from, to], async () => {
      const results = await Promise.all(
        Array.from({ length: 10 }, (_, index) => request(endpoint, { ...params, PERIO: String(index + 1) }))
      );
      const rows = results.flatMap((result) => result.rows);
      const departments = [...new Set(rows.map((row) => clean(row.DDDEP_NM)).filter(Boolean))];
      if (profile.schoolLevel === "high" && departments.length > 1) {
        throw new Error("여러 학과의 시간표가 확인됩니다. 현재는 일반학급 시간표만 지원합니다.");
      }
      return rows.map((row) => ({
        date: clean(row.ALL_TI_YMD),
        period: Number(row.PERIO),
        subject: clean(row.ITRT_CNTNT),
        department: clean(row.DDDEP_NM),
        classroom: clean(row.CLRM_NM),
      }));
    });
  }

  async function fetchStableTimetable(profile,from,to) {
    const month=Number(from.slice(5,7)),year=Number(from.slice(0,4))-(month<3?1:0),term=month>=8||month<3?'2':'1';
    const key=cacheKey('regular-v1',[...profileParts(profile),year,term]);
    const stored=readCache(key)||[];
    const week=await fetchTimetable(profile,from,to);
    let rows=week.value;
    const exceptional=rows.some(r=>window.PrimeTimetable.classify(r.subject));
    const normalDays=new Set(rows.filter(r=>!window.PrimeTimetable.classify(r.subject)).map(r=>new Date(window.PrimeTimetable.dateKey(r.date)+'T00:00:00').getDay()));
    if(!stored.length||exceptional||normalDays.size<5){
      const history=new Date(from+'T00:00:00');history.setDate(history.getDate()-28);
      const earliest=year+(term==='2'?'-08-01':'-03-01');
      const historyFrom=[history.getFullYear(),String(history.getMonth()+1).padStart(2,'0'),String(history.getDate()).padStart(2,'0')].join('-');
      try{rows=(await fetchTimetable(profile,historyFrom<earliest?earliest:historyFrom,to)).value;}catch{/* Keep only a verified class-scoped regular cache on history failure. */}
    }
    const normal=window.PrimeTimetable.normalMatrix(rows,stored);
    if(normal.some(row=>row.some(Boolean)))writeCache(key,normal);
    return {...week,matrix:window.PrimeTimetable.displayMatrix(normal,week.value)};
  }

  function toDateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  async function fetchCompleteRange(endpoint, params, fromName, toName, from, to) {
    const result = await request(endpoint, {
      ...params,
      [fromName]: compactDate(from),
      [toName]: compactDate(to),
    });
    if (result.total <= result.rows.length || from === to) return result.rows;
    const start = new Date(`${from}T00:00:00`);
    const end = new Date(`${to}T00:00:00`);
    const middle = new Date(start.getTime() + Math.floor((end.getTime() - start.getTime()) / 2));
    const rightStart = new Date(middle);
    rightStart.setDate(rightStart.getDate() + 1);
    const left = await fetchCompleteRange(endpoint, params, fromName, toName, from, toDateKey(middle));
    const right = await fetchCompleteRange(endpoint, params, fromName, toName, toDateKey(rightStart), to);
    return [...left, ...right];
  }

  async function fetchAcademicEvents(profile, from, to) {
    const params = {
      ATPT_OFCDC_SC_CODE: profile.school.officeCode,
      SD_SCHUL_CODE: profile.school.schoolCode,
      AA_FROM_YMD: compactDate(from),
      AA_TO_YMD: compactDate(to),
    };
    return cachedRequest("events-v3", [...profileParts(profile).slice(0, 4), from, to], async () => {
      const rows = await fetchCompleteRange("SchoolSchedule", params, "AA_FROM_YMD", "AA_TO_YMD", from, to);
      const gradeField = Number(profile.grade) === 1 ? "ONE_GRADE_EVENT_YN" : Number(profile.grade) === 2 ? "TW_GRADE_EVENT_YN" : "THREE_GRADE_EVENT_YN";
      return rows.filter((row) => clean(row[gradeField] || "Y") !== "N").map((row, index) => {
        const title = clean(row.EVENT_NM) || "학교 일정";
        const isExam = /(시험|고사|평가)/.test(title);
        return {
        id: `neis-${clean(row.AA_YMD)}-${index}`,
        date: `${clean(row.AA_YMD).slice(0, 4)}-${clean(row.AA_YMD).slice(4, 6)}-${clean(row.AA_YMD).slice(6, 8)}`,
        type: isExam ? "시험" : "학사일정",
        dayType: clean(row.SBTR_DD_SC_NM),
        title,
        memo: clean(row.EVENT_CNTNT),
        source: "neis",
      };
      });
    });
  }

  async function fetchMeals(profile, from, to = from) {
    const params = {
      ATPT_OFCDC_SC_CODE: profile.school.officeCode,
      SD_SCHUL_CODE: profile.school.schoolCode,
      MLSV_FROM_YMD: compactDate(from),
      MLSV_TO_YMD: compactDate(to),
    };
    return cachedRequest("meals-v2", [...profileParts(profile).slice(0, 2), from, to], async () => {
      const rows = await fetchCompleteRange("mealServiceDietInfo", params, "MLSV_FROM_YMD", "MLSV_TO_YMD", from, to);
      return rows.map((row) => ({
        date: `${clean(row.MLSV_YMD).slice(0, 4)}-${clean(row.MLSV_YMD).slice(4, 6)}-${clean(row.MLSV_YMD).slice(6, 8)}`,
        name: clean(row.MMEAL_SC_NM) || "급식",
        menu: clean(row.DDISH_NM).replaceAll("<br/>", "\n"),
        calorie: clean(row.CAL_INFO),
      }));
    });
  }

  function isCompleteProfile(profile) {
    return Boolean(
      ["middle", "high"].includes(profile?.schoolLevel) &&
      [1, 2, 3].includes(Number(profile?.grade)) &&
      Number(profile?.classNo) > 0 &&
      profile?.school?.officeCode &&
      profile?.school?.schoolCode &&
      profile?.school?.name
    );
  }

  window.PrimeEduSchoolData = {
    searchSchools,
    fetchTimetable,
    fetchStableTimetable,
    fetchAcademicEvents,
    fetchMeals,
    clearCache,
    isCompleteProfile,
  };
})();
