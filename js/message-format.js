/* AI text is untrusted: escape first, then add only our own inline markup. */
(function (root) {
  function escape(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function format(value) {
    return String(value ?? '').split(/(```[\s\S]*?```|`[^`\n]+`)/g).map(part => {
      if (part.startsWith('```') && part.endsWith('```')) return `<pre><code>${escape(part.slice(3,-3).replace(/^\w*\n/,''))}</code></pre>`;
      if (part.startsWith('`') && part.endsWith('`')) return `<code>${escape(part.slice(1,-1))}</code>`;
      return escape(part).replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    }).join('');
  }
  root.PrimeMessageFormat = { format, escape };
  if (typeof module !== 'undefined') module.exports = { format, escape };
})(typeof window !== 'undefined' ? window : globalThis);
