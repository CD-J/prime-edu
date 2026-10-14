(function () {
  const CHAT_STORAGE_KEY = "schemsAiConversations.v1";
  const memory = window.PrimeChatMemory;
  let accountUid = null;
  let authEpoch = 0;
  let remoteUnsubscribe = null;
  let requestAbort = null;
  let studyCache=null,studyCacheAt=0;
  function bounded(task,ms,fallback){let timer;return Promise.race([Promise.resolve().then(task),new Promise(resolve=>{timer=setTimeout(()=>resolve(fallback),ms);})]).finally(()=>clearTimeout(timer));}
  let syncStatus = 'local';
  let tombstones = [];
  const pendingSaves = new Map();
  const inFlightSaves = new Set();
  const SUGGESTIONS = [
    "오늘 공부 계획 짜줘",
    "다음 시험까지 어떻게 공부할까?",
    "요즘 공부가 힘든데 이야기 들어줘",
    "이번 주 일정과 공부 우선순위 알려줘",
  ];

  let conversations = [];
  let activeConversationId = null;
  let loadingConversationId = null;
  let getContext = () => "";
  let surfaces = [];

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function makeId() {
    return `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function titleFrom(text) {
    const value = String(text || "").replace(/\s+/g, " ").trim();
    return value.length > 24 ? `${value.slice(0, 24)}…` : value || "새 대화";
  }

  function recommendModules(prompt) {
    const text = String(prompt || "").trim();
    const actions = [];
    const add = (type, label) => {
      if (!actions.some((item) => item.type === type)) actions.push({ type, label, prompt: text });
    };

    if (/시험|고사|평가|시험범위|중간|기말/.test(text)) {
      add("exam-strategy", "시험 전략 바로 만들기");
    } else if (/계획|루틴|공부량|분량|일주일|이번 주|우선순위|(?:오늘|내일).*(?:시간|분).*공부/.test(text)) {
      add("study-plan", "스터디 플래너 만들기");
    }

    if (/책|도서|독서|읽을 만한/.test(text)) add("books", "관련 도서 추천받기");
    if (/집중|뽀모도로|타이머|쉬는 시간|공부 시간/.test(text)) add("pomodoro", "집중 타이머 열기");
    if (/성적|점수|정답률|학습 현황|얼마나 공부/.test(text)) add("progress", "학습 현황 확인하기");

    const academicQuestion = /수학|국어|영어|과학|사회|역사|문법|함수|방정식|개념|원리|공식|단원|풀이|왜|어떻게/.test(text);
    if (academicQuestion && !actions.some((item) => item.type === "exam-strategy")) {
      add("concept-note", "질문을 개념 노트로 정리");
      add("quiz", "이 내용으로 문제 풀기");
    }

    return actions.slice(0, 2);
  }

  function activeConversation() {
    return conversations.find((item) => item.id === activeConversationId) || null;
  }

  function snapshot() {
    let legacyAvailable = false;
    try { legacyAvailable = Boolean(localStorage.getItem(CHAT_STORAGE_KEY)); } catch {}
    return {
      activeConversationId,
      loadingConversationId,
      syncStatus,
      account: Boolean(accountUid),
      owner: accountUid || 'guest',
      legacyAvailable,
      conversations: conversations.map((item) => ({
        ...item,
        messages: item.messages.map((message) => ({ ...message })),
      })),
    };
  }

  function saveState() {
    try {
      localStorage.setItem(memory.scopeKey(accountUid), JSON.stringify({ activeConversationId, conversations, tombstones }));
    } catch {
      // Storage can be unavailable in restricted browser modes.
    }
  }

  function notifyHistory() {
    window.dispatchEvent(new CustomEvent("schems:chat-history", { detail: snapshot() }));
  }

  function hydrate() {
    try {
      const saved = JSON.parse(localStorage.getItem(memory.scopeKey(accountUid)) || "{}");
      conversations = Array.isArray(saved.conversations)
        ? saved.conversations.filter((item) => item?.id && Array.isArray(item.messages)).map((item) => ({
            id: String(item.id),
            title: String(item.title || "이전 대화"),
            createdAt: item.createdAt || new Date().toISOString(),
            updatedAt: item.updatedAt || item.createdAt || new Date().toISOString(),
            messages: item.messages.filter((message) => message?.role && typeof message.content === "string"),
          }))
        : [];
      activeConversationId = conversations.some((item) => item.id === saved.activeConversationId)
        ? saved.activeConversationId
        : conversations[0]?.id || null;
      tombstones = Array.isArray(saved.tombstones) ? saved.tombstones.map(memory.clean).filter(Boolean) : [];
      conversations = memory.merge(conversations, tombstones).filter(c => !c.deleted);
    } catch {
      conversations = [];
      activeConversationId = null;
      tombstones = [];
    }
  }

  async function persistRemote(conversation) {
    if (!accountUid) return;
    const uid = accountUid, epoch = authEpoch;
    const safe = memory.clean(conversation);
    pendingSaves.set(safe.id, safe);
    syncStatus = 'syncing'; notifyHistory();
    const queueKey = `${uid}:${safe.id}`;
    if (inFlightSaves.has(queueKey)) return;
    inFlightSaves.add(queueKey);
    try {
      while (epoch === authEpoch && pendingSaves.has(safe.id)) {
        const next = pendingSaves.get(safe.id);
        await window.ClassHubFirebase.saveChatConversation(uid, next);
        if (epoch !== authEpoch) return;
        if (pendingSaves.get(safe.id) === next) pendingSaves.delete(safe.id);
      }
      syncStatus = pendingSaves.size ? 'syncing' : 'synced';
    } catch {
      if (epoch !== authEpoch) return;
      syncStatus = 'offline';
    } finally {
      inFlightSaves.delete(queueKey);
    }
    notifyHistory();
  }

  function changeAccount(user) {
    const nextUid = user?.uid || null;
    if (nextUid === accountUid && remoteUnsubscribe) return;
    authEpoch++; requestAbort?.abort(); requestAbort = null;
    loadingConversationId = null; remoteUnsubscribe?.(); remoteUnsubscribe = null;
    pendingSaves.clear();studyCache=null;studyCacheAt=0;
    accountUid = nextUid; syncStatus = accountUid ? 'syncing' : 'local';
    conversations = []; activeConversationId = null; tombstones = [];
    hydrate(); renderAll(); notifyHistory();
    if (!accountUid) return;
    const epoch = authEpoch;
    remoteUnsubscribe = window.ClassHubFirebase.subscribeChatConversations(accountUid, rows => {
      if (epoch !== authEpoch) return;
      const merged = memory.merge([...conversations, ...tombstones], rows);
      conversations = merged.filter(c => !c.deleted); tombstones = merged.filter(c => c.deleted);
      if (!conversations.some(c => c.id === activeConversationId)) activeConversationId = null;
      syncStatus = pendingSaves.size ? 'syncing' : 'synced';
      saveState(); renderAll(); notifyHistory();
      const remoteMap = new Map(rows.map(c => [c.id, c]));
      merged.filter(c => !remoteMap.has(c.id) || c.updatedAt > remoteMap.get(c.id).updatedAt).forEach(c => persistRemote(c));
    }, () => { if (epoch === authEpoch) { syncStatus = 'offline'; notifyHistory(); } });
  }

  function ensureConversation(firstMessage) {
    let conversation = activeConversation();
    if (conversation) return conversation;
    const now = new Date().toISOString();
    conversation = {
      id: makeId(),
      title: titleFrom(firstMessage),
      createdAt: now,
      updatedAt: now,
      messages: [],
    };
    conversations = [conversation, ...conversations];
    activeConversationId = conversation.id;
    return conversation;
  }

  function newConversation() {
    activeConversationId = null;
    saveState();
    renderAll();
    notifyHistory();
  }

  function importLegacy() {
    if (!window.confirm('이 기기의 이전 대화가 본인의 기록인지 확인해주세요. 현재 계정으로 가져올까요? 다른 사람의 대화라면 취소하세요.')) return;
    try {
      const saved = JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY) || '{}');
      const existing = new Set(conversations.map(c => c.id));
      const incoming = (saved.conversations || []).map(memory.clean).filter(c => c && !existing.has(c.id));
      conversations = memory.merge(conversations, incoming).filter(c => !c.deleted);
      incoming.forEach(persistRemote);
      saveState(); renderAll(); notifyHistory();
    } catch { window.alert('이전 대화를 불러오지 못했습니다. 기존 기록은 삭제되지 않았습니다.'); }
  }

  function selectConversation(id) {
    if (!conversations.some((item) => item.id === id)) return false;
    activeConversationId = id;
    saveState();
    renderAll();
    notifyHistory();
    return true;
  }

  function deleteConversation(id) {
    if (!conversations.some((item) => item.id === id)) return false;
    const old = conversations.find(item => item.id === id);
    const removed = { ...old, messages: [], deleted: true, updatedAt: new Date().toISOString() };
    tombstones = [...tombstones.filter(item => item.id !== id), removed];
    conversations = conversations.filter((item) => item.id !== id);
    if (activeConversationId === id) activeConversationId = null;
    if (loadingConversationId === id) { requestAbort?.abort(); loadingConversationId = null; }
    saveState();
    renderAll();
    notifyHistory();
    persistRemote(removed);
    return true;
  }

  function renderSurface(surface) {
    const box = document.querySelector(surface.messages);
    if (!box) return;
    const conversation = activeConversation();
    const messages = conversation?.messages || [];

    if (!messages.length) {
      box.innerHTML = `
        <div class="ai-chat-empty">
          <div class="ai-chat-suggestions">
            ${SUGGESTIONS.map(
              (s) =>
                `<button type="button" class="ai-chat-chip pressable" data-ai-suggest="${escapeHtml(s)}">${escapeHtml(s)}</button>`
            ).join("")}
          </div>
        </div>`;
      return;
    }

    box.innerHTML = messages
      .map(
        (msg,index) => `
        <div class="ai-chat-bubble-row ${msg.role === "user" ? "is-user" : "is-assistant"}">
          <div class="ai-chat-response">
            <div class="ai-chat-bubble">${msg.role === "assistant" ? (window.PrimeMessageFormat?.format(msg.content) ?? escapeHtml(msg.content)) : escapeHtml(msg.content)}</div>
            ${msg.error&&index===messages.length-1&&msg.retryable!==false?`<button type="button" class="ai-chat-chip pressable" data-ai-retry="${index}" ${Date.now()<(msg.retryAt||0)?'disabled':''}>${Date.now()<(msg.retryAt||0)?'잠시 후 재시도':'다시 시도'}</button>`:''}
            ${msg.role === "assistant" && Array.isArray(msg.actions) && msg.actions.length
              ? `<div class="ai-module-recommendations"><span>이어서 학습하기</span>${msg.actions.map((action) => `<button type="button" class="ai-module-action pressable" data-ai-module="${escapeHtml(action.type)}" data-ai-module-prompt="${escapeHtml(action.prompt)}">${escapeHtml(action.label)}</button>`).join("")}</div>`
              : ""}
          </div>
        </div>`
      )
      .join("");

    if (loadingConversationId && loadingConversationId === conversation?.id) {
      box.innerHTML += `<div class="ai-chat-bubble-row is-assistant"><div class="ai-chat-bubble is-typing" role="status" aria-label="스도가 답변을 준비하고 있어요"><span class="sudo-typing-dots" aria-hidden="true"><i></i><i></i><i></i></span><span class="sr-only">답변 준비 중</span></div></div>`;
    }

    box.scrollTop = box.scrollHeight;
  }

  function renderAll() {
    surfaces.forEach(renderSurface);
  }

  async function sendMessage(text,retry=false) {
    const trimmed = String(text || "").trim();
    if (!trimmed || loadingConversationId) return;
    if (trimmed.length > 4000) { window.alert('질문은 4,000자 이내로 입력해주세요. 긴 필기는 개념 노트를 이용해주세요.'); return; }

    let conversation = ensureConversation(trimmed);
    const previous=conversation.messages.at(-1);if(retry&&previous?.error&&conversation.messages.at(-2)?.role==='user'&&conversation.messages.at(-2)?.content===trimmed){if(Date.now()<(previous.retryAt||0))return;conversation.messages.pop();}else conversation.messages.push({ role: "user", content: trimmed });
    conversation.title = conversation.messages.length === 1 ? titleFrom(trimmed) : conversation.title;
    conversation.updatedAt = new Date().toISOString();
    conversations = [conversation, ...conversations.filter((item) => item.id !== conversation.id)];
    loadingConversationId = conversation.id;
    saveState();
    renderAll();
    notifyHistory();
    persistRemote(conversation);
    const epoch = authEpoch;
    const controller = new AbortController(); requestAbort = controller;
    const timeout = setTimeout(() => controller.abort(), 60000);

    surfaces.forEach((surface) => {
      const input = document.querySelector(surface.input);
      if (input) input.value = "";
    });

    try {
      const user = window.ClassHubFirebase?.getCurrentUser?.();
      let token = user?.uid === accountUid && accountUid ? await bounded(()=>user.getIdToken(),5000,null) : null;
      if(accountUid&&!token)throw Object.assign(new Error('로그인 확인이 늦어지고 있어요. 다시 시도해주세요.'),{code:'AUTH_NOT_READY'});
      if (epoch !== authEpoch) return;
      const cached=studyCache&&Date.now()-studyCacheAt<120000?studyCache:null;
      const study = accountUid ? cached||await bounded(()=>Promise.resolve(window.ClassHubFirebase?.getChatStudyContext?.(accountUid)).catch(() => null),2500,studyCache) : null;
      if (epoch !== authEpoch) return;
      if(study&&!cached&&study!==studyCache){studyCache=study;studyCacheAt=Date.now();}
      const local=window.SchemsStudyAI?.getSnapshot?.()||{},grades=window.PrimeGradeNotebook?.getSnapshot?.()||{},integration=window.PrimeLearnerIntegration;
      const learnerContext=accountUid&&window.PrimeChatRequestCore?window.PrimeChatRequestCore.context({report:integration?.getSelfReport?.()||{},alerts:integration?.getAlerts?.()||[],academy:integration?.events?.()||[],study:local.owner===accountUid?local:study||{},grades:grades.owner===accountUid?grades:{}}):'';
      const payload={messages:window.PrimeChatRequestCore?.messages(conversation.messages)||conversation.messages.filter(m=>!m.error).slice(-24),scheduleContext:[learnerContext,getContext(),study?JSON.stringify(study):''].filter(Boolean).join('\n').slice(0,16000),accountMemory:[window.PrimePersonalData?.getContext?.()||'',accountUid?memory.context(conversations,conversation.id):''].filter(Boolean).join('\n\n')};
      const request=()=>fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        signal: controller.signal,
        body: JSON.stringify(payload),
      });
      let res=await request();if(res.status===401&&user?.uid===accountUid){token=await bounded(()=>user.getIdToken(true),5000,null);if(epoch!==authEpoch)return;if(token)res=await request();}

      const text = await res.text();
      let data; try { data = JSON.parse(text); } catch { data = { error: '스도 서버가 응답하지 않습니다. 잠시 후 다시 시도해주세요.' }; }
      if (epoch !== authEpoch || !conversations.some(item => item.id === conversation.id)) return;
      conversation = conversations.find(item => item.id === conversation.id);
      if (!res.ok) {
        conversation.messages.push({
          role: "assistant",
          content: data.error || "오류가 발생했습니다.",
          error: true,
          code:data.code||'PROVIDER_FAILURE',retryable:data.retryable!==false,retryAt:Date.now()+Math.min(60000,Math.max(0,Number(data.retryAfterMs)||0)),
          actions: recommendModules(trimmed),
        });
        if(data.retryAfterMs>0&&data.retryAfterMs<=60000)setTimeout(()=>{if(epoch===authEpoch)renderAll();},data.retryAfterMs+50);
      } else {
        conversation.messages.push({
          role: "assistant",
          content: typeof data.reply === 'string' && data.reply.trim() ? data.reply : '답변이 비어 있습니다. 다시 질문해주세요.',
          ...(!(typeof data.reply==='string'&&data.reply.trim())?{error:true,retryable:true,code:'AI_EMPTY_RESPONSE'}:{}),
          actions: Array.isArray(data.actions) ? data.actions.map(action=>({...action,prompt:trimmed})) : recommendModules(trimmed),
        });
      }
    } catch (error) {
      if (epoch !== authEpoch || !conversations.some(item => item.id === conversation.id)) return;
      conversation = conversations.find(item => item.id === conversation.id);
      conversation.messages.push({
        role: "assistant",
        content: error.code==='AUTH_NOT_READY'?error.message:error.name === 'AbortError' ? '답변 시간이 길어졌습니다. 다시 시도해주세요.' : '스도 서버에 연결하지 못했습니다. 다시 시도해주세요.',
        error: true,
        retryable:true,code:error.code||'AI_NETWORK_ERROR',
        actions: recommendModules(trimmed),
      });
    } finally {
      clearTimeout(timeout);
      if (epoch !== authEpoch || !conversations.some(item => item.id === conversation.id)) return;
      conversation.updatedAt = new Date().toISOString();
      loadingConversationId = null;
      saveState();
      renderAll();
      notifyHistory();
      persistRemote(conversation);
    }
  }

  function bindSurface(surface) {
    const form = document.querySelector(surface.form);
    const box = document.querySelector(surface.messages);

    form?.addEventListener("submit", (event) => {
      event.preventDefault();
      const input = document.querySelector(surface.input);
      sendMessage(input?.value);
    });

    box?.addEventListener("click", (event) => {
      const chip = event.target.closest("[data-ai-suggest]");
      if (chip) sendMessage(chip.dataset.aiSuggest);
      const retryButton=event.target.closest('[data-ai-retry]');if(retryButton){const rows=activeConversation()?.messages||[],index=Number(retryButton.dataset.aiRetry);if(index===rows.length-1&&rows[index]?.error&&rows[index-1]?.role==='user')sendMessage(rows[index-1].content,true);}
      const moduleButton = event.target.closest("[data-ai-module]");
      if (moduleButton) {
        window.dispatchEvent(new CustomEvent("prime:module-action", {
          detail: {
            type: moduleButton.dataset.aiModule,
            prompt: moduleButton.dataset.aiModulePrompt || "",
          },
        }));
      }
    });
  }

  function init(contextFn, surfaceList) {
    hydrate();
    getContext = typeof contextFn === "function" ? contextFn : () => "";
    surfaces = Array.isArray(surfaceList) ? surfaceList : [];
    surfaces.forEach(bindSurface);
    renderAll();
    notifyHistory();
    window.ClassHubFirebase?.onAuthStateChanged?.(changeAccount);
    window.addEventListener('online', () => { pendingSaves.forEach(c => persistRemote(c)); });
    document.querySelectorAll?.('[data-import-legacy-chat]')?.forEach(button => button.addEventListener('click', importLegacy));
  }

  window.SchemsScheduleAI = { init, sendMessage, renderAll, newConversation, selectConversation, deleteConversation, importLegacy, getState: snapshot };
})();
