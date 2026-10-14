(function () {
  'use strict';
  const button = document.getElementById('aiFabButton');
  const panel = document.getElementById('aiFabPanel');
  const holder = button?.querySelector('.sudo-ai-character');
  const assets = window.PrimeSudoAssets;
  document.querySelectorAll('[data-sudo-home-logo]').forEach(logo => {
    if (logo.classList.contains('sudo-glass-portrait')) return;
    if (!assets?.idle) return;
    logo.innerHTML = assets.idle;
    const face=logo.querySelector('svg');
    face?.pauseAnimations?.();face?.setCurrentTime?.(0);
  });
  if (!button || !panel || !holder || !assets) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const desktop = window.matchMedia('(min-width: 1000px)');
  const labels = { idle: '스도 AI 도우미', thinking: '스도 · 답변을 생각하는 중', answering: '스도 · 답변 도착', complete: '스도 · 답변 확인', checking: '스도 · 다시 확인' };
  let state = '';
  let loadingId = null;
  let timers = [];
  let dragging = false;
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }
  function syncPlayback() {
    const svg = holder.querySelector('svg');
    if (!svg) return;
    const hidden = button.disabled || document.hidden || getComputedStyle(button.parentElement).display === 'none';
    if (reduced.matches) { svg.pauseAnimations?.(); svg.setCurrentTime?.(0); }
    else if (hidden || dragging) { svg.pauseAnimations?.(); if(dragging) svg.setCurrentTime?.(0); }
    else svg.unpauseAnimations?.();
  }
  function syncLabel() {
    const open = !panel.hidden;
    button.setAttribute('aria-expanded', String(open));
    button.setAttribute('aria-label', `${labels[state] || labels.idle} ${open ? '닫기' : '열기'}`);
    button.title = '클릭해서 질문 · 잡고 이동 · 흔들거나 던지기 · 길게 눌러보기';
  }
  function setState(next) {
    if (!assets[next]) return;
    if (state !== next) {
      state = next;
      // These strings are generated from our own SVGs, never from AI/user input.
      holder.innerHTML = assets[next];
      button.dataset.sudoState = next;
    }
    syncLabel(); syncPlayback();
  }
  function onHistory(snapshot) {
    if (!snapshot) return;
    const nextLoading = snapshot.loadingConversationId || null;
    const previousLoading = loadingId;
    loadingId = nextLoading;
    if (nextLoading) { clearTimers(); setState('thinking'); return; }
    if (previousLoading) {
      clearTimers();
      const conversation = snapshot.conversations?.find(item => item.id === previousLoading);
      const last = conversation?.messages?.at(-1);
      if (!last || last.role !== 'assistant') { setState('idle'); return; }
      // A reply can contain an error; don't celebrate or imply success.
      setState('answering');
      timers.push(setTimeout(() => setState('idle'), 3400));
    }
  }
  window.addEventListener('schems:chat-history', event => onHistory(event.detail));
  window.addEventListener('prime:sudo-burst',syncPlayback);
  window.addEventListener('prime:sudo-revive',syncPlayback);
  window.addEventListener('prime:sudo-return-complete',syncPlayback);
  window.addEventListener('prime:sudo-drag', event => {
    const next = ['start','move','flight','impact'].includes(event.detail.phase);
    if (dragging !== next) { dragging = next; syncPlayback(); }
  });
  document.addEventListener('visibilitychange', syncPlayback);
  reduced.addEventListener('change', syncPlayback);
  desktop.addEventListener('change', syncPlayback);
  new MutationObserver(() => { syncLabel(); syncPlayback(); }).observe(panel, { attributes: true, attributeFilter: ['hidden'] });
  new MutationObserver(syncPlayback).observe(document.body, { attributes: true, attributeFilter: ['data-active-tab', 'class'] });
  button.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !panel.hidden) document.getElementById('aiFabClose')?.click();
  });
  panel.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    document.getElementById('aiFabClose')?.click();
    button.focus({ preventScroll: true });
  });
  document.getElementById('aiFabClose')?.addEventListener('click', () => button.focus({ preventScroll: true }));
  setState('idle');
  onHistory(window.SchemsScheduleAI?.getState?.());
})();
