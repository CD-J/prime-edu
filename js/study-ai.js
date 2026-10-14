(function () {
  const STORAGE_KEY = "schemsStudyAI.v2";
  const OLD_STORAGE_KEY = "schemsStudyAI.v1";
  const COLLECTIONS = {
    tasks: "studyTasks",
    sessions: "studySessions",
    notes: "notes",
    quizzes: "quizzes",
    attempts: "quizAttempts",
    diagnostics: "learningDiagnostics",
  };

  const state = {
    tasks: [],
    sessions: [],
    notes: [],
    quizzes: [],
    attempts: [],
    diagnostics: [],
    bookRecommendations: [],
    bookSummary: "",
    currentQuiz: null,
    currentNoteId: null,
    quizDrafts: {},
    lastAttempt: null,
    loadingPlan: false,
    loadingQuiz: false,
    loadingDiagnosis: false,
    grading: false,
    reportLoading: false,
    reportVisible: false,
    retryingQuizId: null,
    quizStartedAt: null,
    pendingPlanTasks: [],
    pendingPlanUnplaced: [],
    pendingExamTasks: [],
  };

  const $ = (selector) => document.querySelector(selector);
  const emptyState = JSON.parse(JSON.stringify(state));
  let storageOwner = window.ClassHubFirebase?.getCurrentUser?.()?.uid || "guest";
  let accountGeneration = 0;
  let historyFilter = 'all', historyLimit = 8;
  let notebookHistoryOrigin = null;
  const cacheKey = (owner = storageOwner) => `${STORAGE_KEY}:${encodeURIComponent(owner)}`;
  function accountChangedError() {
    const error = new Error("계정이 변경되어 작업을 중단했어요. 현재 계정에서 다시 시도해주세요.");
    error.code = "ACCOUNT_CHANGED";
    return error;
  }
  function isCurrentAccount(owner, generation = accountGeneration) {
    return owner === storageOwner && generation === accountGeneration && owner === (window.ClassHubFirebase?.getCurrentUser?.()?.uid || "guest");
  }

  function init() {
    mountNotebookReader();
    hydrate();
    bindRemoteAuth();
    bind();
    renderAll();
  }

  function bind() {
    $("#studyPlanForm")?.addEventListener("submit", onGeneratePlan);
    $("#studyPlanFormAI")?.addEventListener("submit", onGeneratePlan);
    $("#studyNoteForm")?.addEventListener("submit", onSaveNote);
    $("#studyBookForm")?.addEventListener("submit", onRecommendBooks);
    $("#studyHistoryList")?.addEventListener("click", onHistoryAction);
    $("#studyQuizForm")?.addEventListener("submit", onGenerateQuiz);
    $("#quizNoteText")?.addEventListener("input", event => { delete event.currentTarget.dataset.sourceNoteId; });
    $("#examStrategyForm")?.addEventListener("submit", onGenerateExamStrategy);
    $("#studyNoteList")?.addEventListener("click", onNoteAction);
    $("#studyConceptReader")?.addEventListener("click", onNoteAction);
    $("#studyNotebookTabs")?.addEventListener("click", (event) => {
      if (event.target.closest("[data-notebook-library]")) closeNotebookReader();
    });
    $("#studyQuizResult")?.addEventListener("input", (event) => {
      if (state.currentQuiz && event.target.name?.startsWith("quiz-q-")) {
        const index = Number(event.target.name.slice(7));
        (state.quizDrafts[state.currentQuiz.id] ||= {})[index] = event.target.value;
      }
    });
    $("#studyQuizResult")?.addEventListener("submit", onGradeQuiz);
    $("#studyQuizResult")?.addEventListener("change", startQuizTimer);
    $("#studyQuizWorkspace")?.addEventListener("click", onQuizAction);
    $("#studyQuizLibrary")?.addEventListener("click", onQuizLibraryClick);
    document.querySelectorAll("#studyTaskList, #studyTaskListAI").forEach((list) => list.addEventListener("click", onTaskClick));
    $("#studyRefreshContext")?.addEventListener("click", renderContext);
    $("#studyOfflineSeed")?.addEventListener("click", seedOfflinePlan);
    $("#studyOfflineSeedAI")?.addEventListener("click", seedOfflinePlan);
    $("#studyDiagnoseButton")?.addEventListener("click", requestLearningDiagnosis);
    $("#studyDiagnoseButtonAI")?.addEventListener("click", requestLearningDiagnosis);
    $("#studyPlanApplyButton")?.addEventListener("click", applyPendingPlan);
    $("#examStrategyResult")?.addEventListener("click", (event) => {
      if (!event.target.closest("[data-apply-exam-strategy]")) return;
      if (!state.pendingExamTasks.length) return;
      addTasks(state.pendingExamTasks);
      state.pendingExamTasks = [];
      event.target.closest("[data-apply-exam-strategy]").disabled = true;
      renderAll({ preserveReader: true });
      setText("#examStrategyStatus", "시험 전략을 계획과 체크리스트에 추가했습니다.");
      window.dispatchEvent(new CustomEvent("prime:study-result-consumed", { detail: "exam" }));
    });
    document.querySelectorAll("[data-plan-mode]").forEach((button) => {
      button.addEventListener("click", () => {
        document.querySelectorAll("[data-plan-mode]").forEach((item) => {
          const active = item === button;
          item.classList.toggle("is-active", active);
          item.setAttribute("aria-selected", active ? "true" : "false");
        });
        const description = $("#planModeDescription");
        if (description) description.textContent = button.dataset.planMode === "routine"
          ? "오늘의 공부 순서"
          : "날짜별 공부 계획";
        const input = $("#studyPlanMode");
        if (input) input.value = button.dataset.planMode || "long";
      });
    });
    const syncPlanMode=()=>{const input=$("#studyPlanMode");if(!input)return;document.querySelectorAll('[data-plan-mode]').forEach(button=>{const active=button.dataset.planMode===input.value;button.classList.toggle('is-active',active);button.setAttribute('aria-selected',String(active));});const description=$("#planModeDescription");if(description)description.textContent=input.value==='routine'?'오늘의 공부 순서':'날짜별 공부 계획';};
    $("#studyPlanMode")?.addEventListener('change',syncPlanMode);window.addEventListener('prime:controls-sync',syncPlanMode);syncPlanMode();
    $("#studyQuizJumpButton")?.addEventListener("click", () => {
      if (window.PrimeEduAI?.openCategory) window.PrimeEduAI.openCategory("notes", "workspace");
      else if (typeof window.switchTab === "function") window.switchTab("assistant");
    });
  }

  function bindRemoteAuth() {
    const hub = window.ClassHubFirebase;
    if (!hub?.onAuthStateChanged || !hub?.listUserCollectionDocs) return;
    hub.onAuthStateChanged(async (user) => {
      const owner = user?.uid || "guest";
      if (owner !== storageOwner) {
        ["studyPlanStatus", "studyQuizStatus", "studyNoteStatus", "studyBookStatus", "examStrategyStatus"].forEach(id => {
          if (document.getElementById(id)?.closest("form")?.getAttribute("aria-busy") === "true") setOperation(`#${id}`, "error", "계정이 변경되어 작업을 중단했어요.");
        });
        storageOwner = owner;
        accountGeneration += 1;
        historyFilter = 'all'; historyLimit = 8;
        notebookHistoryOrigin = null;
        Object.assign(state, JSON.parse(JSON.stringify(emptyState)));
        hydrate();
        if ($("#studyBookResults")) $("#studyBookResults").replaceChildren();
        renderAll();
        window.dispatchEvent(new CustomEvent("prime:study-owner-change"));
      }
      if (!user?.uid) return;
      await loadRemote(user.uid, accountGeneration);
    });
  }

  function hydrate() {
    try {
      // Unattributed old caches remain untouched and are never assigned to a signed-in user.
      const legacy = storageOwner === "guest" ? localStorage.getItem(STORAGE_KEY) || localStorage.getItem(OLD_STORAGE_KEY) : null;
      const saved = JSON.parse(localStorage.getItem(cacheKey()) || legacy || "{}");
      Object.assign(state, {
        tasks: Array.isArray(saved.tasks) ? saved.tasks : [],
        sessions: Array.isArray(saved.sessions) ? saved.sessions : [],
        notes: Array.isArray(saved.notes) ? saved.notes : [],
        quizzes: Array.isArray(saved.quizzes) ? saved.quizzes : [],
        attempts: Array.isArray(saved.attempts) ? saved.attempts : [],
        diagnostics: Array.isArray(saved.diagnostics) ? saved.diagnostics : [],
        bookRecommendations: Array.isArray(saved.bookRecommendations) ? saved.bookRecommendations : [],
        bookSummary: String(saved.bookSummary || ""),
      });
    } catch {
      // Preserve unreadable records for recovery instead of overwriting them.
      console.warn("Study cache could not be read; original records were preserved.");
    }
  }

  function persist() {
    const existing = localStorage.getItem(cacheKey());
    if (existing) {
      try { JSON.parse(existing); }
      catch {
        // A later successful save must not erase the only recoverable malformed cache.
        const recoveryKey = `${cacheKey()}:recovery:${Date.now()}`;
        localStorage.setItem(recoveryKey, existing);
      }
    }
    localStorage.setItem(
      cacheKey(),
      JSON.stringify({
        tasks: state.tasks,
        sessions: state.sessions,
        notes: state.notes,
        quizzes: state.quizzes,
        attempts: state.attempts,
        diagnostics: state.diagnostics,
        bookRecommendations: state.bookRecommendations,
        bookSummary: state.bookSummary,
      }),
    );
  }

  async function saveRemote(collection, payload) {
    const hub = window.ClassHubFirebase;
    const user = hub?.getCurrentUser?.();
    if (!hub?.addUserCollectionDoc || !user?.uid) return null;
    try {
      return await hub.addUserCollectionDoc(user.uid, collection, payload);
    } catch (error) {
      console.warn("Study AI remote save failed:", error);
      return null;
    }
  }

  async function loadRemote(uid, generation = accountGeneration) {
    const hub = window.ClassHubFirebase;
    if (!hub?.listUserCollectionDocs || !uid) return;
    try {
      const [tasks, sessions, notes, quizzes, attempts, diagnostics] = await Promise.all([
        hub.listUserCollectionDocs(uid, COLLECTIONS.tasks, 50),
        hub.listUserCollectionDocs(uid, COLLECTIONS.sessions, 50),
        hub.listUserCollectionDocs(uid, COLLECTIONS.notes, 30),
        hub.listUserCollectionDocs(uid, COLLECTIONS.quizzes, 20),
        hub.listUserCollectionDocs(uid, COLLECTIONS.attempts, 50),
        hub.listUserCollectionDocs(uid, COLLECTIONS.diagnostics, 20),
      ]);
      if (!isCurrentAccount(uid, generation)) return;
      state.tasks = mergeById(tasks, state.tasks);
      state.sessions = mergeById(sessions, state.sessions);
      state.notes = mergeById(notes, state.notes);
      state.quizzes = mergeById(quizzes, state.quizzes);
      state.attempts = mergeById(attempts, state.attempts);
      state.diagnostics = mergeById(diagnostics, state.diagnostics);
      persist();
      renderAll();
    } catch (error) {
      console.warn("Study AI remote load failed:", error);
    }
  }

  function mergeById(remote, local) {
    const map = new Map();
    const adminTitles = new Map((remote || []).filter(item => item?.adminTitleVersion).map(item => [String(item.id), item]));
    [...(remote || []), ...(local || [])].forEach((item) => {
      if (!item) return;
      const id = String(item.id || uid());
      const previous = map.get(id);
      if (previous?.reviewProgress || item.reviewProgress) {
        const progress = { ...(previous?.reviewProgress || {}) };
        Object.entries(item.reviewProgress || {}).forEach(([index, entry]) => {
          if (!progress[index] || String(entry.updatedAt || '') >= String(progress[index].updatedAt || '')) progress[index] = entry;
        });
        map.set(id, { ...item, reviewProgress: progress });
      } else map.set(id, item);
    });
    return [...map.values()].map(item => {
      const remoteItem = adminTitles.get(String(item.id));
      if (!remoteItem || remoteItem.adminTitleVersion === item.adminTitleVersion) return item;
      const next = {...item, adminTitleVersion:remoteItem.adminTitleVersion};
      if (Object.hasOwn(remoteItem,'title')) next.title=remoteItem.title;
      else delete next.title;
      return next;
    }).slice(0, 100);
  }

  function renderAll({ preserveReader = false } = {}) {
    renderStats();
    renderContext();
    renderDiagnosis();
    renderTasks();
    renderHistory();
    renderNotes({ preserveReader });
    if (!preserveReader) { renderQuiz(); renderStepwiseFeedback(); }
    renderQuizLibrary();
    renderStudyCharts();
    renderSavedBookRecommendations();
    window.dispatchEvent(new CustomEvent("schems:study-data", { detail: getSnapshot() }));
    window.dispatchEvent(new CustomEvent("prime:notebook-content-change"));
  }

  function getSnapshot() {
    return {
      owner: storageOwner,
      tasks: window.PrimeCompat.cloneData(state.tasks),
      sessions: window.PrimeCompat.cloneData(state.sessions),
      attempts: window.PrimeCompat.cloneData(activeAttempts()),
      notes: window.PrimeCompat.cloneData(state.notes.filter(note=>!note.archivedAt)),
      quizzes: window.PrimeCompat.cloneData(state.quizzes.filter(quiz=>!quiz.archivedAt)),
      bookRecommendations: window.PrimeCompat.cloneData(state.bookRecommendations),
      profile: window.PrimeCompat.cloneData(buildLearnerProfile()),
    };
  }

  function activeAttempts(){const archived=new Set(state.quizzes.filter(q=>q.archivedAt).map(q=>q.id)),visible=state.attempts.filter(a=>!archived.has(a.quizId));return window.PrimeStudyHistory?visible.sort((a,b)=>window.PrimeStudyHistory.stamp(b)-window.PrimeStudyHistory.stamp(a)):visible;}
  function retainLibraryEntries(items,limit){return [...items.filter(n=>!n.archivedAt).slice(0,limit),...items.filter(n=>n.archivedAt)];}
  function buildLearnerProfile() {
    const total = activeAttempts().reduce((sum, attempt) => sum + Number(attempt.total || 0), 0);
    const score = activeAttempts().reduce((sum, attempt) => sum + Number(attempt.score || 0), 0);
    const accuracy = total ? Math.round((score / total) * 100) : 0;
    const done = state.tasks.filter((task) => task.done).length;
    const completion = state.tasks.length ? Math.round((done / state.tasks.length) * 100) : 0;
    const studyMinutes =
      state.sessions.reduce((sum, session) => sum + Number(session.minutes || extractMinutes(session.done)), 0) +
      state.tasks.filter((task) => task.done && !task.activity).reduce((sum, task) => sum + Number(task.minutes || 0), 0);
    const weakConcepts = getWeakConcepts();
    const errorTypes = getErrorTypes();
    const level = !total ? "진단 준비 중" : accuracy >= 85 ? "안정권" : accuracy >= 60 ? "성장 구간" : "기초 보강";
    const recommendedDifficulty = !total ? "중간" : accuracy >= 85 ? "어려움" : accuracy >= 60 ? "중간" : "쉬움";
    const todayPriority = weakConcepts[0] ? `${weakConcepts[0]} 개념 재훈련` : state.tasks.find((task) => !task.done)?.title || "오늘 수업 3줄 요약";
    const nextPath = weakConcepts.length
      ? ["해설을 보지 않고 다시 풀기", "핵심 개념 3줄 정리", "유사 문제 2개 풀이"]
      : ["오늘 수업 정리", "시험 D-day 확인", "난이도 한 단계 올린 문제 풀이"];
    const restAlert = buildRestAlert(errorTypes, studyMinutes);

    return {
      total,
      score,
      accuracy,
      completion,
      studyMinutes,
      weakConcepts,
      errorTypes,
      level,
      recommendedDifficulty,
      todayPriority,
      nextPath,
      restAlert,
      selfReport: window.PrimeLearnerIntegration?.getSelfReport?.() || {},
    };
  }

  function renderStats() {
    const profile = buildLearnerProfile();
    setText("#studyTaskCount", String(state.tasks.length));
    setText("#studyDoneCount", String(state.tasks.filter((task) => task.done).length));
    setText("#studyAccuracy", `${profile.accuracy}%`);
    setText("#studyWeakCount", String(profile.weakConcepts.length));
  }

  function renderContext() {
    const box = $("#studyContextPreview");
    if (!box) return;
    box.textContent = buildStudyContext().slice(0, 1800);
  }

  function renderDiagnosis() {
    const profile = buildLearnerProfile();
    const latest = state.diagnostics[0];
    const hiddenPlanBox = $("#planDiagnosisPanel");
    if (hiddenPlanBox) hiddenPlanBox.innerHTML = "";
    const box = $("#studyDiagnosisPanelAI");
    if (!box) return;
    if (!latest && !profile.total) { box.innerHTML = emptyDashboardAction("아직 분석이 없어요", "notes", "quiz"); return; }
    box.innerHTML = `
      <div class="analysis-points">
        <article><span>강점</span><strong>${escapeHtml(latest?.strengths?.[0] || (profile.accuracy >= 70 ? "꾸준한 문제 해결" : "학습 기록 시작"))}</strong></article>
        <article><span>보완점</span><strong>${escapeHtml(latest?.weaknesses?.[0] || profile.weakConcepts[0] || "복습 기록 쌓기")}</strong></article>
        <article><span>다음 추천</span><strong>${escapeHtml(latest?.nextPath?.[0] || profile.nextPath[0] || profile.todayPriority)}</strong></article>
      </div>
      ${latest?.summary ? `<p class="analysis-note">${escapeHtml(latest.summary)}</p>` : ""}
    `;
  }

  function diagnosisCard(title, value, desc) {
    return `<article class="study-item"><h3>${escapeHtml(title)}</h3><p><strong>${escapeHtml(value)}</strong></p></article>`;
  }

  function renderTasks() {
    const renderTaskRows = (tasks, preview = false) => tasks
      .slice(0, 10)
      .map(
        (task) => `
          <article class="study-item">
            <div class="study-task-head">
              <div>
                <h3>${escapeHtml(task.title)}</h3>
                <p>${escapeHtml(task.reason || "")}</p>
              </div>
              <span class="study-priority">${escapeHtml(task.priority || "보통")}</span>
            </div>
            <p>${escapeHtml(task.subject || "학습")} · ${escapeHtml(task.minutes || 30)}분 · ${escapeHtml(task.date || today())}</p>
            ${preview ? "" : `<div class="study-actions">
              <button class="btn pressable" type="button" data-study-done="${escapeHtml(task.id)}">${task.done ? "완료됨" : "완료"}</button>
            </div>`}
          </article>
        `,
      )
      .join("");
    const planList = $("#studyTaskList");
    const preview = $("#studyPlanPreview");
    if (planList) planList.innerHTML = state.pendingPlanTasks.length
      ? renderPlanPreviewGroups(state.pendingPlanTasks, renderTaskRows)
      : `<div class="study-empty">아직 계획이 없어요</div>`;
    if (preview) preview.hidden = !state.pendingPlanTasks.length;
    const aiList = $("#studyTaskListAI");
    if (aiList) aiList.innerHTML = state.tasks.length
      ? renderTaskRows(state.tasks)
      : `<div class="study-empty">생성된 체크리스트 없음</div>`;
  }

  function renderPlanPreviewGroups(tasks, renderRows) {
    const groups = new Map();
    tasks.forEach((task) => {
      const key = task.date || today();
      groups.set(key, [...(groups.get(key) || []), task]);
    });
    return [...groups.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, rows]) => `<section class="plan-preview-day"><h4>${escapeHtml(date)}</h4>${renderRows(rows, true)}</section>`)
      .join("");
  }

  function historyRows(){return window.PrimeStudyHistory.build({...state,tasks:activityTasks()});}
  function renderHistory() {
    const box = $("#studyHistoryList");
    if (!box) return;
    const previousFocus=document.activeElement?.closest('#studyHistoryList button'),focusKey=previousFocus?.getAttribute('data-history-filter')||previousFocus?.getAttribute('data-history-open'),open=new Set([...box.querySelectorAll('details[open]')].map(n=>n.dataset.historyDetails));
    const all=historyRows(),rows=all.filter(r=>historyFilter==='all'||(historyFilter==='focus'?['focus','memo'].includes(r.kind):r.kind===historyFilter)),groups=new Map();
    rows.slice(0,historyLimit).forEach(row=>{const day=row.date||'';if(!groups.has(day))groups.set(day,[]);groups.get(day).push(row);});
    const filter=[['all','전체'],['activity','준비'],['focus','공부'],['quiz','문제'],['review','복습']].map(([key,name])=>`<button type="button" data-history-filter="${key}" aria-pressed="${historyFilter===key}" data-ui-keep-label>${name}</button>`).join('');
    box.innerHTML=`<div class="study-history-filters" role="group" aria-label="기록 종류">${filter}</div>`+(rows.length?[...groups].map(([date,items])=>`<section class="study-history-day"><h4>${date===today()?'오늘':date?escapeHtml(date.slice(5).replace('-','/')):'날짜 미상'}</h4>${items.map(row=>`<article class="study-history-row"><span class="study-history-icon" aria-hidden="true">${window.PrimeUI.svg(row.icon)}</span><div class="study-history-copy"><div class="study-history-meta"><span>${escapeHtml(row.label)}</span>${row.clock?`<time datetime="${escapeHtml(new Date(row.time).toISOString())}">${escapeHtml(row.clock)}</time>`:''}</div><h4>${escapeHtml(row.title)}</h4>${row.context?`<p class="study-history-context">${escapeHtml(row.context)}</p>`:''}<p class="study-history-result">${[row.metric,row.status].filter(Boolean).map(escapeHtml).join(' · ')}</p>${row.missing?'<small>연결 자료가 보관되었거나 삭제됐어요</small>':''}${row.content||row.feedback?`<details data-history-details="${escapeHtml(row.key)}" ${open.has(row.key)?'open':''}><summary>메모 · 피드백</summary>${row.content?`<p>${escapeHtml(row.content)}</p>`:''}${row.feedback?`<p>${escapeHtml(row.feedback)}</p>`:''}</details>`:''}</div>${row.target?`<div class="study-history-actions"><button type="button" class="btn pressable" data-history-open="${escapeHtml(row.key)}" aria-label="${escapeHtml(row.title)} ${row.target.kind==='activity'?'준비 열기':row.target.attemptId?'풀이 기록 열기':'노트 열기'}" data-ui-keep-label>${window.PrimeUI.svg(row.target.kind==='activity'?'arrow':row.target.attemptId?'chart':'openBook')}</button>${row.target.kind==='quiz'&&getReviewQueue().some(q=>q.quizId===row.target.id&&q.ready)?`<button type="button" class="btn pressable" data-start-review-quiz="${escapeHtml(row.target.id)}" aria-label="${escapeHtml(row.title)} 오답 복습" data-ui-keep-label>${window.PrimeUI.svg('review')}</button>`:''}</div>`:''}</article>`).join('')}</section>`).join('')+(rows.length>historyLimit?'<button type="button" class="study-history-more" data-history-more data-ui-keep-label>이전 기록 더 보기</button>':''):`<div class="study-history-empty"><p>${all.length?'이 종류의 기록은 아직 없어요':'첫 공부를 시작해볼까요?'}</p>${!all.length?'<button type="button" class="btn pressable" data-history-start data-ui-keep-label>공부 시작</button>':''}</div>`);
    const emptyAction=box.querySelector('[data-history-start]');if(emptyAction)emptyAction.textContent='타이머 열기';
    if(focusKey)[...box.querySelectorAll('button')].find(b=>b.getAttribute('data-history-filter')===focusKey||b.getAttribute('data-history-open')===focusKey)?.focus({preventScroll:true});
  }

  function onHistoryAction(event){
    const button=event.target.closest('button');if(!button)return;
    if(button.hasAttribute('data-history-filter')){historyFilter=button.dataset.historyFilter;historyLimit=8;renderHistory();return;}
    if(button.hasAttribute('data-history-more')){historyLimit+=8;renderHistory();$('#studyHistoryList .study-history-more')?.focus({preventScroll:true});return;}
    if(button.hasAttribute('data-history-start')){window.switchTab?.('home');requestAnimationFrame(()=>[...document.querySelectorAll('[data-pomodoro-toggle]')].find(b=>b.getClientRects().length)?.focus());return;}
    if(button.hasAttribute('data-history-open'))openHistoryRecord(button.dataset.historyOpen,button);
  }
  function openHistoryRecord(key,origin){
    if(!isCurrentAccount(storageOwner))return false;
    const row=historyRows().find(r=>r.key===key);if(!row?.target){renderHistory();return false;}
    if(row.target.kind==='activity'){window.dispatchEvent(new CustomEvent('prime:activity-open',{detail:{id:row.target.id,origin}}));return true;}
    notebookHistoryOrigin={key,owner:storageOwner};
    window.PrimeEduAI?.openCategory?.('notes','workspace');
    if(row.target.kind==='note'){state.currentNoteId=row.target.id;state.currentQuiz=null;state.reportVisible=false;}
    else{state.currentNoteId=null;state.currentQuiz=state.quizzes.find(q=>q.id===row.target.id&&!q.archivedAt);state.lastAttempt=state.attempts.find(a=>a.id===row.target.attemptId)||null;state.retryingQuizId=null;state.reportVisible=Boolean(state.lastAttempt);}
    renderAll();focusNotebookReader();return true;
  }

  function renderNotes({ preserveReader = false } = {}) {
    const box = $("#studyNoteList");
    if (!box) return;
    const notes = state.notes.filter(note=>!note.archivedAt);
    box.innerHTML = notes.length
      ? notes.map((note, index) => `
          <button type="button" class="concept-library-card" data-open-concept-note="${escapeHtml(note.id)}" aria-label="${escapeHtml(note.title || note.subject || '학습')} 개념노트 열기">
            <span class="quiz-book-cover stored-book-cover ${['is-blue','is-orange','is-violet','is-green','is-red'][index % 5]}">
              <span class="quiz-book-spine" aria-hidden="true"></span>
              <span class="quiz-book-badge" aria-hidden="true">${PrimeUI.svg('book')}</span>
              <small>개념노트</small>
              <strong title="${escapeHtml(note.title || `${note.subject || '학습'}${note.unit && note.unit !== '개념 정리' ? ` · ${note.unit}` : ''}`)}">${escapeHtml(note.title || `${note.subject || '학습'}${note.unit && note.unit !== '개념 정리' ? ` · ${note.unit}` : ''}`)}</strong>
              <em>${note.summary ? '핵심 정리' : '내 필기'}${note.keywords?.length ? ` · 키워드 ${note.keywords.length}개` : ''}</em>
            </span>
            <span class="stored-book-footer"><time>${escapeHtml(String(note.createdAt || "").slice(0, 10))}</time></span>
          </button>
        `).join("")
      : `<div class="study-empty">아직 노트가 없어요</div>`;
    if (preserveReader) return;
    const selected = state.notes.find(note => note.id === state.currentNoteId);
    const reader = $("#studyConceptReader");
    if (reader) reader.innerHTML = selected ? `<article class="study-item study-note-item"><header class="selected-note-heading"><span>개념노트</span><h3>${escapeHtml(selected.subject || "학습")}</h3><time>${escapeHtml(String(selected.createdAt || "").slice(0, 10))}</time></header><section class="note-source"><h4>내 필기</h4><p class="note-original">${escapeHtml(selected.text || "")}</p></section>${selected.summary ? `<section class="note-ai-summary"><strong>핵심 요약</strong><p>${formatAiText(selected.summary)}</p></section>` : ""}${Array.isArray(selected.keywords) ? `<div class="note-keywords">${selected.keywords.map(word => `<span>#${escapeHtml(word)}</span>`).join("")}</div>` : ""}${renderVisualThinking(selected)}<button class="btn primary pressable" type="button" data-quiz-from-note="${escapeHtml(selected.id)}">문제로 풀기</button></article>` : "";
    const renamedHeading=reader?.querySelector?.('.selected-note-heading h3');
    if(renamedHeading&&selected)renamedHeading.textContent=selected.title||selected.subject||'학습';
    renderNotebookNavigation();
  }

  function mountNotebookReader() {
    const panel = $("#aiNotesPanel");
    const spread = panel?.querySelector(".study-book-spread");
    if (!spread || $("#studyNotebookReader")) return;
    const tabs = document.createElement("nav");
    tabs.id = "studyNotebookTabs";
    tabs.className = "notebook-reader-tabs";
    tabs.setAttribute("aria-label", "저장 노트와 학습 화면");
    spread.before(tabs);
    const reader = document.createElement("section");
    reader.id = "studyNotebookReader";
    reader.className = "notebook-selected-reader";
    reader.hidden = true;
    reader.innerHTML = '<div id="studyConceptReader"></div>';
    spread.after(reader);
    const quizWorkspace = $("#studyQuizWorkspace");
    if (quizWorkspace) reader.append(quizWorkspace);
  }

  function renderNotebookNavigation() {
    const quiz = state.currentQuiz;
    const note = state.notes.find(item => item.id === state.currentNoteId);
    const open = Boolean(quiz || note);
    const spread = $("#aiNotesPanel .study-book-spread");
    if (spread) spread.hidden = open;
    if ($("#studyNotebookReader")) $("#studyNotebookReader").hidden = !open;
    if ($("#studyConceptReader")) $("#studyConceptReader").hidden = !note || Boolean(quiz);
    // A back action belongs to the reader, never to the library itself.
    if ($("#studyNotebookTabs")) $("#studyNotebookTabs").hidden = !open;
    $("#studyNotebookTabs")?.setAttribute("data-view", open ? "reader" : "library");
    if ($("#studyNotebookTabs")) $("#studyNotebookTabs").innerHTML = `<button type="button" data-notebook-library aria-label="${notebookHistoryOrigin?.library?'내 공간으로 돌아가기':notebookHistoryOrigin?'최근 기록으로 돌아가기':'저장 노트로 돌아가기'}" ${open ? "" : 'aria-current="page"'}>저장 노트</button>${open ? `<span tabindex="-1" class="notebook-current-tab">${escapeHtml(quiz ? quiz.title || "문제 풀이" : note.title || note.subject || "개념노트")}</span>` : ""}`;
    window.dispatchEvent(new CustomEvent("prime:notebook-content-change"));
  }

  function focusNotebookReader() {
    requestAnimationFrame(() => {
      $("#studyNotebookTabs .notebook-current-tab")?.focus({ preventScroll: true });
      $("#studyNotebookTabs")?.scrollIntoView({ behavior: "auto", block: "start" });
    });
  }

  function closeNotebookReader() {
    const returnHistory=notebookHistoryOrigin;notebookHistoryOrigin=null;
    const oldNote = state.currentNoteId;
    const oldQuiz = state.currentQuiz?.id;
    state.currentNoteId = null;
    state.currentQuiz = null;
    state.lastAttempt = null;
    state.retryingQuizId = null;
    state.reportVisible = false;
    renderAll();
    if(returnHistory?.owner===storageOwner){window.switchTab?.('progress');requestAnimationFrame(()=>[...document.querySelectorAll('[data-history-open], [data-personal-open]')].find(b=>b.dataset.historyOpen===returnHistory.key||b.dataset.personalOpen===returnHistory.key)?.focus());return;}
    requestAnimationFrame(() => {
      const button = oldNote ? [...document.querySelectorAll("[data-open-concept-note]")].find(el => el.dataset.openConceptNote === oldNote) : [...document.querySelectorAll("[data-open-quiz-book]")].find(el => el.dataset.openQuizBook === oldQuiz);
      button?.focus({ preventScroll: true });
      (button || $("#aiNotesPanel .study-book-spread"))?.scrollIntoView({ behavior: "auto", block: "nearest" });
    });
  }

  function renderVisualThinking(note) {
    const visual = normalizeVisualThinking(note);
    if (!visual.branches.length) return "";
    return `
      <section class="concept-visual-board" aria-label="${escapeHtml(visual.center)} 개념 비주얼씽킹">
        <header><span data-ui-symbol aria-hidden="true">✦</span><strong>AI 개념 비주얼씽킹</strong></header>
        <div class="concept-visual-map">
          <div class="concept-visual-center"><small>중심 개념</small><strong>${escapeHtml(visual.center)}</strong></div>
          <div class="concept-visual-branches">
            ${visual.branches.map((branch, index) => `
              <article style="--branch-index:${index}">
                <span>${escapeHtml(branch.title)}</span>
                <p>${escapeHtml(branch.detail)}</p>
              </article>
            `).join("")}
          </div>
        </div>
      </section>
    `;
  }

  function normalizeVisualThinking(note = {}) {
    const source = note.visualThinking && typeof note.visualThinking === "object" ? note.visualThinking : {};
    const sentences = String(note.summary || note.text || "")
      .split(/(?:[.!?]\s*|\n+)/)
      .map((part) => part.trim())
      .filter(Boolean);
    const keywords = Array.isArray(note.keywords)
      ? note.keywords.map((keyword) => String(keyword).trim()).filter(Boolean)
      : [];
    const sourceBranches = Array.isArray(source.branches) ? source.branches : [];
    const fallbackTitles = keywords.length ? keywords : ["정의", "원리", "예시", "확인"];
    const branches = Array.from({ length: Math.min(4, Math.max(2, sourceBranches.length || fallbackTitles.length)) }, (_, index) => {
      const branch = sourceBranches[index] && typeof sourceBranches[index] === "object" ? sourceBranches[index] : {};
      const title = String(branch.title || fallbackTitles[index % fallbackTitles.length] || `핵심 ${index + 1}`).trim().slice(0, 28);
      const detail = String(
        branch.detail ||
        sentences[index % Math.max(sentences.length, 1)] ||
        note.feedback ||
        `${title}의 뜻과 대표 예시를 함께 확인해 보세요.`,
      ).trim().slice(0, 150);
      return { title, detail };
    }).filter((branch) => branch.title && branch.detail);
    return {
      center: String(source.center || note.unit || note.subject || keywords[0] || "핵심 개념").trim().slice(0, 40),
      branches,
    };
  }

  function renderQuiz() {
    const box = $("#studyQuizResult");
    if (!box) return;
    const quiz = state.currentQuiz;
    const workspace = $("#studyQuizWorkspace");
    const library = $("#studyQuizLibrarySection");
    const createTrigger = $("#studyQuizCreateTrigger");
    if (workspace) workspace.hidden = !quiz;
    if (library) library.hidden = Boolean(quiz);
    if (createTrigger) createTrigger.hidden = Boolean(quiz);
    renderNotebookNavigation();
    if (!quiz) {
      box.innerHTML = "";
      return;
    }
    const editor = $("#studyQuizEditor");
    if (editor) editor.hidden = true;
    if (createTrigger) {
      createTrigger.classList.remove("is-open");
      createTrigger.setAttribute("aria-expanded", "false");
      const mark = createTrigger.querySelector("b");
      if (mark) mark.textContent = "＋";
    }
    const latestAttempt =
      state.retryingQuizId === quiz.id || state.quizDrafts[quiz.id]
        ? null
        : state.lastAttempt?.quizId === quiz.id
          ? state.lastAttempt
          : activeAttempts().find((attempt) => attempt.quizId === quiz.id) || null;
    box.innerHTML = `
      <form class="study-list" id="quizAttemptForm">
        <article class="study-item">
          <h3>${escapeHtml(quiz.title || "AI 확인 퀴즈")}</h3>
          <p>${escapeHtml(quiz.subject || "")} · ${escapeHtml(quiz.unit || "")}</p>
        </article>
        ${(quiz.questions || []).map((question, index) => renderQuestion(question, index, latestAttempt)).join("")}
        ${
          latestAttempt
            ? `
              <section class="quiz-instant-summary" aria-live="polite">
                <span>즉시 채점 결과</span>
                <strong>${latestAttempt.score}/${latestAttempt.total}</strong>
                <small>정답률 ${latestAttempt.accuracy}%</small>
              </section>
              <div class="quiz-result-actions">
                <button class="btn primary pressable" type="button" data-request-quiz-report ${state.reportLoading ? "disabled" : ""}>
                  ${state.reportLoading ? "AI 피드백 작성 중…" : "채점 결과 및 피드백 받기"}
                </button>
                <button class="btn pressable" type="button" data-retry-quiz>다시 풀기</button>
              </div>
            `
            : `<button class="btn primary pressable" type="submit">바로 채점하기</button>`
        }
      </form>
    `;
  }

  function renderQuestion(question, index, attempt = null) {
    const options = Array.isArray(question.options) ? question.options : [];
    const inputName = `quiz-q-${index}`;
    const answer = attempt?.answers?.[index] ?? attempt?.details?.[index]?.answer ?? state.quizDrafts[state.currentQuiz?.id]?.[index] ?? "";
    const detail = attempt?.details?.[index];
    const correct = detail ? Boolean(detail.correct) : normalizeText(answer) === normalizeText(question.answer);
    const result = attempt
      ? `
        <div class="quiz-instant-answer ${correct ? "is-correct" : "is-wrong"}">
          <strong>${correct ? "정답" : "오답"}</strong>
          <span>내 답: ${escapeHtml(answer || "미응답")}</span>
          <span>정답: ${escapeHtml(String(question.answer || detail?.correctAnswer || "-"))}</span>
          ${question.explanation ? `<p>${escapeHtml(question.explanation)}</p>` : ""}
        </div>
      `
      : "";
    return `
      <article class="study-item quiz-question">
        <h4>Q${index + 1}. ${escapeHtml(question.question || "")}</h4>
        ${
          options.length
            ? `<div class="quiz-options">${options
                .map(
                  (option) => `
                    <label>
                      <input type="radio" name="${inputName}" value="${escapeHtml(option)}" ${String(option) === String(answer) ? "checked" : ""} ${attempt ? "disabled" : "required"} />
                      <span>${escapeHtml(option)}</span>
                    </label>
                  `,
                )
                .join("")}</div>`
            : `<input class="field" name="${inputName}" value="${escapeHtml(answer)}" placeholder="답안을 입력하세요" ${attempt ? "disabled" : "required"} />`
        }
        ${result}
      </article>
    `;
  }

  function renderStudyCharts() {
    const profile = buildLearnerProfile();
    const weakRows = profile.weakConcepts.slice(0, 5);
    const hasStudyData = Boolean(state.tasks.length || state.sessions.length || activeAttempts().length);
    const summary = $("#studyDashboardSummary");
    if (summary) summary.innerHTML = [
      ["clock", "학습시간", `${profile.studyMinutes}분`],
      ["check", "완료 과제", `${state.tasks.filter((task) => task.done).length}개`],
      ["target", "평균 정답률", profile.total ? `${profile.accuracy}%` : '—'],
    ].map(([icon, label, value]) => `<article><span aria-hidden="true">${window.PrimeUI.svg(icon)}</span><div><small>${label}</small><strong>${value}</strong></div></article>`).join("");

    const completion = $("#studyCompletionChart");
    if (completion) completion.innerHTML = hasStudyData
      ? `<div class="completion-ring" style="--chart-value:${profile.completion}"><strong>${profile.completion}%</strong></div>`
      : emptyDashboardAction("첫 계획을 시작해요", "plan", "planner");

    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - index));
      const key = formatLocalDate(date);
      const taskMinutes = state.tasks
        .filter((task) => {
          if (!task.done || task.activity) return false;
          const completedKey = task.completedAt ? formatLocalDate(new Date(task.completedAt)) : task.date;
          return completedKey === key;
        })
        .reduce((sum, task) => sum + Number(task.minutes || 0), 0);
      const sessionMinutes = state.sessions
        .filter((session) => session.date === key)
        .reduce((sum, session) => sum + Number(session.minutes || extractMinutes(session.done)), 0);
      const minutes = taskMinutes + sessionMinutes;
      return { label: new Intl.DateTimeFormat("ko-KR", { weekday: "short" }).format(date), minutes };
    });
    const maxMinutes = Math.max(30, ...days.map((day) => day.minutes));
    const minutesBox = $("#studyMinutesChart");
    if (minutesBox) minutesBox.innerHTML = hasStudyData
      ? `<div class="dashboard-bars">${days.map((day) => `<div><span style="height:${Math.max(4, Math.round((day.minutes / maxMinutes) * 100))}%"></span><strong>${day.minutes}</strong><small>${day.label}</small></div>`).join("")}</div>`
      : emptyDashboardAction("아직 학습 기록이 없어요", "plan", "planner");

    const attempts = activeAttempts().slice(0, 7).reverse();
    const accuracyBox = $("#studyAccuracyChart");
    if (accuracyBox) accuracyBox.innerHTML = attempts.length
      ? `<svg class="accuracy-sparkline" viewBox="0 0 300 120" role="img" aria-label="최근 퀴즈 정답률 변화"><polyline points="${attempts.map((attempt, index) => `${20 + index * (260 / Math.max(1, attempts.length - 1))},${105 - Number(attempt.accuracy || 0)}`).join(" ")}"/>${attempts.map((attempt, index) => `<circle cx="${20 + index * (260 / Math.max(1, attempts.length - 1))}" cy="${105 - Number(attempt.accuracy || 0)}" r="5"/>`).join("")}</svg><div class="chart-caption"><span>최근 ${attempts.length}회</span><strong>${attempts.at(-1)?.accuracy || 0}%</strong></div>`
      : emptyDashboardAction("아직 퀴즈 기록이 없어요", "notes", "quiz");

    const weaknessBox = $("#studyWeaknessChart");
    if (weaknessBox) weaknessBox.innerHTML = weakRows.length
      ? `<div class="study-chart">${weakRows.map((concept, index) => barRow(concept, Math.max(18, 100 - index * 17), "")).join("")}</div>`
      : emptyDashboardAction("아직 오답이 없어요", "notes", "quiz");
  }

  function emptyDashboardAction(message, category, tool) {
    return `<div class="dashboard-empty"><p>${escapeHtml(message)}</p><button type="button" class="btn pressable" data-journey="${category === 'plan' ? 'plan' : 'quiz'}" onclick="if(!window.PrimeJourneys)window.PrimeEduAI?.openCategory('${category}','${tool}')">시작하기</button></div>`;
  }

  function barRow(label, value, display = `${value}%`) {
    const safe = Math.max(0, Math.min(Number(value) || 0, 100));
    return `<div class="study-bar-row"><span>${escapeHtml(label)}</span><div class="study-bar"><span style="width:${safe}%"></span></div><strong>${escapeHtml(display)}</strong></div>`;
  }

  async function onGeneratePlan(event) {
    event.preventDefault();
    if (state.loadingPlan) return;
    state.loadingPlan = true;
    const generation = accountGeneration;
    const aiForm = event.currentTarget?.id === "studyPlanFormAI";
    const suffix = aiForm ? "AI" : "";
    const statusSelector = `#studyPlanStatus${suffix}`;
    setOperation(statusSelector, "loading", "계획 생성 중");
    const payload = {
      goal: $(`#studyGoal${suffix}`)?.value || "오늘 공부 계획",
      availableMinutes: Number($(`#studyAvailableMinutes${suffix}`)?.value || 90),
      focus: $(`#studyFocus${suffix}`)?.value || "시험 대비와 숙제",
      style: $(`#studyPlanStyle${suffix}`)?.value || "균형형",
      context: buildStudyContext(),
      learnerProfile: buildLearnerProfile(),
      weakConcepts: getWeakConcepts(),
    };
    const mode = aiForm ? "routine" : ($("#studyPlanMode")?.value || "long");
    const selectedDate = $("#studyPlanSelectedDate")?.value || today();
    payload.mode = mode;
    payload.selectedDate = selectedDate;
    payload.goal = mode === "routine"
      ? `${selectedDate} 하루 공부 순서: ${payload.goal}`
      : `가까운 시험일까지 여러 날짜에 배치하는 플랜: ${payload.goal}`;
    try {
      const plan = await postJson("/api/generateStudyPlan", payload);
      if (!Array.isArray(plan.tasks) || !plan.tasks.length) throw Object.assign(new Error('AI 결과가 비어 있어요. 다시 시도해주세요.'), { code: 'AI_INVALID_RESPONSE' });
      const rawTasks = Array.isArray(plan.tasks) ? plan.tasks : [];
      const proposal = window.PrimePlanPolicy.constrain(normalizeTasks(rawTasks, payload), payload);
      state.pendingPlanUnplaced = proposal.unplaced;
      const tasks = proposal.tasks.map((task, index) => ({
        ...task,
        date: mode === "routine"
          ? selectedDate
          : (isDateKey(rawTasks[index]?.date) ? rawTasks[index].date : addDays(selectedDate, index)),
      }));
      {
        state.pendingPlanTasks = tasks;
        renderTasks();
      }
      setOperation(statusSelector, "success", proposal.unplaced.length ? `계획 준비 · ${proposal.unplaced.reduce((n,t)=>n+t.minutes,0)}분은 시간 부족으로 미배치` : "계획 준비 완료");
    } catch (error) {
      if (error.code === "ACCOUNT_CHANGED") { setOperation(statusSelector, "error", error.message); return; }
      const proposal = window.PrimePlanPolicy.constrain(fallbackPlan(payload), payload);
      state.pendingPlanUnplaced = proposal.unplaced;
      const tasks = proposal.tasks.map((task, index) => ({
        ...task,
        date: mode === "routine" ? selectedDate : addDays(selectedDate, index),
      }));
      {
        state.pendingPlanTasks = tasks;
        renderTasks();
      }
      setOperation(statusSelector, "info", planFailureMessage(error), { fallback: true, retryable: Boolean(error.retryable), errorCode: error.code });
    } finally {
      if (generation === accountGeneration) { state.loadingPlan = false; renderAll({ preserveReader: true }); }
    }
  }

  function planFailureMessage(error) {
    const reasons = {
      AI_TEMPORARY_UNAVAILABLE: 'AI 서버 불안정', AI_NETWORK_ERROR: '연결 끊김', AI_CONNECTION_TIMEOUT: '응답 지연',
      AI_QUOTA_EXCEEDED: 'AI 사용 한도', AI_RATE_LIMITED: 'AI 요청 몰림', AI_KEY_REJECTED: 'AI 연결 설정 필요',
      AI_BILLING_UNAVAILABLE: 'AI 이용 설정 필요', AI_MODEL_UNAVAILABLE: 'AI 모델 설정 필요',
      AI_REQUEST_REJECTED: 'AI 요청 설정 필요', AI_INVALID_RESPONSE: 'AI 결과 형식 오류', AI_RESPONSE_TRUNCATED: 'AI 결과 잘림',
    };
    return `기본 계획 · ${reasons[error?.code] || 'AI 연결 실패'} · 다시 생성 가능`;
  }

  async function requestLearningDiagnosis() {
    if (state.loadingDiagnosis) return;
    state.loadingDiagnosis = true;
    const generation = accountGeneration;
    setDiagnosisStatus("학습 기록을 분석하고 있어요", "loading");
    const payload = {
      context: buildStudyContext(),
      learnerProfile: buildLearnerProfile(),
      attempts: activeAttempts().slice(0, 12),
      sessions: state.sessions.slice(0, 12),
      tasks: state.tasks.slice(0, 12),
    };
    try {
      const diagnosis = await postJson("/api/generateLearningDiagnosis", payload);
      const normalized = normalizeDiagnosis(diagnosis);
      state.diagnostics = [normalized, ...state.diagnostics].slice(0, 20);
      persist();
      saveRemote(COLLECTIONS.diagnostics, normalized);
      setDiagnosisStatus("개인 분석을 업데이트했어요", "success");
    } catch (error) {
      if (error.code === "ACCOUNT_CHANGED") { setDiagnosisStatus(error.message, "error"); return; }
      const normalized = normalizeDiagnosis(localDiagnosis());
      state.diagnostics = [normalized, ...state.diagnostics].slice(0, 20);
      persist();
      setDiagnosisStatus("AI에 연결하지 못해 현재 기록으로 기본 분석을 표시했어요.", "info");
    } finally {
      if (generation === accountGeneration) { state.loadingDiagnosis = false; renderAll({ preserveReader: true }); }
    }
  }

  function addTasks(tasks) {
    state.tasks = [...tasks, ...state.tasks].slice(0, 50);
    persist();
    tasks.forEach((task) => saveRemote(COLLECTIONS.tasks, task));
  }

  function setDiagnosisStatus(message, kind = "info") {
    setOperation("#studyDiagnosisStatus", kind, message);
    setOperation("#studyDiagnosisStatusAI", kind, message);
  }

  async function onGenerateExamStrategy(event) {
    event.preventDefault();
    const examName = $("#examStrategyName")?.value?.trim() || "시험";
    const examDate = $("#examStrategyDate")?.value || "";
    const subjects = $("#examStrategySubjects")?.value?.trim() || "";
    const weakness = $("#examStrategyWeakness")?.value?.trim() || "";
    const availableMinutes = Number($("#examStrategyMinutes")?.value || 120);
    const status = $("#examStrategyStatus");
    const resultBox = $("#examStrategyResult");
    if (!subjects || !examDate) return;
    if (event.currentTarget?.getAttribute("aria-busy") === "true") return;
    setOperation("#examStrategyStatus", "loading", "시험 계획 생성 중");
    try {
      const result = await postJson("/api/generateStudyPlan", {
        goal: `${examName} 과목별 시험 전략. 시험일 ${examDate}. 과목과 범위: ${subjects}. 취약점: ${weakness || "별도 기록 없음"}`,
        availableMinutes,
        focus: "시험 대비 과목별 시간 배분과 공부 전략",
        style: "우선순위 중심",
        context: buildStudyContext(),
      });
      const generatedTasks = Array.isArray(result.tasks)
        ? result.tasks
        : Array.isArray(result.plan)
          ? result.plan
          : [];
      const tasks = generatedTasks.map((task, index) => ({
        ...task,
        id: task.id || uid(),
        date: task.date || addDays(today(), index),
        source: "exam-strategy",
        examName,
      }));
      if (!tasks.length) {
        setOperation("#examStrategyStatus", "info", "공부 항목을 만들지 못했어요. 과목과 범위를 조금 더 자세히 적어주세요.", { available: false });
        return;
      }
      state.pendingExamTasks = tasks;
      if (resultBox) {
        resultBox.innerHTML = `<header><h3>${escapeHtml(examName)} 전략</h3><button class="btn primary pressable" type="button" data-apply-exam-strategy>계획에 추가</button></header>
          <div class="exam-allocation-grid">${tasks.map((task, index) => `<article>
            <span>${index + 1}순위</span>
            <h4>${escapeHtml(task.subject || task.title || "학습")}</h4>
            <strong>${Number(task.minutes || 30)}분</strong>
            <p>${escapeHtml(task.reason || task.description || "핵심 개념 확인 후 문제 풀이")}</p>
          </article>`).join("")}</div>`;
      }
      setOperation("#examStrategyStatus", "success", "시험 전략이 준비됐어요");
    } catch (error) {
      setOperation("#examStrategyStatus", "error", error.message || "시험 전략을 만들지 못했어요. 입력한 내용은 남아 있으니 다시 시도해주세요.");
    }
  }

  async function onSaveNote(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (form?.getAttribute("aria-busy") === "true") return;
    const background = window.PrimeJourneys?.isManaged("concept");
    const rawText = $("#studyNoteText")?.value || "";
    const subject = $("#studyNoteSubject")?.value || "학습";
    const unit = "개념 정리";
    if (!rawText.trim()) return;
    const note = {
      id: uid(),
      subject,
      unit,
      text: rawText,
      createdAt: new Date().toISOString(),
    };
    setOperation("#studyNoteStatus", "loading", "개념노트 생성 중");
    let usedFallback = false;
    try {
      const analysis = await postJson("/api/analyzeLearningText", { type: "concept", subject, unit, text: rawText });
      note.summary = analysis.summary || "";
      note.keywords = Array.isArray(analysis.keywords) ? analysis.keywords : [];
      note.feedback = analysis.feedback || "";
      note.visualThinking = normalizeVisualThinking({ ...note, visualThinking: analysis.visualThinking });
    } catch (error) {
      if (error.code === "ACCOUNT_CHANGED") { setOperation("#studyNoteStatus", "error", error.message); return; }
      usedFallback = true;
      note.summary = rawText.split(/[.!?\n]/).map((part) => part.trim()).filter(Boolean).slice(0, 3).join(". ");
      note.keywords = [...new Set(rawText.match(/[가-힣A-Za-z0-9]{2,}/g) || [])].slice(0, 6);
      note.feedback = "핵심 용어의 정의와 예시를 교과서에서 한 번 더 확인해 보세요.";
      note.visualThinking = normalizeVisualThinking(note);
    }
    state.notes = retainLibraryEntries([note, ...state.notes],30);
    persist();
    const owner = storageOwner, generation = accountGeneration;
    await saveRemote(COLLECTIONS.notes, note);
    if (!isCurrentAccount(owner, generation)) return;
    form?.reset();
    if (!background) { state.currentNoteId = note.id; state.currentQuiz = null; }
    renderNotes({ preserveReader: background });
    if (!background) focusNotebookReader();
    window.dispatchEvent(new CustomEvent("prime:notebook-content-change"));
    setOperation("#studyNoteStatus", usedFallback ? "info" : "success", usedFallback ? "AI에 연결하지 못해 필기를 기본 방식으로 정리했어요. 원본 필기는 저장됐어요." : "개념노트를 저장했어요", { resultId: note.id });
  }

  function onNoteAction(event) {
    const opener = event.target.closest("[data-open-concept-note]");
    if (opener) {
      notebookHistoryOrigin = null;
      state.currentNoteId = opener.dataset.openConceptNote;
      state.currentQuiz = null;
      renderAll();
      focusNotebookReader();
      return;
    }
    const button = event.target.closest("[data-quiz-from-note]");
    if (!button) return;
    const note = state.notes.find((item) => item.id === button.dataset.quizFromNote);
    if (!note) return;
    closeNotebookReader();
    if ($("#quizSubject")) $("#quizSubject").value = note.subject || "";
    if ($("#quizUnit")) $("#quizUnit").value = note.unit || "";
    if ($("#quizNoteText")) $("#quizNoteText").value = [note.summary, note.text].filter(Boolean).join("\n\n");
    if ($("#quizNoteText")) $("#quizNoteText").dataset.sourceNoteId = note.id;
    window.PrimeEduAI?.openCategory?.("notes", "workspace");
    const editor = $("#studyQuizEditor");
    if (editor) editor.hidden = false;
    if (window.PrimeJourneys) window.PrimeJourneys.open("quiz", button);
    else requestAnimationFrame(() => $("#quizCount")?.focus());
  }

  async function onRecommendBooks(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (form?.getAttribute("aria-busy") === "true") return;
    const submitButton = form?.querySelector('button[type="submit"]');
    const payload = {
      topic: $("#studyBookTopic")?.value?.trim() || "",
      category: $("#studyBookCategory")?.value || "문학",
      level: $("#studyBookLevel")?.value || "중학생 권장",
      preference: $("#studyBookPreference")?.value?.trim() || "",
      learnerProfile: buildLearnerProfile(),
    };
    if (payload.topic.length < 2) {
      setOperation("#studyBookStatus", "error", "읽고 싶은 주제를 두 글자 이상 적어주세요.");
      return;
    }
    if (submitButton) submitButton.disabled = true;
    setOperation("#studyBookStatus", "loading", "도서 찾는 중");
    try {
      const result = await postJson("/api/recommendBooks", payload);
      const books = (Array.isArray(result?.books) ? result.books : []).filter((book) => book?.title).slice(0, 5);
      if (!books.length) {
        setOperation("#studyBookStatus", "info", "조건에 맞는 책을 찾지 못했어요. 주제를 조금 넓혀 다시 시도해주세요.", { available: false });
        return;
      }
      state.bookRecommendations = books;
      state.bookSummary = String(result?.summary || "");
      persist();
      renderBookRecommendations(result, payload);
      window.dispatchEvent(new CustomEvent("schems:study-data", { detail: getSnapshot() }));
      setOperation("#studyBookStatus", "success", "추천 완료");
    } catch (error) {
      const friendlyMessage = /JSON|array element|position \d+/i.test(String(error.message || ""))
        ? "AI 응답을 정리하지 못했습니다. 같은 조건으로 한 번 더 시도해주세요."
        : (error.message || "AI 연결을 확인한 뒤 다시 시도해주세요.");
      setOperation("#studyBookStatus", "error", friendlyMessage);
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  }

  function renderBookRecommendations(result, payload) {
    const box = $("#studyBookResults");
    if (!box) return;
    const books = (Array.isArray(result?.books) ? result.books : [])
      .filter((book) => book && book.title)
      .slice(0, 5);
    const jump = $("#studyBookResultJump");
    if (!books.length) {
      if (jump) { jump.hidden = true; jump.onclick = null; }
      box.innerHTML = `<div class="book-recommendation-empty"><strong>조건에 맞는 책을 찾지 못했습니다.</strong><p>주제를 조금 넓게 바꿔 다시 검색해보세요.</p></div>`;
      return;
    }
    if (jump) {
      jump.hidden = false;
      const label = `추천 도서 ${books.length}권 보기`;
      jump.setAttribute('aria-label', label);
      jump.title = label;
      // This is an icon control. Never put a long label back into its 44px box.
      jump.innerHTML = window.PrimeUI.svg('down');
      jump.onclick = () => {
        box.scrollIntoView({ behavior: "auto", block: "start" });
        box.focus({ preventScroll: true });
      };
    }
    window.dispatchEvent(new CustomEvent("prime:notebook-content-change"));
    box.innerHTML = `
      <h3 class="book-results-title">추천 도서</h3>
      ${result?.summary ? `<p class="book-recommendation-summary">${formatAiText(result.summary)}</p>` : ""}
      <div class="book-recommendation-grid">
        ${books.map((book, index) => `
          <article class="book-recommendation-card">
            <span class="book-recommendation-number" aria-hidden="true">${index + 1}</span>
            <div>
              <span class="book-recommendation-category">${escapeHtml(book.category || payload.category)}</span>
              <h4>${escapeHtml(book.title)}</h4>
              <p class="book-recommendation-author">${escapeHtml(book.author || "저자 정보 확인 필요")}</p>
              <p>${escapeHtml(book.reason || "입력한 주제와 읽기 수준을 바탕으로 추천했습니다.")}</p>
              ${book.learningPoint ? `<dl><dt>읽기 포인트</dt><dd>${escapeHtml(book.learningPoint)}</dd></dl>` : ""}
              <button type="button" class="book-connect-action btn pressable" data-activity-book-source="${index}" data-book-title="${escapeHtml(book.title)}" aria-label="${escapeHtml(book.title)} 읽기 계획 연결" data-ui-keep-label>${window.PrimeUI.svg('calendar')} 읽기 계획</button>
            </div>
          </article>
        `).join("")}
      </div>
      <p class="book-verification-note">AI 추천 · 제목·저자·대출 가능 여부 확인</p>`;
  }

  function renderSavedBookRecommendations() {
    if (!state.bookRecommendations.length) {
      const box=$("#studyBookResults"),jump=$("#studyBookResultJump");if(jump){jump.hidden=true;jump.onclick=null;}
      if(box)box.innerHTML='<div class="book-recommendation-empty"><strong>다음에 읽을 책</strong><p>관심 있는 주제로 찾아보세요</p><button type="button" class="btn pressable" data-journey="books" data-ui-keep-label>책 찾기</button></div>';
      return;
    }
    renderBookRecommendations(
      { summary: state.bookSummary, books: state.bookRecommendations },
      { category: state.bookRecommendations[0]?.category || "추천 도서" },
    );
  }

  async function onGenerateQuiz(event) {
    event.preventDefault();
    if (state.loadingQuiz) return;
    const background = window.PrimeJourneys?.isManaged("quiz");
    let generatedQuiz;
    state.loadingQuiz = true;
    const generation = accountGeneration;
    setOperation("#studyQuizStatus", "loading", "문제노트 생성 중");
    const payload = {
      subject: $("#quizSubject")?.value || "",
      unit: $("#quizUnit")?.value || "",
      difficulty: $("#quizDifficulty")?.value || "중간",
      count: Number($("#quizCount")?.value || 5),
      noteText: $("#quizNoteText")?.value || "",
      learningContext: window.PrimeLearnerIntegration?.getSelfReport?.() || {},
    };
    const sourceId = $("#quizNoteText")?.dataset?.sourceNoteId;
    const sourceNote = sourceId && state.notes.find(n=>n.id===sourceId&&!n.archivedAt);
    const verifiedSourceId = sourceNote && [sourceNote.summary,sourceNote.text].filter(Boolean).join("\n\n") === payload.noteText ? sourceId : null;
    try {
      const quiz = await postJson("/api/generateQuiz", payload);
      generatedQuiz = normalizeQuiz(quiz, payload);
      if (verifiedSourceId) generatedQuiz.sourceNoteId = verifiedSourceId;
      saveQuiz(generatedQuiz, !background);
      setOperation("#studyQuizStatus", "success", "새 문제책을 만들었어요", { resultId: generatedQuiz.id });
    } catch (error) {
      if (error.code === "ACCOUNT_CHANGED") { setOperation("#studyQuizStatus", "error", error.message); return; }
      generatedQuiz = fallbackQuiz(payload);
      if (verifiedSourceId) generatedQuiz.sourceNoteId = verifiedSourceId;
      saveQuiz(generatedQuiz, !background);
      setOperation("#studyQuizStatus", "info", "AI에 연결하지 못해 기본 문제책을 준비했어요. 새로 생성하면 AI 문제를 받을 수 있어요.", { resultId: generatedQuiz.id });
    } finally {
      if (generation === accountGeneration) {
        state.loadingQuiz = false;
        if (!background) { state.quizStartedAt = Date.now(); state.reportVisible = false; state.retryingQuizId = null; }
        renderAll({ preserveReader: background });
      }
    }
  }

  function saveQuiz(quiz, activate = true) {
    if (activate) state.currentQuiz = quiz;
    state.quizzes = retainLibraryEntries([quiz, ...state.quizzes],20);
    if (quiz.noteText) {
      const note = { id: uid(), subject: quiz.subject, unit: quiz.unit, text: quiz.noteText, createdAt: new Date().toISOString() };
      state.notes = retainLibraryEntries([note, ...state.notes],30);
      saveRemote(COLLECTIONS.notes, note);
    }
    persist();
    saveRemote(COLLECTIONS.quizzes, quiz);
  }

  async function onGradeQuiz(event) {
    event.preventDefault();
    const quiz = state.currentQuiz;
    if (!quiz) return;
    const answers = (quiz.questions || []).map((_, index) => {
      const checked = document.querySelector(`[name="quiz-q-${index}"]:checked`);
      const input = document.querySelector(`input[name="quiz-q-${index}"]:not([type="radio"])`);
      return checked?.value || input?.value || "";
    });
    const durationSec = state.quizStartedAt ? Math.max(1, Math.round((Date.now() - state.quizStartedAt) / 1000)) : 0;
    state.retryingQuizId = null;
    state.reportVisible = false;
    delete state.quizDrafts[quiz.id];
    saveAttempt(localGrade(quiz, answers, durationSec));
    renderAll();
  }

  function saveAttempt(attempt) {
    state.lastAttempt = attempt;
    state.attempts = [attempt, ...state.attempts.filter((item) => item.id !== attempt.id)].slice(0, 50);
    persist();
    saveRemote(COLLECTIONS.attempts, attempt);
  }

  function renderStepwiseFeedback() {
    const latest = state.lastAttempt || activeAttempts()[0];
    const panel = $("#studyFeedback");
    if (!panel) return;
    if (state.reportLoading) {
      setOperation("#studyFeedback", "loading", "풀이 분석 중");
      return;
    }
    panel.className = "";
    panel.removeAttribute("role");
    if (!latest || !state.reportVisible) {
      panel.innerHTML = "";
      return;
    }
    panel.innerHTML = `
      <section class="quiz-report" aria-live="polite">
        <header class="quiz-report-head">
          <div><span>풀이 기록</span><h3>${latest.score}/${latest.total}</h3></div>
          <strong>${latest.accuracy}%</strong>
        </header>
        <article class="study-item study-feedback">
          <p>${formatAiText(latest.feedback || "")}</p>
          ${latest.recommendedNext ? `<p><strong>다음 학습</strong> ${escapeHtml(latest.recommendedNext)}</p>` : ""}
        </article>
        <div class="quiz-report-list">
          ${(latest.details || []).map((detail, index) => renderFeedbackDetail(detail, index)).join("")}
        </div>
      </section>
    `;
  }

  function renderFeedbackDetail(detail, index) {
    const correct = Boolean(detail.correct);
    return `
      <article class="quiz-report-item ${correct ? "is-correct" : "is-wrong"}">
        <header><span>Q${index + 1}</span><strong>${correct ? "정답" : escapeHtml(detail.errorType || "오답")}</strong></header>
        <dl>
          <div><dt>내 답</dt><dd>${escapeHtml(detail.answer || "미응답")}</dd></div>
          <div><dt>정답</dt><dd>${escapeHtml(detail.correctAnswer || "-")}</dd></div>
          <div><dt>해설</dt><dd>${escapeHtml(detail.explanation || "해설이 없습니다.")}</dd></div>
          ${detail.conceptReview ? `<div><dt>핵심 개념</dt><dd>${escapeHtml(detail.conceptReview)}</dd></div>` : ""}
          ${!correct && detail.commonMistake ? `<div><dt>주의할 점</dt><dd>${escapeHtml(detail.commonMistake)}</dd></div>` : ""}
          ${detail.nextPractice ? `<div><dt>다음 연습</dt><dd>${escapeHtml(detail.nextPractice)}</dd></div>` : ""}
        </dl>
      </article>
    `;
  }

  async function onQuizAction(event) {
    if (event.target.closest("[data-close-quiz-workspace]")) {
      closeNotebookReader();
      return;
    }
    if (event.target.closest("[data-retry-quiz]")) {
      state.retryingQuizId = state.currentQuiz?.id || null;
      if (state.currentQuiz) state.quizDrafts[state.currentQuiz.id] = {};
      state.lastAttempt = null;
      state.reportVisible = false;
      state.quizStartedAt = Date.now();
      renderAll();
      return;
    }
    if (!event.target.closest("[data-request-quiz-report]") || state.reportLoading) return;
    const quiz = state.currentQuiz;
    const attempt = state.lastAttempt || activeAttempts().find((item) => item.quizId === quiz?.id);
    if (!quiz || !attempt) return;
    state.reportLoading = true;
    const generation = accountGeneration;
    renderQuiz();
    renderStepwiseFeedback();
    try {
      const graded = await postJson("/api/gradeQuiz", {
        quiz,
        answers: attempt.answers,
        durationSec: attempt.durationSec,
        learnerProfile: buildLearnerProfile(),
      });
      const report = normalizeAttempt(graded, quiz, attempt.answers, attempt.durationSec);
      report.id = attempt.id;
      report.createdAt = attempt.createdAt;
      saveAttempt(report);
    } catch (error) {
      if (error.code === "ACCOUNT_CHANGED") return;
      state.lastAttempt = {
        ...attempt,
        feedback: `${attempt.feedback || "즉시 채점은 완료되었습니다."} AI 피드백 서버에 연결하지 못해 기본 해설을 표시합니다.`,
      };
    } finally {
      if (generation === accountGeneration) { state.reportLoading = false; state.reportVisible = true; renderAll(); }
    }
  }

  function renderQuizLibrary() {
    const box = $("#studyQuizLibrary");
    const count = $("#studyQuizLibraryCount");
    if (!box) return;
    const books = state.quizzes.filter(quiz=>!quiz.archivedAt)
      .map((quiz) => ({ quiz, attempt: activeAttempts().find((item) => item.quizId === quiz.id) }));
    if (count) { count.textContent = `${books.length}권`; count.hidden = !books.length; }
    if (!books.length) {
      box.innerHTML = `<div class="quiz-library-empty"><strong>아직 노트가 없어요</strong></div>`;
      return;
    }
    box.innerHTML = books
      .map(
        ({ quiz, attempt }, index) => `
          <article class="quiz-book-item">
            <button class="quiz-book" type="button" data-open-quiz-book="${escapeHtml(quiz.id)}" aria-label="${escapeHtml(quiz.title || quiz.unit || '문제책')} 문제노트 열기">
              <span class="quiz-book-cover stored-book-cover ${['is-blue','is-orange','is-violet','is-green','is-red'][index % 5]}">
                <span class="quiz-book-spine" aria-hidden="true"></span>
                <span class="quiz-book-badge" aria-hidden="true">${PrimeUI.svg('book')}</span>
                <small>${escapeHtml(quiz.subject || '학습')} · 문제노트</small>
                <strong title="${escapeHtml(quiz.title || quiz.unit || '문제 모음')}">${escapeHtml(quiz.title || quiz.unit || "문제 모음")}</strong>
                <em>${attempt ? `${attempt.score}/${attempt.total} · ${attempt.accuracy}%` : `미풀이 · ${(quiz.questions || []).length}문항`}</em>
              </span>
            </button>
            <span class="stored-book-footer"><time>${escapeHtml(String(attempt?.createdAt || attempt?.date || quiz.createdAt || "").slice(0, 10))}</time></span>
            <button class="quiz-book-delete" type="button" data-delete-quiz-book="${escapeHtml(quiz.id)}" aria-label="${escapeHtml(quiz.title || quiz.unit || "문제책")} 삭제">삭제</button>
          </article>
        `,
      )
      .join("");
  }

  async function onQuizLibraryClick(event) {
    const deleteButton = event.target.closest("[data-delete-quiz-book]");
    if (deleteButton) {
      await deleteQuizBook(deleteButton.dataset.deleteQuizBook);
      return;
    }
    const button = event.target.closest("[data-open-quiz-book]");
    if (!button) return;
    const quiz = state.quizzes.find((item) => item.id === button.dataset.openQuizBook);
    if (!quiz) return;
    notebookHistoryOrigin = null;
    state.currentQuiz = quiz;
    state.lastAttempt = activeAttempts().find((item) => item.quizId === quiz.id) || null;
    state.retryingQuizId = null;
    state.reportVisible = false;
    renderAll();
    focusNotebookReader();
  }

  async function deleteQuizBook(quizId) {
    const quiz = state.quizzes.find((item) => item.id === quizId);
    if (!quiz) return;
    const title = quiz.title || quiz.unit || "이 문제책";
    if (!window.confirm(`"${title}" 문제책과 풀이 기록을 삭제할까요?`)) return;

    const relatedAttempts = state.attempts.filter((item) => item.quizId === quizId);
    state.quizzes = state.quizzes.filter((item) => item.id !== quizId);
    state.attempts = state.attempts.filter((item) => item.quizId !== quizId);
    if (state.currentQuiz?.id === quizId) state.currentQuiz = null;
    if (state.lastAttempt?.quizId === quizId) state.lastAttempt = null;
    if (state.retryingQuizId === quizId) state.retryingQuizId = null;
    persist();
    renderAll();
    requestAnimationFrame(() => {
      ($("#studyQuizLibrary")?.querySelector("[data-open-quiz-book]") || $("#studyQuizCreateTrigger"))?.focus();
    });

    const hub = window.ClassHubFirebase;
    const user = hub?.getCurrentUser?.();
    if (!user?.uid || !hub?.deleteUserCollectionDoc) return;
    const remoteItems = [
      [COLLECTIONS.quizzes, quizId],
      ...relatedAttempts.map((attempt) => [COLLECTIONS.attempts, attempt.id]),
    ];
    const results = await Promise.allSettled(
      remoteItems.map(([collection, id]) => hub.deleteUserCollectionDoc(user.uid, collection, id)),
    );
    if (results.some((result) => result.status === "rejected")) {
      console.warn("Some quiz records could not be deleted remotely.");
    }
  }

  function onTaskClick(event) {
    const doneId = event.target.closest("[data-study-done]")?.dataset.studyDone;
    if (doneId) {
      const task = state.tasks.find((item) => item.id === doneId);
      if (task) {
        setTaskDone(doneId, !task.done);
      }
    }
  }

  function setTaskDone(taskId, done) {
    const task = state.tasks.find((item) => item.id === taskId);
    if (!task) return false;
    if (task.activity) { renderAll(); return false; } // Preparation outcomes own activity completion.
    task.done = Boolean(done);
    task.completedAt = task.done ? new Date().toISOString() : "";
    persist();
    saveRemote(COLLECTIONS.tasks, task);
    renderAll();
    return true;
  }

  async function deleteTask(taskId) {
    const index = state.tasks.findIndex((item) => item.id === taskId);
    if (index < 0) return false;
    state.tasks.splice(index, 1);
    persist();
    const hub = window.ClassHubFirebase;
    const user = hub?.getCurrentUser?.();
    if (user?.uid && hub?.deleteUserCollectionDoc) {
      try {
        await hub.deleteUserCollectionDoc(user.uid, COLLECTIONS.tasks, taskId);
      } catch (error) {
        console.warn("Study AI remote delete failed:", error);
      }
    }
    renderAll();
    return true;
  }

  async function addStudySession(session) {
    if(!isCurrentAccount(storageOwner))throw accountChangedError();
    const item = {
      id: String(session?.id || uid()),
      title: String(session?.title || "학습 세션"),
      done: String(session?.done || ""),
      minutes: Math.max(0, Number(session?.minutes || 0)),
      completed: session?.completed !== false,
      source: String(session?.source || "manual"),
      date: String(session?.date || today()),
      createdAt: session?.createdAt || new Date().toISOString(),
      ...(session?.activityId ? {activityId:session.activityId,blockId:session.blockId,outcome:session.outcome} : {}),
      ...(session?.noteId ? {noteId:String(session.noteId)} : {}),
      ...(session?.quizId ? {quizId:String(session.quizId)} : {}),
      ...(typeof session?.content==='string' ? {content:session.content.slice(0,8000)} : {}),
      ...(typeof session?.feedback==='string' ? {feedback:session.feedback.slice(0,8000)} : {}),
    };
    if (state.sessions.some((existing) => existing.id === item.id)) return false;
    const before=state.sessions;state.sessions = [item, ...state.sessions].slice(0, 100);
    try{persist();}catch(error){state.sessions=before;throw Error('기록을 저장하지 못했어요. 원래 기록은 유지했어요.');}
    renderAll({preserveReader:true});
    const owner = storageOwner, generation = accountGeneration;
    await saveRemote(COLLECTIONS.sessions, item);
    if (isCurrentAccount(owner, generation)) renderAll();
    return true;
  }

  function seedOfflinePlan(event) {
    const aiForm = event?.currentTarget?.id === "studyOfflineSeedAI";
    const selectedDate = $("#studyPlanSelectedDate")?.value || today();
    const mode = aiForm ? "routine" : ($("#studyPlanMode")?.value || "long");
    const tasks = fallbackPlan({ goal: "오늘 공부 순서", availableMinutes: 90, focus: "균형 학습" }).map((task, index) => ({
      ...task,
      date: mode === "routine" ? selectedDate : addDays(selectedDate, index),
    }));
    if (aiForm) addTasks(tasks);
    else {
      state.pendingPlanTasks = tasks;
      renderTasks();
    }
    setText(aiForm ? "#studyPlanStatusAI" : "#studyPlanStatus", aiForm ? "샘플 학습 계획을 추가했습니다." : "샘플 계획을 확인한 뒤 추가하세요.");
  }

  function addDays(key, amount) {
    const date = new Date(`${key}T00:00:00`);
    date.setDate(date.getDate() + Number(amount || 0));
    return formatLocalDate(date);
  }

  function isDateKey(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
  }

  function applyPendingPlan() {
    if (!state.pendingPlanTasks.length) return;
    const tasks = state.pendingPlanTasks;
    state.pendingPlanTasks = [];
    addTasks(tasks);
    setText("#studyPlanStatus", "캘린더와 체크리스트에 계획을 추가했습니다.");
    renderAll({ preserveReader: true });
    window.dispatchEvent(new CustomEvent("prime:study-result-consumed", { detail: "plan" }));
  }

  function buildStudyContext() {
    const planner = readPlannerData();
    const profile = buildLearnerProfile();
    const todayKey = today();
    const lines = [`오늘: ${todayKey}`, `학급: ${planner.className || "미설정"}`, ""];
    const consultation=window.PrimeStudyOnboarding?.getContext?.();
    if(consultation)lines.push(consultation,'');
    lines.push("=== 시간표 ===");
    (planner.schedule || []).forEach((row, idx) => lines.push(`${idx + 1}교시: ${(row || []).join(", ")}`));
    lines.push("");
    lines.push("=== 가까운 일정 ===");
    (planner.events || [])
      .filter((event) => (event.endDate || event.date || "") >= todayKey)
      .slice(0, 20)
      .forEach((event) => lines.push(`- ${event.date}${event.endDate ? `~${event.endDate}` : ""} [${event.type}] ${event.title}`));
    lines.push("");
    lines.push("=== 학습자 진단 ===");
    lines.push(`수준: ${profile.level}, 정답률: ${profile.accuracy}%, 목표 달성률: ${profile.completion}%`);
    lines.push(`취약 개념: ${profile.weakConcepts.join(", ") || "없음"}`);
    lines.push(`추천 난이도: ${profile.recommendedDifficulty}`);
    if (state.tasks.length) {
      lines.push("");
      lines.push("=== 최근 학습 할 일 ===");
      state.tasks.slice(0, 10).forEach((task) => lines.push(`- ${task.done ? "완료" : "예정"} ${task.subject}: ${task.title}`));
    }
    return lines.join("\n");
  }

  function readPlannerData() {
    try {
      return JSON.parse(localStorage.getItem("classPlannerData.v3") || "{}");
    } catch {
      return {};
    }
  }

  async function postJson(url, payload) {
    const owner = storageOwner, generation = accountGeneration;
    const controller = new AbortController();
    // Server retry/failover has one 40s deadline; leave room for authentication/transport.
    const timer = setTimeout(() => controller.abort(), 55000);
    try {
      const token = await window.ClassHubFirebase?.getCurrentUser?.()?.getIdToken?.();
      if (!isCurrentAccount(owner, generation)) throw accountChangedError();
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(payload), signal: controller.signal,
      });
      const data = await response.json().catch(() => null);
      if (!isCurrentAccount(owner, generation)) throw accountChangedError();
      if (!response.ok) throw Object.assign(new Error(data?.error || 'AI 서버가 응답하지 않아요. 다시 시도해주세요.'), {
        code: data?.code || (response.status === 429 ? 'AI_QUOTA_EXCEEDED' : response.status === 504 ? 'AI_CONNECTION_TIMEOUT' : 'AI_TEMPORARY_UNAVAILABLE'),
        status: response.status, retryable: data?.retryable ?? [502, 503, 504].includes(response.status),
      });
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw Object.assign(new Error('AI 결과 형식이 올바르지 않아요. 다시 시도해주세요.'), { code: 'AI_INVALID_RESPONSE', retryable: false });
      return data;
    } catch (error) {
      if (!isCurrentAccount(owner, generation)) throw accountChangedError();
      if (error.name === "AbortError") throw Object.assign(new Error("응답이 늦어지고 있어요. 입력한 내용은 유지되니 다시 시도해주세요."), { code: 'AI_CONNECTION_TIMEOUT', retryable: true });
      if (!error.code && error.name === 'TypeError') throw Object.assign(new Error('연결이 끊겼어요. 입력은 유지되니 다시 시도해주세요.'), { code: 'AI_NETWORK_ERROR', retryable: true });
      throw error;
    } finally { clearTimeout(timer); }
  }

  function normalizeTasks(tasks, payload) {
    const raw = Array.isArray(tasks) && tasks.length ? tasks : fallbackPlan(payload);
    return raw.slice(0, 8).map((task) => ({
      id: task.id || uid(),
      date: task.date || today(),
      subject: String(task.subject || "자기주도학습"),
      title: String(task.title || "핵심 개념 복습"),
      reason: String(task.reason || "현재 일정과 학습 목표를 반영한 추천입니다."),
      minutes: Number(task.minutes || 30),
      priority: String(task.priority || "보통"),
      done: false,
      createdAt: new Date().toISOString(),
    }));
  }

  function normalizeQuiz(quiz, payload) {
    return {
      id: quiz.id || uid(),
      title: quiz.title || `${payload.subject || "학습"} 확인 퀴즈`,
      subject: payload.subject,
      unit: payload.unit,
      difficulty: payload.difficulty,
      noteText: payload.noteText,
      questions: normalizeQuestions(quiz.questions, payload),
      createdAt: new Date().toISOString(),
    };
  }

  function normalizeQuestions(questions, payload) {
    const raw = Array.isArray(questions) && questions.length ? questions : fallbackQuiz(payload).questions;
    return raw.slice(0, payload.count || 5).map((q) => ({
      type: q.type || (Array.isArray(q.options) ? "multiple_choice" : "short_answer"),
      concept: q.concept || payload.unit || payload.subject || "핵심 개념",
      question: q.question || "핵심 개념을 설명하세요.",
      options: Array.isArray(q.options) ? q.options.map(String).slice(0, 5) : [],
      answer: String(q.answer || ""),
      explanation: String(q.explanation || "필기 내용을 다시 확인해보세요."),
      conceptReview: String(q.conceptReview || ""),
      commonMistake: String(q.commonMistake || ""),
      nextPractice: String(q.nextPractice || ""),
    }));
  }

  function normalizeAttempt(graded, quiz, answers, durationSec) {
    const total = Number(graded.total || (quiz.questions || []).length);
    const score = Number(graded.score || 0);
    const details = normalizeDetails(graded.details, quiz, answers);
    return {
      id: uid(),
      quizId: quiz.id,
      date: today(),
      answers,
      score,
      total,
      accuracy: total ? Math.round((score / total) * 100) : 0,
      durationSec,
      feedback: graded.feedback || "",
      weakConcepts: Array.isArray(graded.weakConcepts) ? graded.weakConcepts : details.filter((d) => !d.correct).map((d) => d.concept || d.question),
      errorTypes: details.filter((d) => !d.correct).map((d) => d.errorType || "개념 혼동"),
      recommendedNext: graded.recommendedNext || details.find((d) => !d.correct)?.nextPractice || "",
      details,
      createdAt: new Date().toISOString(),
    };
  }

  function normalizeDetails(details, quiz, answers) {
    const questions = quiz.questions || [];
    const raw = Array.isArray(details) && details.length ? details : [];
    return questions.map((question, index) => {
      const source = raw[index] || {};
      const correct = source.correct !== undefined ? Boolean(source.correct) : normalizeText(answers[index]) === normalizeText(question.answer);
      return {
        question: source.question || question.question,
        concept: source.concept || question.concept,
        answer: source.answer || answers[index] || "",
        correctAnswer: source.correctAnswer || question.answer || "",
        correct,
        explanation: source.explanation || question.explanation || "",
        errorType: source.errorType || (correct ? "이해 완료" : classifyErrorType(question, answers[index])),
      conceptReview: source.conceptReview || question.conceptReview || `${question.concept || "핵심 개념"}을 필기에서 다시 찾아보세요.`,
        commonMistake: source.commonMistake || question.commonMistake || "문제 조건을 끝까지 확인하지 않고 답을 고르는 실수",
        nextPractice: source.nextPractice || question.nextPractice || `${question.concept || "이 개념"}과 관련된 쉬운 문제를 2개 더 풀어보세요.`,
      };
    });
  }

  function normalizeDiagnosis(diagnosis) {
    return {
      id: diagnosis.id || uid(),
      date: today(),
      summary: diagnosis.summary || "현재 기록을 바탕으로 학습 경로를 업데이트했습니다.",
      level: diagnosis.level || buildLearnerProfile().level,
      strengths: Array.isArray(diagnosis.strengths) ? diagnosis.strengths : [],
      weaknesses: Array.isArray(diagnosis.weaknesses) ? diagnosis.weaknesses : getWeakConcepts(),
      recommendedDifficulty: diagnosis.recommendedDifficulty || buildLearnerProfile().recommendedDifficulty,
      nextPath: Array.isArray(diagnosis.nextPath) ? diagnosis.nextPath : buildLearnerProfile().nextPath,
      restAlert: diagnosis.restAlert || buildLearnerProfile().restAlert,
      createdAt: new Date().toISOString(),
    };
  }

  function localGrade(quiz, answers, durationSec) {
    const details = normalizeDetails([], quiz, answers);
    let score = 0;
    details.forEach((detail) => {
      if (detail.correct) score += 1;
    });
    const total = details.length;
    return {
      id: uid(),
      quizId: quiz.id,
      date: today(),
      answers,
      score,
      total,
      accuracy: total ? Math.round((score / total) * 100) : 0,
      durationSec,
      feedback: score === total ? "좋아요. 전부 맞혔습니다." : "틀린 문항의 정답과 해설을 확인하고 다시 풀어보세요.",
      weakConcepts: [...new Set(details.filter((d) => !d.correct).map((d) => d.concept || d.question))].slice(0, 8),
      errorTypes: details.filter((d) => !d.correct).map((d) => d.errorType),
      recommendedNext: details.find((d) => !d.correct)?.nextPractice || "다음에는 난이도를 한 단계 올려보세요.",
      details,
      createdAt: new Date().toISOString(),
    };
  }

  function fallbackPlan(payload = {}) {
    const minutes = Number(payload.availableMinutes || 90);
    const chunk = Math.max(1, Math.floor(minutes / 3));
    const weak = getWeakConcepts()[0];
    const goal = String(payload.goal || "입력한 공부 목표").slice(0,100);
    return [
      { id: uid(), date: today(), subject: "학습", title: weak ? `${weak} 다시 풀기` : `${goal} · 첫 항목`, reason: "직접 확인할 수 있는 기본 계획", minutes: chunk, priority: "높음" },
      { id: uid(), date: today(), subject: "학습", title: `${goal} · 이어서 공부`, reason: "입력한 목표 기준", minutes: chunk, priority: "보통" },
      { id: uid(), date: today(), subject: "정리", title: "공부한 내용 확인", reason: "다음 할 일만 짧게 기록", minutes: Math.max(1,minutes-chunk*2), priority: "보통" },
    ];
  }

  function fallbackQuiz(payload = {}) {
    const subject = payload.subject || "학습";
    const unit = payload.unit || "핵심 단원";
    return {
      id: uid(),
      title: `${subject} ${unit} 확인 퀴즈`,
      subject,
      unit,
      difficulty: payload.difficulty || "중간",
      noteText: payload.noteText || "",
      questions: [
        {
          type: "short_answer",
          concept: unit,
          question: `${unit}에서 가장 중요한 개념을 한 문장으로 쓰세요.`,
          options: [],
          answer: unit,
          explanation: "핵심어가 포함되었는지 스스로 확인하세요.",
          conceptReview: `${unit}의 정의, 예시, 조건을 구분해 정리해보세요.`,
          commonMistake: "핵심어 없이 느낌만 설명하는 경우가 많습니다.",
          nextPractice: `${unit} 예시를 하나 직접 만들어보세요.`,
        },
        {
          type: "multiple_choice",
          concept: "복습 전략",
          question: "효과적인 복습 방법으로 가장 적절한 것은?",
          options: ["한 번만 읽기", "오답 이유 설명하기", "모르는 부분 넘기기", "답만 외우기"],
          answer: "오답 이유 설명하기",
          explanation: "오답 원인을 설명하면 기억이 오래갑니다.",
          conceptReview: "복습은 정답 확인보다 오류 원인을 찾을 때 효과가 큽니다.",
          commonMistake: "답만 외우면 비슷한 변형 문제에서 다시 틀릴 수 있습니다.",
          nextPractice: "오늘 틀린 문제 하나의 오답 이유를 말로 설명해보세요.",
        },
      ],
      createdAt: new Date().toISOString(),
    };
  }

  function localDiagnosis() {
    const profile = buildLearnerProfile();
    return {
      summary: profile.total ? `${profile.level} 상태입니다. ${profile.todayPriority}을 먼저 진행하세요.` : "아직 기록이 부족합니다. 문제 풀이와 학습 계획으로 시작해보세요.",
      level: profile.level,
      weaknesses: profile.weakConcepts,
      recommendedDifficulty: profile.recommendedDifficulty,
      nextPath: profile.nextPath,
      restAlert: profile.restAlert,
    };
  }

  function getWeakConcepts() {
    return [
      ...new Set(
        activeAttempts()
          .flatMap((attempt) => attempt.weakConcepts || [])
          .map((concept) => String(concept || "").trim())
          .filter(Boolean),
      ),
    ].slice(0, 10);
  }

  function getErrorTypes() {
    const counts = new Map();
    activeAttempts().flatMap((attempt) => attempt.errorTypes || []).forEach((type) => counts.set(type, (counts.get(type) || 0) + 1));
    return [...counts.entries()].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count);
  }

  function buildRestAlert(errorTypes, studyMinutes) {
    if (studyMinutes >= 90) return "학습 시간이 길어졌습니다. 5분 휴식 뒤 쉬운 예시 문제로 전환해보세요.";
    if ((errorTypes[0]?.count || 0) >= 3) return `${errorTypes[0].type}이 반복됩니다. 핵심 개념을 다시 확인한 뒤 비슷한 문제를 풀어보세요.`;
    return "";
  }

  function classifyErrorType(question, answer) {
    const text = `${question.question || ""} ${answer || ""}`;
    if (!answer) return "근거 부족";
    if (/계산|수식|값|비율|거리|시간|속도/.test(text)) return "계산/절차 실수";
    if (/조건|모두|아닌|옳지|제외/.test(text)) return "조건 누락";
    if (/뜻|정의|용어|개념/.test(text)) return "용어 이해 부족";
    return "개념 혼동";
  }

  function startQuizTimer() {
    if (!state.quizStartedAt) state.quizStartedAt = Date.now();
  }

  function extractMinutes(text) {
    const match = String(text || "").match(/(\d+)\s*분/);
    return match ? Number(match[1]) : 0;
  }

  function setText(selector, value) {
    const el = $(selector);
    if (el) el.textContent = value;
  }

  function formatAiText(value) {
    return window.PrimeMessageFormat?.format(value) ?? escapeHtml(value);
  }

  let toastTimer;
  function setOperation(selector, kind, message, detail = {}) {
    const el = $(selector);
    if (!el) return;
    const busy = kind === "loading";
    const form = el.closest("form");
    form?.setAttribute("aria-busy", String(busy));
    form?.querySelectorAll('button[type="submit"]').forEach(button => { button.disabled = busy; });
    el.className = `status-text operation-state is-${kind}`;
    el.setAttribute("role", kind === "error" ? "alert" : "status");
    el.setAttribute("aria-live", "polite");
    if (kind === "success") {
      el.className = "status-text";
      el.replaceChildren();
      let toast = $("#studyOperationToast");
      if (!toast) {
        toast = document.createElement("div");
        toast.id = "studyOperationToast";
        toast.className = "operation-toast";
        toast.setAttribute("role", "status");
        document.body.append(toast);
      }
      toast.textContent = message;
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toast.remove(), 3000);
    } else {
      el.innerHTML = `<span class="operation-heading">${busy ? '<span class="operation-spinner" aria-hidden="true"></span>' : ''}${escapeHtml(message)}</span>${busy ? '<span class="operation-skeleton" aria-hidden="true"><i></i><i></i><i></i></span>' : ''}`;
    }
    window.dispatchEvent(new CustomEvent("prime:study-operation", { detail: { statusId: el.id, kind, message, ...detail } }));
    window.dispatchEvent(new CustomEvent("prime:notebook-content-change"));
  }

  function today() {
    return formatLocalDate(new Date());
  }

  function formatLocalDate(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function uid() {
    return `study-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function normalizeText(value) {
    return String(value || "").replace(/\s+/g, "").toLowerCase();
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function getReviewQueue() {
    return window.SchemsReviewCore?.buildQueue(state.quizzes, state.attempts, today()) || [];
  }

  function activityTasks() { return state.tasks.filter(task => window.PrimeActivityCore.isActivity(task.activity)); }
  function writeActivity(id, mutate) {
    const index = state.tasks.findIndex(task => task.id === id && task.activity);
    if(index<0||!window.PrimeActivityCore.isActivity(state.tasks[index].activity))throw Error('활동 기록을 확인해주세요. 원본 데이터는 유지했어요.');
    if(!isCurrentAccount(storageOwner))throw accountChangedError();
    const before=state.tasks[index],next=mutate(window.PrimeCompat.cloneData(before));
    const open=next.activity.blocks.filter(block=>block.state!=='done').sort((a,b)=>(a.date+a.start).localeCompare(b.date+b.start))[0];
    next.date=open?.date||next.activity.dueDate;next.minutes=open?.minutes||0;
    next.done=next.activity.steps.every(step=>step.state==='done');
    next.updatedAt=new Date().toISOString();state.tasks[index]=next;
    try{persist();}catch(error){state.tasks[index]=before;throw Error('저장하지 못했어요. 원래 기록은 유지했어요.');}
    renderAll({preserveReader:true});saveRemote(COLLECTIONS.tasks,next);return window.PrimeCompat.cloneData(next);
  }
  function createActivity(input) {
    const duplicate=activityTasks().find(task=>task.title===String(input.title||'').trim()&&task.activity.source.text===String(input.sourceText||'').trim()&&task.activity.dueDate===input.dueDate);
    if(duplicate)return {id:duplicate.id,duplicate:true};
    const id=`activity-${uid()}`,fixed=activityFixed('',input.dueDate),activity=window.PrimeActivityCore.create(input,id,window.PrimeActivityCore.dateKey(),fixed,activityMinuteNow());
    const first=activity.blocks[0];
    const task={id,title:activity.title,subject:String(input.subject||'학교 준비').slice(0,40),source:'activity',date:first?.date||activity.dueDate,minutes:first?.minutes||0,done:false,activity,createdAt:new Date().toISOString()};
    const before=state.tasks;state.tasks=[task,...state.tasks];
    try{persist();}catch(error){state.tasks=before;throw Error('활동을 저장하지 못했어요. 입력은 유지했어요.');}
    renderAll({preserveReader:true});saveRemote(COLLECTIONS.tasks,task);return {id,duplicate:false};
  }
  function getActivity(id){const task=activityTasks().find(task=>task.id===id);return task?window.PrimeCompat.cloneData(task):null;}
  function activityMinuteNow(){const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date());return Number(parts.find(p=>p.type==='hour').value)*60+Number(parts.find(p=>p.type==='minute').value);}
  function activityFixed(id,dueDate){return [...activityTasks().filter(t=>t.id!==id).flatMap(t=>t.activity.blocks),...(window.PrimeStudyOnboarding?.getBusy?.(window.PrimeActivityCore.dateKey(),dueDate)||[])];}
  function activityFixedVersion(id){const rows=activityTasks().filter(t=>t.id!==id).map(t=>[t.id,t.activity.version]),c=window.PrimeStudyOnboarding?.getData?.();if(['draft','completed'].includes(c?.status)&&!c.noAcademy&&c.academy?.length)rows.push(['consultation-academy',c.academy]);return JSON.stringify(rows);}
  function previewNewActivity(input){const fixed=activityFixed('',input.dueDate);return window.PrimeActivityCore.create(input,'preview',window.PrimeActivityCore.dateKey(),fixed,activityMinuteNow());}
  function proposeActivity(id,input){const task=getActivity(id);if(!task)throw Error('활동을 찾을 수 없어요.');const fixed=activityFixed(id,input.dueDate||task.activity.dueDate);return {...window.PrimeActivityCore.propose(task.activity,{...input,fixed,notBeforeMinutes:activityMinuteNow()}),fixedVersion:activityFixedVersion(id)};}
  function acceptActivity(id,proposal){if(proposal.fixedVersion!==activityFixedVersion(id))throw Error('다른 준비 계획이 바뀌었어요. 조정안을 다시 확인해주세요.');return writeActivity(id,task=>{task.activity=window.PrimeActivityCore.accept(task.activity,proposal);task.activity.history.at(-1).changeReason=proposal.changeSource||proposal.reason;task.activity.history.at(-1).fixedVersion=proposal.fixedVersion;task.activity.personalDateOverride=task.activity.dueDate!==task.activity.source.date?task.activity.dueDate:null;return task;});}
  function undoActivity(id){return writeActivity(id,task=>{const previous=task.activity.history.at(-1);if(previous?.fixedVersion!==undefined&&previous.fixedVersion!==activityFixedVersion(id))throw Error('다른 준비 계획이 바뀌었어요. 되돌리기 대신 새 조정안을 확인해주세요.');task.activity=window.PrimeActivityCore.undo(task.activity);task.activity.personalDateOverride=task.activity.dueDate!==task.activity.source.date?task.activity.dueDate:null;return task;});}
  function estimateActivityRemaining(id,stepId,minutes){return writeActivity(id,task=>{task.activity=window.PrimeActivityCore.estimateRemaining(task.activity,stepId,minutes);return task;});}
  function startActivityBlock(id,blockId){return writeActivity(id,task=>{if(task.activity.needsReplan)throw Error('남은 분량에 맞는 배치안을 먼저 확인해주세요.');const block=task.activity.blocks.find(b=>b.id===blockId);if(!block||block.state==='done')throw Error('시작할 준비를 확인해주세요.');block.state='active';task.activity.version++;return task;});}
  function cancelActivityStart(id,blockId){return writeActivity(id,task=>{const block=task.activity.blocks.find(b=>b.id===blockId);if(block?.state==='active')block.state='planned';task.activity.version++;return task;});}
  async function finishActivitySession(context,session) {
    if(context.owner!==storageOwner||!isCurrentAccount(storageOwner))throw accountChangedError();
    const index=state.tasks.findIndex(t=>t.id===context.taskId&&t.activity);
    if(index<0)throw Error('활동을 찾을 수 없어요.');
    if(state.sessions.some(s=>s.id===session.id))return {duplicate:true};
    const before=state.tasks[index],oldSessions=state.sessions;
    const activity=window.PrimeActivityCore.record(before.activity,context.blockId,session);
    const next={...before,activity,done:activity.steps.every(s=>s.state==='done')};
    const first=activity.blocks.filter(b=>b.state!=='done').sort((a,b)=>(a.date+a.start).localeCompare(b.date+b.start))[0];next.date=first?.date||activity.dueDate;next.minutes=first?.minutes||0;
    const item={...session,source:'activity',activityId:context.taskId,blockId:context.blockId,title:before.title,date:window.PrimeActivityCore.dateKey(),completed:session.outcome==='done',done:({done:'끝냈어',partial:'일부만 했어',more:'더 준비해야 해',missed:'못 했어'})[session.outcome],createdAt:new Date().toISOString()};
    state.tasks[index]=next;state.sessions=[item,...state.sessions].slice(0,100);
    try{persist();}catch(error){state.tasks[index]=before;state.sessions=oldSessions;throw Error('결과를 저장하지 못했어요. 진행 기록은 유지했어요.');}
    const owner=storageOwner,generation=accountGeneration;renderAll({preserveReader:true});
    const results=await Promise.all([saveRemote(COLLECTIONS.tasks,next),saveRemote(COLLECTIONS.sessions,item)]);
    if(!isCurrentAccount(owner,generation))throw accountChangedError();
    return {local:true,cloud:owner==='guest'?null:results.every(Boolean)};
  }
  function linkActivityMaterial(id,kind,materialId){
    const item=(kind==='note'?state.notes:kind==='quiz'?state.quizzes:[]).find(n=>n.id===materialId&&!n.archivedAt);
    if(!item)throw Error('자료를 찾을 수 없어요.');
    return writeActivity(id,task=>{if(!task.activity.materials.some(m=>m.kind===kind&&m.id===materialId))task.activity.materials.push({kind,id:materialId,label:item.title||item.subject||'자료'});task.activity.version++;return task;});
  }

  async function saveReviewResult(reviewId, correct) {
    const item = getReviewQueue().find(item => item.id === reviewId);
    const quiz = item && state.quizzes.find(quiz => quiz.id === item.quizId);
    if (!item || !quiz) throw new Error("문제노트가 변경됐어요. 복습 목록을 다시 열어주세요.");
    const owner = storageOwner, generation = accountGeneration;
    if (!isCurrentAccount(owner, generation)) throw accountChangedError();
    const progress = window.SchemsReviewCore.advance(item, Boolean(correct), today());
    const previous = quiz.reviewProgress;
    const previousTasks = state.tasks;
    const previousSessions=state.sessions,record={id:`review:${encodeURIComponent(quiz.id)}:${item.index}:${encodeURIComponent(item.attemptId)}:${today()}`,source:'review',quizId:quiz.id,questionIndex:item.index,title:quiz.title||quiz.unit||'오답 복습',date:today(),createdAt:progress.updatedAt,correct:Boolean(correct),completed:true,minutes:0};
    quiz.reviewProgress = { ...(previous || {}), [item.index]: progress };
    const completedTasks = [];
    state.tasks = state.tasks.map(task => {
      if (task.done || task.source !== "review" || task.date !== today() || task.reviewQuizId !== quiz.id || !task.reviewQuestionIds?.length) return task;
      const complete = task.reviewQuestionIds.every(id => {
        const index = String(id).slice(`${quiz.id}:`.length);
        return quiz.questions[index] && quiz.reviewProgress[index]?.lastReviewed === today() && quiz.reviewProgress[index]?.fingerprint === window.SchemsReviewCore.fingerprint(quiz.questions[index]);
      });
      if (!complete) return task;
      const done = {...task, done:true, completedAt:new Date().toISOString()}; completedTasks.push(done); return done;
    });
    if(!state.sessions.some(s=>s.id===record.id))state.sessions=[record,...state.sessions].slice(0,100);
    try { persist(); } catch (error) { quiz.reviewProgress = previous; state.tasks = previousTasks;state.sessions=previousSessions; throw new Error("저장 공간이 부족해요. 복습 결과를 저장하지 못했어요."); }
    renderAll({ preserveReader: true });
    const remote = await Promise.all([saveRemote(COLLECTIONS.quizzes, quiz),saveRemote(COLLECTIONS.sessions,record), ...completedTasks.map(task => saveRemote(COLLECTIONS.tasks, task))]);
    if (!isCurrentAccount(owner, generation)) throw accountChangedError();
    return { local: true, cloud: owner === "guest" ? null : remote.every(Boolean), due: progress.due, mastered: progress.mastered };
  }

  function addReviewsToPlan() {
    const key = today(), groups = new Map();
    getReviewQueue().filter(item => item.ready).forEach(item => {
      if (!groups.has(item.quizId)) groups.set(item.quizId, []);
      groups.get(item.quizId).push(item);
    });
    const tasks = [];
    groups.forEach((items, quizId) => {
      const id = `review-task:${key}:${quizId}`;
      if (state.tasks.some(task => task.id === id)) return;
      tasks.push({ id, date: key, subject: items[0].subject, title: `${items[0].title} · 오답 복습`,
        minutes: Math.min(60, Math.max(5, items.length * 3)), difficulty: "medium", done: false,
        source: "review", reviewQuizId: quizId, reviewQuestionIds: items.map(item => item.id), createdAt: new Date().toISOString() });
    });
    if (tasks.length) {
      const previous = state.tasks;
      state.tasks = [...tasks, ...state.tasks];
      try { persist(); } catch (error) { state.tasks = previous; throw new Error("복습을 저장하지 못했어요. 저장 공간을 확인해주세요."); }
      tasks.forEach(task => saveRemote(COLLECTIONS.tasks, task));
      renderAll({ preserveReader: true });
    }
    return tasks.length;
  }

  function deviceRecords() {
    try {
      return JSON.parse(localStorage.getItem(cacheKey("guest")) || localStorage.getItem(STORAGE_KEY) || localStorage.getItem(OLD_STORAGE_KEY) || "{}");
    } catch { return {}; }
  }
  function canImportDeviceRecords() {
    const records = deviceRecords();
    return storageOwner !== "guest" && !localStorage.getItem(`${cacheKey()}:imported`) && ["notes", "quizzes", "attempts", "tasks", "sessions"].some(key => records[key]?.length);
  }
  function importDeviceRecords() {
    if (!canImportDeviceRecords()) return false;
    const before = JSON.parse(JSON.stringify(state)), records = deviceRecords();
    ["notes", "quizzes", "attempts", "tasks", "sessions", "diagnostics"].forEach(key => {
      state[key] = mergeById(Array.isArray(records[key]) ? records[key] : [], state[key]);
    });
    try { persist(); } catch (error) { Object.assign(state, before); throw new Error("기록을 가져오지 못했어요. 원래 기기 기록은 그대로 남아 있어요."); }
    try { localStorage.setItem(`${cacheKey()}:imported`, "true"); } catch { /* Imported records are already saved; repeating merges by ID. */ }
    renderAll({ preserveReader: true });
    return true;
  }

  window.SchemsStudyAI = {
    init,
    buildStudyContext,
    buildLearnerProfile,
    getSnapshot,
    getRecentHistory:()=>window.PrimeCompat.cloneData(historyRows()),openHistoryRecord,
    openLibraryItem(kind,id) {
      if(!isCurrentAccount(storageOwner)||!['note','quiz'].includes(kind))return false;
      const item=(kind==='note'?state.notes:state.quizzes).find(row=>row.id===id&&!row.archivedAt);
      if(!item)return false;
      notebookHistoryOrigin={key:`${kind}:${id}`,owner:storageOwner,library:true};
      window.PrimeEduAI?.openCategory?.('notes','workspace');
      state.currentNoteId=kind==='note'?id:null;state.currentQuiz=kind==='quiz'?item:null;
      state.lastAttempt=null;state.reportVisible=false;state.retryingQuizId=null;
      renderAll();focusNotebookReader();return true;
    },
    setTaskDone,
    deleteTask,
    addStudySession,
    getReviewQueue,
    saveReviewResult,
    addReviewsToPlan,
    canImportDeviceRecords,
    importDeviceRecords,
    activityTasks:()=>window.PrimeCompat.cloneData(activityTasks()),getActivity,createActivity,previewNewActivity,proposeActivity,acceptActivity,undoActivity,estimateActivityRemaining,startActivityBlock,cancelActivityStart,finishActivitySession,linkActivityMaterial,
    openNotebookLibrary: closeNotebookReader,
    syncNotebookView: renderNotebookNavigation,
    libraryItems: () => [...state.notes.map(n=>({...n,kind:'note'})),...state.quizzes.map(n=>({...n,kind:'quiz'}))].map(n=>({id:n.id,kind:n.kind,title:n.title||n.subject||'노트',archived:Boolean(n.archivedAt)})),
    async renameLibraryItem(kind,id,title) {
      if(!['note','quiz'].includes(kind))throw new Error('알 수 없는 노트입니다.');
      const item=(kind==='note'?state.notes:state.quizzes).find(n=>n.id===id);title=String(title||'').trim();if(!item||!title||title.length>80)throw new Error('이름을 1~80자로 입력해주세요.');
      const old=item.title;item.title=title;try{persist();}catch(error){if(old===undefined)delete item.title;else item.title=old;throw error;}renderAll();
      const user=window.ClassHubFirebase?.getCurrentUser?.();const remote=await saveRemote(kind==='note'?COLLECTIONS.notes:COLLECTIONS.quizzes,item);return {local:true,cloud:user?.uid?Boolean(remote):null};
    },
    async archiveLibraryItems(keys,restore=false) {
      if(!Array.isArray(keys)||keys.some(k=>!['note','quiz'].includes(k.kind)))throw new Error('알 수 없는 노트입니다.');
      const changed=keys.map(({kind,id})=>({kind,item:(kind==='note'?state.notes:state.quizzes).find(n=>n.id===id)})).filter(n=>n.item),before=changed.map(n=>n.item.archivedAt);
      changed.forEach(n=>{if(restore)n.item.archivedAt=null;else n.item.archivedAt=new Date().toISOString();});
      try{persist();}catch(error){changed.forEach((n,i)=>{if(before[i]===undefined)delete n.item.archivedAt;else n.item.archivedAt=before[i];});throw error;}
      if(!restore){if(changed.some(n=>n.kind==='note'&&n.item.id===state.currentNoteId))state.currentNoteId=null;if(changed.some(n=>n.kind==='quiz'&&n.item.id===state.currentQuiz?.id))state.currentQuiz=null;if(changed.some(n=>n.kind==='quiz'&&n.item.id===state.lastAttempt?.quizId))state.lastAttempt=null;}
      renderAll();const user=window.ClassHubFirebase?.getCurrentUser?.();const remote=await Promise.all(changed.map(n=>saveRemote(n.kind==='note'?COLLECTIONS.notes:COLLECTIONS.quizzes,n.item)));return {local:true,cloud:user?.uid?remote.every(Boolean):null};
    },
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
