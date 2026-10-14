/* Deterministic review policy, not an AI diagnosis or a validated memory score. */
(function (root) {
  const intervals = [1, 3, 7, 14, 30];
  const dateKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  function validDate(key) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(key))) return false;
    const d = new Date(`${key}T12:00:00`);
    return !Number.isNaN(d.getTime()) && dateKey(d) === key;
  }
  function addDays(key, amount) {
    if (!validDate(key)) throw new Error('복습 날짜를 확인해주세요.');
    const d = new Date(`${key}T12:00:00`);
    d.setDate(d.getDate() + amount);
    return dateKey(d);
  }
  const normalize = value => String(value ?? '').normalize('NFKC').replace(/\s+/g, '').toLowerCase();
  const fingerprint = q => JSON.stringify([String(q.question || ''), String(q.answer || ''), q.options || []]);
  function attemptTime(attempt) {
    const stamp = attempt.createdAt;
    if (typeof stamp === 'string' && !validDate(stamp) && Number.isFinite(Date.parse(stamp))) return Date.parse(stamp);
    if (Number.isFinite(stamp?.seconds)) return stamp.seconds * 1000;
    const date = validDate(attempt.date) ? attempt.date : validDate(stamp) ? stamp : null;
    return date ? +new Date(`${date}T00:00:00+09:00`) : 0;
  }
  function buildQueue(quizzes = [], attempts = [], today = dateKey(new Date())) {
    if (!validDate(today)) throw new Error('복습 날짜를 확인해주세요.');
    const queue = [];
    quizzes.filter(q => q && !q.archivedAt).forEach(quiz => {
      const latest = attempts.filter(a => a?.quizId === quiz.id && a.kind !== 'review')
        .sort((a, b) => attemptTime(b) - attemptTime(a))[0];
      if (!latest || !Array.isArray(latest.details)) return;
      (quiz.questions || []).forEach((question, index) => {
        const detail = latest.details[index];
        // Missing/unknown correctness is not evidence of a mistake.
        if (!detail || detail.correct !== false) return;
        const stamp = fingerprint(question);
        const candidate = quiz.reviewProgress?.[index];
        const progress = candidate?.attemptId === latest.id && candidate?.fingerprint === stamp ? candidate : null;
        if (progress?.mastered) return;
        const start = String(latest.date || latest.createdAt || '').slice(0, 10);
        const due = validDate(progress?.due) ? progress.due : validDate(start) ? start : today;
        queue.push({id: `${quiz.id}:${index}`, quizId: quiz.id, index, attemptId: latest.id,
          fingerprint: stamp, subject: quiz.subject || '학습', title: quiz.title || quiz.unit || '문제노트',
          question, detail, due, stage: Math.min(intervals.length, Math.max(0, Number(progress?.stage) || 0)),
          lastReviewed: progress?.lastReviewed || '', overdue: due < today, ready: due <= today});
      });
    });
    return queue.sort((a, b) => a.due.localeCompare(b.due) || a.subject.localeCompare(b.subject) || a.index - b.index);
  }
  function advance(item, correct, today) {
    if (!validDate(today) || item.due > today || item.lastReviewed === today) throw new Error('이미 복습한 문제예요.');
    const stage = correct ? Math.min(intervals.length, item.stage + 1) : 0;
    return {attemptId: item.attemptId, fingerprint: item.fingerprint, stage,
      due: addDays(today, correct ? intervals[Math.max(0, stage - 1)] : 1),
      lastReviewed: today, mastered: correct && item.stage >= intervals.length,
      updatedAt: new Date().toISOString(), correct: Boolean(correct)};
  }
  function matches(question, answer) {
    const expected = question?.answer;
    return expected !== undefined && normalize(expected) !== '' && normalize(answer) === normalize(expected);
  }
  const api = {intervals, dateKey, validDate, addDays, buildQueue, advance, matches, fingerprint};
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SchemsReviewCore = api;
})(typeof window === 'object' ? window : this);
