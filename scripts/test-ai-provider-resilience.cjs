const assert = require('node:assert/strict');
(async () => {
  const { createBudget, requestJson, providerError } = await import('../netlify/functions/ai-provider-transport.mjs');
  const core = await import('../netlify/functions/study-ai-core.mjs');
  const planHandler = (await import('../netlify/functions/generateStudyPlan.mjs')).handler;
  const success = () => new Response(JSON.stringify({ ok: true }));
  const failure = (status, message = 'private provider text', headers) => new Response(JSON.stringify({ error: { message, status: 'UNAVAILABLE' } }), { status, headers });
  let calls = 0, waits = [], time = 1000;
  const deps = { fetcher: async () => ++calls === 1 ? failure(503) : success(), wait: async ms => { waits.push(ms); time += ms; }, random: () => 0 };
  const budget = createBudget(() => time);
  assert.deepEqual(await requestJson('https://example.invalid', { body: 'same request' }, budget, deps), { ok: true });
  assert.equal(calls, 2); assert.deepEqual(waits, [500]);
  for (const [status, message, code] of [
    [400, 'bad parameter', 'AI_REQUEST_REJECTED'], [400, 'API key not valid', 'AI_KEY_REJECTED'],
    [400, 'Free tier is not available in your country. Enable billing', 'AI_BILLING_UNAVAILABLE'],
    [401, 'secret', 'AI_KEY_REJECTED'], [403, 'secret', 'AI_KEY_REJECTED'], [402, 'Prepay credit balance depleted', 'AI_BILLING_UNAVAILABLE'],
    [404, 'secret', 'AI_MODEL_UNAVAILABLE'], [429, 'Daily quota exhausted', 'AI_QUOTA_EXCEEDED'], [429, 'limit: 0', 'AI_QUOTA_EXCEEDED'],
  ]) {
    calls = 0;
    await assert.rejects(requestJson('https://example.invalid', {}, createBudget(), { fetcher: async () => { calls++; return failure(status, message); }, wait: async () => { throw Error('must not retry'); } }), error => {
      assert.equal(error.code, code); assert.equal(error.retryable, false); assert.equal(error.providerStatus, status); assert(!error.message.includes('secret')); return true;
    });
    assert.equal(calls, 1);
  }
  calls = 0; waits = [];
  await requestJson('https://example.invalid', {}, createBudget(), { fetcher: async () => ++calls === 1 ? failure(429, 'Requests per minute rate limit exceeded', { 'retry-after': '2' }) : success(), wait: async ms => waits.push(ms), random: () => 0 });
  assert.equal(calls, 2); assert.deepEqual(waits, [2000]);
  calls = 0;
  await assert.rejects(requestJson('https://example.invalid', {}, createBudget(), { fetcher: async () => { calls++; return failure(503, '', { 'retry-after': '60' }); }, wait: async () => { throw Error('long retry must not wait'); } }), e => e.retryAfterMs === 60000);
  assert.equal(calls, 1);
  calls = 0;
  await requestJson('https://example.invalid', {}, createBudget(), { fetcher: async () => { if (++calls === 1) throw new TypeError('fetch failed private URL'); return success(); }, wait: async () => {} });
  assert.equal(calls, 2);
  calls = 0;
  const slowBudget = createBudget(() => 1000,{deadlineMs:32000,requestTimeoutMs:12000});
  await assert.rejects(requestJson('https://example.invalid', {}, slowBudget, {fetcher:async()=>{calls++;throw Object.assign(new Error('timeout'),{name:'TimeoutError'});},wait:async()=>{throw Error('a timed-out primary must not be repeated');}}),e=>e.code==='AI_CONNECTION_TIMEOUT');
  assert.equal(calls,1);assert.equal(slowBudget.requestTimeoutMs,12000);
  calls = 0;
  await requestJson('https://example.invalid', {}, createBudget(), { fetcher: async () => ++calls === 1 ? new Response('<html>bad gateway</html>', { status: 503 }) : success(), wait: async () => {} });
  assert.equal(calls, 2);
  const expired = createBudget(() => 0); expired.deadline = 1;
  await assert.rejects(requestJson('https://example.invalid', {}, expired, { fetcher: async () => failure(503), wait: async () => { throw Error('budget must not sleep'); } }), e => e.code === 'AI_TEMPORARY_UNAVAILABLE');
  const exhausted = createBudget(); exhausted.requests = exhausted.maxRequests;
  await assert.rejects(requestJson('https://example.invalid', {}, exhausted, { fetcher: async () => { throw Error('request limit bypassed'); } }), e => e.code === 'AI_CONNECTION_TIMEOUT');
  assert.equal(providerError(503, { error: { status: '<private>', message: 'api-key=secret' } }).providerReason, undefined);

  const realFetch = global.fetch, names = ['AI_API_KEY','AI_PROVIDER','AI_MODEL','AI_FALLBACK_MODEL'], old = Object.fromEntries(names.map(n => [n, process.env[n]]));
  process.env.AI_API_KEY = 'test-key-never-real'; process.env.AI_PROVIDER = 'gemini'; process.env.AI_MODEL = 'gemini-3.5-flash'; delete process.env.AI_FALLBACK_MODEL;
  const response = (text, finishReason = 'STOP') => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] }, finishReason }] }));
  const seen = [];
  try {
    global.fetch = async (url, options) => {
      seen.push({ url: String(url), headers: options.headers, body: JSON.parse(options.body) });
      return String(url).includes('gemini-3.6-flash') ? failure(503) : response('{"tasks":[{"title":"검수","minutes":10}]}');
    };
    assert.equal(JSON.parse(await core.callOpenAI('rules', 'synthetic only')).tasks.length, 1);
    assert.equal(seen.length, 3); assert.equal(seen[0].body.generationConfig.thinkingConfig.thinkingLevel, 'low');
    assert(seen[0].url.includes('gemini-3.6-flash'), 'legacy model resolves to active documented alias');
    assert(seen[2].url.includes('gemini-3.5-flash-lite')); assert.equal(seen[2].body.generationConfig.thinkingConfig.thinkingLevel, 'low');
    assert(seen.every(x => !x.url.includes('test-key') && !x.url.includes('?key=')));
    assert(seen.every(x => x.headers['x-goog-api-key'] === 'test-key-never-real'));
    seen.length=0;
    global.fetch=async(url,options)=>{
      seen.push({url:String(url),body:JSON.parse(options.body)});
      if(String(url).includes('gemini-3.6-flash'))throw Object.assign(new Error('synthetic timeout'),{name:'TimeoutError'});
      return response('{"summary":"검수용 피드백"}');
    };
    assert.equal(JSON.parse(await core.callOpenAI('rules','synthetic',true,{interactive:true,maxOutputTokens:2048})).summary,'검수용 피드백');
    assert.equal(seen.length,2,'slow primary immediately yields to fallback');
    assert.equal(seen[1].body.generationConfig.thinkingConfig.thinkingLevel,'minimal');
    assert(seen.every(x=>x.body.generationConfig.maxOutputTokens===2048));
    for (const status of [401, 429]) {
      seen.length = 0; global.fetch = async url => { seen.push(url); return failure(status); };
      await assert.rejects(core.callOpenAI('rules', 'synthetic only'), e => e.retryable === false); assert.equal(seen.length, 1, 'no model/account quota or auth bypass');
    }
    global.fetch = async () => response('{"tasks":', 'MAX_TOKENS');
    await assert.rejects(core.callOpenAI('rules', 'synthetic only'), e => e.code === 'AI_RESPONSE_TRUNCATED');
    assert.throws(() => core.parseAiJson('invalid'), e => e.code === 'AI_INVALID_RESPONSE');
    assert.deepEqual(core.parseAiJson('```json\n{"tasks":[]}\n```'), { tasks: [] });
    global.fetch = async () => response('{"tasks":[]}');
    const invalid = await planHandler({ httpMethod: 'POST', body: '{"goal":"검수"}' });
    assert.equal(invalid.statusCode, 502); assert.equal(JSON.parse(invalid.body).code, 'AI_INVALID_RESPONSE');
    global.fetch = async () => response('{"tasks":[{"title":"검수 복습","minutes":10}]}');
    const valid = await planHandler({ httpMethod: 'POST', body: '{"goal":"검수"}' });
    assert.equal(valid.statusCode, 200);
  } finally {
    global.fetch = realFetch; for (const n of names) if (old[n] === undefined) delete process.env[n]; else process.env[n] = old[n];
  }
  console.log('PASS AI provider: bounded transient retries/deadline, Retry-After, no quota/key/billing retry or failover, same-provider model failover, safe diagnostics, secret-free URLs, JSON truncation/empty plan validation.');
})().catch(error => { console.error(error); process.exitCode = 1; });
