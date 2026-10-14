(function (root) {
  "use strict";
  const subjects = ["국어", "수학", "영어", "사회", "과학", "역사"];
  const periods = [{ term: 1, exam: "mid", label: "1학기 중간" }, { term: 1, exam: "final", label: "1학기 기말" }, { term: 2, exam: "mid", label: "2학기 중간" }, { term: 2, exam: "final", label: "2학기 기말" }];
  const schoolLevel = value => value === "high" ? "high" : "middle";
  const clampYear = value => Math.max(1, Math.min(3, Math.floor(Number(value) || 1)));
  function config(profile = {}, saved = {}, year = new Date().getFullYear()) {
    const level = schoolLevel(profile.schoolLevel || saved.schoolLevel);
    const grade = clampYear(profile.grade || saved.grade);
    const entryYear = year - grade + 1;
    return { schoolLevel: level, grade, gradeSystem: [5, 9].includes(Number(saved.gradeSystem)) ? Number(saved.gradeSystem) : entryYear >= 2025 ? 5 : 9,
      subjects: [...new Set([...subjects, ...(Array.isArray(saved.subjects) ? saved.subjects : [])].map(s => String(s).trim().slice(0, 30)).filter(Boolean))].slice(0, 16),
      targets: { middle: saved.targets?.middle || null, high: saved.targets?.high || null },
      consultationGoalHidden:{middle:String(saved.consultationGoalHidden?.middle||'').slice(0,100),high:String(saved.consultationGoalHidden?.high||'').slice(0,100)} };
  }
  const years = grade => Array.from({ length: clampYear(grade) }, (_, i) => i + 1);
  const cellKey = row => [schoolLevel(row.schoolLevel), row.recordType || "exam-score", clampYear(row.year), row.term, row.exam || "semester", String(row.subject).trim()].join("|");
  function number(value, min, max, integer = false) {
    if (value === "" || value == null) return null;
    const n = Number(value);
    if (!Number.isFinite(n) || n < min || n > max || (integer && !Number.isInteger(n))) throw new Error(`${min}–${max}${integer ? " 사이 정수" : " 사이 숫자"}를 입력해주세요.`);
    return n;
  }
  function normalize(rows, fallbackLevel = "middle") {
    const map = new Map();
    for (const value of Array.isArray(rows) ? rows : []) {
      try {
        if (!value?.subject || ![1, 2, 3].includes(Number(value.year)) || ![1, 2].includes(Number(value.term))) continue;
        const row = { schoolLevel: schoolLevel(value.schoolLevel || fallbackLevel), recordType: value.recordType === "semester-rank" ? "semester-rank" : "exam-score", year: Number(value.year), term: Number(value.term), subject: String(value.subject).trim().slice(0, 30) };
        if (row.recordType === "exam-score") {
          if (!["mid", "final"].includes(value.exam)) continue;
          row.exam = value.exam; row.score = number(value.score, 0, 100);
          if (row.score === null) continue;
        } else {
          if (row.schoolLevel !== "high") continue;
          row.gradeSystem = Number(value.gradeSystem) === 9 ? 9 : 5;
          row.rank = number(value.rank, 1, row.gradeSystem, true);
          row.credits = number(value.credits, .5, 20) ?? 1;
          if (row.rank === null) continue;
        }
        row.id = value.id || cellKey(row);
        map.set(cellKey(row), row);
      } catch { /* Invalid legacy rows are preserved in the old storage, never sent to AI. */ }
    }
    return [...map.values()];
  }
  function summary(rows) {
    const exams = rows.filter(row => row.recordType === "exam-score");
    const groups = new Map();
    exams.forEach(row => {
      const key = `${row.year}-${row.term}-${row.exam}`;
      const group = groups.get(key) || { year: row.year, term: row.term, exam: row.exam, scores: [] };
      group.scores.push({ subject: row.subject, score: row.score }); groups.set(key, group);
    });
    return [...groups.values()].sort((a,b) => a.year-b.year || a.term-b.term || (a.exam === "mid" ? 0 : 1) - (b.exam === "mid" ? 0 : 1)).map(group => ({ ...group, average: Math.round(group.scores.reduce((sum,r) => sum+r.score,0) / group.scores.length * 10) / 10 }));
  }
  const model = { subjects, periods, config, years, cellKey, number, normalize, summary };
  if (typeof module !== "undefined" && module.exports) module.exports = model;
  else root.PrimeEduGradeModel = model;
})(typeof window !== "undefined" ? window : this);
