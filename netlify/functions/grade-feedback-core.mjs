export function validateGrades(body) {
  const invalid = message => { throw Object.assign(new Error(message), { statusCode: 400 }); };
  if (!['middle', 'high'].includes(body.schoolLevel) || ![1,2,3].includes(Number(body.grade))) invalid('학교급과 학년을 확인해주세요.');
  if (!Array.isArray(body.entries) || !body.entries.length || body.entries.length > 400) invalid('성적을 1–400개 입력해주세요.');
  const entries = body.entries.map(row => {
    if (!row || ![1,2,3].includes(Number(row.year)) || Number(row.year) > Number(body.grade) || ![1,2].includes(Number(row.term)) || typeof row.subject !== 'string' || !row.subject.trim() || row.subject.length > 30) invalid('성적표의 학년·학기·과목을 확인해주세요.');
    const base = { year: Number(row.year), term: Number(row.term), subject: row.subject.trim(), recordType: row.recordType };
    if (row.recordType === 'exam-score') {
      if (!['mid','final'].includes(row.exam) || typeof row.score !== 'number' || !Number.isFinite(row.score) || row.score < 0 || row.score > 100) invalid('시험 점수는 0–100점 사이여야 해요.');
      return { ...base, exam: row.exam, score: row.score };
    }
    if (row.recordType !== 'semester-rank' || body.schoolLevel !== 'high' || ![5,9].includes(row.gradeSystem) || !Number.isInteger(row.rank) || row.rank < 1 || row.rank > row.gradeSystem || typeof row.credits !== 'number' || !Number.isFinite(row.credits) || row.credits < .5 || row.credits > 20) invalid('고등학교 학기 내신등급과 학점을 확인해주세요.');
    return { ...base, rank: row.rank, gradeSystem: row.gradeSystem, credits: row.credits };
  });
  const keys = entries.map(row => `${row.recordType}|${row.year}|${row.term}|${row.exam || ''}|${row.subject}`);
  if (new Set(keys).size !== keys.length) invalid('동일한 과목 성적이 중복되어 있어요.');
  return { schoolLevel: body.schoolLevel, grade: Number(body.grade), entries };
}
export function gradeStatistics(entries) {
  const subjects = [...new Set(entries.map(row => row.subject))];
  return subjects.map(subject => {
    const rows = entries.filter(row => row.subject === subject && row.recordType === 'exam-score').sort((a,b) => a.year-b.year || a.term-b.term || (a.exam === 'mid' ? 0 : 1) - (b.exam === 'mid' ? 0 : 1));
    const ranks = entries.filter(row => row.subject === subject && row.recordType === 'semester-rank');
    return { subject, exams: rows.map(row => ({ year:row.year, term:row.term, exam:row.exam, score:row.score })), latestScore: rows.at(-1)?.score ?? null, scoreChange: rows.length > 1 ? Math.round((rows.at(-1).score - rows[0].score)*10)/10 : null,
      // Never mix 5- and 9-rank scales into a single average or turn raw scores into ranks.
      semesterRanks: ranks.map(row => ({ year:row.year, term:row.term, rank:row.rank, gradeSystem:row.gradeSystem, credits:row.credits })) };
  });
}
export function sanitizeFeedback(value) {
  const clean = value => String(value || '').replace(/<[^>]*>/g, '').trim().slice(0,700);
  const list = input => (Array.isArray(input) ? input : []).slice(0,4).map(clean).filter(Boolean);
  const result = { summary:clean(value?.summary), strengths:list(value?.strengths), nextSteps:list(value?.nextSteps), targetAdvice:list(value?.targetAdvice) };
  // Reject fabricated eligibility, cutoffs and numeric acceptance probabilities rather than display them.
  const all = JSON.stringify(result);
  if (!result.summary || /\d+(?:\.\d+)?\s*%|합격\s*(?:보장|확실|가능성|확률)|(?:커트라인|합격선|최저\s*합격)\s*(?:은|이|:)?\s*\d/.test(all)) throw Object.assign(new Error('AI 피드백에 확인되지 않은 진학 수치가 포함돼 다시 요청이 필요해요.'), { statusCode:502 });
  return result;
}
