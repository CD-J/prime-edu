const assert=require('node:assert/strict'),fs=require('node:fs');
const I=require('../js/ui-icons.js');
const read=f=>fs.readFileSync(require.resolve('../'+f),'utf8');
for(const name of Object.keys(I.paths)){
  const svg=I.svg(name);
  assert.match(svg,/viewBox="0 0 24 24"/);
  assert.match(svg,/stroke-width="1.8"/);assert.match(svg,/stroke-linecap="round"/);assert.match(svg,/stroke-linejoin="round"/);
  assert.match(svg,/fill="none"/);assert.match(svg,/stroke="currentColor"/);
  assert.match(svg,/aria-hidden="true"/);assert.match(svg,/focusable="false"/);
  assert(svg.includes(`data-ui-icon="${name}"`));
}
// Same shaft-less pair, mirrored about x=12. Return is intentionally different.
assert.equal(I.paths.previous,'m15 6-6 6 6 6');assert.equal(I.paths.arrow,'m9 6 6 6-6 6');assert.notEqual(I.paths.previous,I.paths.back);
function slot(name,tag='SPAN',text=''){
  const attrs={},classes=new Set();let html='',writes=0;
  return {nodeType:1,tagName:tag,dataset:name?{uiIcon:name}:{},textContent:text,
    classList:{contains:c=>classes.has(c),add:c=>classes.add(c)},setAttribute:(k,v)=>attrs[k]=v,
    querySelector:()=>html.includes('prime-icon')?{}:null,
    get innerHTML(){return html},set innerHTML(v){html=v;writes++;this.textContent='';},get writes(){return writes},attrs};
}
const raw=slot('calendar','svg');I.polishSymbol(raw);assert(raw.innerHTML.includes(I.paths.calendar));assert.equal(raw.attrs['stroke-width'],'1.8');assert.equal(raw.attrs['aria-hidden'],'true');
I.polishSymbol(raw);assert.equal(raw.writes,1,'self-mutations must not repaint forever');
const glyph=slot(null,'B','＋');I.polishSymbol(glyph);assert(glyph.innerHTML.includes(I.paths.plus));
I.polishSymbol(glyph);assert.equal(glyph.writes,1);glyph.textContent='−';glyph.innerHTML='−';glyph.textContent='−';I.polishSymbol(glyph);assert(glyph.innerHTML.includes(I.paths.minus));
const prose=slot(null,'SPAN','공부 계획');I.polishSymbol(prose);assert.equal(prose.writes,0,'never touch user text');
const html=read('index.html'),css=read('js/icon-consistency.css'),js=read('js/ui-icons.js');
const staticIcons=[...html.matchAll(/<svg\b([^>]*)><path d="[^"]+"\/><\/svg>/g)].filter(m=>m[1].includes('0 0 24 24'));
assert(staticIcons.length>=41);for(const m of staticIcons)assert.match(m[1],/data-ui-icon=/);
assert(!html.includes('data-ui-symbol aria-hidden="true"></span>'),'no accidental blank symbol migration');
assert.match(html,/topBtn.innerHTML = window.PrimeUI.svg/);assert.doesNotMatch(html,/topBtn.textContent = selected/);
assert(html.indexOf('icon-consistency.css')>html.indexOf('glass-design.css'));
assert.match(css,/--prime-icon-stroke:1.8/);assert.match(css,/pointer-events:none/);
assert.doesNotMatch(css,/\.mobile-theme-button\s*\{[^}]*display:[^}]*!important/,'desktop mobile-only must remain hidden');
assert.match(js,/'‹':\['previous'/);assert.match(js,/이전:\['previous'/);
assert.match(read('js/app-shell.js'),/chat-history-delete[^\n]+PrimeUI.svg\('trash'\)/);
console.log(`PASS unified icons: ${Object.keys(I.paths).length} SVGs, 41 static slots, symmetric month/page arrows, canonical dynamic icons, stateful +/- and idempotent slots without prose/desktop visibility regressions.`);
