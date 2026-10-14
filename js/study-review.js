/* A short, source-backed recall flow. The original StudyAI owner saves all data. */
(() => {
  const $ = selector => document.querySelector(selector);
  const api = () => window.SchemsStudyAI;
  const core = window.SchemsReviewCore;
  const icon = name => window.PrimeUI.svg(name);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let session = null, origin = null, blocked = [], answer = '', checked = false, correct = false, saving = false, historyEntry = false, historyClosing = false, deferredOpen = null;
  const view = document.createElement('section');
  view.id = 'primeReviewView'; view.hidden = true; view.className = 'prime-review-view';
  view.setAttribute('role', 'dialog'); view.setAttribute('aria-modal', 'true'); view.setAttribute('aria-labelledby', 'reviewViewTitle');
  document.body.append(view);
  const status = message => { $('#todayReviewStatus').textContent = message; };
  function renderCard() {
    const queue = api()?.getReviewQueue?.() || [], ready = queue.filter(item => item.ready);
    $('#todayReviewCount').textContent = ready.length ? `${ready.length}문항` : '';
    const summary = $('#todayReviewSummary');
    if (ready.length) {
      const groups = new Map();
      ready.forEach(item => groups.set(item.subject, (groups.get(item.subject) || 0) + 1));
      summary.innerHTML = `<div class="review-subjects">${[...groups].map(([subject, count]) => `<span>${escape(subject)} <b>${count}</b></span>`).join('')}</div><p class="review-card-copy">${ready.some(item => item.overdue) ? '미뤄둔 오답부터 가볍게' : '해설 없이 한 번 더'}</p>`;
    } else summary.innerHTML = `<p class="review-card-empty">${queue.length ? `다음 복습 · ${escape(queue[0].due.slice(5).replace('-', '/'))}` : '틀린 문제가 생기면 여기에 모여요'}</p>`;
    $('#startTodayReview').hidden = !ready.length;
    $('#planTodayReview').hidden = !ready.length;
    $('#importStudyDeviceRecords').hidden = !api()?.canImportDeviceRecords?.();
    document.querySelectorAll('[data-review-launcher]').forEach(button => {
      button.disabled = !ready.length;
      button.setAttribute('aria-label', ready.length ? `오늘의 복습 ${ready.length}문항` : '복습할 오답 없음');
      if (button.hasAttribute('data-review-home')) {
        button.hidden = !ready.length;
        button.innerHTML = `${icon('review')}<span>복습 <b>${ready.length}문항</b></span>${icon('arrow')}`;
      }
    });
  }
  function open(button, quizId) {
    if (session) return;
    if (historyClosing) { deferredOpen = [button, quizId]; return; }
    const items = (api()?.getReviewQueue?.() || []).filter(item => item.ready && (!quizId || item.quizId === quizId)).slice(0, 10);
    if (!items.length) { status('오늘 복습할 문제는 없어요.'); return; }
    session = {items, index: 0, correct: 0, owner: api().getSnapshot().owner};
    origin = button; answer = ''; checked = false;
    view.hidden = false; view.tabIndex = -1; view.focus({preventScroll:true}); document.body.classList.add('is-review-open');
    blocked = [...document.body.children].filter(node => node !== view && !['SCRIPT', 'STYLE', 'LINK'].includes(node.tagName)).map(node => [node, node.inert, node.getAttribute('aria-hidden')]);
    blocked.forEach(([node]) => { node.inert = true; node.setAttribute('aria-hidden','true'); });
    history.pushState({ ...history.state, primeReview: true }, ''); historyEntry = true;
    renderQuestion();
  }
  function close(fromHistory = false) {
    if (!session) return;
    session = null; saving = false; view.hidden = true; view.replaceChildren();
    document.body.classList.remove('is-review-open');
    blocked.forEach(([node, before, hidden]) => { if (node.isConnected) { node.inert = before; if(hidden===null)node.removeAttribute('aria-hidden');else node.setAttribute('aria-hidden',hidden); } }); blocked = [];
    if (!fromHistory && historyEntry && history.state?.primeReview) { historyClosing = true; history.back(); }
    historyEntry = false;
    if (origin?.isConnected && !origin.hidden && !origin.disabled) origin.focus({preventScroll: true});
    else $('#todayReviewTitle')?.focus?.({preventScroll: true});
    renderCard();
  }
  function shell(body, footer = '') {
    view.innerHTML = `<header class="review-view-head"><button type="button" class="review-icon pressable" data-review-close aria-label="복습 닫기">${icon('back')}</button><h2 id="reviewViewTitle">오늘의 복습</h2><span class="review-counter">${session.index < session.items.length ? `${session.index + 1}/${session.items.length}` : ''}</span></header><div class="review-view-content">${body}</div><footer class="review-view-footer">${footer}<p id="reviewViewStatus" role="status" aria-live="polite"></p></footer>`;
  }
  function renderQuestion() {
    if (!session) return;
    if (session.index >= session.items.length) { renderComplete(); return; }
    const item = session.items[session.index];
    const current = api().getReviewQueue().find(q => q.id === item.id);
    if (!current || !current.ready || current.fingerprint !== item.fingerprint || current.attemptId !== item.attemptId) {
      close(); status('문제노트가 변경됐어요. 최신 복습 목록을 확인해주세요.'); return;
    }
    const q = item.question, options = Array.isArray(q.options) ? q.options : [];
    shell(`<article class="review-question"><div class="review-source"><span>${escape(item.subject)}</span><button type="button" class="review-source-link" data-review-source>${escape(item.title)} ${icon('external')}</button></div><h3 id="reviewQuestionHeading" tabindex="-1">${escape(q.question)}</h3><form id="reviewAnswerForm"><fieldset class="review-options"><legend class="sr-only">답 선택</legend>${options.length ? options.map((option, index) => `<label><input type="radio" name="review-answer" value="${escape(option)}" required><span><i aria-hidden="true">${index + 1}</i>${escape(option)}</span></label>`).join('') : '<label class="review-written-label" for="reviewWrittenAnswer">내 답</label><input class="field review-written-answer" id="reviewWrittenAnswer" name="review-answer" type="text" maxlength="500" autocomplete="off" required>'}</fieldset></form><div id="reviewAnswerResult" aria-live="polite"></div></article>`, `<button class="btn primary pressable review-main-action" type="submit" form="reviewAnswerForm" data-ui-keep-label>확인</button>`);
    checked = false; answer = ''; saving = false;
    $('#reviewQuestionHeading')?.focus({preventScroll: true});
  }
  function check(event) {
    event.preventDefault();
    if (!session || checked || saving) return;
    const item = session.items[session.index];
    answer = new FormData(event.target).get('review-answer') || '';
    if (!String(answer).trim()) return;
    correct = core.matches(item.question, answer); checked = true;
    const written = !item.question.options?.length;
    $('#reviewAnswerResult').innerHTML = `<div class="review-answer-result ${correct ? 'is-correct' : 'is-missed'}"><strong>${written ? '정답과 비교해보세요' : correct ? '잘 기억하고 있어요' : '한 번 더 짚고 가요'}</strong><p><span>정답</span> ${escape(item.question.answer)}</p>${item.question.explanation ? `<p class="review-explanation">${escape(item.question.explanation)}</p>` : ''}${written ? `<label class="review-self-check"><input type="checkbox" id="reviewSelfCorrect" ${correct ? 'checked' : ''}>같은 뜻으로 답했어요</label>` : ''}</div>`;
    $('#reviewAnswerForm').querySelectorAll('input').forEach(input => { input.disabled = true; });
    const next = view.querySelector('.review-main-action');
    next.type = 'button'; next.removeAttribute('form'); next.dataset.reviewNext = '';
    next.textContent = session.index + 1 === session.items.length ? '완료' : '다음';
    next.focus({preventScroll: true});
  }
  async function next(button) {
    if (!session || !checked || saving) return;
    saving = true; button.disabled = true;
    const active = session, item = active.items[active.index];
    const selfCheck = $('#reviewSelfCorrect');
    const accepted = selfCheck ? selfCheck.checked : correct;
    try {
      const result = await api().saveReviewResult(item.id, accepted);
      if (session !== active) return;
      if (accepted) active.correct++;
      if (result.cloud === false) active.localOnly = true;
      active.index++;
      renderQuestion();
    } catch (error) {
      if (session !== active) return;
      $('#reviewViewStatus').textContent = error.message || '복습을 저장하지 못했어요.';
    } finally { if (session === active) { saving = false; button.disabled = false; } }
  }
  function renderComplete() {
    const remaining = api().getReviewQueue().filter(item => item.ready).length;
    shell(`<article class="review-complete"><span class="review-complete-mark" aria-hidden="true">${icon('check')}</span><h3 tabindex="-1" id="reviewCompleteHeading">복습을 마쳤어요</h3><p>${session.items.length}문항 · 정답 ${session.correct}</p><small>${session.localOnly ? '이 기기에 저장됨 · 계정 동기화 실패' : session.owner === 'guest' ? '이 기기에 저장됨' : '계정에 저장됨'}</small><p class="review-next-date">다음 복습은 날짜에 맞춰 모아둘게요</p></article>`, `<button type="button" class="btn primary pressable review-main-action" data-review-close data-ui-keep-label>돌아가기</button>${remaining ? `<button type="button" class="btn pressable" data-review-more data-ui-keep-label>${remaining}문항 더 복습</button>` : ''}`);
    $('#reviewCompleteHeading').focus({preventScroll: true});
  }
  function init() {
    document.querySelectorAll('.mobile-pomodoro-copy,.home-pomodoro').forEach(anchor => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'review-home-shortcut pressable';
      button.dataset.reviewLauncher = ''; button.dataset.reviewHome = ''; button.dataset.uiKeepLabel = '';
      anchor.append(button);
    });
    ['#homeChecklistWidget', '#aiNotesTitle'].forEach(selector => {
      const anchor = $(selector); if (!anchor) return;
      const button = document.createElement('button'); button.type = 'button'; button.className = 'icon-btn pressable review-mini-launcher';
      button.dataset.reviewLauncher = ''; button.innerHTML = icon('review'); button.title = '오늘의 복습';
      (selector === '#homeChecklistWidget' ? anchor.closest('article').querySelector('header') : anchor.parentElement).append(button);
    });
    $('#startTodayReview').addEventListener('click', event => open(event.currentTarget));
    $('#planTodayReview').addEventListener('click', () => {
      try { const count = api().addReviewsToPlan(); status(count ? `오늘 할 일에 ${count}개 복습을 추가했어요.` : '오늘 할 일에 이미 추가돼 있어요.'); }
      catch (error) { status(error.message); }
    });
    $('#importStudyDeviceRecords').addEventListener('click', () => {
      if (!confirm('이 기기에 남아 있는 학습 기록을 현재 계정의 로컬 기록으로 복사할까요? 원본은 유지하고, 다른 기기로 전송하지 않습니다.')) return;
      try { api().importDeviceRecords(); status('현재 계정의 기기 기록으로 가져왔어요.'); } catch (error) { status(error.message); }
    });
    document.addEventListener('click', event => {
      const button = event.target.closest('[data-review-launcher], [data-start-review-quiz]');
      if (button) open(button, button.dataset.startReviewQuiz);
    });
    view.addEventListener('submit', check);
    view.addEventListener('click', event => {
      const target = event.target.closest('button'); if (!target) return;
      if (target.hasAttribute('data-review-close')) close();
      else if (target.hasAttribute('data-review-next')) next(target);
      else if (target.hasAttribute('data-review-more')) {
        const items = api().getReviewQueue().filter(item => item.ready).slice(0,10);
        if (!items.length) return;
        session = {items, index:0, correct:0, owner:api().getSnapshot().owner}; renderQuestion();
      }
      else if (target.hasAttribute('data-review-source') && session) {
        const quizId = session.items[session.index].quizId; close();
        window.PrimeEduAI?.openCategory?.('notes', 'workspace');
        [...document.querySelectorAll('[data-open-quiz-book]')].find(b => b.dataset.openQuizBook === quizId)?.click();
      }
    });
    view.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); close(); }
      if (event.key !== 'Tab') return;
      const focusable = [...view.querySelectorAll('button:not(:disabled),input:not(:disabled),[tabindex="0"]')].filter(node => node.getClientRects().length);
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !focusable.includes(document.activeElement))) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    });
    window.addEventListener('popstate', () => {
      if (historyClosing) { historyClosing = false; const pending = deferredOpen; deferredOpen = null; if (pending) open(...pending); return; }
      if (session) close(true);
    });
    window.addEventListener('prime:study-owner-change', () => { close(); status(''); });
    window.addEventListener('schems:study-data', renderCard);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) renderCard(); });
    renderCard();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
