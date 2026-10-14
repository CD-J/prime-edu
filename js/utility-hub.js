(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const POMODORO_KEY = "primeEduPomodoro.v1";

  const todayKey = (date = new Date()) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  };

  const readJson = (key, fallback) => {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "null");
      return value ?? fallback;
    } catch {
      return fallback;
    }
  };

  const escapeHtml = (value) => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  let pomodoro = {
    focusMinutes: 25,
    breakMinutes: 5,
    mode: "focus",
    remainingSec: 25 * 60,
    running: false,
    endAt: null,
    sessionId: null,
    completedIds: [],
    ...readJson(POMODORO_KEY, {}),
  };
  // Recover older settings safely; completed session IDs remain untouched.
  pomodoro.focusMinutes = Math.max(1, Math.min(120, Math.round(Number(pomodoro.focusMinutes) || 25)));
  pomodoro.breakMinutes = Math.max(1, Math.min(30, Math.round(Number(pomodoro.breakMinutes) || 5)));
  let timerHandle = null;
  let activeUtility = "";
  // GradeNotebook owns account-scoped persistence; this module only draws the chart.
  let academicGrades = [];

  function pomodoroDurationSec() {
    return (pomodoro.mode === "focus" ? pomodoro.focusMinutes : pomodoro.breakMinutes) * 60;
  }

  function savePomodoro() {
    localStorage.setItem(POMODORO_KEY, JSON.stringify(pomodoro));
  }

  function getTodayPomodoroStats() {
    const sessions = window.SchemsStudyAI?.getSnapshot?.().sessions || [];
    const completed = sessions.filter((session) =>
      session.source === "pomodoro" &&
      session.completed !== false &&
      String(session.date || "").slice(0, 10) === todayKey()
    );
    return {
      minutes: completed.reduce((sum, session) => sum + Number(session.minutes || 0), 0),
      count: completed.length,
    };
  }

  function renderPomodoro() {
    const total = Math.max(1, pomodoroDurationSec());
    const remaining = window.PrimeTimerProgress.remaining(pomodoro.remainingSec, total);
    const currentMinutes = pomodoro.mode === "focus" ? pomodoro.focusMinutes : pomodoro.breakMinutes;
    const maxMinutes = pomodoro.mode === "focus" ? 120 : 30;
    const minutes = Math.floor(Math.max(0, pomodoro.remainingSec) / 60);
    const seconds = Math.max(0, pomodoro.remainingSec) % 60;
    const stats = getTodayPomodoroStats();
    $$("[data-pomodoro-time]").forEach((el) => {
      el.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    });
    $$("[data-pomodoro-mode]").forEach((el) => {
      el.textContent = pomodoro.mode === "focus" ? "집중" : "휴식";
    });
    $$("[data-pomodoro-ring]").forEach((el) => {
      el.style.setProperty("--pomodoro-progress", `${remaining * 360}deg`);
      // Full at the start. Its clockwise SVG path shortens at the endpoint,
      // so the visible boundary retreats counterclockwise as time decreases.
      el.style.setProperty("--pomodoro-arc", String(remaining * 360));
      el.style.setProperty("--pomodoro-stroke-visible", String(remaining > 0 ? 1 : 0));
      const previousRemaining = Number(el.dataset.remainingRatio);
      el.style.setProperty("--pomodoro-stroke-duration", !Number.isFinite(previousRemaining) || remaining > previousRemaining ? "0ms" : "900ms");
      el.dataset.remainingRatio = String(remaining);
      // The duration-setting thumb is independent of the countdown arc.
      const targetAngle = currentMinutes / maxMinutes * 360;
      const previousAngle = Number(el.dataset.handleAngle);
      // Nearest equivalent rotation prevents a 359°→3° spin at the top of the dial.
      const angle = Number.isFinite(previousAngle)
        ? previousAngle + ((targetAngle - previousAngle + 540) % 360 + 360) % 360 - 180
        : targetAngle;
      el.dataset.handleAngle = String(angle);
      el.style.setProperty("--pomodoro-angle", `${angle}deg`);
      el.style.setProperty("--pomodoro-setting-arc", String(targetAngle));
      el.style.setProperty("--pomodoro-handle-x", `${50 + Math.sin(targetAngle * Math.PI / 180) * 44.7}%`);
      el.style.setProperty("--pomodoro-handle-y", `${50 - Math.cos(targetAngle * Math.PI / 180) * 44.7}%`);
      el.classList.toggle("is-running", pomodoro.running);
      el.classList.toggle("is-countdown-full", remaining === 1);
      el.classList.toggle("is-adjustable", !pomodoro.running);
      el.dataset.mode = pomodoro.mode;
      const slider = el.querySelector?.('[data-pomodoro-adjust]') || el;
      slider.setAttribute("aria-label", `${pomodoro.mode === "focus" ? "집중" : "휴식"} 시간`);
      slider.setAttribute("aria-valuemax", String(maxMinutes));
      el.dataset.dialValue = `${currentMinutes}분`;
      slider.setAttribute("aria-valuenow", String(currentMinutes));
      slider.setAttribute("aria-valuetext", `${pomodoro.mode === "focus" ? "집중" : "휴식"} ${currentMinutes}분`);
      slider.setAttribute("aria-disabled", String(pomodoro.running));
    });
    $$("[data-pomodoro-dial-value]").forEach((el) => {
      el.textContent = `${currentMinutes}분 설정`;
    });
    $$("[data-pomodoro-switch]").forEach(button => {
      const homeClock = Boolean(button.closest?.('.mobile-pomodoro-widget,.home-pomodoro'));
      button.disabled = pomodoro.running && !homeClock;
      button.setAttribute("aria-label", pomodoro.running && homeClock
        ? `${pomodoro.mode === "focus" ? "집중" : "휴식"} 타이머 · 눌러서 스탠바이 열기`
        : `${pomodoro.mode === "focus" ? "집중" : "휴식"} 모드 · 눌러서 ${pomodoro.mode === "focus" ? "휴식" : "집중"}으로 전환`);
    });
    $$("[data-pomodoro-toggle]").forEach((el) => {
      el.textContent = pomodoro.running ? "일시정지" : "시작";
    });
    $$("[data-pomodoro-today]").forEach((el) => {
      el.textContent = `${stats.minutes}분`;
    });
    $$("[data-pomodoro-count]").forEach((el) => {
      el.textContent = `${stats.count}회`;
    });
    $$("[data-pomodoro-preset]").forEach((button) => {
      const [focus, rest] = button.dataset.pomodoroPreset.split(",").map(Number);
      button.classList.toggle("is-active", focus === pomodoro.focusMinutes && rest === pomodoro.breakMinutes);
    });
    $$("[data-pomodoro-focus]").forEach((input) => { if (document.activeElement !== input) input.value = pomodoro.focusMinutes; input.disabled = pomodoro.running; });
    $$("[data-pomodoro-break]").forEach((input) => { if (document.activeElement !== input) input.value = pomodoro.breakMinutes; input.disabled = pomodoro.running; });
    $$("[data-pomodoro-apply], [data-pomodoro-preset]").forEach(button => { button.disabled = pomodoro.running; });
    // One timer is shared by the home widgets and Sudo's cross-tab companion.
    window.dispatchEvent(new CustomEvent('prime:pomodoro-state', {detail: {
      running:pomodoro.running, mode:pomodoro.mode, remainingSec:pomodoro.remainingSec, endAt:pomodoro.endAt,
    }}));
  }

  async function finishPomodoroPhase() {
    if(pomodoro.activityContext){pomodoro.running=false;pomodoro.endAt=null;pomodoro.remainingSec=0;savePomodoro();renderPomodoro();window.dispatchEvent(new CustomEvent('prime:activity-result-request',{detail:pomodoro.activityContext.taskId}));return;}
    const finishedMode = pomodoro.mode;
    const finishedId = pomodoro.sessionId;
    const completedDate = todayKey(new Date(pomodoro.endAt || Date.now()));
    pomodoro.running = false;
    pomodoro.endAt = null;
    if (finishedMode === "focus" && finishedId && !pomodoro.completedIds.includes(finishedId)) {
      pomodoro.completedIds = [...pomodoro.completedIds, finishedId].slice(-100);
      await window.SchemsStudyAI?.addStudySession?.({
        id: finishedId,
        source: "pomodoro",
        title: "뽀모도로 집중",
        done: `${pomodoro.focusMinutes}분 집중 완료`,
        minutes: pomodoro.focusMinutes,
        completed: true,
        date: completedDate,
        createdAt: new Date().toISOString(),
      });
    }
    pomodoro.mode = finishedMode === "focus" ? "break" : "focus";
    pomodoro.remainingSec = pomodoroDurationSec();
    pomodoro.sessionId = null;
    savePomodoro();
    renderPomodoro();
  }

  function tickPomodoro() {
    if (!pomodoro.running || !pomodoro.endAt) return;
    pomodoro.remainingSec = Math.max(0, Math.ceil((pomodoro.endAt - Date.now()) / 1000));
    if (pomodoro.remainingSec <= 0) {
      finishPomodoroPhase();
      return;
    }
    renderPomodoro();
  }

  function togglePomodoro() {
    if(pomodoro.activityContext&&(pomodoro.activityContext.owner!==window.SchemsStudyAI?.getSnapshot?.().owner||pomodoro.remainingSec<=0)){window.dispatchEvent(new CustomEvent('prime:activity-result-request',{detail:pomodoro.activityContext.taskId}));return;}
    if (pomodoro.running) {
      pomodoro.remainingSec = Math.max(0, Math.ceil((pomodoro.endAt - Date.now()) / 1000));
      pomodoro.running = false;
      pomodoro.endAt = null;
    } else {
      if (pomodoro.remainingSec <= 0) pomodoro.remainingSec = pomodoroDurationSec();
      if (pomodoro.mode === "focus" && !pomodoro.sessionId) {
        pomodoro.sessionId = `pomo-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      }
      pomodoro.running = true;
      pomodoro.endAt = Date.now() + pomodoro.remainingSec * 1000;
    }
    savePomodoro();
    renderPomodoro();
  }

  function resetPomodoro() {
    if(pomodoro.activityContext){window.dispatchEvent(new CustomEvent('prime:activity-result-request',{detail:pomodoro.activityContext.taskId}));return;}
    pomodoro.running = false;
    pomodoro.endAt = null;
    pomodoro.sessionId = null;
    pomodoro.remainingSec = pomodoroDurationSec();
    savePomodoro();
    renderPomodoro();
  }

  function applyPomodoroPreset(focusMinutes, breakMinutes) {
    if (pomodoro.running || pomodoro.activityContext) return;
    pomodoro.focusMinutes = Math.max(1, Math.min(120, Math.round(Number(focusMinutes) || pomodoro.focusMinutes || 25)));
    pomodoro.breakMinutes = Math.max(1, Math.min(30, Math.round(Number(breakMinutes) || 5)));
    pomodoro.mode = "focus";
    pomodoro.sessionId = null;
    pomodoro.remainingSec = pomodoro.focusMinutes * 60;
    savePomodoro();
    renderPomodoro();
  }

  function switchPomodoroMode() {
    if(pomodoro.activityContext)return;
    if (pomodoro.running || $$("[data-pomodoro-ring]").some(ring => ring.classList.contains?.("is-adjusting"))) return;
    pomodoro.mode = pomodoro.mode === "focus" ? "break" : "focus";
    pomodoro.sessionId = null;
    pomodoro.endAt = null;
    pomodoro.remainingSec = pomodoroDurationSec();
    savePomodoro();
    renderPomodoro();
  }

  function setPomodoroFromDial(minutes, { persist = true } = {}) {
    if (pomodoro.running || pomodoro.activityContext) return;
    const maxMinutes = pomodoro.mode === "focus" ? 120 : 30;
    const nextMinutes = Math.max(1, Math.min(maxMinutes, Math.round(Number(minutes) || 1)));
    if (pomodoro.mode === "focus") pomodoro.focusMinutes = nextMinutes;
    else pomodoro.breakMinutes = nextMinutes;
    pomodoro.sessionId = null;
    pomodoro.remainingSec = nextMinutes * 60;
    pomodoro.endAt = null;
    if (persist) savePomodoro();
    renderPomodoro();
  }

  function dialMinutesFromPointer(ring, event, bounds) {
    const rect = bounds || ring.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const angle = (Math.atan2(event.clientY - centerY, event.clientX - centerX) * 180 / Math.PI + 450) % 360;
    return angle;
  }

  function bindPomodoroDials() {
    $$("[data-pomodoro-switch]").forEach(button => button.addEventListener("click", switchPomodoroMode));
    $$("[data-pomodoro-ring]").forEach((ring) => {
      let pointerId = null;
      let lastAngle = 0;
      let dragMinutes = 25;
      let frameId = 0;
      let pendingMinutes = null;
      let dragRect = null, before = null, dragging = false, tap = false, startX = 0, startY = 0;
      const flushPending = () => {
        frameId = 0;
        if (pendingMinutes === null) return;
        setPomodoroFromDial(pendingMinutes, { persist: false });
        pendingMinutes = null;
      };
      const update = (event) => {
        if (pointerId === null || event.pointerId !== pointerId) return;
        if (!dragging) {
          if (Math.hypot(event.clientX-startX,event.clientY-startY)>8) tap=false;
          return;
        }
        const angle = dialMinutesFromPointer(ring, event, dragRect);
        const delta = ((angle - lastAngle + 540) % 360) - 180;
        // Unwrap across 12 o'clock, clamp rather than jumping 120→1.
        dragMinutes = Math.max(1, Math.min(pomodoro.mode === "focus" ? 120 : 30, dragMinutes + delta / (pomodoro.mode === "focus" ? 3 : 12)));
        lastAngle = angle;
        pendingMinutes = dragMinutes;
        if (!frameId) frameId = requestAnimationFrame(flushPending);
        event.preventDefault();
      };
      const finish = (event, cancelled = false) => {
        if (pointerId === null || event.pointerId !== pointerId) return;
        if (frameId) {
          cancelAnimationFrame(frameId);
          frameId = 0;
        }
        if (cancelled && dragging && before) {
          pomodoro = before;
        } else if (pendingMinutes !== null) {
          setPomodoroFromDial(pendingMinutes, { persist: false });
        } else if (!dragging && tap && !cancelled && Math.hypot(event.clientX-startX,event.clientY-startY)<=8) {
          const rect=dragRect, radius=Math.hypot(event.clientX-rect.left-rect.width/2,event.clientY-rect.top-rect.height/2);
          if(radius>=rect.width*.32&&radius<=rect.width*.55) {
            const max=pomodoro.mode==='focus'?120:30;
            setPomodoroFromDial(Math.round(dialMinutesFromPointer(ring,event,rect)/(360/max))||max,{persist:false});
          }
        }
        pendingMinutes = null;
        const id=pointerId, changed=dragging||tap;
        pointerId = null;
        dragging=false;tap=false;before=null;dragRect=null;
        if(ring.hasPointerCapture?.(id))ring.releasePointerCapture?.(id);
        ring.classList.remove("is-adjusting");
        if(!cancelled&&changed)savePomodoro();
        renderPomodoro();
      };
      ring.addEventListener("pointerdown", (event) => {
        if (pomodoro.running || pointerId !== null || event.button > 0) return;
        if (event.target?.closest?.('[data-pomodoro-switch]')) return;
        const rect = ring.getBoundingClientRect();
        if (Math.hypot(event.clientX - rect.left - rect.width/2, event.clientY - rect.top - rect.height/2) < rect.width * .32) return;
        lastAngle = dialMinutesFromPointer(ring, event, rect);
        const currentMinutes = pomodoro.mode === "focus" ? pomodoro.focusMinutes : pomodoro.breakMinutes;
        dragging=Boolean(event.target?.closest?.('[data-pomodoro-adjust]'));
        tap=!dragging;startX=event.clientX;startY=event.clientY;dragRect=rect;
        before={...pomodoro,completedIds:[...pomodoro.completedIds]};
        dragMinutes = currentMinutes;
        pointerId = event.pointerId;
        // Only the visible thumb captures a drag; the rest remains scrollable.
        if(!dragging)return;
        (ring.querySelector?.('[data-pomodoro-adjust]') || ring).focus({ preventScroll: true });
        ring.setPointerCapture?.(pointerId);
        ring.classList.add("is-adjusting");
        event.preventDefault();
      });
      ring.addEventListener("pointermove", update, { passive: false });
      ring.addEventListener("pointerup", finish);
      ring.addEventListener("pointercancel", event=>finish(event,true));
      ring.addEventListener("lostpointercapture", event=>finish(event,true));
      const cancel=()=>{if(pointerId!==null)finish({pointerId},true);};
      window.addEventListener?.('blur',cancel);
      document.addEventListener?.('visibilitychange',()=>{if(document.hidden)cancel();});
      document.addEventListener?.('pointerup',event=>{if(pointerId!==null&&!dragging)finish(event);});
      ring.addEventListener("keydown", (event) => {
        if (pomodoro.running || event.ctrlKey || event.metaKey || event.altKey) return;
        const keys = ["ArrowRight", "ArrowUp", "ArrowLeft", "ArrowDown", "Home", "End"];
        if (!keys.includes(event.key)) return;
        if (event.target?.closest?.("[data-pomodoro-switch]")) return;
        event.preventDefault();
        if (event.key === "Home") setPomodoroFromDial(1);
        else if (event.key === "End") setPomodoroFromDial(pomodoro.mode === "focus" ? 120 : 30);
        else setPomodoroFromDial((pomodoro.mode === "focus" ? pomodoro.focusMinutes : pomodoro.breakMinutes) + (["ArrowRight", "ArrowUp"].includes(event.key) ? 1 : -1));
      });
    });
  }

  function recoverPomodoro() {
    if(pomodoro.activityContext&&pomodoro.activityContext.owner!==window.SchemsStudyAI?.getSnapshot?.().owner){pomodoro.running=false;pomodoro.endAt=null;savePomodoro();}
    if (pomodoro.running && pomodoro.endAt) {
      const remaining = Math.ceil((pomodoro.endAt - Date.now()) / 1000);
      if (remaining <= 0) finishPomodoroPhase();
      else pomodoro.remainingSec = remaining;
    }
    clearInterval(timerHandle);
    timerHandle = setInterval(tickPomodoro, 500);
    renderPomodoro();
  }

  const UTILITY_TITLES = {
    chat: "AI 챗봇",
    checklist: "체크리스트 관리",
    pomodoro: "뽀모도로 타이머",
  };

  function setUtilityModal(name = "") {
    const modal = $("#utilityModal");
    if (!modal) return;
    activeUtility = name;
    const open = Boolean(name);
    modal.classList.toggle("is-open", open);
    modal.setAttribute("aria-hidden", String(!open));
    document.body.classList.toggle("modal-open", open);
    $$("[data-utility-panel]", modal).forEach((panel) => {
      panel.hidden = panel.dataset.utilityPanel !== name;
    });
    if (!open) return;
    $("#utilityModalTitle").textContent = UTILITY_TITLES[name] || "전체";
    if (name === "checklist") {
      $("#utilityChecklistDate").value ||= todayKey();
      renderUtilityChecklist();
    } else if (name === "pomodoro") {
      renderPomodoro();
    }
    requestAnimationFrame(() => {
      const first = $("[data-utility-panel]:not([hidden]) input, [data-utility-panel]:not([hidden]) button", modal);
      first?.focus({ preventScroll: true });
    });
  }

  function renderUtilityChecklist() {
    const date = $("#utilityChecklistDate")?.value || todayKey();
    const list = $("#utilityChecklistList");
    const bridge = window.PrimeEduUtilityBridge;
    if (!list) return;
    if (!bridge?.getChecklist) {
      list.innerHTML = '<p class="status-text">체크리스트를 불러오는 중입니다.</p>';
      return;
    }
    const items = bridge.getChecklist(date);
    list.innerHTML = items.length
      ? items.map((item) => `<article class="utility-check-row ${item.done ? "is-done" : ""}">
          <label><input type="checkbox" data-utility-check="${escapeHtml(item.key)}" ${item.done ? "checked" : ""}><strong>${escapeHtml(item.title)}</strong></label>
          <button type="button" data-utility-delete="${escapeHtml(item.key)}" aria-label="${escapeHtml(item.title)} 삭제">삭제</button>
        </article>`).join("")
      : '<div class="planner-empty"><strong>등록된 체크리스트가 없습니다.</strong></div>';
  }

  function setAdmissionMode(mode) {
    $$("[data-admission-mode]").forEach((button) => {
      const active = button.dataset.admissionMode === mode;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
    });
    $("#admissionsDetailed").hidden = mode !== "detailed";
    $("#admissionsForm").dataset.mode = mode;
  }

  function hydrateAdmissionProfile() {
    const profile = window.SchemsPlannerAPI?.getUserProfile?.() || {};
    const level = profile.schoolLevel === "high" ? "high" : profile.schoolLevel === "middle" ? "middle" : "";
    if (level) $("#admissionSchoolLevel").value = level;
    const region = String(profile.school?.address || "").split(/\s+/).slice(0, 2).join(" ");
    if (region && !$("#admissionRegion").value) $("#admissionRegion").value = region;
    syncGradeSystem();
  }

  function syncGradeSystem() {
    const level = $("#admissionSchoolLevel")?.value || "middle";
    const system = $("#admissionGradeSystem");
    if (!system) return;
    system.innerHTML = level === "middle"
      ? '<option value="achievement5">성취도 5단계(A=1~E=5)</option>'
      : '<option value="grade5">내신 5등급제</option><option value="grade9">내신 9등급제</option>';
    syncAdmissionAverageLimit();
  }

  function syncAdmissionAverageLimit() {
    const system = $("#admissionGradeSystem")?.value || "achievement5";
    const input = $("#admissionAverage");
    if (!input) return;
    input.max = system === "grade9" ? "9" : "5";
    input.value = Math.min(Number(input.value || 3), Number(input.max));
  }

  async function saveAdmissionDoc(collection, payload) {
    const hub = window.ClassHubFirebase;
    const user = hub?.getCurrentUser?.();
    if (user?.uid && hub?.addUserCollectionDoc) {
      return hub.addUserCollectionDoc(user.uid, collection, payload);
    }
    const local = readJson(LOCAL_ADMISSION_KEY, { gradeRecords: [], admissionReports: [] });
    local[collection] = [{ id: `local-${Date.now()}`, ...payload }, ...(local[collection] || [])].slice(0, 30);
    localStorage.setItem(LOCAL_ADMISSION_KEY, JSON.stringify(local));
    return null;
  }

  async function saveGradeRecord(payload) {
    const hub = window.ClassHubFirebase;
    const user = hub?.getCurrentUser?.();
    if (user?.uid && hub?.addUserCollectionDoc) {
      return hub.addUserCollectionDoc(user.uid, "gradeRecords", payload);
    }
    return null;
  }

  function renderAdmissionResults(result) {
    const summary = $("#admissionsSummary");
    const list = $("#admissionsResults");
    if (summary) {
      summary.hidden = false;
      summary.innerHTML = `<strong>${escapeHtml(result.summary || "입력한 성적을 기준으로 탐색 결과를 정리했습니다.")}</strong>`;
    }
    if (!list) return;
    const bandLabel = { reach: "상향", match: "적정", safe: "안정" };
    const confidenceLabel = { low: "낮음", medium: "보통", high: "높음" };
    list.innerHTML = (result.recommendations || []).map((item) => {
      const range = item.probabilityRange || {};
      const reasons = Array.isArray(item.reasons) ? item.reasons : [];
      const officialUrl = /^https:\/\//.test(item.officialUrl || "") ? item.officialUrl : "";
      return `<article class="admission-result-card">
        <header><h3>${escapeHtml(item.institutionName || "추천 기관")}</h3><span class="admission-band">${bandLabel[item.band] || "탐색"}</span></header>
        ${item.program ? `<p>${escapeHtml(item.program)}</p>` : ""}
        <div class="admission-probability">${Number(range.min || 0)}–${Number(range.max || 0)}%</div>
        <span class="admission-confidence">신뢰도 ${confidenceLabel[item.confidence] || "낮음"} · ${item.estimateBasis === "ai_inference" ? "AI 추정" : "공식 자료 기반"}</span>
        <ul>${reasons.map((reason) => `<li>${escapeHtml(reason)}</li>`).join("")}</ul>
        <p><strong>보완 목표</strong><br>${escapeHtml(item.improvementGoal || "모집요강과 최근 성적을 함께 확인하세요.")}</p>
        ${officialUrl ? `<a href="${escapeHtml(officialUrl)}" target="_blank" rel="noopener noreferrer">공식 정보 확인</a>` : ""}
      </article>`;
    }).join("");
  }

  async function submitAdmission(event) {
    event.preventDefault();
    const status = $("#admissionsStatus");
    const payload = {
      mode: event.currentTarget.dataset.mode || "quick",
      schoolLevel: $("#admissionSchoolLevel").value,
      gradeSystem: $("#admissionGradeSystem").value,
      average: Number($("#admissionAverage").value),
      region: $("#admissionRegion").value.trim(),
      interest: $("#admissionInterest").value.trim(),
      track: $("#admissionTrack").value.trim(),
      subjects: $("#admissionSubjects").value.trim(),
      mockExam: $("#admissionMock").value.trim(),
    };
    status.textContent = "성적을 계산하고 추천 범위를 분석하고 있습니다.";
    status.className = "status-text";
    try {
      await saveAdmissionDoc("gradeRecords", { ...payload, createdAt: new Date().toISOString() });
      const response = await fetch("/api/recommendAdmissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "추천 API를 사용할 수 없습니다.");
      renderAdmissionResults(result);
      await saveAdmissionDoc("admissionReports", { ...result, input: payload, createdAt: new Date().toISOString() });
      status.textContent = "추천 결과를 만들었습니다.";
      status.className = "status-text ok";
    } catch (error) {
      status.textContent = `${error.message} 성적 입력값은 저장했지만 추천은 표시하지 못했습니다.`;
      status.className = "status-text error";
    }
  }

  function gradePeriodLabel(record) {
    return `${record.year}학년 ${record.term}학기 ${record.exam === "mid" ? "중간" : "기말"}`;
  }

  function renderAcademicGrades() {
    const chart = $("#gradeComboChart");
    const list = $("#gradeRecordList");
    const filter = $("#gradeChartSubject");
    if (!chart || !list || !filter) return;
    const subjects = [...new Set(academicGrades.map((item) => item.subject))].sort((a, b) => a.localeCompare(b, "ko"));
    const current = subjects.includes(filter.value) ? filter.value : "all";
    filter.innerHTML = `<option value="all">전체 평균</option>${subjects.map((subject) => `<option value="${escapeHtml(subject)}">${escapeHtml(subject)}</option>`).join("")}`;
    filter.value = current;
    filter.hidden = subjects.length === 0;
    filter.parentElement?.classList.toggle('is-empty',subjects.length === 0);
    const periodKeys = [...new Set(academicGrades.map((item) => `${item.year}-${item.term}-${item.exam}`))]
      .sort((a, b) => {
        const [ay, at, ae] = a.split("-"), [by, bt, be] = b.split("-");
        return Number(ay) - Number(by) || Number(at) - Number(bt) || (ae === "mid" ? 0 : 1) - (be === "mid" ? 0 : 1);
      });
    const points = periodKeys.map((key) => {
      const rows = academicGrades.filter((item) => `${item.year}-${item.term}-${item.exam}` === key && (current === "all" || item.subject === current));
      const score = rows.length ? rows.reduce((sum, item) => sum + Number(item.score || 0), 0) / rows.length : 0;
      return { key, label: rows[0] ? gradePeriodLabel(rows[0]) : key, score: Math.round(score * 10) / 10, count: rows.length };
    }).filter((item) => item.count > 0);
    chart.dataset.empty = String(!points.length);
    if (!points.length) {
      chart.innerHTML = '<div class="planner-empty grade-chart-empty"><strong>첫 성적을 기록해볼까요?</strong><button type="button" class="btn" data-ui-keep-label data-journey="grades" aria-label="성적 기록하기">성적 기록</button></div>';
    } else {
      // Keep each semester's label readable instead of scaling 12 terms into 720px.
      const width = Math.max(720, points.length * 140);
      const height = 260;
      const gap = width / points.length;
      const polyline = points.map((item, index) => `${Math.round(gap * index + gap / 2)},${Math.round(height - 34 - item.score * 1.9)}`).join(" ");
      chart.innerHTML = `<div class="grade-chart-scroll"><svg style="min-width:${width}px" viewBox="0 0 ${width} ${height}" role="img" aria-label="성적 막대와 추이">
        <line class="grade-grid-line" x1="0" y1="${height - 34}" x2="${width}" y2="${height - 34}"/>
        ${points.map((item, index) => {
          const barHeight = item.score * 1.9;
          const x = gap * index + gap * .2;
          return `<rect class="grade-bar" x="${x}" y="${height - 34 - barHeight}" width="${gap * .6}" height="${barHeight}" rx="8"/>
            <text class="grade-score" x="${gap * index + gap / 2}" y="${height - 42 - barHeight}" text-anchor="middle">${item.score}</text>
            <text class="grade-axis-label" x="${gap * index + gap / 2}" y="${height - 10}" text-anchor="middle">${escapeHtml(item.label.replace("학년 ", "-").replace("학기 ", " "))}</text>`;
        }).join("")}
        <polyline class="grade-trend-line" points="${polyline}"/>
        ${points.map((item, index) => `<circle class="grade-trend-dot" cx="${Math.round(gap * index + gap / 2)}" cy="${Math.round(height - 34 - item.score * 1.9)}" r="5"/>`).join("")}
      </svg></div>`;
    }
    list.innerHTML = ""; // Editing and clearing now happen in the account-scoped table.
  }

  function bindEvents() {
    document.addEventListener("click", async (event) => {
      const opener = event.target.closest("[data-utility-open]");
      if (opener) {
        setUtilityModal(opener.dataset.utilityOpen);
        return;
      }
      if (event.target.closest("#utilityModalClose") || event.target.id === "utilityModal") {
        setUtilityModal("");
        return;
      }
      if (event.target.closest("[data-pomodoro-toggle]")) {
        togglePomodoro();
        return;
      }
      if (event.target.closest("[data-pomodoro-reset]")) {
        resetPomodoro();
        return;
      }
      const preset = event.target.closest("[data-pomodoro-preset]");
      if (preset) {
        applyPomodoroPreset(...preset.dataset.pomodoroPreset.split(",").map(Number));
        return;
      }
      const applyTimer = event.target.closest("[data-pomodoro-apply]");
      if (applyTimer) {
        const scope = applyTimer.closest(".home-pomodoro, .mobile-pomodoro-widget, .utility-pomodoro-panel") || document;
        applyPomodoroPreset(
          scope.querySelector("[data-pomodoro-focus]")?.value ?? pomodoro.focusMinutes,
          scope.querySelector("[data-pomodoro-break]")?.value,
        );
        return;
      }
      const progressButton = event.target.closest("[data-open-progress]");
      if (progressButton) {
        setUtilityModal("");
        window.switchTab?.("progress");
        return;
      }
      const checkbox = event.target.closest("[data-utility-check]");
      if (checkbox) {
        await window.PrimeEduUtilityBridge?.toggleChecklist?.(checkbox.dataset.utilityCheck, checkbox.checked);
        renderUtilityChecklist();
        return;
      }
      const remove = event.target.closest("[data-utility-delete]");
      if (remove && confirm("이 체크리스트를 삭제할까요?")) {
        await window.PrimeEduUtilityBridge?.deleteChecklist?.(remove.dataset.utilityDelete);
        renderUtilityChecklist();
        return;
      }
    });

    $("#utilityChecklistDate")?.addEventListener("change", renderUtilityChecklist);
    $("#utilityChecklistForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const title = $("#utilityChecklistTitle").value.trim();
      const date = $("#utilityChecklistDate").value || todayKey();
      const status = $("#utilityChecklistStatus");
      if (!title) return;
      try {
        await window.PrimeEduUtilityBridge?.addChecklist?.(title, date, {
          minutes: Number($("#utilityChecklistMinutes")?.value || 30),
          difficulty: $("#utilityChecklistDifficulty")?.value || "medium",
        });
        event.currentTarget.reset();
        $("#utilityChecklistDate").value = date;
        $("#utilityChecklistMinutes").value = "30";
        $("#utilityChecklistDifficulty").value = "medium";
        status.textContent = "체크리스트에 추가했습니다.";
        status.className = "status-text ok";
        renderUtilityChecklist();
      } catch (error) {
        status.textContent = error.message || "체크리스트를 추가하지 못했습니다.";
        status.className = "status-text error";
      }
    });
    $("#gradeChartSubject")?.addEventListener("change", renderAcademicGrades);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && activeUtility) setUtilityModal("");
    });
    window.addEventListener("schems:study-data", renderPomodoro);
    window.addEventListener("schems:planner-data", () => {
      if (activeUtility === "checklist") renderUtilityChecklist();
    });
  }

  function init() {
    bindEvents();
    bindPomodoroDials();
    recoverPomodoro();
    renderAcademicGrades();
  }

  window.PrimeEduPomodoro = {
    getState: () => window.PrimeCompat.cloneData(pomodoro),
    toggle: togglePomodoro,
    reset: resetPomodoro,
    startActivity(taskId,blockId) {
      if(pomodoro.running||pomodoro.sessionId||pomodoro.activityContext)throw Error('사용 중인 타이머를 먼저 마쳐주세요.');
      const task=window.SchemsStudyAI.getActivity(taskId),block=task?.activity.blocks.find(b=>b.id===blockId);
      if(!block||block.state==='done')throw Error('시작할 준비를 확인해주세요.');
      const previous=window.PrimeCompat.cloneData(pomodoro);
      window.SchemsStudyAI.startActivityBlock(taskId,blockId);
      try{applyPomodoroPreset(block.minutes,pomodoro.breakMinutes);pomodoro.activityContext={taskId,blockId,owner:window.SchemsStudyAI.getSnapshot().owner,startedAt:new Date().toISOString(),previousSettings:{focusMinutes:previous.focusMinutes,breakMinutes:previous.breakMinutes,mode:previous.mode,remainingSec:previous.remainingSec}};togglePomodoro();}
      catch(error){pomodoro=previous;window.SchemsStudyAI.cancelActivityStart(taskId,blockId);renderPomodoro();throw Error('타이머를 저장하지 못했어요. 다시 시작해주세요.');}
    },
    async finishActivity(outcome) {
      const context=pomodoro.activityContext;if(!context||context.owner!==window.SchemsStudyAI.getSnapshot().owner)throw Error('현재 계정의 준비 타이머가 아니에요.');
      if(pomodoro.running){pomodoro.remainingSec=Math.max(0,Math.ceil((pomodoro.endAt-Date.now())/1000));pomodoro.running=false;pomodoro.endAt=null;savePomodoro();renderPomodoro();}
      const session={id:pomodoro.sessionId,outcome,minutes:Math.round(Math.max(0,pomodoro.focusMinutes*60-pomodoro.remainingSec)/60*100)/100,startedAt:context.startedAt};
      if(!session.id)throw Error('세션을 확인해주세요.');
      const result=await window.SchemsStudyAI.finishActivitySession(context,session);
      if(pomodoro.activityContext!==context)return result;
      pomodoro.activityContext=null;pomodoro.sessionId=null;Object.assign(pomodoro,context.previousSettings||{remainingSec:pomodoro.focusMinutes*60});savePomodoro();renderPomodoro();return result;
    },
  };
  window.addEventListener('prime:study-owner-change',()=>{
    if(pomodoro.activityContext&&pomodoro.activityContext.owner!==window.SchemsStudyAI?.getSnapshot?.().owner){
      if(pomodoro.running)pomodoro.remainingSec=Math.max(0,Math.ceil((pomodoro.endAt-Date.now())/1000));
      pomodoro.running=false;pomodoro.endAt=null;savePomodoro();renderPomodoro();
    }
  });
  window.PrimeEduGradeChart = {
    setRecords: (records) => { academicGrades = records.filter(item => item.recordType === "exam-score"); renderAcademicGrades(); },
    getRecords: () => window.PrimeCompat.cloneData(academicGrades),
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
