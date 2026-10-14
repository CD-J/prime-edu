(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PrimeChatMemory = factory();
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  const KEY = 'primeEdu.sudoChats.v2';
  const scopeKey = uid => `${KEY}.${uid || 'guest'}`;
  function clean(raw) {
    if (!raw || !/^[a-zA-Z0-9_-]{1,120}$/.test(String(raw.id || ''))) return null;
    const result = {
      id: String(raw.id), title: String(raw.title || '새 대화').slice(0, 120),
      createdAt: String(raw.createdAt || new Date().toISOString()),
      updatedAt: String(raw.updatedAt || raw.createdAt || new Date().toISOString()),
      deleted: raw.deleted === true,
      messages: (Array.isArray(raw.messages) ? raw.messages : []).filter(m => m && ['user', 'assistant'].includes(m.role) && typeof m.content === 'string')
        .slice(-120).map(m => ({ role: m.role, content: m.content.slice(0, 6000), ...(m.error ? { error: true,retryable:m.retryable!==false,code:/^[A-Z_]{1,40}$/.test(m.code)?m.code:'PROVIDER_FAILURE',retryAt:Number.isFinite(m.retryAt)?m.retryAt:0 } : {}),
          ...(Array.isArray(m.actions) ? { actions: m.actions.filter(a => a?.type && a?.label).slice(0, 2).map(a => ({ type: String(a.type), label: String(a.label).slice(0, 80), prompt: String(a.prompt || '').slice(0, 4000) })) } : {}) })),
    };
    let size = result.messages.reduce((sum, message) => sum + message.content.length, 0);
    while (size > 90000 && result.messages.length > 1) size -= result.messages.shift().content.length;
    return result;
  }
  function merge(local, remote) {
    const map = new Map();
    [...(local || []), ...(remote || [])].forEach(raw => {
      const item = clean(raw); if (!item) return;
      const old = map.get(item.id);
      if (!old || item.updatedAt >= old.updatedAt) map.set(item.id, item);
    });
    return [...map.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 50);
  }
  function context(items, activeId) {
    return (items || []).filter(c => !c.deleted && c.id !== activeId).slice(0, 8).map(c => {
      // Prior questions preserve user goals; model guesses/errors are not permanent facts.
      const questions = c.messages.filter(m => m.role === 'user' && !m.error).slice(-3).map(m => m.content.slice(0, 700));
      return `대화: ${c.title}\n기록일: ${c.updatedAt}\n학생이 말했던 내용:\n${questions.join('\n')}`;
    }).join('\n\n').slice(0, 8000);
  }
  return { scopeKey, clean, merge, context };
});
