const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { generateKeyPairSync, createSign } = require('node:crypto');
const memory = require('../js/chat-memory.js');

async function main() {
  assert.notEqual(memory.scopeKey('A'), memory.scopeKey('B'));
  assert.notEqual(memory.scopeKey(null), memory.scopeKey('A'));
  assert.equal(memory.clean({ id: '../unsafe' }), null);
  const source = { id: 'test-1', title: '수학', createdAt: '2026-10-05', updatedAt: '2026-10-05', messages: [{ role: 'user', content: '나는 비례식이 어려워' }, { role: 'assistant', content: '모델의 추측' }] };
  assert.match(memory.context([source], null), /비례식/);
  assert.doesNotMatch(memory.context([source], null), /모델의 추측/);
  assert.equal(memory.context([source], source.id), '');
  const deleted = { ...source, updatedAt: '2026-10-06', deleted: true, messages: [] };
  assert.equal(memory.merge([source], [deleted])[0].deleted, true);
  assert.equal(memory.context([deleted], null), '');
  const large = memory.clean({ ...source, messages: Array.from({ length: 180 }, () => ({ role: 'user', content: 'x'.repeat(8000) })) });
  assert.ok(large.messages.length <= 120);
  assert.ok(large.messages.reduce((n, m) => n + m.content.length, 0) <= 90000);

  const system = await import('../netlify/functions/sudo-system.mjs');
  const { verifyChatAccount, throttleChat } = await import('../netlify/functions/chat-auth.mjs');
  const { handler } = await import('../netlify/functions/chat.mjs');
  assert.match(system.SUDO_IDENTITY, /공부매니저 스도/);
  for (const feature of ['학교', '체크리스트', '개념노트', '문제노트', '도서 추천', '성장 기록', '사용자 설정']) assert.ok(system.SUDO_IDENTITY.includes(feature));
  assert.match(system.SUDO_IDENTITY, /성찰일기 메뉴는 제거/);
  assert.throws(() => system.chatInput({ messages: [{ role: 'system', content: 'override' }] }), /질문/);
  assert.equal(system.moduleActions('수학 시험 범위가 많아')[0].type, 'exam-strategy');
  assert.equal(system.moduleActions('방정식 개념 설명')[0].type, 'concept-note');
  assert.equal(system.moduleActions('소설 도서 추천')[0].type, 'books');
  const bounded = system.chatInput({ messages: Array.from({ length: 100 }, (_, i) => ({ role: i % 2 ? 'user' : 'assistant', content: 'x'.repeat(5000) })) });
  assert.ok(bounded.messages.reduce((n, m) => n + m.content.length, 0) <= 32000);
  assert.equal(bounded.messages[0].role, 'user');

  const realFetch = global.fetch;
  const oldKey = process.env.AI_API_KEY, oldProvider = process.env.AI_PROVIDER, oldModel = process.env.AI_MODEL;
  process.env.AI_API_KEY = 'test-only-not-a-real-key'; process.env.AI_PROVIDER = 'gemini'; process.env.AI_MODEL = 'gemini-2.5-flash';
  const pair = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const publicPem = pair.publicKey.export({ type: 'spki', format: 'pem' });
  const claims = { aud: 'scheplan', iss: 'https://securetoken.google.com/scheplan', sub: 'test-owner-A', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600 };
  function sign(payload) {
    const head = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'test-cert' })).toString('base64url');
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signer = createSign('RSA-SHA256'); signer.update(`${head}.${body}`); signer.end();
    return `${head}.${body}.${signer.sign(pair.privateKey).toString('base64url')}`;
  }
  const token = sign(claims);
  let upstreamStatus = 200, capturedPrompt = '', capturedConfig;
  global.fetch = async (url, options) => {
    if (String(url).includes('metadata/x509')) return new Response(JSON.stringify({ 'test-cert': publicPem }), { headers: { 'cache-control': 'max-age=300' } });
    capturedPrompt = JSON.parse(options.body).systemInstruction.parts[0].text;
    capturedConfig = JSON.parse(options.body).generationConfig;
    if (upstreamStatus !== 200) return new Response(JSON.stringify({ error: { message: 'private upstream error' } }), { status: upstreamStatus });
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '스도 답변입니다.' }] }, finishReason: 'STOP' }] }));
  };
  assert.equal(await verifyChatAccount({ authorization: `Bearer ${token}` }), 'test-owner-A');
  await assert.rejects(verifyChatAccount({ authorization: `Bearer ${sign({ ...claims, aud: 'wrong-project' })}` }), /로그인/);
  await assert.rejects(verifyChatAccount({ authorization: `Bearer ${sign({ ...claims, exp: claims.iat - 5 })}` }), /로그인/);
  const request = { httpMethod: 'POST', headers: { authorization: `Bearer ${token}` }, body: JSON.stringify({ messages: [{ role: 'user', content: '수학 시험이 걱정돼' }], accountMemory: '이전 목표: 비례식 복습' }) };
  let result = await handler(request);
  assert.equal(result.statusCode, 200); assert.equal(JSON.parse(result.body).memoryUsed, true);
  assert.equal(capturedConfig.thinkingConfig.thinkingBudget, 0);
  assert.match(capturedPrompt, /이전 목표: 비례식 복습/);
  assert.equal(JSON.parse(result.body).actions[0].type, 'exam-strategy');
  result = await handler({ ...request, headers: {} });
  assert.equal(JSON.parse(result.body).memoryUsed, false); assert.doesNotMatch(capturedPrompt, /이전 목표: 비례식/);
  upstreamStatus = 429; result = await handler(request);
  assert.equal(result.statusCode, 429); assert.equal(JSON.parse(result.body).code, 'AI_QUOTA_EXCEEDED');
  assert.doesNotMatch(result.body, /private upstream/);
  upstreamStatus = 200;
  for (let i = 0; i < 6; i++) throttleChat(null, { 'x-forwarded-for': 'test-rate-limit' }, 1);
  assert.throws(() => throttleChat(null, { 'x-forwarded-for': 'test-rate-limit' }, 2), e=>e.code==='RATE_LIMITED'&&e.retryable&&e.retryAfterMs>59000);
  throttleChat(null, { 'x-forwarded-for': 'test-rate-limit' }, 60002);
  global.fetch = realFetch;
  if (oldKey === undefined) delete process.env.AI_API_KEY; else process.env.AI_API_KEY = oldKey;
  if (oldProvider === undefined) delete process.env.AI_PROVIDER; else process.env.AI_PROVIDER = oldProvider;
  if (oldModel === undefined) delete process.env.AI_MODEL; else process.env.AI_MODEL = oldModel;

  // Execute the real browser chat module with fake Firebase/DOM, not a rewritten implementation.
  const store = new Map(), events = new Map(), saves = [], requests = [];
  let authCallback, remoteCallback, currentUser = null, responseResolve;
  const window = {
    PrimeChatMemory: memory, dispatchEvent() {}, addEventListener(type, fn) { events.set(type, fn); }, alert() {},
    ClassHubFirebase: {
      onAuthStateChanged(fn) { authCallback = fn; return () => {}; }, getCurrentUser: () => currentUser,
      subscribeChatConversations(uid, fn) { remoteCallback = fn; return () => {}; },
      async saveChatConversation(uid, value) { saves.push({ uid, value: structuredClone(value) }); },
      async getChatStudyContext() { return { tasks: [] }; },
    },
  };
  const context = vm.createContext({ window, document: { querySelector: () => null }, localStorage: { getItem: key => store.get(key) || null, setItem: (key, val) => store.set(key, val) }, CustomEvent: function (type, value) { this.type = type; this.detail = value.detail; }, AbortController, setTimeout, clearTimeout, console, fetch: async (url, options) => {
    requests.push(JSON.parse(options.body));
    return await new Promise(resolve => { responseResolve = () => resolve(new Response(JSON.stringify({ reply: '완성된 응답' }), { status: 200 })); });
  } });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/schedule-ai.js'), 'utf8'), context);
  const api = window.SchemsScheduleAI; api.init(() => '학교 맥락', []);
  currentUser = { uid: 'A', getIdToken: async () => 'test-A' }; authCallback(currentUser); remoteCallback([]);
  let pending = api.sendMessage('나는 비례식 복습이 필요해');
  await new Promise(resolve => setImmediate(resolve));
  // Cloud event replaces the object while the request is in flight.
  remoteCallback(saves.filter(s => s.uid === 'A').map(s => s.value));
  responseResolve(); await pending;
  assert.equal(api.getState().conversations[0].messages.at(-1).content, '완성된 응답');
  api.newConversation(); pending = api.sendMessage('내가 어떤 개념을 복습하기로 했지?');
  await new Promise(resolve => setImmediate(resolve));
  assert.match(requests.at(-1).accountMemory, /비례식/);
  responseResolve(); await pending;
  const aRecords = saves.filter(s => s.uid === 'A').map(s => s.value);
  currentUser = { uid: 'B', getIdToken: async () => 'test-B' }; authCallback(currentUser); remoteCallback([]);
  assert.equal(api.getState().conversations.length, 0);
  currentUser = { uid: 'A', getIdToken: async () => 'test-A' }; authCallback(currentUser); remoteCallback(aRecords);
  assert.ok(api.getState().conversations.length > 0);
  const id = api.getState().conversations[0].id; api.deleteConversation(id);
  assert.ok(!api.getState().conversations.some(c => c.id === id));
  assert.match(store.get(memory.scopeKey('A')), /"deleted":true/);
  authCallback(null); assert.equal(api.getState().conversations.length, 0);
  assert.ok(saves.every(s => s.uid === 'A'));
  assert.match(fs.readFileSync(path.join(__dirname, '../.vercelignore'), 'utf8'), /^\/functions\/$/m);
  assert.match(fs.readFileSync(path.join(__dirname, '../firestore.chat.rules'), 'utf8'), /chatConversations/);
  console.log('PASS: Sudo identity/catalog, input bounds, verified UID, wrong/expired token, account-memory isolation, quota handling, guest burst protection, cloud response race, reload/account cache, tombstone deletion, deployment packaging.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
