(function () {
  'use strict';
  // Keep keyboard/rotation geometry separate from layout zoom and account data.
  function visibleViewport(layoutHeight, visualHeight, visualTop) {
    const height = Math.max(0, Number(layoutHeight) || 0);
    const top = Math.max(0, Math.min(height, Number(visualTop) || 0));
    const visible = Number.isFinite(Number(visualHeight)) && Number(visualHeight) > 0 ? Number(visualHeight) : height;
    return { top, height: Math.max(0, Math.min(visible, height - top)) };
  }
  if (typeof module === 'object' && module.exports) { module.exports = { visibleViewport }; return; }
  let frame = 0, last = '';
  function update() {
    frame = 0;
    const view = window.visualViewport;
    const layoutHeight = document.documentElement.clientHeight || window.innerHeight;
    const size = visibleViewport(layoutHeight, view?.height, view?.offsetTop);
    const focused = document.activeElement;
    const editing = focused && (['INPUT', 'TEXTAREA', 'SELECT'].includes(focused.tagName) || focused.isContentEditable);
    // Scale-normalize height so pinch zoom isn't mistaken for a keyboard.
    // Keep the state through blur until the actual keyboard retracts.
    const wasOpen = document.body?.classList.contains('mobile-keyboard-open');
    const keyboard = Boolean((editing || wasOpen) && layoutHeight - (view?.height || size.height) * (view?.scale || 1) > 120);
    const width = view?.width || document.documentElement.clientWidth || window.innerWidth || 0;
    const left = Math.max(0, view?.offsetLeft || 0);
    const values = [size.height, size.top, width, left].map(n => Math.round(n * 2) / 2);
    const key = values.join(',') + ',' + keyboard;
    if (key === last) return;
    last = key;
    ['height','top','width','left'].forEach((name,i) => document.documentElement.style.setProperty(`--mobile-visible-${name}`, `${values[i]}px`));
    document.body?.classList.toggle('mobile-keyboard-open', keyboard);
  }
  function schedule() { if (!frame) frame = requestAnimationFrame(update); }
  window.addEventListener('resize', schedule, { passive: true });
  window.visualViewport?.addEventListener('resize', schedule, { passive: true });
  window.visualViewport?.addEventListener('scroll', schedule, { passive: true });
  document.addEventListener?.('focusin', schedule, { passive: true });
  document.addEventListener?.('focusout', schedule, { passive: true });
  update();
})();
