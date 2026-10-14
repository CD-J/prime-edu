/* Small, feature-detected bridges for the app's existing record models. */
(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.PrimeCompat = api; api.install(); }
})(typeof window === 'object' ? window : globalThis, function (root) {
  'use strict';
  function cloneData(value) {
    if (typeof root.structuredClone === 'function') return root.structuredClone(value);
    const seen = new WeakMap();
    function copy(item) {
      if (typeof item === 'function' || typeof item === 'symbol') throw new TypeError('Record data must be cloneable.');
      if (item === null || typeof item !== 'object') return item;
      if (seen.has(item)) return seen.get(item);
      const kind = Object.prototype.toString.call(item);
      if (kind === '[object Date]') return new Date(item.getTime());
      if (kind === '[object RegExp]') return new RegExp(item.source, item.flags);
      if (kind !== '[object Object]' && kind !== '[object Array]') throw new TypeError('Unsupported record data.');
      const next = Array.isArray(item) ? new Array(item.length) : {};
      seen.set(item, next);
      Object.keys(item).forEach(key => Object.defineProperty(next, key, {
        value: copy(item[key]), enumerable: true, writable: true, configurable: true,
      }));
      return next;
    }
    return copy(value);
  }
  function install() {
    if (!Object.hasOwn) Object.defineProperty(Object, 'hasOwn', {
      configurable: true, writable: true,
      value: (object, key) => Object.prototype.hasOwnProperty.call(object, key),
    });
    if (!Array.prototype.at) Object.defineProperty(Array.prototype, 'at', {
      configurable: true, writable: true,
      value: function (index) {
        if (this == null) throw new TypeError('Array.at requires a receiver.');
        const object = Object(this), length = Math.min(Math.max(Number(object.length) || 0, 0), Number.MAX_SAFE_INTEGER);
        const number = Number(index) || 0, integer = Math.trunc(number), position = integer < 0 ? length + integer : integer;
        return position < 0 || position >= length ? undefined : object[position];
      },
    });
    if (!root.document || root.CSS?.supports('color', 'color-mix(in srgb,white,black)')) return;
    const doc = root.document, html = doc.documentElement;
    function updateColors() {
      const dark = html.dataset.theme === 'dark';
      const accent = root.getComputedStyle(html).getPropertyValue('--shell-blue').trim() || '#176b48';
      const palette = legacyPalette(accent, dark);
      Object.keys(palette).forEach(key => html.style.setProperty(key, palette[key]));
    }
    new root.MutationObserver(updateColors).observe(html, { attributes:true, attributeFilter:['data-theme','data-accent'] });
    doc.addEventListener('DOMContentLoaded', updateColors, { once:true });
  }
  function mix(first, second, ratio) {
    const rgb = hex => /^#[\da-f]{6}$/i.test(hex) ? [1,3,5].map(i => parseInt(hex.slice(i,i+2),16)) : [23,107,72];
    const a = rgb(first), b = rgb(second);
    return '#' + a.map((v,i) => Math.round(v*ratio+b[i]*(1-ratio)).toString(16).padStart(2,'0')).join('');
  }
  function legacyPalette(accent, dark) {
    const card = dark ? mix(accent,'#181c22',.04) : '#ffffff';
    const ink = dark ? '#f5f7fa' : '#17191c', bg = mix(accent,dark?'#101319':'#f7f8fa',.03);
    const edge = mix(ink,card,.09), inset = mix(accent,card,.04), standby = mix(accent,'#f4f1fb',.54);
    return {
      '--shell-card':card, '--shell-bg':bg, '--shell-line':mix(accent,dark?'#2b3038':'#e5e8eb',.1),
      '--shell-shadow':dark?'0 12px 32px rgba(0,0,0,.24)':'0 10px 26px rgba(20,30,40,.07)',
      '--glass-sheet':mix(accent,card,.03), '--glass-chrome':card, '--glass-inset':inset,
      '--glass-edge':edge, '--glass-muted':mix(ink,card,.74), '--finish-edge-soft':edge,
      '--glass-control-fill':standby, '--surface-strong':inset,
      '--legacy-active-fill':mix(accent,card,.09), '--legacy-active-edge':mix(accent,edge,.24),
      '--legacy-glass-body':mix(accent,card,.24), '--legacy-glass-tone':mix(accent,card,.55),
      '--legacy-glass-deep':mix(accent,card,.78), '--legacy-glass-prism':mix(accent,card,.18),
      '--legacy-sudo-fill':mix(accent,dark?'#262a32':'#ffffff',.08), '--legacy-standby-accent':standby,
    };
  }
  return { cloneData, install, legacyPalette };
});
