(function () {
  "use strict";

  const HOME_PREF_KEY = "schemsHomePreferences.v1";
  const LOCAL_PLAN_KEY = "schemsLocalPlanEvents.v1";
  const PLAN_CHECK_KEY = "schemsPlanChecks.v1";
  const FAB_POSITION_KEY = "schemsAiFabPosition.v1";
  const HOME_ACCENTS = ["green", "blue", "gray", "red", "purple", "orange"];

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const todayKey = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  };
  const toDateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const escapeHtml = (value) => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  function readJson(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "null");
      return value ?? fallback;
    } catch {
      return fallback;
    }
  }

  function selectTab(tab) {
    if (!tab || typeof window.switchTab !== "function") return;
    window.switchTab(tab);
    if (tab === "plan") renderPlanner();
    if (tab === "settings") renderPrivacyInsights();
    syncActiveTabState();
  }

  function refreshThemeChoice() {
    const mode = typeof window.getThemeMode === "function" ? window.getThemeMode() : "auto";
    $$('[data-theme-choice]').forEach((button) => {
      const active = button.dataset.themeChoice === mode;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }
  window.addEventListener('prime:theme-change',refreshThemeChoice);

  $$(".desktop-nav-item").forEach((button) => {
    button.addEventListener("click", () => selectTab(button.dataset.tab));
  });

  $$(".bottom-nav .nav-item").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.tab === "plan") renderPlanner();
      if (button.dataset.tab === "settings") renderPrivacyInsights();
    });
  });

  $$('[data-theme-choice]').forEach((button) => {
    button.addEventListener("click", () => {
      if (typeof window.applyTheme === "function") window.applyTheme(button.dataset.themeChoice);
      refreshThemeChoice();
    });
  });

  $("#settingsProfileButton")?.addEventListener("click", () => $("#accountProfileButton")?.click());
  $("#settingsLogoutButton")?.addEventListener("click", () => $("#logoutButton")?.click());

  let homePreferences = {
    showSuggestions: true,
    accent: "green",
    ...readJson(HOME_PREF_KEY, {}),
  };

  function saveHomePreferences() {
    localStorage.setItem(HOME_PREF_KEY, JSON.stringify(homePreferences));
    applyHomePreferences();
  }

  function applyHomePreferences() {
    document.body.classList.toggle("home-hide-suggestions", !homePreferences.showSuggestions);
    document.body.classList.remove("home-density-compact");
    const accent = HOME_ACCENTS.includes(homePreferences.accent) ? homePreferences.accent : "green";
    document.documentElement.dataset.accent = accent;
    document.body.classList.remove("mobile-home-layout-favorites");
    const toggle = $("#homeSuggestionToggle");
    if (toggle) toggle.checked = homePreferences.showSuggestions;
    $$('[data-accent-choice]').forEach((button) => {
      const active = button.dataset.accentChoice === accent;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  let homeSettingsCloseTimer = null;
  let desktopChatOpen = false;
  let desktopChatTransitionTimer = null;

  function setDesktopChatOpen(open) {
    desktopChatOpen = Boolean(open) && window.matchMedia("(min-width: 1000px)").matches;
    const visible = desktopChatOpen && document.body.dataset.activeTab === "home";
    const hero = $(".home-ai-hero");
    hero?.classList.toggle("has-conversation", visible);
    if (!visible) hero?.classList.remove("is-chat-transitioning");
    document.body.classList.toggle("desktop-home-chat-mode", visible);
    if (hero) {
      hero.scrollTop = 0;
      requestAnimationFrame(() => {
        hero.scrollTop = 0;
      });
    }
  }

  function beginDesktopChatTransition() {
    if (!window.matchMedia("(min-width: 1000px)").matches) return;
    const hero = $(".home-ai-hero");
    clearTimeout(desktopChatTransitionTimer);
    hero?.classList.add("is-chat-transitioning");
    desktopChatTransitionTimer = setTimeout(() => {
      desktopChatOpen = true;
      setDesktopChatOpen(true);
      requestAnimationFrame(() => hero?.classList.remove("is-chat-transitioning"));
    }, 230);
  }

  let homeSettingsTrigger=null;
  function setHomeSettingsOpen(open) {
    const panel = $("#homeSettingsPanel");
    const button = $("#homeSettingsButton");
    if (!panel || !button) return;
    const backdrop = $("#homeSettingsBackdrop");
    window.clearTimeout(homeSettingsCloseTimer);
    if (open) {
      homeSettingsTrigger=document.activeElement?.matches?.('#homeSettingsButton,#mobileHomeChangeButton')?document.activeElement:$(window.innerWidth<1000?'#mobileHomeChangeButton':'#homeSettingsButton');
      panel.classList.remove("is-closing");
      backdrop?.classList.remove("is-closing");
      panel.hidden = false;
      if (backdrop) backdrop.hidden = false;
      document.body.classList.add("home-settings-open");
      button.setAttribute("aria-expanded", "true");
      $("#mobileHomeChangeButton")?.setAttribute("aria-expanded", "true");
      window.PrimeHomeSettingsLayout?.position();
      return;
    }
    button.setAttribute("aria-expanded", "false");
    $("#mobileHomeChangeButton")?.setAttribute("aria-expanded", "false");
    document.body.classList.remove("home-settings-open");
    if (panel.hidden) return;
    panel.classList.add("is-closing");
    backdrop?.classList.add("is-closing");
    homeSettingsCloseTimer = window.setTimeout(() => {
      panel.hidden = true;
      panel.classList.remove("is-closing");
      if (backdrop) {
        backdrop.hidden = true;
        backdrop.classList.remove("is-closing");
      }
      if(document.body.dataset.activeTab==='home'&&homeSettingsTrigger?.getClientRects().length)homeSettingsTrigger.focus({preventScroll:true});
    }, 210);
  }

  $("#homeSettingsButton")?.addEventListener("click", () => setHomeSettingsOpen($("#homeSettingsPanel")?.hidden));
  $("#homeSettingsCloseButton")?.addEventListener("click", () => setHomeSettingsOpen(false));
  $("#homeSettingsBackdrop")?.addEventListener("click", () => setHomeSettingsOpen(false));
  $("#homeSettingsSaveButton")?.addEventListener("click", () => setHomeSettingsOpen(false));
  $("#mobileHomeChangeButton")?.addEventListener("click", () => setHomeSettingsOpen(true));
  $("#homeSuggestionToggle")?.addEventListener("change", (event) => {
    homePreferences.showSuggestions = event.currentTarget.checked;
    saveHomePreferences();
  });
  $$('[data-accent-choice]').forEach((button) => button.addEventListener("click", () => {
    homePreferences.accent = HOME_ACCENTS.includes(button.dataset.accentChoice) ? button.dataset.accentChoice : "green";
    saveHomePreferences();
  }));

  function syncActiveTabState() {
    const activeTab = $("main > .panel.is-active")?.dataset.tab || "home";
    document.body.dataset.activeTab = activeTab;
    if (activeTab !== "home") {
      desktopChatOpen = false;
      document.body.classList.remove("desktop-home-chat-mode");
      setHomeSettingsOpen(false);
      setMobileChatDrawer(false);
      setDesktopChatHistory(false);
    }
  }

  $$("main > .panel").forEach((panel) => {
    new MutationObserver(syncActiveTabState).observe(panel, { attributes: true, attributeFilter: ["class"] });
  });
  syncActiveTabState();

  const MOBILE_HOME_GREETINGS = [
    "친구야, 고민을 말해봐!",
    "친구야, 공부를 시작할까?",
    "오늘은 무엇부터 해볼까?",
    "함께 천천히 시작해볼까?",
    "지금 가장 궁금한 건 뭐야?",
  ];

  function randomizeMobileGreeting() {
    const target = $("#mobileHomeTitle");
    if (!target) return;
    target.textContent = '무엇이 궁금해요?';
  }

  function setMobileChatView(open) {
    const landing = $(".mobile-home-landing");
    const chatView = $("#mobileHomeChatView");
    if (!landing || !chatView) return;
    // A viewport-owned chat must not inherit a transitioning panel's transform.
    if (open && !chatView.dataset.viewportPortal) {
      document.body.append(chatView);
      chatView.dataset.viewportPortal = 'true';
    }
    landing.hidden = open;
    chatView.hidden = !open;
    document.body.classList.toggle("mobile-home-chat-mode", open);
    if (open) requestAnimationFrame(() => $("#aiChatInputMobile")?.focus());
  }

  $('#mobileHomeChatView .mobile-home-chat-form > button')?.addEventListener('pointerdown', event => {
    if (event.pointerType === 'touch' && document.activeElement === $('#aiChatInputMobile')) event.preventDefault();
  });

  function setMobileChatDrawer(open) {
    const drawer = $("#mobileChatDrawer");
    const backdrop = $("#mobileChatDrawerBackdrop");
    if (!drawer || !backdrop) return;
    drawer.hidden = !open;
    backdrop.hidden = !open;
    drawer.classList.toggle("is-open", open);
    backdrop.classList.toggle("is-open", open);
    $("#mobileLandingHistoryButton")?.setAttribute("aria-expanded", String(open));
    $("#mobileChatMenuButton")?.setAttribute("aria-expanded", String(open));
    document.body.classList.toggle("mobile-chat-drawer-open", open);
  }

  function setDesktopChatHistory(open) {
    const drawer = $("#desktopChatHistory");
    const backdrop = $("#desktopChatHistoryBackdrop");
    if (!drawer || !backdrop) return;
    drawer.hidden = !open;
    backdrop.hidden = !open;
    drawer.classList.toggle("is-open", open);
    backdrop.classList.toggle("is-open", open);
    $("#desktopHistoryButton")?.setAttribute("aria-expanded", String(open));
  }

  function formatChatTime(value) {
    const date = new Date(value || Date.now());
    if (Number.isNaN(date.getTime())) return "";
    const today = new Date();
    if (date.toDateString() === today.toDateString()) return date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
    return `${date.getMonth() + 1}.${date.getDate()}`;
  }

  function renderMobileChatHistory(state = window.SchemsScheduleAI?.getState?.()) {
    if (!state) return;
    document.querySelectorAll('[data-import-legacy-chat]').forEach(el => { el.hidden = !state.legacyAvailable; });
    const list = $("#mobileChatHistoryList");
    const empty = $("#mobileChatHistoryEmpty");
    const title = $("#mobileHomeChatTitle");
    const conversations = [...(state.conversations || [])].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    const historyHtml = conversations.map((conversation) => {
      const last = conversation.messages?.[conversation.messages.length - 1]?.content || "대화를 시작해 보세요.";
      const active = conversation.id === state.activeConversationId;
      return `<div class="chat-history-row${active ? " is-active" : ""}">
        <button type="button" class="mobile-chat-history-item" data-mobile-conversation="${escapeHtml(conversation.id)}">
          <span><strong>${escapeHtml(conversation.title)}</strong><small>${escapeHtml(last)}</small></span><time>${escapeHtml(formatChatTime(conversation.updatedAt))}</time>
        </button>
        <button type="button" class="chat-history-delete" data-delete-conversation="${escapeHtml(conversation.id)}" aria-label="${escapeHtml(conversation.title)} 삭제">${window.PrimeUI.svg('trash')}</button>
      </div>`;
    }).join("");
    if (list) list.innerHTML = historyHtml;
    const desktopList = $("#desktopChatHistoryList");
    const desktopEmpty = $("#desktopChatHistoryEmpty");
    if (desktopList) desktopList.innerHTML = historyHtml;
    if (empty) empty.hidden = conversations.length > 0;
    if (desktopEmpty) desktopEmpty.hidden = conversations.length > 0;
    const active = conversations.find((conversation) => conversation.id === state.activeConversationId);
    if (title) title.textContent = active?.title || "새 대화";
    const hero = $(".home-ai-hero");
    const showDesktopChat = desktopChatOpen && document.body.dataset.activeTab === "home";
    hero?.classList.toggle("has-conversation", showDesktopChat);
    document.body.classList.toggle("desktop-home-chat-mode", showDesktopChat);
  }

  function openHomeConversation(id) {
    const mobile = window.matchMedia("(max-width: 999px)").matches;
    desktopChatOpen = !mobile;
    if (id && !window.SchemsScheduleAI?.selectConversation?.(id)) return false;
    selectTab("home");
    setMobileChatDrawer(false);
    setMobileChatView(mobile);
    if (!mobile) renderMobileChatHistory();
    return true;
  }

  window.PrimeEduChat = {
    openConversation: openHomeConversation,
    open() { return openHomeConversation(); },
    close() { setMobileChatDrawer(false); setMobileChatView(false); },
  };

  function startNewMobileConversation() {
    window.SchemsScheduleAI?.newConversation?.();
    setMobileChatDrawer(false);
    setMobileChatView(false);
    randomizeMobileGreeting();
    const search = $("#mobileStudySearchInput");
    if (search) search.value = "";
  }

  randomizeMobileGreeting();

  // Enter the conversation before typing; scripted focus on return never
  // reopens it. The live mascot travels into the profile slot at this point.
  $("#mobileStudySearchInput")?.addEventListener('pointerdown', event => {
    if(window.innerWidth>=1000)return;
    event.preventDefault();
    const draft=event.currentTarget.value;
    setMobileChatView(true);
    if(draft)$("#aiChatInputMobile").value=draft;
  });
  $("#aiChatInputHome")?.addEventListener('pointerdown', () => {
    if(window.innerWidth>=1000)setDesktopChatOpen(true);
  });

  $("#aiChatFormHome")?.addEventListener("submit", () => {
    if (!$("#aiChatInputHome")?.value.trim()) return;
    beginDesktopChatTransition();
  }, true);
  $("#aiChatMessagesHome")?.addEventListener("click", (event) => {
    if (!event.target.closest("[data-ai-suggest]")) return;
    beginDesktopChatTransition();
  });

  $("#mobileStudySearchForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const input = $("#mobileStudySearchInput");
    if (!input?.value.trim()) {
      input?.focus();
      return;
    }
    const prompt = input.value.trim();
    window.SchemsScheduleAI?.newConversation?.();
    setMobileChatView(true);
    window.SchemsScheduleAI?.sendMessage?.(prompt);
    input.value = "";
  });
  $("#mobileStudyCameraButton")?.addEventListener("click", () => $("#mobileStudyPhotoInput")?.click());
  $("#mobileStudyPhotoInput")?.addEventListener("change", (event) => {
    const file = event.currentTarget.files?.[0];
    const status = $("#mobileStudyPhotoStatus");
    const camera = $("#mobileStudyCameraButton");
    camera?.classList.toggle("has-photo", Boolean(file));
    if (status) status.textContent = file ? `${file.name} 선택됨 · 질문을 함께 입력해 주세요.` : "";
  });
  $("#mobileLandingHistoryButton")?.addEventListener("click", () => setMobileChatDrawer(true));
  $("#mobileChatMenuButton")?.addEventListener("click", () => setMobileChatDrawer(true));
  $("#mobileChatBackButton")?.addEventListener("click", () => {
    setMobileChatDrawer(false);
    setMobileChatView(false);
    randomizeMobileGreeting();
  });
  $("#desktopChatBackButton")?.addEventListener("click", () => {
    desktopChatOpen = false;
    window.SchemsScheduleAI?.newConversation?.();
    setDesktopChatOpen(false);
    $("#aiChatInputHome")?.focus();
  });
  $("#mobileChatDrawerClose")?.addEventListener("click", () => setMobileChatDrawer(false));
  $("#mobileChatDrawerBackdrop")?.addEventListener("click", () => setMobileChatDrawer(false));
  $("#mobileChatNewButton")?.addEventListener("click", startNewMobileConversation);
  $("#mobileChatDrawerNew")?.addEventListener("click", startNewMobileConversation);
  $("#desktopHistoryButton")?.addEventListener("click", () => setDesktopChatHistory($("#desktopChatHistory")?.hidden));
  $("#desktopChatHistoryClose")?.addEventListener("click", () => setDesktopChatHistory(false));
  $("#desktopChatHistoryBackdrop")?.addEventListener("click", () => setDesktopChatHistory(false));
  $("#desktopChatHistoryNew")?.addEventListener("click", () => {
    window.SchemsScheduleAI?.newConversation?.();
    desktopChatOpen = false;
    setDesktopChatHistory(false);
    setDesktopChatOpen(false);
    $("#aiChatInputHome")?.focus();
  });
  function handleConversationHistoryClick(event) {
    const deleteButton = event.target.closest("[data-delete-conversation]");
    if (deleteButton) {
      const id = deleteButton.dataset.deleteConversation;
      if (confirm("이 대화 기록을 삭제할까요?")) {
        const wasActive = window.SchemsScheduleAI?.getState?.().activeConversationId === id;
        window.SchemsScheduleAI?.deleteConversation?.(id);
        if (wasActive) {
          setMobileChatDrawer(false);
          setDesktopChatHistory(false);
          const mobile = window.matchMedia("(max-width: 999px)").matches;
          if (mobile) setMobileChatView(false);
          else {
            desktopChatOpen = false;
            setDesktopChatOpen(false);
          }
        }
      }
      return;
    }
    const button = event.target.closest("[data-mobile-conversation]");
    if (!button) return;
    if (window.SchemsScheduleAI?.selectConversation?.(button.dataset.mobileConversation)) {
      if (window.matchMedia("(max-width: 999px)").matches) setMobileChatView(true);
      else {
        desktopChatOpen = true;
        setDesktopChatOpen(true);
        setDesktopChatHistory(false);
      }
      setMobileChatDrawer(false);
    }
  }
  $("#mobileChatHistoryList")?.addEventListener("click", handleConversationHistoryClick);
  $("#desktopChatHistoryList")?.addEventListener("click", handleConversationHistoryClick);
  $("#aiChatInputMobile")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      $("#aiChatFormMobile")?.requestSubmit();
    }
  });
  window.addEventListener("schems:chat-history", (event) => {
    renderMobileChatHistory(event.detail);
  });
  renderMobileChatHistory();

  function getPlannerData() {
    return window.SchemsPlannerAPI?.getData?.() || { schedule: [], events: [] };
  }

  function getSchoolEvents() {
    return window.SchemsPlannerAPI?.getSchoolEvents?.() || [];
  }

  function getPersonalEvents(from,to) {
    return window.SchemsPlannerAPI?.getPersonalEvents?.(from,to) || [];
  }

  function eventOccursOn(event, key) {
    const start = String(event?.date || "");
    const end = String(event?.endDate || start);
    return start <= key && key <= end;
  }

  function renderNotifications() {
    const key = todayKey();
    const now = new Date(`${key}T00:00:00`);
    const dayIndex = now.getDay() - 1;
    const planner = getPlannerData();
    const subjects = dayIndex >= 0 && dayIndex < 5
      ? (planner.schedule || []).map((row, index) => ({ period: index + 1, subject: String(row?.[dayIndex] || "").trim() })).filter((item) => item.subject)
      : [];
    const schoolEvents = getSchoolEvents().filter((event) => eventOccursOn(event, key));
    const academyEvents=getPersonalEvents(key,key).filter(event=>event.source==='consultation'&&event.date===key);
    const upcoming=window.PrimeLearnerIntegration?.getAlerts?.().filter(event=>event.date>key)||[];
    const mealSource = $("#mealDetailListPage") || $("#mealDetailList");
    // textContent joins adjacent <br> lines. Read the menu structure, not flattened text.
    const mealCards = mealSource ? [...mealSource.querySelectorAll(".list-item")] : [];
    const mealMenus = mealCards.map(card => {
      const menu = card.querySelector(".meal-menu");
      const lines = menu ? [...menu.childNodes].filter(node => node.nodeType === 3)
        .flatMap(node => String(node.textContent || "").split(/\n+/)).map(line => line.trim()).filter(Boolean)
        : [...card.querySelectorAll(".meal-detail-items li")].map(item => item.textContent.trim()).filter(Boolean);
      return { name: card.querySelector("strong")?.textContent?.trim() || "급식", lines,
        calorie: card.querySelector(".meal-calorie")?.textContent?.replace(/^\s*·\s*/, "").trim() || "" };
    }).filter(meal => meal.lines.length);
    const hasMeal = mealMenus.length > 0;

    const todayList = $("#notificationTodayList");
    if (todayList) {
      const rows = [
        ...schoolEvents.map((event) => `<article class="notification-item"><span class="notification-item-icon event">일정</span><div><strong>${escapeHtml(event.title)}</strong><p>${escapeHtml(event.type || "학교 일정")}</p></div></article>`),
        ...academyEvents.map(event=>`<article class="notification-item"><span class="notification-item-icon event" aria-hidden="true">${window.PrimeUI.svg('clock')}</span><div><strong>${escapeHtml(event.title)}</strong><p>${escapeHtml(event.start+'–'+event.end)} · 학원</p></div></article>`),
        ...upcoming.map(event=>`<article class="notification-item"><span class="notification-item-icon event" aria-hidden="true">${window.PrimeUI.svg('calendar')}</span><div><strong>${escapeHtml(event.title)} · ${escapeHtml(event.dday)}</strong><p>${escapeHtml(event.date.slice(5).replace('-','/'))} · ${escapeHtml(event.sourceLabel)}</p></div></article>`),
        ...subjects.slice(0, 7).map((item) => `<article class="notification-item"><span class="notification-item-icon class">${item.period}</span><div><strong>${escapeHtml(item.subject)}</strong><p>${item.period}교시</p></div></article>`),
      ];
      todayList.innerHTML = rows.length ? rows.join("") : `<p class="notification-empty">오늘 등록된 일정이 없습니다.</p>`;
    }
    const mealList = $("#notificationMealList");
    if (mealList) mealList.innerHTML = hasMeal ? mealMenus.map(meal => `<article class="notification-item notification-meal"><span class="notification-item-icon meal" aria-hidden="true">급식</span><div><strong>${escapeHtml(meal.name)}</strong><ul>${meal.lines.map(line => `<li>${escapeHtml(line)}</li>`).join("")}</ul>${meal.calorie ? `<small>${escapeHtml(meal.calorie)}</small>` : ""}</div></article>`).join("") : '<p class="notification-empty">오늘 등록된 급식이 없습니다.</p>';

    const count = schoolEvents.length + academyEvents.length + upcoming.length + subjects.length + (hasMeal ? 1 : 0);
    const badge = $("#notificationBadge");
    if (badge) {
      badge.hidden = count === 0;
      badge.textContent = count > 9 ? "9+" : String(count);
    }
    const summary = $("#homeNoticeSummary");
    if (summary) summary.textContent = `${subjects.length ? `${subjects.length}교시` : "수업 없음"} · 일정 ${schoolEvents.length}개 · ${hasMeal ? "급식 확인" : "급식 미등록"}`;
  }

  let notificationReturnFocus = null;
  function setNotificationsOpen(open, restoreFocus = false) {
    const popover = $("#notificationPopover");
    const button = $("#notificationButton");
    if (!popover || !button) return;
    if (open) { notificationReturnFocus = document.activeElement; renderNotifications(); }
    popover.hidden = !open;
    button.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) {
      window.PrimeNotificationLayout?.position();
      $("#notificationCloseButton")?.focus({ preventScroll: true });
    } else if (restoreFocus && notificationReturnFocus?.isConnected) {
      notificationReturnFocus.focus({ preventScroll: true });
    }
  }

  $("#notificationButton")?.addEventListener("click", () => setNotificationsOpen($("#notificationPopover")?.hidden));
  $("#notificationCloseButton")?.addEventListener("click", () => setNotificationsOpen(false, true));
  $("#homeNoticeButton")?.addEventListener("click", () => setNotificationsOpen(true));

  let plannerCursor = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  let selectedPlanDate = todayKey();
  let localPlanEvents = Array.isArray(readJson(LOCAL_PLAN_KEY, [])) ? readJson(LOCAL_PLAN_KEY, []) : [];
  let planChecks = readJson(PLAN_CHECK_KEY, {});
  let latestStudySnapshot = {
    tasks: [],
    sessions: [],
    attempts: [],
    notes: [],
    bookRecommendations: [],
    profile: null,
  };

  function getStudySnapshot() {
    return window.SchemsStudyAI?.getSnapshot?.() || latestStudySnapshot;
  }

  function homeWidgetEmpty(message) {
    return `<p class="home-widget-empty">${escapeHtml(message)}</p>`;
  }

  function setHomeWidget(name, html) {
    $$(`[data-home-widget="${name}"]`).forEach((box) => { box.innerHTML = html; });
  }

  function renderHomeLearningWidgets() {
    const snapshot = getStudySnapshot();
    const todayItems = planItemsForDate(todayKey()).filter((item) => ["checklist", "ai"].includes(item.kind));
    const upcomingExam = allSchoolPlanEvents()
      .filter((event) => {
        const date = event.startDate || event.date || event.endDate || "";
        return date >= todayKey() && /시험|고사|평가/i.test(event.title || "");
      })
      .sort((a, b) => String(a.startDate || a.date || a.endDate).localeCompare(String(b.startDate || b.date || b.endDate)))[0];
    const rows = [
      ...todayItems.filter((item) => !item.done).slice(0, 2).map((item) => ({
        label: item.activityId ? "내 준비" : item.kind === "ai" ? "AI 계획" : "체크리스트",
        title: item.title,
        meta: `${item.minutes || 30}분`,
      })),
      ...(upcomingExam ? [{
        label: "시험",
        title: upcomingExam.title,
        meta: upcomingExam.startDate || upcomingExam.endDate,
      }] : []),
    ];
    setHomeWidget("major", rows.length
      ? rows.slice(0, 3).map((item) => `<article class="home-widget-row"><span>${escapeHtml(item.label)}</span><div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.meta)}</small></div></article>`).join("")
      : homeWidgetEmpty("체크리스트나 시험 일정을 추가해 보세요."));

    const book = snapshot.bookRecommendations?.[0];
    setHomeWidget("books", book
      ? `<article class="home-feature-preview"><span>${escapeHtml(book.category || "추천 도서")}</span><strong>${escapeHtml(book.title)}</strong><p>${escapeHtml(book.reason || "학습 주제에 맞춰 추천한 책입니다.")}</p></article>`
      : homeWidgetEmpty("주제를 입력해 첫 도서를 추천받아 보세요."));

    const note = snapshot.notes?.[0];
    setHomeWidget("notes", note
      ? `<article class="home-feature-preview"><span>${escapeHtml(note.subject || "공부 노트")} · ${escapeHtml(note.unit || "개념 정리")}</span><strong>${escapeHtml(note.summary || note.text || "저장된 필기")}</strong>${Array.isArray(note.keywords) && note.keywords.length ? `<p>${note.keywords.slice(0, 4).map((word) => `#${escapeHtml(word)}`).join(" ")}</p>` : ""}</article>`
      : homeWidgetEmpty("공부한 내용을 적으면 최근 필기가 여기에 표시됩니다."));

    const profile = snapshot.profile || {};
    const grades = window.PrimeEduGradeChart?.getRecords?.() || [];
    const average = grades.length
      ? Math.round((grades.reduce((sum, item) => sum + Number(item.score || 0), 0) / grades.length) * 10) / 10
      : null;
    setHomeWidget("status", `<div class="home-status-grid">
      <article><strong>${Number(profile.studyMinutes || 0)}분</strong><span>누적 학습</span></article>
      <article><strong>${Number(profile.completion || 0)}%</strong><span>계획 달성</span></article>
      <article><strong>${Number(profile.accuracy || 0)}%</strong><span>문제 정답률</span></article>
      <article><strong>${average === null ? "—" : `${average}점`}</strong><span>평균 성적</span></article>
    </div>`);
  }

  function inferSubject(text) {
    const value = String(text || "");
    if (/수학|함수|방정식|기하|확률/.test(value)) return "수학";
    if (/영어|문법|독해|단어/.test(value)) return "영어";
    if (/과학|물리|화학|생물|지구과학/.test(value)) return "과학";
    if (/국어|문학|비문학|작문/.test(value)) return "국어";
    if (/사회|역사|지리|도덕/.test(value)) return "사회";
    return "학습";
  }

  function showEditor(id) {
    if (["#studyNoteEditor", "#studyQuizEditor"].includes(id)) window.SchemsStudyAI?.openNotebookLibrary?.();
    const editor = $(id);
    if (!editor) return;
    editor.hidden = false;
    const trigger = document.querySelector(`[data-ai-collapse="${id.replace(/^#/, "")}"]`);
    trigger?.setAttribute("aria-expanded", "true");
  }

  function addDaysKey(days) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return toDateKey(date);
  }

  function openHomeRoute(route) {
    if (route === "plan") {
      selectTab("plan");
      requestAnimationFrame(() => $("#manualChecklistTitle")?.focus());
    } else if (route === "books") {
      window.PrimeEduAI?.openCategory?.("books");
    } else if (route === "notes") {
      window.PrimeEduAI?.openCategory?.("notes", "workspace");
    } else if (route === "progress") {
      selectTab("progress");
    }
  }

  function handleModuleAction(action = {}) {
    const type = String(action.type || "");
    const prompt = String(action.prompt || "").trim();
    if (!type) return;

    if (type === "exam-strategy") {
      selectTab("plan");
      window.setTimeout(() => {
        $("#examStrategyName").value = `${inferSubject(prompt)} 시험 전략`;
        $("#examStrategyDate").value = "";
        $("#examStrategySubjects").value = prompt;
        $("#examStrategyWeakness").value = prompt;
        window.dispatchEvent(new CustomEvent('prime:journey-open', {detail:'exam'}));
      }, 120);
      return;
    }

    if (type === "study-plan") {
      selectTab("plan");
      window.setTimeout(() => {
        $("#studyGoal").value = prompt || "이번 주 학습 계획";
        const intent = window.PrimePlanPolicy.intent(prompt);
        $("#studyPlanMode").value = intent.mode;
        $("#studyPlanSelectedDate").value = intent.selectedDate;
        if (intent.availableMinutes) $("#studyAvailableMinutes").value = intent.availableMinutes;
        $("#studyPlanMode").dispatchEvent(new Event('change', {bubbles:true}));
        window.dispatchEvent(new Event('prime:controls-sync'));
        window.dispatchEvent(new CustomEvent('prime:journey-open', {detail:'plan'}));
      }, 120);
      return;
    }

    if (type === "concept-note") {
      window.PrimeEduAI?.openCategory?.("notes", "workspace");
      window.setTimeout(() => {
        showEditor("#studyNoteEditor");
        $("#studyNoteSubject").value = inferSubject(prompt);
        $("#studyNoteText").value = prompt;
        $("#studyNoteForm")?.requestSubmit();
      }, 180);
      return;
    }

    if (type === "quiz") {
      window.PrimeEduAI?.openCategory?.("notes", "workspace");
      window.setTimeout(() => {
        showEditor("#studyQuizEditor");
        $("#quizSubject").value = inferSubject(prompt);
        $("#quizUnit").value = "질문에서 가져온 내용";
        $("#quizNoteText").value = prompt;
        $("#studyQuizForm")?.requestSubmit();
      }, 180);
      return;
    }

    if (type === "books") {
      window.PrimeEduAI?.openCategory?.("books");
      window.setTimeout(() => {
        $("#studyBookTopic").value = prompt;
        $("#studyBookForm")?.requestSubmit();
      }, 180);
      return;
    }

    if (type === "progress") {
      selectTab("progress");
      return;
    }

    if (type === "pomodoro") {
      selectTab("home");
      window.setTimeout(() => document.querySelector('[data-home-block="pomodoro"]')?.scrollIntoView({ behavior: "auto", block: "center" }), 100);
    }
  }

  function allPersonalEvents(from,to) {
    const remote = getPersonalEvents(from,to).map((event) => ({ ...event, source: event.source==='consultation'?'consultation':"remote" }));
    return [...remote, ...localPlanEvents.map((event) => ({ ...event, source: "local" }))];
  }

  function allSchoolPlanEvents() {
    return getSchoolEvents().map((event) => ({ ...event, source: "school" }));
  }

  function planItemsForDate(key) {
    const personal = allPersonalEvents(key,key)
      .filter((event) => event.date === key)
      .map((event) => ({
        key: `personal:${event.source}:${event.id}`,
        id: event.id,
        kind: event.category === "checklist" ? "checklist" : "personal",
        source: event.source,
        title: event.title || (event.category === "checklist" ? "할 일" : "개인 일정"),
        description: event.memo || (event.category === "checklist" ? "오늘 업무" : "개인 일정"),
        start:event.start||'',recurring:event.source==='consultation',
        minutes: Number(event.minutes || 30),
        difficulty: String(event.difficulty || "medium"),
        done: Boolean(planChecks[`personal:${event.source}:${event.id}`]),
      }));
    const tasks = (getStudySnapshot().tasks || [])
      .flatMap(task => task.activity ? (Array.isArray(task.activity.blocks)&&Array.isArray(task.activity.steps)?task.activity.blocks.map(block => ({...task,date:block.date,minutes:block.minutes,done:block.state==='done',activityBlockId:block.id,activityBlockStart:block.start,title:`${task.title} · ${task.activity.steps.find(step=>step.id===block.stepId)?.title||'준비'}`})):[]) : [task])
      .filter((task) => (task.date || todayKey()) === key)
      .map((task) => ({
        key: `ai:${task.id}${task.activityBlockId ? ':'+task.activityBlockId : ''}`,
        id: task.id,
        kind: "ai",
        source: "ai",
        reviewQuizId: task.source === "review" ? task.reviewQuizId : "",
        activityId: task.activity ? task.id : "",
        activityStart: task.activityBlockStart || "",
        title: task.title || "AI 학습 루틴",
        description: `${task.subject || "학습"} · ${task.minutes || 30}분`,
        minutes: Number(task.minutes || 30),
        difficulty: String(task.difficulty || "medium"),
        done: Boolean(task.done),
      }));
    const school = allSchoolPlanEvents()
      .filter((event) => eventOccursOn(event, key))
      .map((event) => ({
        key: `school:${event.id}`,
        id: event.id,
        kind: "school",
        source: "school",
        title: event.title || "학사일정",
        description: event.type || "학교 일정",
        done: false,
      }));
    const weights = { hard: 3, medium: 2, easy: 1 };
    const prioritized = [...personal, ...tasks].sort((a, b) => {
      if(a.start&&b.start)return a.start.localeCompare(b.start);
      if(a.activityId&&b.activityId)return a.activityStart.localeCompare(b.activityStart);
      const aScore = (weights[a.difficulty] || 2) * 100 + Math.min(a.minutes || 30, 360);
      const bScore = (weights[b.difficulty] || 2) * 100 + Math.min(b.minutes || 30, 360);
      return bScore - aScore;
    });
    return [...school, ...prioritized];
  }

  function difficultyLabel(value) {
    return value === "hard" ? "어려움" : value === "easy" ? "쉬움" : "보통";
  }

  function formatPlanDate(key) {
    const date = new Date(`${key}T00:00:00`);
    return new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", weekday: "long" }).format(date);
  }

  function checklistRowsHtml(actionableItems, compact = false) {
    return actionableItems.length
      ? actionableItems.map((item, index) => `<article class="daily-check-item ${item.done ? "is-done" : ""}">
          <label class="daily-check-main">
            <input type="checkbox" data-plan-check="${escapeHtml(item.key)}" data-plan-kind="${item.kind}" data-plan-id="${escapeHtml(item.id)}" ${item.done ? "checked" : ""} ${item.activityId ? 'disabled aria-label="준비 실행에서 진행 결과 기록"' : ''} />
            <span class="daily-check-control" aria-hidden="true"></span>
            <span class="daily-check-copy">
              <strong>${escapeHtml(item.title)}</strong>
              <small><span class="daily-kind ${item.kind}">${item.activityId ? "내 준비" : item.reviewQuizId ? "복습" : index === 0 && !item.done ? "우선" : item.kind === "ai" ? "AI 계획" : "체크리스트"}</span>${item.activityStart ? escapeHtml(item.activityStart)+' · ' : ''}${item.minutes || 30}분 · ${difficultyLabel(item.difficulty)}</small>
            </span>
          </label>
          ${item.reviewQuizId && !item.done ? `<button type="button" class="icon-btn pressable" data-start-review-quiz="${escapeHtml(item.reviewQuizId)}" aria-label="${escapeHtml(item.title)} 시작">${window.PrimeUI.svg('play')}</button>` : ""}
          ${item.activityId ? `<button type="button" class="icon-btn pressable" data-open-activity="${escapeHtml(item.activityId)}" aria-label="${escapeHtml(item.title)} 준비 열기">${window.PrimeUI.svg('arrow')}</button>` : ""}
          ${compact || item.activityId ? "" : `<div class="daily-check-actions">
            ${item.kind === "checklist" ? `<button class="daily-check-edit" type="button" data-plan-edit-checklist="${escapeHtml(item.id)}" data-plan-edit-source="${escapeHtml(item.source)}">수정</button>` : ""}
            <button class="daily-check-delete" type="button" data-plan-delete="${escapeHtml(item.id)}" data-plan-delete-kind="${item.kind}" data-plan-delete-source="${escapeHtml(item.source)}" aria-label="${escapeHtml(item.title)} 삭제">삭제</button>
          </div>`}
        </article>`).join("")
      : `<div class="planner-empty"><p>아직 할 일이 없어요</p><button type="button" class="btn" data-ui-keep-label data-journey="checklist" aria-label="할 일 추가">할 일 추가</button></div>`;
  }

  function renderPlannerDay() {
    const title = $("#plannerSelectedDateTitle");
    const quickDate = $("#plannerQuickDate");
    const checklistDate = $("#manualChecklistDate");
    if (title) title.textContent = formatPlanDate(selectedPlanDate);
    const planSelectedDate = $("#studyPlanSelectedDate");
    if (planSelectedDate) planSelectedDate.value = selectedPlanDate;
    if (quickDate) quickDate.value = selectedPlanDate;
    if (checklistDate) checklistDate.value = selectedPlanDate;
    const actionableItems = planItemsForDate(selectedPlanDate).filter((item) => item.kind === "checklist" || item.kind === "ai");
    const done = actionableItems.filter((item) => item.done).length;
    const progress = actionableItems.length ? Math.round((done / actionableItems.length) * 100) : 0;
    if ($("#dailyChecklistProgress")) { $("#dailyChecklistProgress").textContent = `${done}/${actionableItems.length}`; $("#dailyChecklistProgress").hidden = !actionableItems.length; }
    const checklistCard = $('.planner-checklist-card');
    if (checklistCard) checklistCard.dataset.empty = String(!actionableItems.length);
    if ($("#dailyProgressBar")) $("#dailyProgressBar").style.width = `${progress}%`;
    if ($("#dailyChecklist")) $("#dailyChecklist").innerHTML = checklistRowsHtml(actionableItems);
    if ($("#homeChecklistWidget")) $("#homeChecklistWidget").innerHTML = checklistRowsHtml(
      planItemsForDate(todayKey()).filter((item) => item.kind === "checklist" || item.kind === "ai").slice(0, 5),
      true,
    );
  }

  function renderPlannerCalendarSynced() {
    const grid = $("#plannerCalendarGrid");
    if (!grid) return;
    const year = plannerCursor.getFullYear();
    const month = plannerCursor.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();
    const monthTitle = $("#plannerMonthTitle");
    if (monthTitle) monthTitle.textContent = `${year}년 ${month + 1}월`;
    const blanks = Array.from({ length: firstDay }, () => `<span class="planner-day-blank" aria-hidden="true"></span>`).join("");
    const days = Array.from({ length: lastDate }, (_, index) => {
      const day = index + 1;
      const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const items = planItemsForDate(key);
      const schoolCount = items.filter((item) => item.kind === "school").length;
      const personalCount = items.filter((item) => item.kind === "personal").length;
      const checklistCount = items.filter((item) => item.kind === "checklist").length;
      const aiCount = items.filter((item) => item.kind === "ai").length;
      const actionableItems = items.filter((item) => item.kind === "checklist" || item.kind === "ai");
      const doneCount = actionableItems.filter((item) => item.done).length;
      const primary = items[0];
      const previewTitle = primary ? window.PrimeCalendarView?.shortTitle(primary.title) || primary.title : "";
      const previewText = window.PrimeCalendarView?.previewText?.(previewTitle) || previewTitle;
      const classes = ["planner-day", key === todayKey() ? "is-today" : "", key === selectedPlanDate ? "is-selected" : "", actionableItems.length && doneCount === actionableItems.length ? "is-complete" : ""].filter(Boolean).join(" ");
      const labels = [
        schoolCount ? `학사일정 ${schoolCount}개` : "",
        personalCount ? `이벤트 ${personalCount}개` : "",
        checklistCount + aiCount ? `오늘 업무 ${checklistCount + aiCount}개` : "",
      ].filter(Boolean).join(", ");
      return `<button type="button" class="${classes}" data-plan-date="${key}" data-weekday="${new Date(year,month,day).getDay()}" aria-label="${month + 1}월 ${day}일${labels ? `, ${labels}` : ""}${primary ? `, ${escapeHtml(primary.title)}` : ""}${actionableItems.length ? `, ${doneCount}/${actionableItems.length} 완료` : ""}">
        <time datetime="${key}">${day}</time>
        <span class="planner-day-items">
          ${primary ? `<span class="planner-event ${primary.kind === 'school' ? 'school' : primary.kind === 'personal' ? 'personal' : 'checklist'}" data-calendar-tone="${primary.kind === 'school' ? window.PrimeTimetable?.classify(primary.title)||'school' : primary.kind}" title="${escapeHtml(primary.title)}">${escapeHtml(previewText)}</span>` : ""}
        </span>
        <span class="planner-day-meta">${items.length > 1 ? `<span class="planner-day-more" title="추가 일정 ${items.length - 1}개">${window.PrimeCalendarView?.moreLabel(items.length - 1) || `+${items.length - 1}`}</span>` : ""}${actionableItems.length ? `<span class="planner-day-progress" title="${doneCount}/${actionableItems.length} 완료">${window.PrimeCalendarView?.progressLabel(doneCount, actionableItems.length) || `${doneCount}/${actionableItems.length}`}</span>` : ""}</span>
      </button>`;
    }).join("");
    grid.innerHTML = blanks + days;
  }

  function renderPlanner() {
    renderPlannerCalendarSynced();
    renderPlannerDay();
    if ($("#plannerEventModal")?.classList.contains("is-open")) renderPlannerModalDetails();
  }

  function renderPlannerModalDetails() {
    const items = planItemsForDate(selectedPlanDate);
    const tasks = items.filter((item) => item.kind === "checklist" || item.kind === "ai");
    const events = items.filter((item) => item.kind === "personal" || item.kind === "school");
    const taskList = $("#plannerDayTaskList");
    const eventList = $("#plannerDayEventList");

    if (taskList) {
      taskList.innerHTML = tasks.length
        ? tasks.map((item) => `<article class="planner-detail-row task ${item.done ? "is-done" : ""}">
            <label class="planner-detail-check">
              <input type="checkbox" data-plan-check="${escapeHtml(item.key)}" data-plan-kind="${item.kind}" data-plan-id="${escapeHtml(item.id)}" ${item.done ? "checked" : ""} ${item.activityId ? 'disabled aria-label="준비 실행에서 진행 결과 기록"' : ''} />
              <span aria-hidden="true"></span>
              <div><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.description)}</p></div>
            </label>
            ${item.activityId ? `<button class="planner-row-action" type="button" data-open-activity="${escapeHtml(item.activityId)}" aria-label="${escapeHtml(item.title)} 준비 열기">${window.PrimeUI.svg('arrow')}</button>` : `<button class="planner-row-action danger" type="button" data-plan-delete="${escapeHtml(item.id)}" data-plan-delete-kind="${item.kind}" data-plan-delete-source="${escapeHtml(item.source)}">삭제</button>`}
          </article>`).join("")
        : `<div class="planner-detail-empty">등록된 오늘 업무가 없습니다.</div>`;
    }

    if (eventList) {
      eventList.innerHTML = events.length
        ? events.map((item) => `<article class="planner-detail-row event">
            <span class="planner-detail-kind ${item.kind}">${item.kind === "school" ? "학사" : item.recurring?'학원':"이벤트"}</span>
            <div class="planner-detail-copy"><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.description)}</p></div>
            ${item.kind === 'school' ? `<button type="button" class="btn pressable prime-icon-button" data-activity-source-event="${escapeHtml(item.id)}" aria-label="${escapeHtml(item.title)} 내 준비에 연결" title="내 준비에 연결">${window.PrimeUI.svg('arrow')}</button>` : ''}
            ${item.recurring?`<button class="planner-row-action" type="button" data-edit-academy aria-label="${escapeHtml(item.title)} 주간 시간표 수정">${window.PrimeUI.svg('edit')}</button>`:''}
            ${item.kind === "personal"&&!item.recurring ? `<div class="planner-row-actions">
              <button class="planner-row-action" type="button" data-plan-edit="${escapeHtml(item.id)}" data-plan-edit-source="${escapeHtml(item.source)}">수정</button>
              <button class="planner-row-action danger" type="button" data-plan-delete="${escapeHtml(item.id)}" data-plan-delete-kind="personal" data-plan-delete-source="${escapeHtml(item.source)}">삭제</button>
            </div>` : ""}
          </article>`).join("")
        : `<div class="planner-detail-empty">등록된 이벤트가 없습니다.</div>`;
    }
  }

  function resetPlannerEventEditor() {
    const form = $("#plannerQuickAddForm");
    form?.reset();
    if ($("#plannerQuickDate")) $("#plannerQuickDate").value = selectedPlanDate;
    if ($("#plannerQuickEventId")) $("#plannerQuickEventId").value = "";
    if ($("#plannerQuickEventSource")) $("#plannerQuickEventSource").value = "";
    if ($("#plannerQuickSubmitButton")) $("#plannerQuickSubmitButton").textContent = "이벤트 추가";
    if ($("#plannerQuickCancelEdit")) $("#plannerQuickCancelEdit").hidden = true;
  }

  function beginPlannerEventEdit(eventId, source) {
    const target = allPersonalEvents().find((item) => item.id === eventId && item.source === source);
    if (!target || target.category === "checklist") return;
    $("#plannerQuickEventId").value = target.id;
    $("#plannerQuickEventSource").value = target.source;
    $("#plannerQuickDate").value = target.date;
    $("#plannerQuickTitle").value = target.title || "";
    $("#plannerQuickMemo").value = target.memo || "";
    $("#plannerQuickSubmitButton").textContent = "변경사항 저장";
    $("#plannerQuickCancelEdit").hidden = false;
    window.dispatchEvent(new CustomEvent('prime:journey-open',{detail:'event'}));
    $("#plannerQuickTitle").focus();
  }

  async function deletePlannerItem(itemId, kind, source) {
    if(source==='consultation')throw Error('학원 일정은 주간 시간표에서 수정해주세요.');
    if (kind === "ai") {
      await window.SchemsStudyAI?.deleteTask?.(itemId);
    } else if (source === "remote") {
      const hub = window.ClassHubFirebase;
      const user = hub?.getCurrentUser?.();
      if (!user?.uid) throw new Error("로그인이 필요합니다.");
      await hub.deletePersonalEvent(user.uid, itemId);
    } else {
      localPlanEvents = localPlanEvents.filter((item) => item.id !== itemId);
      localStorage.setItem(LOCAL_PLAN_KEY, JSON.stringify(localPlanEvents));
    }
    delete planChecks[`personal:${source}:${itemId}`];
    localStorage.setItem(PLAN_CHECK_KEY, JSON.stringify(planChecks));
    renderPlanner();
    renderPrivacyInsights();
  }

  async function addChecklistItem(title, date = selectedPlanDate, options = {}) {
    const cleanTitle = String(title || "").trim();
    const cleanDate = String(date || selectedPlanDate || todayKey());
    const minutes = Math.max(5, Math.min(360, Number(options.minutes || 30)));
    const difficulty = ["easy", "medium", "hard"].includes(options.difficulty) ? options.difficulty : "medium";
    if (!cleanTitle) throw new Error("할 일을 입력하세요.");
    const hub = window.ClassHubFirebase;
    const user = hub?.getCurrentUser?.();
    if (user?.uid && hub?.addPersonalEvent) {
      await hub.addPersonalEvent(user.uid, {
        title: cleanTitle,
        date: cleanDate,
        memo: "",
        category: "checklist",
        minutes,
        difficulty,
      });
    } else {
      localPlanEvents = [{
        id: `local-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        title: cleanTitle,
        date: cleanDate,
        memo: "",
        category: "checklist",
        minutes,
        difficulty,
        createdAt: new Date().toISOString(),
      }, ...localPlanEvents].slice(0, 200);
      localStorage.setItem(LOCAL_PLAN_KEY, JSON.stringify(localPlanEvents));
    }
    selectedPlanDate = cleanDate;
    renderPlanner();
    window.dispatchEvent(new CustomEvent("schems:planner-data"));
    return true;
  }

  async function updateChecklistItem(itemId, source, payload) {
    const title = String(payload.title || "").trim();
    const date = String(payload.date || selectedPlanDate);
    const minutes = Math.max(5, Math.min(360, Number(payload.minutes || 30)));
    const difficulty = ["easy", "medium", "hard"].includes(payload.difficulty) ? payload.difficulty : "medium";
    if (!title) throw new Error("할 일을 입력하세요.");
    if (source === "remote") {
      const hub = window.ClassHubFirebase;
      const user = hub?.getCurrentUser?.();
      if (!user?.uid) throw new Error("로그인이 필요합니다.");
      await hub.updatePersonalEvent(user.uid, itemId, { title, date, memo: "", category: "checklist", minutes, difficulty });
    } else {
      localPlanEvents = localPlanEvents.map((item) => item.id === itemId
        ? { ...item, title, date, minutes, difficulty, updatedAt: new Date().toISOString() }
        : item);
      localStorage.setItem(LOCAL_PLAN_KEY, JSON.stringify(localPlanEvents));
    }
    selectedPlanDate = date;
    renderPlanner();
    window.dispatchEvent(new CustomEvent("schems:planner-data"));
    return true;
  }

  function getChecklistItems(date = selectedPlanDate) {
    return planItemsForDate(date)
      .filter((item) => item.kind === "checklist" || item.kind === "ai")
      .map((item) => ({ ...item }));
  }

  async function toggleChecklistItem(itemKey, done) {
    const item = planItemsForDate(selectedPlanDate).find((entry) => entry.key === itemKey)
      || getChecklistItems($("#utilityChecklistDate")?.value || selectedPlanDate).find((entry) => entry.key === itemKey);
    if (!item) return false;
    if (item.kind === "ai") {
      window.SchemsStudyAI?.setTaskDone?.(item.id, done);
    } else {
      planChecks[item.key] = Boolean(done);
      localStorage.setItem(PLAN_CHECK_KEY, JSON.stringify(planChecks));
    }
    renderPlanner();
    renderPrivacyInsights();
    window.dispatchEvent(new CustomEvent("schems:planner-data"));
    return true;
  }

  async function deleteChecklistItem(itemKey) {
    const date = $("#utilityChecklistDate")?.value || selectedPlanDate;
    const item = getChecklistItems(date).find((entry) => entry.key === itemKey);
    if (!item) return false;
    await deletePlannerItem(item.id, item.kind, item.source);
    window.dispatchEvent(new CustomEvent("schems:planner-data"));
    return true;
  }

  function handlePlannerCheckChange(event) {
    const checkbox = event.target.closest("[data-plan-check]");
    if (!checkbox) return;
    if (checkbox.dataset.planKind === "ai") {
      window.SchemsStudyAI?.setTaskDone?.(checkbox.dataset.planId, checkbox.checked);
    } else {
      planChecks[checkbox.dataset.planCheck] = checkbox.checked;
      localStorage.setItem(PLAN_CHECK_KEY, JSON.stringify(planChecks));
    }
    renderPlanner();
    renderPrivacyInsights();
  }

  async function handlePlannerDeleteClick(event) {
    const button = event.target.closest("[data-plan-delete]");
    if (!button) return;
    if (!confirm("이 항목을 삭제할까요?")) return;
    try {
      await deletePlannerItem(
        button.dataset.planDelete,
        button.dataset.planDeleteKind,
        button.dataset.planDeleteSource,
      );
    } catch (error) {
      alert(error?.message || "항목을 삭제하지 못했습니다.");
    }
  }

  function handleChecklistEditClick(event) {
    const button = event.target.closest("[data-plan-edit-checklist]");
    if (!button) return;
    const item = getChecklistItems(selectedPlanDate).find((entry) =>
      entry.id === button.dataset.planEditChecklist && entry.source === button.dataset.planEditSource
    );
    if (!item) return;
    $("#manualChecklistEditId").value = item.id;
    $("#manualChecklistEditSource").value = item.source;
    $("#manualChecklistTitle").value = item.title;
    $("#manualChecklistDate").value = selectedPlanDate;
    $("#manualChecklistMinutes").value = item.minutes || 30;
    $("#manualChecklistDifficulty").value = item.difficulty || "medium";
    window.dispatchEvent(new Event('prime:controls-sync'));
    $("#manualChecklistSubmit").textContent = "수정 저장";
    $("#manualChecklistCancelEdit").hidden = false;
    window.dispatchEvent(new CustomEvent('prime:journey-open',{detail:'checklist'}));
    $("#manualChecklistTitle").focus();
  }

  function resetChecklistEditor(date = selectedPlanDate) {
    $("#manualChecklistForm")?.reset();
    if ($("#manualChecklistDate")) $("#manualChecklistDate").value = date;
    if ($("#manualChecklistMinutes")) $("#manualChecklistMinutes").value = "30";
    if ($("#manualChecklistDifficulty")) $("#manualChecklistDifficulty").value = "medium";
    if ($("#manualChecklistEditId")) $("#manualChecklistEditId").value = "";
    if ($("#manualChecklistEditSource")) $("#manualChecklistEditSource").value = "";
    if ($("#manualChecklistSubmit")) $("#manualChecklistSubmit").textContent = "추가";
    if ($("#manualChecklistCancelEdit")) $("#manualChecklistCancelEdit").hidden = true;
    window.dispatchEvent(new Event('prime:controls-sync'));
  }

  function setPlannerEventModal(open, date = selectedPlanDate) {
    const modal = $("#plannerEventModal");
    if (!modal) return;
    if (open) {
      selectedPlanDate = date || selectedPlanDate;
      const quickDate = $("#plannerQuickDate");
      const label = $("#plannerEventDateLabel");
      const title = $("#plannerEventModalTitle");
      const monthLabel = $("#plannerEventMonthLabel");
      const dayLabel = $("#plannerEventDayLabel");
      const status = $("#plannerQuickStatus");
      const dateValue = new Date(`${selectedPlanDate}T00:00:00`);
      if (quickDate) quickDate.value = selectedPlanDate;
      if (label) label.textContent = formatPlanDate(selectedPlanDate);
      if (title) title.textContent = `${dateValue.getMonth() + 1}월 ${dateValue.getDate()}일 계획`;
      if (monthLabel) monthLabel.textContent = `${dateValue.getMonth() + 1}월`;
      if (dayLabel) dayLabel.textContent = String(dateValue.getDate());
      if (status) {
        status.textContent = "";
        status.className = "status-text";
      }
      resetPlannerEventEditor();
      renderPlannerModalDetails();
      modal.classList.add("is-open");
      modal.setAttribute("aria-hidden", "false");
      document.body.classList.add("modal-open");
      return;
    }
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
  }

  $("#plannerPrevMonth")?.addEventListener("click", () => {
    plannerCursor = new Date(plannerCursor.getFullYear(), plannerCursor.getMonth() - 1, 1);
    renderPlannerCalendarSynced();
  });
  $("#plannerNextMonth")?.addEventListener("click", () => {
    plannerCursor = new Date(plannerCursor.getFullYear(), plannerCursor.getMonth() + 1, 1);
    renderPlannerCalendarSynced();
  });
  $("#plannerAddTodayButton")?.addEventListener("click", () => {
    const today = new Date();
    selectedPlanDate = todayKey();
    plannerCursor = new Date(today.getFullYear(), today.getMonth(), 1);
    renderPlanner();
    setPlannerEventModal(true, selectedPlanDate);
  });
  $("#plannerAddSelectedButton")?.addEventListener("click", () => setPlannerEventModal(true, selectedPlanDate));
  $("#closePlannerEventModal")?.addEventListener("click", () => setPlannerEventModal(false));
  $("#plannerEventModal")?.addEventListener("click", (event) => {
    if (event.target.id === "plannerEventModal") setPlannerEventModal(false);
  });
  $("#plannerCalendarGrid")?.addEventListener("click", (event) => {
    const day = event.target.closest("[data-plan-date]");
    if (!day) return;
    selectedPlanDate = day.dataset.planDate;
    renderPlanner();
    setPlannerEventModal(true, selectedPlanDate);
  });

  $("#manualChecklistForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const title = $("#manualChecklistTitle")?.value.trim();
    const date = $("#manualChecklistDate")?.value || selectedPlanDate;
    const minutes = Number($("#manualChecklistMinutes")?.value || 30);
    const difficulty = $("#manualChecklistDifficulty")?.value || "medium";
    const editId = $("#manualChecklistEditId")?.value;
    const editSource = $("#manualChecklistEditSource")?.value;
    const status = $("#manualChecklistStatus");
    if (!title) return;
    if (status) { status.className = "status-text"; status.textContent = editId ? "체크리스트를 수정하고 있습니다." : "체크리스트를 저장하고 있습니다."; }
    try {
      if (editId) await updateChecklistItem(editId, editSource, { title, date, minutes, difficulty });
      else await addChecklistItem(title, date, { minutes, difficulty });
      resetChecklistEditor(date);
      if (status) {
        status.textContent = editId ? "체크리스트를 수정했습니다." : "체크리스트에 추가했습니다.";
        status.className = "status-text ok";
      }
    } catch (error) {
      if (status) {
        status.textContent = error?.message || "체크리스트를 저장하지 못했습니다.";
        status.className = "status-text error";
      }
    }
  });
  $("#manualChecklistCancelEdit")?.addEventListener("click", () => resetChecklistEditor());

  $("#plannerQuickAddForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const title = $("#plannerQuickTitle")?.value.trim();
    const memo = $("#plannerQuickMemo")?.value.trim();
    const date = $("#plannerQuickDate")?.value || selectedPlanDate;
    const eventId = $("#plannerQuickEventId")?.value;
    const eventSource = $("#plannerQuickEventSource")?.value;
    const status = $("#plannerQuickStatus");
    if (!title) return;
    if (status) { status.className = "status-text"; status.textContent = eventId ? "이벤트를 수정하고 있어요." : "이벤트를 저장하고 있어요."; }
    try {
      const hub = window.ClassHubFirebase;
      const user = hub?.getCurrentUser?.();
      if (eventId && eventSource === "remote" && user?.uid && hub?.updatePersonalEvent) {
        await hub.updatePersonalEvent(user.uid, eventId, { title, memo, date, category: "event" });
      } else if (eventId && eventSource === "local") {
        localPlanEvents = localPlanEvents.map((item) => item.id === eventId ? { ...item, title, memo, date, category: "event" } : item);
        localStorage.setItem(LOCAL_PLAN_KEY, JSON.stringify(localPlanEvents));
      } else if (user?.uid && hub?.addPersonalEvent) {
        await hub.addPersonalEvent(user.uid, { title, memo, date, category: "event" });
      } else {
        localPlanEvents = [{ id: `local-${Date.now()}`, title, memo, date, category: "event", createdAt: new Date().toISOString() }, ...localPlanEvents].slice(0, 200);
        localStorage.setItem(LOCAL_PLAN_KEY, JSON.stringify(localPlanEvents));
      }
      form?.reset();
      resetPlannerEventEditor();
      if (status) {
        status.textContent = eventId ? "이벤트를 수정했습니다." : "이벤트를 추가했습니다.";
        status.className = "status-text ok";
      }
      renderPlanner();
    } catch (error) {
      if (status) {
        status.textContent = error?.message || "일정을 저장하지 못했습니다.";
        status.className = "status-text error";
      }
    }
  });

  $("#plannerQuickCancelEdit")?.addEventListener("click", resetPlannerEventEditor);
  $("#dailyChecklist")?.addEventListener("change", handlePlannerCheckChange);
  $("#dailyChecklist")?.addEventListener("click", (event) => {
    handleChecklistEditClick(event);
    handlePlannerDeleteClick(event);
  });
  $("#homeChecklistWidget")?.addEventListener("change", handlePlannerCheckChange);
  $("[data-open-plan-tab]")?.addEventListener("click", () => selectTab("plan"));
  $("#plannerDayTaskList")?.addEventListener("change", handlePlannerCheckChange);
  $("#plannerDayTaskList")?.addEventListener("click", handlePlannerDeleteClick);
  $("#plannerDayEventList")?.addEventListener("click", (event) => {
    const editButton = event.target.closest("[data-plan-edit]");
    if (editButton) {
      beginPlannerEventEdit(editButton.dataset.planEdit, editButton.dataset.planEditSource);
      return;
    }
    handlePlannerDeleteClick(event);
  });
  window.addEventListener('prime:planner-open-date',event=>{const date=String(event.detail||'');if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return;selectedPlanDate=date;plannerCursor=new Date(date+'T12:00:00');renderPlanner();setPlannerEventModal(true,date);});

  function lastSevenDays() {
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - index));
      return { key: toDateKey(date), label: new Intl.DateTimeFormat("ko-KR", { weekday: "short" }).format(date) };
    });
  }

  function renderPrivacyInsights() {
    const snapshot = getStudySnapshot();
    const profile = snapshot.profile || { completion: 0, accuracy: 0, studyMinutes: 0 };
    const completion = $("#privacyCompletionRate");
    const accuracy = $("#privacyAccuracyRate");
    const minutes = $("#privacyStudyMinutes");
    if (completion) completion.textContent = `${Number(profile.completion || 0)}%`;
    if (accuracy) accuracy.textContent = `${Number(profile.accuracy || 0)}%`;
    if (minutes) minutes.textContent = `${Number(profile.studyMinutes || 0)}분`;

    const days = lastSevenDays().map((day) => {
      const completedTasks = (snapshot.tasks || []).filter((task) => task.done && String(task.completedAt || task.date || "").startsWith(day.key)).length;
      const sessions = (snapshot.sessions || []).filter((session) => session.date === day.key).length;
      return { ...day, value: completedTasks + sessions };
    });
    const max = Math.max(1, ...days.map((day) => day.value));
    const chart = $("#privacyWeeklyChart");
    if (chart) chart.innerHTML = days.map((day) => `
      <div class="privacy-chart-column" aria-label="${escapeHtml(day.label)} ${day.value}건">
        <span class="privacy-chart-value">${day.value}</span>
        <div class="privacy-chart-track"><span style="height:${Math.max(6, Math.round((day.value / max) * 100))}%"></span></div>
        <strong>${escapeHtml(day.label)}</strong>
      </div>`).join("");
  }

  function setPrivacyOpen(open) {
    const panel = $("#privacyInsights");
    if (!panel) return;
    if (open) renderPrivacyInsights();
    panel.hidden = !open;
    $("#settingsPrivacyButton")?.setAttribute("aria-expanded", open ? "true" : "false");
  }

  $("#settingsPrivacyButton")?.addEventListener("click", () => setPrivacyOpen($("#privacyInsights")?.hidden));
  $("#privacyInsightsClose")?.addEventListener("click", () => setPrivacyOpen(false));

  function initDraggableAiFab() {
    const wrap = $("#aiFabWrap");
    const button = $("#aiFabButton");
    const panel = $("#aiFabPanel");
    if (!wrap || !button || !panel) return;
    let drag = null;
    let suppressClick = false;
    let flight = null, flightFrame = 0, flightTime = 0, holdTimer = 0;
    let chatDocked = false, dockMode = '', dockAnimation = null;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const saved = readJson(FAB_POSITION_KEY, null);
    let desktopPosition = Number.isFinite(saved?.x) && Number.isFinite(saved?.y)
      ? { x: saved.x, y: saved.y }
      : null;
    const mobileSaved=readJson(`${FAB_POSITION_KEY}.mobile`,null);
    let mobilePosition=Number.isFinite(mobileSaved?.x)&&Number.isFinite(mobileSaved?.y)?mobileSaved:null;
    const readRatio = value => Number.isFinite(value?.rx) && Number.isFinite(value?.ry)
      ? { x: Math.max(0,Math.min(1,value.rx)), y: Math.max(0,Math.min(1,value.ry)) } : null;
    const viewportRatios = { desktop: readRatio(saved), mobile: readRatio(mobileSaved) };
    const viewportMode = () => window.innerWidth >= 1000 ? 'desktop' : 'mobile';
    const currentPosition=()=>window.innerWidth>=1000?desktopPosition:mobilePosition;
    const defaultPosition=()=>({x:window.innerWidth-button.offsetWidth-4,y:window.innerHeight-button.offsetHeight-(window.innerWidth>=1000?4:92)});

    // The drawing is inset ~8px inside the hit area; let the drawing, not the
    // invisible button box, meet the viewport wall. Most of the hit area stays visible.
    const bounds = () => {
      if(window.innerWidth>=1000)return {minX:-8,minY:-8,maxX:Math.max(-8,window.innerWidth-button.offsetWidth+8),maxY:Math.max(-8,window.innerHeight-button.offsetHeight+8)};
      const view=window.visualViewport,top=view?.offsetTop||0,bottom=top+(view?.height||window.innerHeight);
      const header=document.querySelector?.('.topbar')?.getBoundingClientRect();
      const nav=document.querySelector?.('.bottom-nav')?.getBoundingClientRect();
      // Reserve the inflated SVG silhouette, not only its invisible hit box.
      const margin=40,minY=Math.max(top+12,header?.bottom||top+64)+margin;
      const floor=Math.min(bottom-12,nav?.top||bottom-88);
      return {minX:margin,minY,maxX:Math.max(margin,window.innerWidth-button.offsetWidth-margin),maxY:Math.max(minY,floor-button.offsetHeight-margin-10)};
    };
    const clampPosition = (x, y) => {
      const b = bounds();
      return { x: Math.max(b.minX, Math.min(b.maxX, x)), y: Math.max(b.minY, Math.min(b.maxY, y)) };
    };
    const emitDrag = (phase, event, rawX, rawY) => window.dispatchEvent(new CustomEvent('prime:sudo-drag', { detail: {
      phase, time: performance.now(), pointerX: event?.clientX ?? 0, pointerY: event?.clientY ?? 0,
      rawX, rawY, ...bounds(),
    } }));
    const setPosition = (x, y, save = false) => {
      if (chatDocked) return;
      const point = clampPosition(x, y);
      let visiblePoint=point;
      if(!drag&&!flight&&!flightFrame&&window.PrimeSudoLayout){
        const controls=[...(document.querySelectorAll?.('.panel.is-active button,.panel.is-active input,.panel.is-active textarea,.panel.is-active [role="button"]')||[])].filter(n=>!n.closest('[hidden],[inert]')&&n.getClientRects().length&&getComputedStyle(n).visibility!=='hidden').map(n=>n.getBoundingClientRect()).filter(r=>r.width>1&&r.height>1);
        const view=window.visualViewport,viewport={top:view?.offsetTop||0,bottom:(view?.offsetTop||0)+(view?.height||innerHeight),width:innerWidth};
        document.querySelectorAll?.('.panel.is-active').forEach(scope=>controls.push(...(window.PrimeSudoLayout.readingRects?.(scope,viewport)||[])));
        visiblePoint=window.PrimeSudoLayout.avoidControls(point,{width:button.offsetWidth,height:button.offsetHeight},bounds(),controls);
      }
      if(visiblePoint)wrap.classList.remove('is-sudo-crowded');else wrap.classList.add('is-sudo-crowded');
      // Optical avoidance never changes the saved/desired free coordinates.
      wrap.style.left = `${(visiblePoint||point).x}px`;
      wrap.style.top = `${(visiblePoint||point).y}px`;
      wrap.style.right = "auto";
      wrap.style.bottom = "auto";
      if (window.innerWidth >= 1000) desktopPosition = point;
      else mobilePosition=point;
      const b = bounds();
      const ratio = { x: (point.x-b.minX)/Math.max(1,b.maxX-b.minX), y: (point.y-b.minY)/Math.max(1,b.maxY-b.minY) };
      viewportRatios[viewportMode()] = ratio;
      if (save) { try { localStorage.setItem(FAB_POSITION_KEY+(window.innerWidth>=1000?'':'.mobile'), JSON.stringify({...point,rx:ratio.x,ry:ratio.y})); } catch {} }
      positionPanel();
    };
    const positionPanel = () => {
      if (panel.hidden) return;
      requestAnimationFrame(() => {
        if(panel.hidden)return;
        if(window.innerWidth<1000){
          const view=window.visualViewport,height=view?.height??window.innerHeight,offset=view?.offsetTop??0;
          const layoutWidth=document.documentElement?.clientWidth || window.innerWidth;
          Object.assign(panel.style,{position:'fixed',left:'12px',top:`${offset+12}px`,right:'auto',bottom:'auto',width:`${Math.max(0,layoutWidth-24)}px`,height:`${Math.max(140,Math.min(600,height-24))}px`});return;
        }
        const anchor = button.getBoundingClientRect();
        const width = Math.min(380, window.innerWidth - 32);
        const height = Math.min(520, window.innerHeight - 32);
        const placement=window.PrimeSudoPhysics?.placeOverlay(anchor,{width,height},{width:window.innerWidth,height:window.innerHeight},{gap:20,inset:16,prefer:'top'});
        const left = placement?.x ?? Math.max(16,Math.min(window.innerWidth-width-16,anchor.left-width-20));
        const top = placement?.y ?? Math.max(16,Math.min(window.innerHeight-height-16,anchor.top));
        panel.style.position = "fixed";
        panel.style.left = `${left}px`;
        panel.style.top = `${Math.max(16, top)}px`;
        panel.style.right = "auto";
        panel.style.bottom = "auto";
        panel.style.width = `${width}px`;
        panel.style.height = `${height}px`;
      });
    };

    const stopFlight = () => {
      if (!flight && !flightFrame) return;
      cancelAnimationFrame(flightFrame); flightFrame = 0; flight = null; flightTime = 0;
      const rect = getComputedStyle(wrap).display === 'none' ? currentPosition() : wrap.getBoundingClientRect();
      if (rect) setPosition(rect.x ?? rect.left, rect.y ?? rect.top, true);
      emitDrag('settle');
    };
    const advanceFlight = (now) => {
      flightFrame = 0;
      if (!flight || document.hidden || getComputedStyle(wrap).display === 'none') { stopFlight(); return; }
      const s = flight.step(flightTime ? (now - flightTime) / 1000 : .016, bounds());
      flightTime = now;
      setPosition(s.x, s.y);
      window.dispatchEvent(new CustomEvent('prime:sudo-drag', { detail: { phase:'flight', time:now, vx:s.vx, vy:s.vy } }));
      for (const hit of s.impacts) window.dispatchEvent(new CustomEvent('prime:sudo-drag', { detail: { phase:'impact', time:now, ...hit } }));
      if (s.active) flightFrame = requestAnimationFrame(advanceFlight);
      else stopFlight();
    };

    const relativePoint = (ratio, fallback) => {
      const b = bounds();
      return ratio ? {x:b.minX+ratio.x*(b.maxX-b.minX),y:b.minY+ratio.y*(b.maxY-b.minY)} : fallback;
    };
    const restoredPoint = relativePoint(viewportRatios[viewportMode()], currentPosition() || defaultPosition());
    setPosition(restoredPoint.x,restoredPoint.y);

    button.addEventListener("pointerdown", (event) => {
      if (chatDocked || button.disabled || event.button !== 0 || drag) return;
      stopFlight();
      const rect = wrap.getBoundingClientRect();
      drag = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, left: rect.left, top: rect.top, moved: false,
        samples: [{time:performance.now(), x:event.clientX, y:event.clientY}] };
      button.setPointerCapture?.(event.pointerId);
      wrap.classList.add("is-dragging");
      emitDrag('start', event, rect.left, rect.top);
      holdTimer = setTimeout(() => { if (drag) suppressClick = true; }, 600);
    });
    window.addEventListener("pointermove", (event) => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      if (Math.hypot(dx, dy) > 5) drag.moved = true;
      if (!drag.moved) return;
      const now = performance.now();
      drag.samples.push({time:now,x:event.clientX,y:event.clientY});
      drag.samples = drag.samples.filter(s => now - s.time <= 120);
      suppressClick = true;
      setPosition(drag.left + dx, drag.top + dy);
      emitDrag('move', event, drag.left + dx, drag.top + dy);
      event.preventDefault();
    });
    const endDrag = (event) => {
      if (!drag) return;
      if (event.pointerId != null && event.pointerId !== drag.pointerId) return;
      const pointerId = drag.pointerId;
      clearTimeout(holdTimer);
      const motion = window.PrimeSudoPhysics;
      const release = drag.moved && event.type === 'pointerup' && !reducedMotion.matches && motion
        ? motion.releaseVelocity(drag.samples, performance.now()) : { vx:0, vy:0 };
      const rect = wrap.getBoundingClientRect();
      if (drag.moved) {
        setPosition(rect.left, rect.top, !release.vx && !release.vy);
      }
      drag = null;
      wrap.classList.remove("is-dragging");
      if (button.hasPointerCapture?.(pointerId)) button.releasePointerCapture(pointerId);
      emitDrag(event.type === 'pointerup' ? 'end' : 'cancel', event);
      if (release.vx || release.vy) {
        flight = motion.createFlight({x:rect.left,y:rect.top,...release});
        flightTime = performance.now();
        flightFrame = requestAnimationFrame(advanceFlight);
      }
      setTimeout(() => { suppressClick = false; }, 0);
    };
    window.addEventListener("pointerup", endDrag);
    window.addEventListener('prime:sudo-burst', () => {
      endDrag({type:'burst'}); stopFlight(); suppressClick=true;
    });
    window.addEventListener('prime:sudo-revive', event => {
      suppressClick=false;
      const b=bounds();
      const drawing=button.querySelector?.('.sudo-ai-character');
      const drawingInset=Math.max(0,((drawing?.offsetHeight||button.offsetHeight)-button.offsetHeight)/2);
      const safeY=Number.isFinite(event?.detail?.safeBottom)?event.detail.safeBottom-button.offsetHeight-drawingInset-4:b.maxY;
      setPosition(Math.min(b.maxX,window.innerWidth-button.offsetWidth-24),Math.min(b.maxY,safeY),true);
    });
    window.addEventListener("pointercancel", endDrag);
    button.addEventListener("lostpointercapture", endDrag);
    window.addEventListener("blur", event => { endDrag(event); stopFlight(); });
    document.addEventListener('visibilitychange', () => { if(document.hidden) { endDrag({type:'hidden'}); stopFlight(); } });
    reducedMotion.addEventListener('change', () => { if (reducedMotion.matches) stopFlight(); });
    button.addEventListener("dragstart", (event) => event.preventDefault());
    button.addEventListener('contextmenu', event => {
      if(wrap.classList.contains('is-dragging'))event.preventDefault();
    });
    button.addEventListener("click", (event) => {
      if (chatDocked) {
        event.preventDefault(); event.stopImmediatePropagation();
        document.querySelector(window.innerWidth < 1000 ? '#aiChatInputMobile' : '#aiChatInputHome')?.focus();
        return;
      }
      if (!suppressClick && !button.disabled) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    }, true);
    new MutationObserver(positionPanel).observe(panel, { attributes: true, attributeFilter: ["hidden"] });
    window.addEventListener("resize", () => {
      if (chatDocked) { syncChatDock(true); return; }
      // Capture before cancellation clamps to the new viewport. Otherwise a
      // portrait -> landscape -> portrait trip leaves Sudo stuck over fields.
      const ratio = viewportRatios[viewportMode()];
      const fallback = { ...(currentPosition() || defaultPosition()) };
      const interrupted = Boolean(drag || flight || flightFrame);
      if (drag) endDrag({ type: 'resize' });
      stopFlight();
      const point = relativePoint(ratio, fallback);
      setPosition(point.x,point.y,interrupted);
    });
    const visiblePosition=()=>{if(chatDocked){syncChatDock(true);return;}const p=currentPosition()||defaultPosition();setPosition(p.x,p.y);positionPanel();};
    window.visualViewport?.addEventListener('resize',visiblePosition);
    window.visualViewport?.addEventListener('scroll',visiblePosition);
    // A sticky header changes its geometry while scrolling the document.
    let boundaryFrame=0,readingSettleTimer=0;
    const refreshBoundary=()=>{if(boundaryFrame)return;boundaryFrame=requestAnimationFrame(()=>{boundaryFrame=0;visiblePosition();});};
    window.addEventListener('scroll',refreshBoundary,{passive:true});window.addEventListener('prime:notebook-content-change',refreshBoundary);
    // Async school data and chart rendering can move controls after a tab opens.
    const readingHost=document.querySelector?.('main');
    if(readingHost){
      new ResizeObserver(refreshBoundary).observe(readingHost);
      new MutationObserver(records=>{if(records.some(r=>r.target.closest?.('.panel.is-active')))refreshBoundary();}).observe(readingHost,{childList:true,subtree:true});
      readingHost.addEventListener('transitionend',refreshBoundary);
      readingHost.addEventListener('animationend',refreshBoundary);
    }

    function syncChatDock(reposition=false) {
      const nextMode=document.body?.dataset.activeTab==='home'
        ? document.body.classList.contains('mobile-home-chat-mode')?'mobile':document.body.classList.contains('desktop-home-chat-mode')?'desktop':'' : '';
      if(nextMode===dockMode&&!reposition){if(!nextMode){const p=currentPosition()||defaultPosition();setPosition(p.x,p.y);}return;}
      // Only chat has a profile dock. Other tabs keep the user's floating
      // position below the header; the brand mark is never a mascot target.
      const slot=nextMode?document.querySelector(`[data-sudo-chat-dock="${nextMode}"]`):null;
      if(nextMode&&!slot)return;
      const from=button.getBoundingClientRect();
      if(drag)endDrag({type:'dock'});stopFlight();dockAnimation?.cancel();
      const to=slot?.getBoundingClientRect();
      chatDocked=Boolean(to);dockMode=nextMode;
      document.body.classList.toggle('sudo-chat-docked',chatDocked);
      let target;
      const dockSize=to?to.width:0;
      if(to){
        // The portal follows the visual viewport; its floating profile must
        // use that same coordinate space when Safari pans for a keyboard.
        const view=nextMode==='mobile'?window.visualViewport:null;
        target={x:to.left+(view?.offsetLeft||0),y:to.top+(view?.offsetTop||0)};
        wrap.classList.remove('is-sudo-crowded');
        wrap.style.left=`${target.x}px`;wrap.style.top=`${target.y}px`;
      }
      else {const p=currentPosition()||defaultPosition();setPosition(p.x,p.y);target=currentPosition();}
      const scale=to?dockSize/Math.max(1,button.offsetWidth):1;
      wrap.style.transformOrigin='0 0';wrap.style.transform=`scale(${scale})`;
      button.setAttribute('aria-label',chatDocked?'스도에게 메시지 쓰기':'스도 AI 도우미 열기');
      // A FLIP flight keeps the old on-screen position while its layout changes.
      // Docking never saves coordinates or overwrites the user's free position.
      if(!reducedMotion.matches&&!reposition&&wrap.animate) {
        dockAnimation=wrap.animate([
          {transform:`translate(${from.left-target.x}px,${from.top-target.y}px) scale(${from.width/Math.max(1,button.offsetWidth)})`},
          {transform:`translate(0,0) scale(${scale})`}
        ],{duration:620,easing:'cubic-bezier(.22,1,.36,1)'});
        // The desktop chat surface also enters with a scale animation. Re-read
        // its settled profile slot instead of retaining its first-frame bounds.
        const move=dockAnimation;
        if(move.finished)move.finished.then(()=>{if(dockAnimation===move&&chatDocked)syncChatDock(true);}).catch(()=>{});
      }
    }
    if(document.body) {
      new MutationObserver(records=>{syncChatDock();if(records.some(r=>r.attributeName==='data-active-tab')){clearTimeout(readingSettleTimer);readingSettleTimer=setTimeout(refreshBoundary,420);}}).observe(document.body,{attributes:true,attributeFilter:['class','data-active-tab']});
      syncChatDock();
    }
  }

  function initAiWorkspace() {
    const pagesViewport = $("#aiNotebookPages");
    const categoryButtons = $$('[data-ai-category-target]:not([hidden])');
    const visibleCategories = categoryButtons.map((button) => button.dataset.aiCategoryTarget);
    const allCategoryPanels = pagesViewport ? $$('[data-ai-category-panel]', pagesViewport) : [];
    allCategoryPanels
      .filter((panel) => !visibleCategories.includes(panel.dataset.aiCategoryPanel))
      .forEach((panel) => { panel.hidden = true; });
    const categoryPanels = pagesViewport
      ? allCategoryPanels.filter((panel) => visibleCategories.includes(panel.dataset.aiCategoryPanel))
      : [];
    if (!categoryButtons.length || !categoryPanels.length || !pagesViewport) return;
    categoryPanels.forEach((panel) => { panel.hidden = false; });

    const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const aiOrder = visibleCategories;
    let deckOrder = [...aiOrder];
    let activeCategory = aiOrder[0];
    let pageTurnTimer = 0;
    let pageSettleTimer = 0;
    const updateDeckHeight = () => {
      // The active page stays in document flow. Measuring an already clipped
      // absolute page made nested notes truncate and created resize loops.
      pagesViewport.style.removeProperty("height");
      pagesViewport.style.removeProperty("--notebook-active-height");
      categoryPanels.forEach(panel => panel.style.removeProperty("--panel-page-height"));
    };

    const setActiveCategory = (category, { animate = true, direction = 1 } = {}) => {
      const previousCategory = activeCategory;
      if (!aiOrder.includes(category)) return;
      if (category !== previousCategory) {
        deckOrder = [
          category,
          ...deckOrder.filter((item) => item !== category && item !== previousCategory),
          previousCategory,
        ];
      }
      categoryButtons.forEach((button) => {
        const active = button.dataset.aiCategoryTarget === category;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-selected", String(active));
        button.tabIndex = active ? 0 : -1;
      });
      categoryPanels.forEach((panel) => {
        const active = panel.dataset.aiCategoryPanel === category;
        const stackIndex = deckOrder.indexOf(panel.dataset.aiCategoryPanel);
        panel.classList.remove(
          "is-current",
          "is-next-page",
          "is-back-page",
          "is-page-turning-left",
          "is-page-turning-right",
          "is-page-arriving",
          "is-page-settling-back",
        );
        panel.classList.add(stackIndex === 0 ? "is-current" : stackIndex === 1 ? "is-next-page" : "is-back-page");
        panel.setAttribute("aria-hidden", String(!active));
        panel.inert = !active;
      });
      if (animate && category !== previousCategory) {
        const outgoing = $(`[data-ai-category-panel="${previousCategory}"]`);
        const incoming = $(`[data-ai-category-panel="${category}"]`);
        outgoing?.classList.add(direction > 0 ? "is-page-turning-left" : "is-page-turning-right");
        incoming?.classList.add("is-page-arriving");
        window.clearTimeout(pageTurnTimer);
        window.clearTimeout(pageSettleTimer);
        pageTurnTimer = window.setTimeout(() => {
          outgoing?.classList.remove("is-page-turning-left", "is-page-turning-right");
          incoming?.classList.remove("is-page-arriving");
          outgoing?.classList.add("is-page-settling-back");
          pageSettleTimer = window.setTimeout(() => {
            outgoing?.classList.remove("is-page-settling-back");
          }, reducedMotion() ? 0 : 170);
        }, reducedMotion() ? 0 : 310);
      }
      activeCategory = category;
      requestAnimationFrame(updateDeckHeight);
    };

    const openTool = (category, tool) => {
      const panel = $(`[data-ai-category-panel="${category}"]`);
      if (!panel || !tool) return;
      const buttons = [...panel.querySelectorAll("[data-ai-tool-target]")];
      const tools = [...panel.querySelectorAll("[data-ai-tool-panel]")];
      buttons.forEach((button) => {
        const active = button.dataset.aiToolTarget === tool;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-expanded", String(active));
      });
      tools.forEach((toolPanel) => {
        const active = toolPanel.dataset.aiToolPanel === tool;
        toolPanel.hidden = !active;
        if (active) {
          toolPanel.classList.remove("is-note-writing");
          requestAnimationFrame(() => toolPanel.classList.add("is-note-writing"));
        }
      });
      if (category === "notes") window.SchemsStudyAI?.syncNotebookView?.();
      requestAnimationFrame(updateDeckHeight);
    };

    const openCategory = (category, tool = "", animate = true) => {
      const panel = $(`[data-ai-category-panel="${category}"]`);
      if (!panel) return false;
      const resolvedTool = category === "notes" && !tool ? "workspace" : tool;
      const previousIndex = aiOrder.indexOf(activeCategory);
      const nextIndex = aiOrder.indexOf(category);
      const forwardDistance = (nextIndex - previousIndex + aiOrder.length) % aiOrder.length;
      const direction = forwardDistance === 0 || forwardDistance === 1 ? 1 : -1;
      setActiveCategory(category, { animate, direction });
      if (resolvedTool) openTool(category, resolvedTool);
      return true;
    };

    categoryButtons.forEach((button) => button.addEventListener("click", () => openCategory(button.dataset.aiCategoryTarget)));
    $$('[data-ai-category-close]').forEach((button) => button.addEventListener("click", () => {
      const panel = button.closest("[data-ai-category-panel]");
      panel?.querySelectorAll("[data-ai-tool-panel], .ai-plan-builder").forEach((item) => { item.hidden = true; });
      panel?.querySelectorAll("[data-ai-tool-target], [data-ai-plan-preset]").forEach((item) => {
        item.classList.remove("is-active");
        item.setAttribute("aria-expanded", "false");
      });
    }));

    $$('[data-ai-tool-target]').forEach((button) => button.addEventListener("click", () => {
      const categoryPanel = button.closest("[data-ai-category-panel]");
      const toolPanel = categoryPanel?.querySelector(`[data-ai-tool-panel="${button.dataset.aiToolTarget}"]`);
      if (!categoryPanel || !toolPanel) return;
      const persistentWorkspace = button.dataset.aiToolTarget === "workspace";
      const wasOpen = !toolPanel.hidden && !persistentWorkspace;
      categoryPanel.querySelectorAll("[data-ai-tool-target]").forEach((item) => {
        item.classList.remove("is-active");
        item.setAttribute("aria-expanded", "false");
      });
      categoryPanel.querySelectorAll("[data-ai-tool-panel]").forEach((item) => { item.hidden = true; });
      if (!wasOpen) {
        button.classList.add("is-active");
        button.setAttribute("aria-expanded", "true");
        toolPanel.hidden = false;
        toolPanel.classList.remove("is-note-writing");
        requestAnimationFrame(() => toolPanel.classList.add("is-note-writing"));
      }
      requestAnimationFrame(updateDeckHeight);
    }));

    $$('[data-ai-collapse]').forEach((button) => button.addEventListener("click", () => {
      const panel = document.getElementById(button.dataset.aiCollapse);
      if (!panel) return;
      const open = panel.hidden;
      panel.hidden = !open;
      if (open) {
        panel.classList.remove("is-note-writing");
        requestAnimationFrame(() => panel.classList.add("is-note-writing"));
      }
      button.classList.toggle("is-open", open);
      button.setAttribute("aria-expanded", String(open));
      const mark = button.querySelector("b");
      if (mark) mark.textContent = open ? "−" : "＋";
      requestAnimationFrame(updateDeckHeight);
    }));

    $$('[data-ai-plan-preset]').forEach((button) => button.addEventListener("click", () => {
      const builder = $("#studyPlanBuilderAI");
      if (!builder) return;
      const preset = button.dataset.aiPlanPreset;
      const wasActive = button.classList.contains("is-active") && !builder.hidden;
      $$('[data-ai-plan-preset]').forEach((item) => {
        item.classList.remove("is-active");
        item.setAttribute("aria-expanded", "false");
      });
      if (wasActive) {
        builder.hidden = true;
        return;
      }
      button.classList.add("is-active");
      button.setAttribute("aria-expanded", "true");
      builder.hidden = false;
      builder.classList.remove("is-note-writing");
      requestAnimationFrame(() => builder.classList.add("is-note-writing"));
      if (preset === "exam") {
        if ($("#studyGoalAI")) $("#studyGoalAI").value = "시험 D-day 기반 과목별 학습 계획";
        if ($("#studyFocusAI")) $("#studyFocusAI").value = "시험 대비와 숙제";
      } else if (preset === "daily") {
        if ($("#studyGoalAI")) $("#studyGoalAI").value = "오늘 수업 복습";
      }
      requestAnimationFrame(updateDeckHeight);
    }));

    const openLegacyTarget = (value) => {
      const target = String(value || "").replace(/^#/, "");
      if (["studyTrainingSection", "aiNotesPanel"].includes(target)) return openCategory("notes", "workspace");
      if (["studyReportSection", "aiRecordPanel"].includes(target)) return openCategory("record");
      if (target === "aiPlanPanel") return openCategory("plan");
      if (target === "aiBooksPanel") return openCategory("books");
      return false;
    };

    const turnNotebookPage = (direction) => {
      const index = aiOrder.indexOf(activeCategory);
      const next = aiOrder[(index + direction + aiOrder.length) % aiOrder.length];
      openCategory(next);
    };

    pagesViewport.addEventListener("keydown", (event) => {
      if (event.target !== pagesViewport || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
      event.preventDefault();
      turnNotebookPage(event.key === "ArrowRight" ? 1 : -1);
    });

    let notebookDrag = null;
    const finishNotebookDrag = (event, cancelled = false) => {
      if (!notebookDrag) return;
      const state = notebookDrag;
      const currentPanel = $(`[data-ai-category-panel="${activeCategory}"]`);
      notebookDrag = null;
      pagesViewport.classList.remove("is-dragging");
      if (state.captured) pagesViewport.releasePointerCapture?.(event.pointerId);
      if (cancelled || !state.horizontal) {
        currentPanel?.style.removeProperty("--page-drag-x");
        currentPanel?.style.removeProperty("--page-drag-tilt");
        return;
      }
      const threshold = Math.min(110, Math.max(64, pagesViewport.clientWidth * 0.12));
      if (Math.abs(state.deltaX) >= threshold) {
        turnNotebookPage(state.deltaX < 0 ? 1 : -1);
        window.setTimeout(() => {
          currentPanel?.style.removeProperty("--page-drag-x");
          currentPanel?.style.removeProperty("--page-drag-tilt");
        }, reducedMotion() ? 0 : 320);
      } else {
        currentPanel?.style.removeProperty("--page-drag-x");
        currentPanel?.style.removeProperty("--page-drag-tilt");
        currentPanel?.classList.add("is-page-snapping");
        window.setTimeout(() => currentPanel?.classList.remove("is-page-snapping"), reducedMotion() ? 0 : 220);
      }
    };

    pagesViewport.addEventListener("pointerdown", (event) => {
      if (event.button !== undefined && event.button !== 0) return;
      if (event.target.closest("input, textarea, select, button, a, label")) return;
      notebookDrag = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        deltaX: 0,
        horizontal: false,
        cancelled: false,
        captured: false,
      };
    });
    pagesViewport.addEventListener("pointermove", (event) => {
      if (!notebookDrag || notebookDrag.pointerId !== event.pointerId || notebookDrag.cancelled) return;
      const deltaX = event.clientX - notebookDrag.startX;
      const deltaY = event.clientY - notebookDrag.startY;
      if (!notebookDrag.horizontal) {
        const horizontalThreshold = event.pointerType === "touch" ? 24 : 12;
        const verticalThreshold = event.pointerType === "touch" ? 12 : 10;
        const horizontalDominance = event.pointerType === "touch" ? 1.75 : 1.25;
        if (Math.abs(deltaY) > verticalThreshold && Math.abs(deltaY) >= Math.abs(deltaX) * 0.85) {
          notebookDrag.cancelled = true;
          return;
        }
        if (Math.abs(deltaX) < horizontalThreshold || Math.abs(deltaX) <= Math.abs(deltaY) * horizontalDominance) return;
        notebookDrag.horizontal = true;
        notebookDrag.captured = true;
        pagesViewport.setPointerCapture?.(event.pointerId);
        pagesViewport.classList.add("is-dragging");
      }
      event.preventDefault();
      notebookDrag.deltaX = deltaX;
      const currentPanel = $(`[data-ai-category-panel="${activeCategory}"]`);
      currentPanel?.style.setProperty("--page-drag-x", `${deltaX}px`);
      currentPanel?.style.setProperty("--page-drag-tilt", `${deltaX * -0.006}deg`);
    }, { passive: false });
    pagesViewport.addEventListener("pointerup", (event) => finishNotebookDrag(event));
    pagesViewport.addEventListener("pointercancel", (event) => finishNotebookDrag(event, true));

    if ("ResizeObserver" in window) {
      const notebookResizeObserver = new ResizeObserver(() => requestAnimationFrame(updateDeckHeight));
      categoryPanels.forEach((panel) => notebookResizeObserver.observe(panel));
    }
    window.addEventListener("prime:notebook-content-change", () => requestAnimationFrame(updateDeckHeight));
    window.addEventListener("resize", () => {
      pagesViewport.style.removeProperty("--notebook-page-height");
      requestAnimationFrame(updateDeckHeight);
    });

    openCategory("notes", "", false);
    requestAnimationFrame(updateDeckHeight);
    const hashTarget = window.location.hash.replace(/^#/, "");
    if (openLegacyTarget(hashTarget)) selectTab("assistant");
    window.addEventListener("hashchange", () => {
      const target = window.location.hash.replace(/^#/, "");
      if (openLegacyTarget(target)) selectTab("assistant");
    });
    window.PrimeEduAI = {
      openCategory(category, tool = "") {
        selectTab("assistant");
        requestAnimationFrame(() => openCategory(category, tool));
        return true;
      },
      close() {
        categoryPanels.forEach((panel) => {
          panel.querySelectorAll("[data-ai-tool-panel], .ai-plan-builder").forEach((item) => { item.hidden = true; });
        });
      },
    };
    window.SchemsStudyDeck = { openCard: openLegacyTarget };
  }

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".notification-wrap,#notificationPopover") && !event.target.closest("#homeNoticeButton")) setNotificationsOpen(false);
    if (!event.target.closest(".home-settings-wrap,#homeSettingsButton") && !event.target.closest("#homeSettingsPanel") && !event.target.closest("#mobileHomeChangeButton")) setHomeSettingsOpen(false);
    const homeRoute = event.target.closest("[data-home-route]")?.dataset.homeRoute;
    if (homeRoute) openHomeRoute(homeRoute);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if ($("#plannerEventModal")?.classList.contains("is-open")) setPlannerEventModal(false);
    else if (!$("#homeSettingsPanel")?.hidden) setHomeSettingsOpen(false);
    else if (!$("#mobileChatDrawer")?.hidden) setMobileChatDrawer(false);
    else if (!$("#desktopChatHistory")?.hidden) setDesktopChatHistory(false);
    else if (!$("#notificationPopover")?.hidden) setNotificationsOpen(false, true);
  });

  window.addEventListener("prime:module-action", (event) => handleModuleAction(event.detail));
  window.addEventListener("prime:grades-updated", renderHomeLearningWidgets);

  window.addEventListener("schems:planner-data", () => {
    renderNotifications();
    renderPlanner();
    renderHomeLearningWidgets();
  });
  window.addEventListener("schems:study-data", (event) => {
    latestStudySnapshot = event.detail || latestStudySnapshot;
    renderNotifications();
    renderPlanner();
    renderPrivacyInsights();
    renderHomeLearningWidgets();
  });

  window.PrimeEduUtilityBridge = {
    getChecklist: getChecklistItems,
    addChecklist: addChecklistItem,
    toggleChecklist: toggleChecklistItem,
    deleteChecklist: deleteChecklistItem,
  };
  window.PrimeEduStandbyData = {
    getTodayItems: () => getChecklistItems(todayKey()),
    async toggle(key) {
      const item=getChecklistItems(todayKey()).find(entry=>entry.key===key);
      if(!item)return false;
      if(item.kind==='ai') await window.SchemsStudyAI?.setTaskDone?.(item.id,!item.done);
      else {planChecks[item.key]=!item.done;localStorage.setItem(PLAN_CHECK_KEY,JSON.stringify(planChecks));}
      renderPlanner();renderPrivacyInsights();window.dispatchEvent(new CustomEvent('schems:planner-data'));return true;
    },
  };

  applyHomePreferences();
  refreshThemeChoice();
  renderNotifications();
  renderPlanner();
  renderPrivacyInsights();
  renderHomeLearningWidgets();
  initDraggableAiFab();
  const recordPanel = $("#aiRecordPanel");
  const progressMount = $("#progressDashboardMount");
  if (recordPanel && progressMount) {
    recordPanel.removeAttribute("data-ai-category-panel");
    recordPanel.removeAttribute("role");
    recordPanel.classList.remove("ai-category-panel", "is-current", "is-next-page", "is-back-page");
    recordPanel.classList.add("growth-dashboard");
    recordPanel.hidden = false;
    recordPanel.inert = false;
    recordPanel.querySelector(".ai-category-head")?.remove();
    progressMount.appendChild(recordPanel);
  }
  initAiWorkspace();
})();
