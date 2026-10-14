(() => {
  "use strict";
  const M = window.PrimeEduGradeModel;
  const $ = selector => document.querySelector(selector);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[ch]));
  const rich = value => esc(value).replace(/\*\*([^*\n]{1,180})\*\*/g, '<strong>$1</strong>');
  const DOC_ID = "grade-notebook-v2";
  const cacheKey = uid => `primeEduGradeNotebook.v2.${uid || "guest"}`;
  const read = key => { try { return JSON.parse(localStorage.getItem(key) || "null"); } catch { return null; } };
  let account = "", generation = 0, settings = M.config(), rows = [], profile = {}, saving = false, feedback = null, cloudLoaded = false;
  let searchGeneration = 0, feedbackGeneration = 0, searchResults = [], feedbackBusy = false, feedbackInfoOpen = false;
  let feedbackKey = '', feedbackError = null, feedbackController = null, feedbackSlow = false;
  function consultationGoal(){if(!account||window.ClassHubFirebase?.getCurrentUser?.()?.uid!==account)return '';const goals=window.PrimeLearnerIntegration?.getGoals?.()||{},name=settings.schoolLevel==='high'?goals.university:goals.highSchool;return name&&settings.consultationGoalHidden?.[settings.schoolLevel]!==name?name:'';}
  const inputKey = () => JSON.stringify({ schoolLevel:settings.schoolLevel, grade:settings.grade, entries:visibleRows().slice().sort((a,b)=>M.cellKey(a).localeCompare(M.cellKey(b))), target:settings.targets[settings.schoolLevel] || (settings.schoolLevel==='high'&&consultationGoal()?{name:consultationGoal()}:null) });
  function cache(pending = true) {
    try { localStorage.setItem(cacheKey(account), JSON.stringify({ settings, rows, feedback, feedbackKey, pending })); window.dispatchEvent(new CustomEvent('prime:grade-data'));return true; }
    catch { status("기기 저장 실패 · 공간 확인 후 다시 저장", "error"); return false; }
  }
  function status(message, kind = "info") {
    const el = $("#gradeSaveStatus");
    if (el) { el.textContent = message; el.dataset.state = kind; }
  }
  const visibleRows = () => rows.filter(row => row.schoolLevel === settings.schoolLevel && row.year <= settings.grade);
  function updateChart() { window.PrimeEduGradeChart?.setRecords(visibleRows()); }
  function setBusy(busy) {
    saving = busy;
    $("#gradeNotebookForm")?.setAttribute("aria-busy", String(busy));
    document.querySelectorAll("#gradeNotebook button, #gradeNotebook input, #gradeNotebook select, #gradeGoalPanel button, #gradeGoalPanel input").forEach(el => { el.disabled = busy; });
    if (!busy && profile.schoolLevel && profile.grade) { $("#gradeStudentLevel").disabled = true; $("#gradeStudentYear").disabled = true; }
  }
  function render() {
    const host = $("#gradeNotebook");
    if (!host) return;
    const high = settings.schoolLevel === "high";
    const byCell = new Map(rows.map(row => [M.cellKey(row), row]));
    const cell = (year, period, subject, kind, field) => {
      const key = M.cellKey({ schoolLevel: settings.schoolLevel, year, ...period, subject, recordType: kind });
      const row = byCell.get(key);
      const label = `${year}학년 ${period.term}학기 ${period.exam ? period.exam === "mid" ? "중간" : "기말" : "내신"} ${subject} ${field === "score" ? "점수" : field === "rank" ? "등급" : "학점"}`;
      return `<input type="number" inputmode="${field === "rank" ? "numeric" : "decimal"}" min="${field === "score" ? 0 : field === "rank" ? 1 : .5}" max="${field === "score" ? 100 : field === "rank" ? settings.gradeSystem : 20}" step="${field === "rank" ? 1 : .1}" value="${row?.[field] ?? ""}" placeholder="—" aria-label="${esc(label)}" data-grade-cell="${esc(key)}" data-grade-field="${field}" data-grade-year="${year}" data-grade-term="${period.term}" data-grade-exam="${period.exam || ""}" data-grade-subject="${esc(subject)}" data-grade-kind="${kind}">`;
    };
    host.innerHTML = `<div class="grade-profile-controls"><label>학교급<select class="field" id="gradeStudentLevel"><option value="middle" ${high ? "" : "selected"}>중학교</option><option value="high" ${high ? "selected" : ""}>고등학교</option></select></label><label>현재 학년<select class="field" id="gradeStudentYear">${[1,2,3].map(y => `<option value="${y}" ${y === settings.grade ? "selected" : ""}>${y}학년</option>`).join("")}</select></label>${high ? `<label>내신 등급제<select class="field" id="gradeRankSystem"><option value="5" ${settings.gradeSystem === 5 ? "selected" : ""}>5등급제</option><option value="9" ${settings.gradeSystem === 9 ? "selected" : ""}>9등급제</option></select></label>` : ""}</div>
      <form id="gradeNotebookForm"><div class="grade-year-tables">${M.years(settings.grade).map(year => `<details class="grade-year-block" ${year === settings.grade ? "open" : ""}><summary>${year}학년 <span>${year === settings.grade ? "현재 학년" : "이전 성적"}</span></summary><div class="grade-table-scroll" tabindex="0" role="region" aria-label="${year}학년 시험 성적 입력표"><table class="grade-input-table"><caption>${year}학년 시험 점수 <span>점 / 100점</span></caption><thead><tr><th scope="col" rowspan="2">과목</th><th scope="colgroup" colspan="2">1학기</th><th scope="colgroup" colspan="2">2학기</th></tr><tr>${["중간", "기말", "중간", "기말"].map(label => `<th scope="col">${label}</th>`).join("")}</tr></thead><tbody>${settings.subjects.map(subject => `<tr><th scope="row">${esc(subject)}</th>${M.periods.map(period => `<td>${cell(year,period,subject,"exam-score","score")}</td>`).join("")}</tr>`).join("")}</tbody></table></div>${high ? `<div class="grade-table-scroll" tabindex="0" role="region" aria-label="${year}학년 학기 내신 입력표"><table class="grade-input-table grade-rank-table"><caption>학기 내신 <span>${settings.gradeSystem}등급제 · 성적표 기준</span></caption><thead><tr><th scope="col" rowspan="2">과목</th><th scope="colgroup" colspan="2">1학기</th><th scope="colgroup" colspan="2">2학기</th></tr><tr><th scope="col">등급</th><th scope="col">학점</th><th scope="col">등급</th><th scope="col">학점</th></tr></thead><tbody>${settings.subjects.map(subject => `<tr><th scope="row">${esc(subject)}</th>${[1,2].map(term => `<td>${cell(year,{term},subject,"semester-rank","rank")}</td><td>${cell(year,{term},subject,"semester-rank","credits")}</td>`).join("")}</tr>`).join("")}</tbody></table></div><p class="grade-entry-hint">등급이 없는 과목은 비워두세요. 학점 미입력 시 가중치 1로 계산하며, 시험 점수를 내신등급으로 환산하지 않아요.</p>` : ""}</details>`).join("")}</div><div class="grade-save-row"><button type="submit" class="btn primary pressable">성적 저장</button><span id="gradeSaveStatus" role="status" aria-live="polite"></span></div></form>
      <form id="gradeSubjectForm" class="grade-subject-form"><label class="sr-only" for="gradeNewSubject">추가 과목 이름</label><input id="gradeNewSubject" class="field" maxlength="30" placeholder="추가할 과목" required><button type="submit" class="btn">과목 추가</button></form>${Array.isArray(read("primeEduAcademicGrades.v1")) && read("primeEduAcademicGrades.v1").length ? '<button class="grade-import-button" type="button" id="gradeImportLegacy">이 기기의 이전 성적 가져오기</button>' : ""}`;
    if (profile.schoolLevel && profile.grade) { $("#gradeStudentLevel").disabled = true; $("#gradeStudentYear").disabled = true; }
    renderGoal(); updateChart();
  }
  function capture() {
    const cells = new Map();
    document.querySelectorAll("[data-grade-cell]").forEach(input => {
      const data = input.dataset;
      const row = cells.get(data.gradeCell) || { schoolLevel: settings.schoolLevel, recordType: data.gradeKind, year: Number(data.gradeYear), term: Number(data.gradeTerm), subject: data.gradeSubject, ...(data.gradeExam ? { exam: data.gradeExam } : { gradeSystem: settings.gradeSystem }) };
      row[data.gradeField] = M.number(input.value, data.gradeField === "score" ? 0 : data.gradeField === "rank" ? 1 : .5, data.gradeField === "score" ? 100 : data.gradeField === "rank" ? settings.gradeSystem : 20, data.gradeField === "rank");
      cells.set(data.gradeCell, row);
    });
    rows = [...rows.filter(row => row.schoolLevel !== settings.schoolLevel || row.year > settings.grade), ...M.normalize([...cells.values()], settings.schoolLevel)];
    if (feedbackKey !== inputKey()) {
      const hadFeedback = Boolean(feedback || feedbackBusy || feedbackError);
      feedbackController?.abort(); feedbackController = null;
      feedback = null; feedbackError = null; feedbackGeneration++; feedbackBusy = false;
      if (hadFeedback) renderGoal();
    }
    cache(); updateChart();
  }
  async function save(event) {
    event?.preventDefault();
    if (saving) return;
    try { capture(); } catch (error) { status(error.message, "error"); $("#gradeNotebookForm")?.reportValidity(); return; }
    const uid = account, token = generation;
    if (uid && !cloudLoaded) { status("계정 기록을 확인하지 못해 덮어쓰지 않았어요. 새로고침 후 다시 저장해주세요. 입력값은 이 기기에 남아 있어요.", "error"); return; }
    setBusy(true); status(uid ? "계정에 저장하고 있어요…" : "저장하고 있어요…");
    try {
      if (uid) await window.ClassHubFirebase.addUserCollectionDoc(uid, "gradeRecords", { id: DOC_ID, recordType: "grade-notebook", settings, entries: rows, createdAt: new Date().toISOString(), savedAt: new Date().toISOString() });
      if (token !== generation) return;
      if (cache(false)) status(uid ? "계정에 저장했어요" : "이 기기에 저장했어요", "success");
      window.dispatchEvent(new CustomEvent("prime:grades-updated")); renderGoal();
    } catch { if (token === generation) status("기기 저장 완료 · 계정 동기화 실패 · 다시 저장", "error"); }
    finally { if (token === generation) setBusy(false); }
  }
  async function load(user) {
    const token = ++generation;
    feedbackController?.abort(); feedbackController = null; feedbackError = null;
    account = user?.uid || ""; saving = false; cloudLoaded = false; feedbackBusy = false; feedbackGeneration++; searchGeneration++;
    const cached = read(cacheKey(account));
    rows = M.normalize(cached?.rows); profile = {}; settings = M.config({}, cached?.settings); feedbackKey = cached?.feedbackKey || ''; feedback = feedbackKey === inputKey() ? cached?.feedback || null : null;
    render();
    if (!account) return;
    status("계정의 성적을 불러오고 있어요…");
    try {
      const [p, documents] = await Promise.all([window.ClassHubFirebase.getUserProfile(account), window.ClassHubFirebase.listUserCollectionDocs(account, "gradeRecords", 100)]);
      if (token !== generation) return;
      profile = p || {};
      cloudLoaded = true;
      const saved = documents.find(doc => doc.id === DOC_ID);
      const content = cached?.pending ? cached : saved ? { rows: saved.entries, settings: saved.settings } : { rows: documents.filter(doc => doc.recordType === "exam-score"), settings: cached?.settings };
      settings = M.config(profile, content?.settings);
      rows = M.normalize(content?.rows, settings.schoolLevel);
      settings.subjects = [...new Set([...settings.subjects, ...visibleRows().map(row => row.subject)])].slice(0,16);
      feedback = feedbackKey === inputKey() ? cached?.feedback || null : null;
      render(); cache(Boolean(cached?.pending));
      status(cached?.pending ? "기기 변경사항 · 계정 저장 필요" : "동기화 완료");
    } catch { if (token === generation) status("계정 성적을 불러오지 못했어요. 이 기기의 기록만 표시합니다.", "error"); }
  }
  function renderGoal() {
    const oldQuery=$('#gradeTargetQuery'),queryDraft=oldQuery?.dataset.queryOwner===account&&oldQuery?.dataset.userDraft==='true'?oldQuery.value:null;
    if ((feedback || feedbackBusy || feedbackError) && feedbackKey !== inputKey()) {
      feedbackController?.abort();feedbackController=null;feedbackGeneration++;feedbackBusy=false;feedback=null;feedbackError=null;
    }
    const tracker=$('.grade-tracker>.planner-section-title');
    if(tracker) {
      let badge=tracker.querySelector('#gradeFeedbackState');
      if(!badge){badge=document.createElement('button');badge.id='gradeFeedbackState';badge.type='button';badge.className='grade-feedback-badge';badge.dataset.uiKeepLabel='';badge.setAttribute('aria-label','성적 분석 확인');badge.addEventListener('click',()=>window.dispatchEvent(new CustomEvent('prime:journey-open',{detail:'target'})));tracker.append(badge);}
      badge.hidden=!feedbackBusy&&!feedbackError&&!feedback;
      badge.textContent=feedbackBusy?'분석 중':feedbackError?'다시 시도':'피드백';
      badge.setAttribute('aria-busy',String(feedbackBusy));
    }
    const high = settings.schoolLevel === "high", target = settings.targets[settings.schoolLevel];
    const host = $("#gradeGoalPanel"); if (!host) return;
    host.innerHTML = `<header><h3 id="gradeGoalTitle">${high ? "목표 대학" : "목표 고등학교"}</h3></header><form id="gradeTargetForm" class="grade-target-form"><label for="gradeTargetQuery">${high ? "대학·학과 이름" : "학교 이름"}</label><div><input class="field" id="gradeTargetQuery" maxlength="80" placeholder="${high ? "예: 서울대학교 · 생명과학" : "예: 포항고등학교"}" value="${esc(target?.name || "")}" required><button type="submit" class="btn">${high ? "목표 설정" : "학교 찾기"}</button></div></form><p id="gradeSchoolStatus" role="status"></p><div id="gradeSchoolResults" class="grade-school-results"></div><div id="gradeSelectedTarget">${target ? `<article class="grade-selected-target"><strong>${esc(target.name)}</strong>${target.address ? `<p>${esc(target.address)}</p>` : ""}${target.schoolType ? `<span>${esc(target.schoolType)} · ${esc(target.establishment || "")}</span>` : ""}<button type="button" class="grade-target-clear" id="gradeTargetClear" aria-label="목표 학교 해제">목표 해제</button></article>` : ""}</div><div class="grade-feedback-action"><button class="btn primary" id="gradeFeedbackButton" data-ui-keep-label type="button" ${feedbackBusy ? "disabled" : ""}>${feedbackBusy ? "분석 중" : "분석하기"}</button></div><div id="gradeFeedbackResult" class="grade-feedback-result" aria-live="polite"></div><div class="grade-analysis-note"><span>학습 참고용 · 합격 예측 아님</span><button type="button" id="gradeFeedbackInfoButton" aria-label="성적 분석 안내" aria-expanded="${feedbackInfoOpen}" aria-controls="gradeFeedbackInfo">${window.PrimeUI.svg("info")}</button></div><section id="gradeFeedbackInfo" aria-label="성적 분석 안내" ${feedbackInfoOpen ? "" : "hidden"}><ul><li>이름·이메일 없이 성적과 목표만 분석해요.</li><li>학교마다 시험 난이도가 달라 점수를 직접 비교할 수 없어요.</li><li>학습·진학 탐색을 위한 참고자료예요. 합격 가능성이나 합격선을 뜻하지 않아요.</li></ul></section>`;
    if (feedbackBusy) showFeedbackLoading();
    else if (feedback) showFeedback(feedback);
    else if (feedbackError) showFeedbackError(feedbackError);
    const query=$('#gradeTargetQuery'),suggested=consultationGoal();if(query){query.dataset.queryOwner=account;if(queryDraft!==null){query.value=queryDraft;query.dataset.userDraft='true';}else if(!target&&suggested)query.value=suggested.slice(0,80);}
    if(!target&&suggested)$('#gradeSchoolStatus').textContent=high?'학습 상담에서 정한 목표':'상담 목표 · 학교 정보 확인 필요';
    window.dispatchEvent(new CustomEvent('prime:grade-data'));
  }
  async function request(url, body, signal) {
    const authGeneration = generation;
    const controller = new AbortController(), timer = setTimeout(()=>controller.abort(),55000);
    const abort = () => controller.abort(); signal?.addEventListener('abort',abort,{once:true});
    if(signal?.aborted)controller.abort();
    try {
    const user = window.ClassHubFirebase?.getCurrentUser?.();
    const token = user ? await user.getIdToken() : "";
    if(authGeneration !== generation)throw Object.assign(new Error('계정이 변경됐어요.'),{code:'ACCOUNT_CHANGED'});
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body), signal:controller.signal });
    const result = await response.json().catch(error => { if(error.name==='AbortError')throw error;return null; });
    if(authGeneration !== generation)throw Object.assign(new Error('계정이 변경됐어요.'),{code:'ACCOUNT_CHANGED'});
    if (!response.ok) throw Object.assign(new Error(result?.error || "요청을 처리하지 못했어요. 다시 시도해주세요."), { code:result?.code || (response.status===504?'AI_CONNECTION_TIMEOUT':'SERVICE_UNAVAILABLE'), status:response.status, retryable:result?.retryable ?? [502,503,504].includes(response.status) });
    if(!result || typeof result !== 'object' || Array.isArray(result))throw Object.assign(new Error('결과를 끝까지 받지 못했어요.'),{code:'AI_INVALID_RESPONSE',retryable:true});
    return result;
    } catch(error) {
      if(error.name==='AbortError')throw Object.assign(new Error('분석이 지연됐어요. 성적은 그대로 저장돼 있어요.'),{code:'AI_CONNECTION_TIMEOUT',retryable:true});
      if(error.name==='TypeError' && !error.code)throw Object.assign(new Error('연결이 끊겼어요. 네트워크를 확인해주세요.'),{code:'AI_NETWORK_ERROR',retryable:true});
      throw error;
    } finally { clearTimeout(timer);signal?.removeEventListener('abort',abort); }
  }
  async function searchTarget(event) {
    event.preventDefault();
    const name = $("#gradeTargetQuery").value.trim(), token = ++searchGeneration, authToken = generation;
    if (name.length < 2) { $("#gradeSchoolStatus").textContent = "이름을 두 글자 이상 적어주세요."; return; }
    if (settings.schoolLevel === "high") { settings.targets.high = { name }; feedback = null; cache(); renderGoal(); await save(); return; }
    const submit = event.target.querySelector("button"); submit.disabled = true;
    $("#gradeSchoolStatus").textContent = "나이스 공식 학교 정보를 찾고 있어요…";
    try {
      const result = await request("/api/schoolCatalog", { query: name });
      if (token !== searchGeneration || authToken !== generation) return;
      searchResults = Array.isArray(result.schools) ? result.schools : [];
      $("#gradeSchoolStatus").textContent = searchResults.length ? `${searchResults.length}개 학교 · ${result.dataAsOf} 확인${result.limited ? " · 일부 결과만 제공되어 정확한 학교 이름으로 검색해주세요" : ""}` : "학교를 찾지 못했어요. 학교 이름을 더 정확히 입력해주세요.";
      $("#gradeSchoolResults").innerHTML = searchResults.map((school,i) => `<button type="button" data-grade-school="${i}"><strong>${esc(school.name)}</strong><span>${esc(school.address)}</span><small>${esc(school.schoolType || school.kind)}</small></button>`).join("");
    } catch (error) { if (token === searchGeneration && authToken === generation) $("#gradeSchoolStatus").textContent = error.name === "TimeoutError" ? "학교 정보 연결이 늦어지고 있어요. 다시 시도해주세요." : error.message; }
    finally { if (token === searchGeneration) submit.disabled = false; }
  }
  function showFeedback(result) {
    const host = $("#gradeFeedbackResult"); if (!host) return;
    host.innerHTML = `<article class="grade-feedback-card"><header><span aria-hidden="true">${window.PrimeUI.svg('chart')}</span><h4>성적 피드백</h4></header><p>${rich(result.summary)}</p>${[ ["잘하고 있는 점", result.strengths], ["다음 공부 목표", result.nextSteps], ["목표 학교 확인", result.targetAdvice] ].map(([title, items]) => Array.isArray(items) && items.length ? `<section><h5>${title}</h5><ul>${items.map(item => `<li>${rich(item)}</li>`).join("")}</ul></section>` : "").join("")}<footer>${(result.sources || []).filter(source => /^https:\/\//.test(source.url)).map(source => `<a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${esc(source.label)} ${window.PrimeUI.svg('external')}</a>`).join("")}<span>${esc(result.dataAsOf || "")} 기준 · AI 피드백</span></footer></article>`;
  }
  function showFeedbackLoading() {
    const host=$('#gradeFeedbackResult');if(!host)return;
    host.innerHTML=`<div class="grade-feedback-loading" role="status"><span class="operation-spinner" aria-hidden="true"></span><strong>${feedbackSlow?'분석을 이어가고 있어요':'성적 분석 중'}</strong><span class="grade-feedback-state">다른 화면을 사용해도 계속 진행돼요</span><i></i><i></i></div>`;
  }
  function showFeedbackError(error) {
    const host=$('#gradeFeedbackResult');if(!host)return;
    const title=error.code==='AI_CONNECTION_TIMEOUT'?'분석이 조금 늦어졌어요':error.code==='AI_QUOTA_EXCEEDED'?'이용 한도에 도달했어요':error.status===401?'로그인이 필요해요':'분석을 완료하지 못했어요';
    host.innerHTML=`<div class="grade-feedback-error" role="alert"><strong>${title}</strong><p>${esc(error.message)}</p>${error.retryable!==false?`<button type="button" class="grade-feedback-retry" id="gradeFeedbackRetry" aria-label="성적 분석 다시 시도">${window.PrimeUI.svg('reset')}</button>`:''}</div>`;
  }
  async function generateFeedback() {
    if (feedbackBusy || saving) return;
    try { capture(); } catch (error) { status(error.message, "error"); return; }
    const inputRows = visibleRows();
    if (!inputRows.length) { status("성적을 한 칸 이상 입력해주세요.", "error"); return; }
    const target = settings.targets[settings.schoolLevel] || (settings.schoolLevel==='high'&&consultationGoal()?{name:consultationGoal()}:null);
    if (!target) { $("#gradeSchoolStatus").textContent = "목표 학교를 먼저 설정해주세요."; $("#gradeTargetQuery")?.focus(); return; }
    const token = ++feedbackGeneration, authToken = generation;
    feedbackBusy = true; feedbackError=null;feedbackSlow=false;feedbackKey=inputKey();
    const controller=new AbortController();feedbackController=controller;renderGoal();
    const slowTimer=setTimeout(()=>{if(token===feedbackGeneration&&authToken===generation&&feedbackBusy){feedbackSlow=true;showFeedbackLoading();}},8000);
    try {
      const result = await request("/api/gradeFeedback", { schoolLevel: settings.schoolLevel, grade: settings.grade, gradeSystem: settings.gradeSystem, entries: inputRows, target: settings.schoolLevel === "middle" ? { schoolCode: target.schoolCode, officeCode: target.officeCode } : { name: target.name } },controller.signal);
      if (token !== feedbackGeneration || authToken !== generation) return;
      if(typeof result.summary!=='string'||!result.summary.trim())throw Object.assign(new Error('피드백을 끝까지 받지 못했어요.'),{code:'AI_INVALID_RESPONSE',retryable:true});
      feedback = result; cache(); showFeedback(result);
    } catch (error) { if (token === feedbackGeneration && authToken === generation) { feedbackError=error;showFeedbackError(error); } }
    finally { clearTimeout(slowTimer);if (authToken === generation && token === feedbackGeneration) { feedbackBusy = false;feedbackController=null;renderGoal(); } }
  }
  function init() {
    if (!M || !$("#gradeNotebook")) return;
    document.addEventListener("submit", event => {
      if (event.target.id === "gradeNotebookForm") save(event);
      if (event.target.id === "gradeTargetForm") searchTarget(event);
      if (event.target.id === "gradeSubjectForm") {
        event.preventDefault();
        try { capture(); } catch (error) { status(error.message,"error"); return; }
        const subject = $("#gradeNewSubject").value.trim();
        if (!subject || settings.subjects.includes(subject)) { status("이미 있는 과목이에요."); return; }
        if (settings.subjects.length >= 16) { status("과목은 16개까지 추가할 수 있어요."); return; }
        settings.subjects.push(subject); cache(); render();
      }
    });
    document.addEventListener("change", event => {
      if (event.target.matches("[data-grade-cell]")) {
        try { capture(); status("변경사항 · 저장 필요"); } catch (error) { status(error.message,"error"); }
      }
      if (["gradeStudentLevel", "gradeStudentYear", "gradeRankSystem"].includes(event.target.id)) {
        try { capture(); } catch (error) {
          $("#gradeStudentLevel").value = settings.schoolLevel;
          $("#gradeStudentYear").value = String(settings.grade);
          if ($("#gradeRankSystem")) $("#gradeRankSystem").value = String(settings.gradeSystem);
          status(error.message,"error"); return;
        }
        settings = M.config({}, { ...settings, schoolLevel: $("#gradeStudentLevel").value, grade: $("#gradeStudentYear").value, gradeSystem: $("#gradeRankSystem")?.value || undefined });
        searchGeneration++; cache(); render();
      }
    });
    document.addEventListener("click", event => {
      if (event.target.closest('#gradeFeedbackInfoButton')) {
        feedbackInfoOpen = !feedbackInfoOpen;
        const info = $('#gradeFeedbackInfo');
        if (info) info.hidden = !feedbackInfoOpen;
        $('#gradeFeedbackInfoButton')?.setAttribute('aria-expanded', String(feedbackInfoOpen));
        if (feedbackInfoOpen) info?.scrollIntoView?.({ block: 'nearest', behavior: 'auto' });
        return;
      }
      const school = event.target.closest("[data-grade-school]");
      if (school) { const item = searchResults[Number(school.dataset.gradeSchool)]; if (item) { settings.targets.middle = item; feedback = null; feedbackBusy = false; feedbackGeneration++; searchGeneration++; cache(); renderGoal(); save(); } }
      if (event.target.closest("#gradeTargetClear")) { const name=consultationGoal();settings.consultationGoalHidden={...settings.consultationGoalHidden,[settings.schoolLevel]:name};delete $('#gradeTargetQuery')?.dataset.userDraft;settings.targets[settings.schoolLevel] = null; feedback = null; feedbackBusy = false; feedbackGeneration++; searchGeneration++; cache(); renderGoal(); save(); }
      if (event.target.closest("#gradeFeedbackButton, #gradeFeedbackRetry")) generateFeedback();
      if (event.target.closest("#gradeImportLegacy")) {
        try { capture(); } catch (error) { status(error.message,"error"); return; }
        const old = M.normalize(read("primeEduAcademicGrades.v1"), settings.schoolLevel);
        // Current values take precedence; the original device-wide key is left intact.
        rows = M.normalize([...old, ...rows], settings.schoolLevel);
        settings.subjects = [...new Set([...settings.subjects, ...visibleRows().map(row => row.subject)])].slice(0,16);
        cache(); render(); status("이전 성적 가져옴 · 확인 후 저장");
      }
    });
    window.addEventListener("prime:profile-updated", async () => {
      const uid = account, token = generation;
      if (!uid || saving) return;
      try {
        const p = await window.ClassHubFirebase.getUserProfile(uid);
        if (token !== generation) return;
        const previousStatus = $("#gradeSaveStatus")?.textContent || "";
        // Input change already captures drafts. A profile read is not a grade edit:
        // do not mark clean account data as an unsynced local draft.
        profile = p || {}; settings = M.config(profile, settings); render();
        if (previousStatus) status(previousStatus);
      } catch { /* Auth callback handles initial load and shows failures. */ }
    });
    document.addEventListener('input',event=>{if(event.target.id==='gradeTargetQuery')event.target.dataset.userDraft='true';});
    window.addEventListener('prime:learner-context',()=>{if(!saving&&!feedbackBusy)renderGoal();});
    if (window.firebase && window.ClassHubFirebase?.isConfigured?.() && window.ClassHubFirebase?.onAuthStateChanged) window.ClassHubFirebase.onAuthStateChanged(load);
    else load(null);
  }
  window.PrimeGradeNotebook={getSnapshot:()=>({owner:account||'guest',records:JSON.parse(JSON.stringify(visibleRows())),targets:JSON.parse(JSON.stringify(settings.targets)),feedback:feedback?JSON.parse(JSON.stringify(feedback)):null})};
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", init) : init();
})();
