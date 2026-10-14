(function () {
  "use strict";
  const $ = (s) => document.querySelector(s),
    categories = {
      studyTasks: "할 일",
      studySessions: "집중 기록",
      notes: "개념노트",
      quizzes: "문제노트",
      quizAttempts: "풀이",
      learningDiagnostics: "분석",
      gradeRecords: "성적",
      preferences: "설정",
      chatConversations: "대화",
    };
  const fieldNames = {
    title: "제목",
    date: "날짜",
    memo: "메모",
    subject: "과목",
    summary: "요약",
    text: "내용",
    content: "내용",
    createdAt: "생성일",
    updatedAt: "수정일",
    minutes: "시간(분)",
    done: "완료",
    role: "권한",
    grade: "학년",
    classNo: "반",
    displayName: "이름",
    school: "학교",
    name: "이름",
    messages: "대화",
    question: "문제",
    answer: "정답",
    explanation: "해설",
    details: "상세",
    feedback: "피드백",
    outcome: "결과",
    source: "출처",
    score: "맞은 수",
    total: "전체 수",
    accuracy: "정답률",
    steps: "단계",
    blocks: "시간 배치",
    emailVerified: "이메일 확인",
    phoneNumber: "전화번호",
    lastRefreshAt: "최근 세션 갱신",
    sessionsValidAfter: "유효 세션 기준",
    linkedAccounts: "연결 계정",
    provider: "로그인 방식",
    email: "이메일",
    multifactorCount: "추가 인증 수단 수",
    schoolLevel: "학교급",
    classId: "학년·반",
    officeCode: "교육청 코드",
    schoolCode: "학교 코드",
    address: "주소",
    category: "분류",
    ddayTitle: "D-day 이름",
    ddayDate: "D-day 날짜",
    before: "변경 전",
    after: "변경 후",
    exists: "등록 여부",
    value: "내용",
  };
  let epoch = 0,
    selection = 0,
    listRequest = 0,
    recordRequest = 0,
    accounts = [],
    accountsCursor = null,
    current = null,
    recordCursor = null,
    activeTab = "profile",
    activeCollection = "studyTasks",
    operation = null,
    busy = false,
    modalOrigin = null;
  let profileRevision = null,
    historyCursor = null,
    historyRows = [],
    historyRequest = 0,
    schoolRequest = 0;
  const actionNames = {
    updateProfile: "정보 수정",
    updateDday: "D-day 변경",
    editEvent: "일정 수정",
    renameRecord: "노트 이름 변경",
    restoreChange: "변경 복구",
    revokeSessions: "세션 종료",
    addEvent: "일정 추가",
    resetPassword: "재설정 메일",
    setDisabled: "로그인 관리",
  };
  const icon = (n) => window.PrimeUI.svg(n),
    text = (selector, value) => ($(selector).textContent = String(value ?? ""));
  function dateLabel(value) {
    if (!value) return "—";
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return String(value);
    return new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      ...(/^\d{4}-\d{2}-\d{2}$/.test(value)
        ? {}
        : { hour: "2-digit", minute: "2-digit", hour12: false }),
    }).format(date);
  }
  function renderData(host, value) {
    host.replaceChildren();
    function append(parent, item) {
      if (Array.isArray(item)) {
        const list = document.createElement("div");
        list.className = "record-array";
        item.forEach((v) => {
          const row = document.createElement("div");
          append(row, v);
          list.append(row);
        });
        parent.append(list);
      } else if (item && typeof item === "object") {
        const list = document.createElement("dl");
        list.className = "record-fields";
        Object.entries(item).forEach(([key, v]) => {
          const dt = document.createElement("dt"),
            dd = document.createElement("dd");
          dt.textContent = fieldNames[key] || key;
          append(dd, v);
          list.append(dt, dd);
        });
        parent.append(list);
      } else
        parent.textContent =
          typeof item === "boolean"
            ? item
              ? "예"
              : "아니요"
            : String(item ?? "—");
    }
    append(host, value);
  }
  async function request(payload) {
    const owner = window.ClassHubFirebase.getCurrentUser(),
      generation = epoch;
    if (!owner) throw Error("관리자 계정으로 로그인해주세요.");
    const token = await owner.getIdToken();
    if (generation !== epoch) throw Error("계정이 변경됐어요.");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 55000);
    let res, data;
    try {
      res = await fetch("/api/serviceAdmin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      data = await res
        .json()
        .catch(() => ({ error: "관리 서버가 응답하지 않아요." }));
    } catch (error) {
      throw Error(
        error.name === "AbortError"
          ? "응답이 늦어지고 있어요. 변경 작업은 중복 요청하지 말고 상태를 확인해주세요."
          : "연결을 확인해주세요.",
      );
    } finally {
      clearTimeout(timeout);
    }
    if (
      generation !== epoch ||
      owner.uid !== window.ClassHubFirebase.getCurrentUser()?.uid
    )
      throw Error("계정이 변경됐어요.");
    if (!res.ok)
      throw Object.assign(
        new Error(data.error || "요청을 처리하지 못했어요."),
        { code: data.code },
      );
    return data;
  }
  function hideModal() {
    if (busy) return;
    $("#manageModal").hidden = true;
    $(".manage-shell").inert = false;
    $(".manage-header").inert = false;
    $(".manage-shell").removeAttribute("aria-hidden");
    $(".manage-header").removeAttribute("aria-hidden");
    operation = null;
    schoolRequest++;
    modalOrigin?.focus?.();
  }
  function clear() {
    selection++;
    listRequest++;
    recordRequest++;
    accounts = [];
    current = null;
    accountsCursor = recordCursor = null;
    operation = null;
    profileRevision = null;
    historyRows = [];
    historyCursor = null;
    historyRequest++;
    schoolRequest++;
    busy = false;
    $("#manageModal")
      .querySelectorAll("button[type=submit]")
      .forEach((b) => (b.disabled = false));
    for (const selector of [
      "#accountHistory",
      "#profileData",
      "#authenticationData",
      "#accountFacts",
      "#eventRecords",
      "#learningRecords",
    ])
      $(selector).replaceChildren();
    $("#confirmManageAction").disabled = false;
    $("#eventManageForm button").disabled = false;
    $("#closeManageModal").disabled = false;
    $("#accountList").replaceChildren();
    $("#detailPanel").hidden = true;
    $("#manageWorkspace").hidden = true;
    $("#manageModal").hidden = true;
    $(".manage-shell").inert = false;
    $(".manage-header").inert = false;
    $(".manage-shell").removeAttribute("aria-hidden");
    $(".manage-header").removeAttribute("aria-hidden");
    $(".manage-shell").classList.remove("is-detail");
  }
  async function access(user) {
    const generation = ++epoch;
    clear();
    $("#accessPanel").hidden = false;
    $("#manageLogin").hidden = Boolean(user);
    $("#manageGoogle").hidden = Boolean(user);
    $("#manageLogout").hidden = !user;
    if (!user) {
      text("#accessMessage", "관리자 계정으로 로그인해주세요.");
      return;
    }
    text("#accessMessage", "관리 권한 확인 중");
    try {
      await request({ action: "status" });
      if (generation !== epoch) return;
      $("#accessPanel").hidden = true;
      $("#manageWorkspace").hidden = false;
      await loadAccounts(false);
    } catch (e) {
      if (generation === epoch) text("#accessMessage", e.message);
    }
  }
  async function loadAccounts(more) {
    const generation = epoch,
      ticket = ++listRequest;
    text("#accountsStatus", "계정 불러오는 중");
    $("#moreAccounts").disabled = true;
    try {
      const data = await request({
        action: "accounts",
        cursor: more ? accountsCursor : null,
        query: $("#accountQuery").value.trim(),
      });
      if (generation !== epoch || ticket !== listRequest) return;
      accounts = more ? [...accounts, ...data.accounts] : data.accounts;
      accountsCursor = data.nextCursor;
      renderAccounts();
      text("#accountsStatus", accounts.length ? "" : "검색 결과가 없어요.");
    } catch (e) {
      if (generation === epoch && ticket === listRequest)
        text("#accountsStatus", e.message);
    } finally {
      if (ticket === listRequest) $("#moreAccounts").disabled = false;
    }
  }
  function renderAccounts() {
    const list = $("#accountList");
    list.replaceChildren();
    text("#accountCount", accounts.length + "개 표시");
    $("#moreAccounts").hidden = !accountsCursor;
    accounts.forEach((account) => {
      const button = document.createElement("button");
      button.className = "account-row";
      button.type = "button";
      button.setAttribute("aria-pressed", String(account.uid === current?.uid));
      button.dataset.accountUid = account.uid;
      const avatar = document.createElement("span");
      avatar.className = "account-avatar";
      avatar.textContent = (account.displayName || account.email || "?").slice(
        0,
        1,
      );
      const copy = document.createElement("span");
      copy.className = "account-copy";
      const name = document.createElement("strong"),
        email = document.createElement("span");
      name.textContent = account.displayName || "이름 없음";
      email.textContent = account.email || account.uid;
      copy.append(name, email);
      button.append(avatar, copy);
      if (account.disabled) {
        const status = document.createElement("small");
        status.textContent = "차단";
        button.append(status);
      }
      button.addEventListener("click", () => choose(account.uid));
      list.append(button);
    });
  }
  async function choose(uid) {
    const ticket = ++selection,
      generation = epoch;
    current = null;
    $("#detailPanel").hidden = true;
    text("#accountsStatus", "계정 확인 중");
    try {
      const data = await request({ action: "account", uid });
      if (ticket !== selection || generation !== epoch) return;
      current = data.account;
      profileRevision = data.profileRevision;
      activeTab = "profile";
      $("#detailPanel").hidden = false;
      $(".manage-shell").classList.add("is-detail");
      renderAccounts();
      renderAccount();
      switchTab("profile");
      text("#accountsStatus", "");
    } catch (e) {
      if (ticket === selection && generation === epoch)
        text("#accountsStatus", e.message);
    }
  }
  function renderAccount() {
    text(
      "#detailAvatar",
      (current.displayName || current.email || "?").trim().slice(0, 1),
    );
    text("#accountName", current.displayName || "이름 없음");
    text("#accountEmail", current.email || current.uid);
    const facts = $("#accountFacts");
    facts.replaceChildren();
    const profile = current.profile || {},
      school = profile.school || {};
    for (const [label, value] of [
      ["UID", current.uid],
      ["상태", current.disabled ? "로그인 차단" : "사용 중"],
      [
        "로그인",
        current.providers
          .map((p) => ({ password: "이메일", "google.com": "Google" })[p] || p)
          .join(", ") || "미등록",
      ],
      ["가입", dateLabel(current.createdAt)],
      ["최근 로그인", dateLabel(current.lastSignInAt)],
      ["학교", school.name || "미설정"],
      [
        "학년·반",
        [profile.grade, profile.classNo].filter(Boolean).join(" · ") ||
          "미설정",
      ],
    ]) {
      const dt = document.createElement("dt"),
        dd = document.createElement("dd");
      dt.textContent = label;
      dd.textContent = value;
      if (label === "UID") dd.className = "account-uid";
      facts.append(dt, dd);
    }
    renderData($("#profileData"), profile);
    renderData($("#authenticationData"), current.authentication || {});
    document.querySelector('[data-admin-action="resetPassword"]').disabled =
      !current.passwordResetAvailable;
    for (const action of ["setDisabled", "revokeSessions"])
      document.querySelector(`[data-admin-action="${action}"]`).disabled =
        current.uid === window.ClassHubFirebase.getCurrentUser()?.uid ||
        current.administrator;
    $("#resetAccountPassword").disabled = !current.passwordResetAvailable;
    $("#resetAccountPassword").title = current.passwordResetAvailable
      ? "재설정 메일"
      : "Google 등 외부 계정은 해당 서비스에서 비밀번호를 변경해요.";
    $("#toggleAccount").disabled =
      current.uid === window.ClassHubFirebase.getCurrentUser()?.uid ||
      current.administrator;
    $("#toggleAccount").setAttribute(
      "aria-label",
      current.disabled ? "로그인 차단 해제" : "로그인 차단",
    );
    $("#toggleAccount").innerHTML = icon(current.disabled ? "play" : "pause");
  }
  async function switchTab(tab) {
    activeTab = tab;
    document
      .querySelectorAll(".manage-tabs button")
      .forEach((b) =>
        b.setAttribute("aria-selected", String(b.dataset.planMode === tab)),
      );
    $("#profileView").hidden = tab !== "profile";
    $("#eventsView").hidden = tab !== "events";
    $("#recordsView").hidden = tab !== "records";
    $("#historyView").hidden = tab !== "history";
    $("#moreRecords").hidden = true;
    text("#detailStatus", "");
    if (tab === "history") await loadHistory(false);
    else if (tab !== "profile") await loadRecords(false);
  }
  async function loadHistory(more) {
    if (!current) return;
    const uid = current.uid,
      generation = epoch,
      ticket = ++historyRequest;
    $("#moreHistory").hidden = true;
    if (!more) {
      historyRows = [];
      $("#accountHistory").replaceChildren();
    }
    text("#detailStatus", "작업 이력 불러오는 중");
    try {
      const data = await request({
        action: "history",
        uid,
        cursor: more ? historyCursor : null,
      });
      if (
        generation !== epoch ||
        ticket !== historyRequest ||
        current?.uid !== uid ||
        activeTab !== "history"
      )
        return;
      historyRows = [...historyRows, ...data.history];
      historyCursor = data.nextCursor;
      historyRows.sort((a, b) =>
        String(b.createdAt || "").localeCompare(String(a.createdAt || "")),
      );
      $("#accountHistory").replaceChildren();
      historyRows.forEach((row) => {
        const box = document.createElement("article");
        box.className = "record-row";
        const title = document.createElement("strong"),
          meta = document.createElement("p");
        title.textContent =
          actionNames[row.action] ||
          {
            "account.read": "계정 조회",
            "records.read": "목록 조회",
            "record.read": "기록 조회",
            "history.read": "이력 조회",
          }[row.action] ||
          row.action;
        meta.className = "history-meta";
        meta.textContent =
          dateLabel(row.createdAt) +
          " · " +
          { done: "완료", started: "처리 중", uncertain: "결과 확인 필요" }[
            row.state || ""
          ];
        if (!row.state) meta.textContent = dateLabel(row.createdAt);
        box.append(title, meta);
        if (row.changes) {
          const detail = document.createElement("details"),
            label = document.createElement("summary"),
            body = document.createElement("div");
          label.textContent = "변경 내용";
          body.className = "record-data";
          renderData(body, row.changes);
          detail.append(label, body);
          box.append(detail);
        }
        if (row.restorable) {
          const undo = document.createElement("button");
          undo.className = "icon-button";
          undo.setAttribute("aria-label", title.textContent + " 되돌리기");
          undo.innerHTML = icon("reset");
          undo.addEventListener("click", () => {
            if (current?.uid === uid)
              modal("restoreChange", { originalId: row.id });
          });
          box.append(undo);
        }
        $("#accountHistory").append(box);
      });
      $("#moreHistory").hidden = !historyCursor;
      text("#detailStatus", historyRows.length ? "" : "작업 이력이 없어요.");
    } catch (e) {
      if (
        generation === epoch &&
        ticket === historyRequest &&
        current?.uid === uid &&
        activeTab === "history"
      )
        text("#detailStatus", e.message);
    }
  }
  async function loadRecords(more) {
    if (!current) return;
    const account = current.uid,
      requestTicket = ++recordRequest,
      ticket = selection,
      generation = epoch,
      collection = activeTab === "events" ? "personalEvents" : activeCollection,
      tab = activeTab,
      target = tab === "events" ? $("#eventRecords") : $("#learningRecords");
    $("#moreRecords").hidden = true;
    if (!more) target.replaceChildren();
    $("#chatReasonForm").hidden = collection !== "chatConversations";
    if (
      collection === "chatConversations" &&
      $("#chatReason").value.trim().length < 3
    ) {
      text("#detailStatus", "확인 사유를 입력해주세요.");
      return;
    }
    text("#detailStatus", "기록 불러오는 중");
    try {
      const data = await request({
        action: "records",
        uid: account,
        collection,
        cursor: more ? recordCursor : null,
        reason: $("#chatReason").value.trim(),
      });
      if (
        requestTicket !== recordRequest ||
        ticket !== selection ||
        generation !== epoch ||
        tab !== activeTab ||
        collection !==
          (activeTab === "events" ? "personalEvents" : activeCollection)
      )
        return;
      recordCursor = data.nextCursor;
      $("#moreRecords").hidden = !recordCursor;
      text(
        "#detailStatus",
        data.records.length || more ? "" : "저장된 기록이 없어요.",
      );
      data.records.forEach((record) =>
        renderRecord(target, record, collection, account),
      );
    } catch (e) {
      if (
        requestTicket === recordRequest &&
        ticket === selection &&
        generation === epoch
      )
        text("#detailStatus", e.message);
    }
  }
  function renderRecord(parent, record, collection, account) {
    const details = document.createElement("details");
    details.className = "record-row";
    const summary = document.createElement("summary"),
      name = document.createElement("strong"),
      date = document.createElement("span");
    const copy = document.createElement("span"),
      chevron = document.createElement("span");
    copy.className = "record-copy";
    chevron.className = "record-chevron";
    chevron.setAttribute("aria-hidden", "true");
    chevron.innerHTML = icon("down");
    name.textContent = record.title;
    date.textContent = record.date ? dateLabel(record.date) : "";
    copy.append(name, date);
    summary.append(copy, chevron);
    details.append(summary);
    const content = document.createElement("div");
    content.className = "record-data";
    details.append(content);
    details.addEventListener("toggle", async () => {
      if (!details.open || details.dataset.loaded || details.dataset.loading)
        return;
      details.dataset.loading = "true";
      const generation = epoch,
        ticket = selection;
      content.textContent = "불러오는 중";
      try {
        const data = await request({
          action: "record",
          uid: account,
          collection,
          id: record.id,
          reason: $("#chatReason").value.trim(),
        });
        if (
          generation !== epoch ||
          ticket !== selection ||
          current?.uid !== account
        )
          return;
        renderData(content, data.record.data);
        if (["personalEvents", "notes", "quizzes"].includes(collection)) {
          const actions = document.createElement("div"),
            edit = document.createElement("button");
          actions.className = "record-actions";
          edit.className = "icon-button";
          edit.type = "button";
          edit.setAttribute(
            "aria-label",
            collection === "personalEvents" ? "일정 수정" : "노트 이름 변경",
          );
          edit.innerHTML = icon("edit");
          edit.addEventListener("click", () => {
            if (current?.uid === account)
              modal(
                collection === "personalEvents" ? "editEvent" : "renameRecord",
                { record: data.record, collection },
              );
          });
          actions.append(edit);
          details.append(actions);
        }
        details.dataset.loaded = "true";
      } catch (e) {
        if (generation === epoch && ticket === selection)
          content.textContent = e.message;
      } finally {
        delete details.dataset.loading;
      }
    });
    parent.append(details);
  }
  function modal(action, context = {}) {
    if (!current || busy) return;
    if ($("#manageModal").hidden) modalOrigin = document.activeElement;
    operation = {
      action,
      uid: current.uid,
      id: crypto.randomUUID
        ? crypto.randomUUID()
        : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
            (
              Number(c) ^
              (crypto.getRandomValues(new Uint8Array(1))[0] &
                (15 >> (Number(c) / 4)))
            ).toString(16),
          ),
      disabled: !current.disabled,
      revision: context.record?.revision || profileRevision,
      context,
      school: current.profile?.school || null,
    };
    $("#manageModal").hidden = false;
    $(".manage-shell").inert = true;
    $(".manage-header").inert = true;
    text("#modalStatus", "");
    $("#accountTools").hidden = action !== "tools";
    for (const [selector, actions] of Object.entries({
      "#eventManageForm": ["addEvent", "editEvent"],
      "#profileManageForm": ["updateProfile"],
      "#ddayManageForm": ["updateDday"],
      "#renameManageForm": ["renameRecord"],
    }))
      $(selector).hidden = !actions.includes(action);
    $("#confirmManageAction").hidden = ![
      "resetPassword",
      "setDisabled",
      "revokeSessions",
      "restoreChange",
    ].includes(action);
    text(
      "#modalMessage",
      [
        "addEvent",
        "editEvent",
        "updateProfile",
        "updateDday",
        "renameRecord",
        "tools",
      ].includes(action)
        ? current.displayName || current.email
        : action === "resetPassword"
          ? current.email + "에 재설정 메일을 보내요."
          : action === "revokeSessions"
            ? "기존 로그인 갱신을 해제해요. 반영까지 최대 1시간이 걸릴 수 있어요."
            : action === "restoreChange"
              ? "그 뒤에 수정되지 않은 내용만 이전 상태로 되돌려요."
              : current.disabled
                ? "이 계정의 로그인을 다시 허용해요."
                : "이 계정의 새 로그인을 차단해요.",
    );
    text(
      "#manageModalTitle",
      action === "tools" ? "계정 관리" : actionNames[action] || "로그인 관리",
    );
    if (["addEvent", "editEvent"].includes(action)) {
      $("#eventManageForm").reset();
      $("#eventManageForm [name=date]").value = new Date().toLocaleDateString(
        "sv-SE",
      );
      $("#eventManageForm [name=title]").focus();
      $("#eventManageForm button").textContent =
        action === "addEvent" ? "추가" : "저장";
      if (context.record)
        for (const name of ["title", "date", "memo"])
          $(`#eventManageForm [name=${name}]`).value =
            context.record.data[name] || "";
    } else if (action === "updateProfile") {
      $("#profileManageForm").reset();
      const p = current.profile || {};
      for (const [key, value] of Object.entries({
        displayName: current.displayName,
        grade: p.grade || "",
        classNo: p.classNo || "",
      }))
        $(`#profileManageForm [name=${key}]`).value = value;
      $(
        `#profileManageForm [name=schoolLevel][value=${p.schoolLevel === "high" ? "high" : "middle"}]`,
      ).checked = true;
      $("#profileSchoolQuery").value = p.school?.name || "";
      text("#profileSchoolSelected", p.school?.name || "학교를 선택해주세요.");
      $("#profileSchoolResults").replaceChildren();
      $("#profileManageForm [name=displayName]").focus();
    } else if (action === "updateDday") {
      $("#ddayManageForm [name=title]").value =
        current.profile?.ddayTitle || "";
      $("#ddayManageForm [name=date]").value = current.profile?.ddayDate || "";
      $("#ddayManageForm [name=title]").focus();
    } else if (action === "renameRecord") {
      $("#renameManageForm [name=title]").value =
        context.record.data.title || context.record.data.subject || "";
      $("#renameManageForm input").focus();
    } else if (action === "tools") $("#accountTools button").focus();
    else $("#confirmManageAction").focus();
    $(".manage-shell").setAttribute("aria-hidden", "true");
    $(".manage-header").setAttribute("aria-hidden", "true");
  }
  async function mutate(event) {
    event?.preventDefault();
    if (!operation || busy) return;
    const target = operation,
      generation = epoch;
    let applied = false;
    busy = true;
    $("#confirmManageAction").disabled = true;
    $("#eventManageForm button").disabled = true;
    $("#closeManageModal").disabled = true;
    text("#modalStatus", "처리 중");
    const payload = {
      action: target.action,
      uid: target.uid,
      operationId: target.id,
    };
    if (target.action === "addEvent")
      payload.event = Object.fromEntries(new FormData($("#eventManageForm")));
    if (
      ["updateProfile", "updateDday", "editEvent", "renameRecord"].includes(
        target.action,
      )
    )
      payload.revision = target.revision;
    if (target.action === "updateProfile")
      payload.profile = {
        ...Object.fromEntries(new FormData($("#profileManageForm"))),
        school: target.school,
      };
    if (target.action === "updateDday")
      payload.dday = Object.fromEntries(new FormData($("#ddayManageForm")));
    if (target.action === "editEvent") {
      payload.event = Object.fromEntries(new FormData($("#eventManageForm")));
      payload.id = target.context.record.id;
    }
    if (target.action === "renameRecord") {
      payload.title = $("#renameManageForm input").value;
      payload.id = target.context.record.id;
      payload.collection = target.context.collection;
    }
    if (target.action === "restoreChange")
      payload.originalId = target.context.originalId;
    if (target.action === "setDisabled") payload.disabled = target.disabled;
    $("#manageModal")
      .querySelectorAll("button[type=submit]")
      .forEach((b) => (b.disabled = true));
    try {
      await request(payload);
      applied = true;
      if (generation !== epoch) return;
      busy = false;
      hideModal();
      if (current?.uid === target.uid) {
        if (["addEvent", "editEvent"].includes(target.action)) {
          await switchTab("events");
        } else {
          const d = await request({ action: "account", uid: target.uid });
          if (generation === epoch && current?.uid === target.uid) {
            current = d.account;
            profileRevision = d.profileRevision;
            renderAccount();
            text(
              "#detailStatus",
              target.action === "resetPassword"
                ? "재설정 메일 발송 완료"
                : (actionNames[target.action] || "변경") + " 완료",
            );
            if (["renameRecord", "restoreChange"].includes(target.action))
              await switchTab(
                target.action === "restoreChange" ? "history" : "records",
              );
          }
        }
      }
      await loadAccounts(false);
    } catch (e) {
      if (generation === epoch)
        text(
          applied ? "#detailStatus" : "#modalStatus",
          applied
            ? "변경은 완료됐어요. 화면을 새로고침해 확인해주세요."
            : e.message,
        );
    } finally {
      if (generation === epoch) {
        busy = false;
        $("#confirmManageAction").disabled = false;
        $("#eventManageForm button").disabled = false;
        $("#closeManageModal").disabled = false;
        $("#manageModal")
          .querySelectorAll("button[type=submit]")
          .forEach((b) => (b.disabled = false));
      }
    }
  }
  async function init() {
    window.PrimeButtonMotion?.init();
    document
      .querySelectorAll("[data-manage-icon]")
      .forEach((e) => (e.innerHTML = icon(e.dataset.manageIcon)));
    Object.entries(categories).forEach(([value, label]) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = label;
      b.dataset.collection = value;
      b.setAttribute("aria-pressed", String(value === activeCollection));
      b.addEventListener("click", () => {
        activeCollection = value;
        $("#chatReason").value = "";
        document
          .querySelectorAll("[data-collection]")
          .forEach((n) => n.setAttribute("aria-pressed", String(n === b)));
        loadRecords(false);
      });
      $("#recordCategories").append(b);
    });
    $("#accountSearch").addEventListener("submit", (e) => {
      e.preventDefault();
      loadAccounts(false);
    });
    $("#moreAccounts").addEventListener("click", () => loadAccounts(true));
    $("#moreRecords").addEventListener("click", () => loadRecords(true));
    $("#moreHistory").addEventListener("click", () => loadHistory(true));
    $("#editAccountProfile").addEventListener("click", () =>
      modal("updateProfile"),
    );
    $("#manageAccountTools").addEventListener("click", () => modal("tools"));
    document
      .querySelectorAll("[data-admin-action]")
      .forEach((b) =>
        b.addEventListener("click", () => modal(b.dataset.adminAction)),
      );
    for (const selector of [
      "#profileManageForm",
      "#ddayManageForm",
      "#renameManageForm",
    ])
      $(selector).addEventListener("submit", mutate);
    document
      .querySelectorAll("#profileManageForm [name=schoolLevel]")
      .forEach((r) =>
        r.addEventListener("change", () => {
          schoolRequest++;
          if (operation) {
            operation.school = null;
            text("#profileSchoolSelected", "학교를 다시 선택해주세요.");
            $("#profileSchoolResults").replaceChildren();
          }
        }),
      );
    $("#profileSchoolQuery").addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        $("#profileSchoolSearch").click();
      }
    });
    $("#profileSchoolSearch").addEventListener("click", async () => {
      const captured = operation,
        generation = epoch,
        ticket = ++schoolRequest;
      if (!captured || captured.action !== "updateProfile") return;
      text("#profileSchoolSelected", "학교 찾는 중");
      $("#profileSchoolResults").replaceChildren();
      try {
        const rows = await request({
          action: "schools",
          uid: captured.uid,
          query: $("#profileSchoolQuery").value,
          level: $("#profileManageForm [name=schoolLevel]:checked").value,
        });
        if (
          generation !== epoch ||
          captured !== operation ||
          ticket !== schoolRequest
        )
          return;
        text(
          "#profileSchoolSelected",
          rows.schools.length ? "학교를 선택해주세요." : "검색 결과가 없어요.",
        );
        rows.schools.forEach((school) => {
          const b = document.createElement("button");
          b.type = "button";
          b.textContent = school.name + " · " + school.address;
          b.addEventListener("click", () => {
            if (operation !== captured) return;
            captured.school = school;
            $("#profileSchoolQuery").value = school.name;
            text("#profileSchoolSelected", school.name);
            $("#profileSchoolResults").replaceChildren();
          });
          $("#profileSchoolResults").append(b);
        });
      } catch (e) {
        if (
          generation === epoch &&
          captured === operation &&
          ticket === schoolRequest
        )
          text("#profileSchoolSelected", e.message);
      }
    });
    $("#chatReasonForm").addEventListener("submit", (e) => {
      e.preventDefault();
      loadRecords(false);
    });
    document
      .querySelectorAll(".manage-tabs button")
      .forEach((b) =>
        b.addEventListener("click", () => switchTab(b.dataset.planMode)),
      );
    $("#backAccounts").addEventListener("click", () => {
      $(".manage-shell").classList.remove("is-detail");
      $("#detailPanel").hidden = true;
      selection++;
      current = null;
      renderAccounts();
    });
    $("#addAccountEvent").addEventListener("click", () => modal("addEvent"));
    $("#toggleAccount").addEventListener("click", () => modal("setDisabled"));
    $("#resetAccountPassword").addEventListener("click", () =>
      modal("resetPassword"),
    );
    $("#eventManageForm").addEventListener("submit", mutate);
    $("#confirmManageAction").addEventListener("click", mutate);
    $("#closeManageModal").addEventListener("click", hideModal);
    $("#manageModal").addEventListener("keydown", (e) => {
      if (e.key === "Escape") hideModal();
      if (e.key === "Tab") {
        const items = [
            ...$("#manageModal").querySelectorAll("button,input,textarea"),
          ].filter((n) => !n.disabled && n.getClientRects().length),
          a = items[0],
          z = items.at(-1);
        if (e.shiftKey && document.activeElement === a) {
          e.preventDefault();
          z.focus();
        } else if (!e.shiftKey && document.activeElement === z) {
          e.preventDefault();
          a.focus();
        }
      }
    });
    $("#refreshManage").addEventListener("click", () =>
      access(window.ClassHubFirebase.getCurrentUser()),
    );
    $("#manageLogout").addEventListener("click", () =>
      window.ClassHubFirebase.signOut(),
    );
    $("#manageLogin").addEventListener("submit", async (e) => {
      e.preventDefault();
      const form = e.currentTarget;
      const f = new FormData(form);
      try {
        await window.ClassHubFirebase.signIn(f.get("email"), f.get("password"));
        form.reset();
      } catch (error) {
        text("#accessMessage", error.message);
      }
    });
    $("#manageGoogle").addEventListener("click", async () => {
      try {
        await firebase
          .auth()
          .signInWithPopup(new firebase.auth.GoogleAuthProvider());
      } catch {
        text("#accessMessage", "Google 로그인을 완료하지 못했어요.");
      }
    });
    if (!window.ClassHubFirebase?.init()) {
      text("#accessMessage", "계정 연결 설정이 필요해요.");
      return;
    }
    window.ClassHubFirebase.onAuthStateChanged(access);
  }
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
