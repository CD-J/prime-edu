const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const api=require('../js/glass-design.js'),read=n=>fs.readFileSync(path.join(__dirname,'..',n),'utf8');
const css=read('js/glass-design.css'),source=read('js/glass-design.js'),html=read('index.html');
assert(html.indexOf('glass-design.css')>html.indexOf('standby.css'));
assert.match(css,/Reading surfaces stay substantially opaque/);
assert.match(css,/\.topbar\.is-collapsed::before[^}]*opacity:0; box-shadow:none!important; backdrop-filter:none/);
assert.match(css,/linear-gradient\(to bottom,var\(--book-color\) 0 34%,transparent 34%\)/);
assert.match(css,/\.home-ai-hero:not\(\.has-conversation\) \.home-ai-messages[^}]*border-color:transparent!important/,'An empty desktop chat must not leave an unrelated line across the art');
assert.match(css,/prefers-reduced-transparency:reduce/);assert.match(css,/prefers-contrast:more/);assert.match(css,/forced-colors:active/);assert.match(css,/prefers-reduced-motion:reduce/);
assert.doesNotMatch(css,/[{;]\s*(?:font-size|width|height|min-height|padding|position|transform|z-index|zoom|filter)\s*:/,'Finishing must preserve geometry, fonts and stacking owners');
assert.doesNotMatch(source,/preventDefault|setPointerCapture|localStorage|fetch\(/,'No input interception, data persistence or network/render owner');
assert.equal(api.accentMaterial('unknown'),null);
for(const color of ['#7854e5','#b9a2ff','#dd7812','#ffad6c','#14825b','#6acaaa','#3265ad','#70a5f2']){
  const m=api.accentMaterial(color),base=api.rgb(color),glow=base.map(v=>v+(1-v)*m.gleam);
  assert(m.contrast>=4.5,color+' base contrast');assert(api.contrast(api.rgb(m.ink),glow)>=4.5,color+' gleam contrast');
}
assert.equal(api.accentMaterial('#dd7812').ink,'#10131b');assert.equal(api.accentMaterial('#7854e5').ink,'#ffffff');
assert.deepEqual(api.position(500,-50,{left:0,top:0,width:100,height:100}),{x:100,y:0});
function fixture({fine=true,reduced=false,blocked=false}={}){
  const handlers={},frames=new Map();let count=0;const classes=new Set(),styles=new Map();
  const el={isConnected:true,disabled:false,classList:{add:v=>classes.add(v),remove:v=>classes.delete(v)},style:{setProperty:(k,v)=>styles.set(k,v),removeProperty:k=>styles.delete(k)},getAttribute:()=>null,closest:s=>s===api.selector?el:blocked?{}:null,contains:e=>e===el,getBoundingClientRect:()=>({left:10,top:20,width:100,height:50})};
  const doc={addEventListener:(name,fn)=>handlers[name]=fn,hidden:false},win={matchMedia:s=>({matches:s.includes('pointer')?fine:reduced,addEventListener(){}}),requestAnimationFrame:f=>{frames.set(++count,f);return count;},cancelAnimationFrame:id=>frames.delete(id),addEventListener(){}};
  api.create(doc,win).init();const move=(x=35,y=30,type='mouse')=>handlers.pointermove({target:el,clientX:x,clientY:y,pointerType:type});const flush=()=>{for(const [id,fn] of [...frames]){frames.delete(id);fn();}};return {el,classes,styles,handlers,frames,move,flush};
}
const f=fixture();f.move();f.move(60,45);assert.equal(f.frames.size,1);f.flush();assert(f.classes.has('is-prime-glass-lit'));assert.equal(f.styles.get('--prime-glass-x'),'50.0%');assert.equal(f.styles.get('--prime-glass-y'),'50.0%');f.handlers.scroll();assert.equal(f.classes.size,0);assert.equal(f.styles.size,0);
for(const options of [{fine:false},{reduced:true},{blocked:true}]){const f=fixture(options);f.move();f.flush();assert.equal(f.classes.size,0);}
const touch=fixture();touch.move(30,30,'touch');touch.flush();assert.equal(touch.classes.size,0);
const cancelled=fixture();cancelled.move();cancelled.handlers.pointercancel();cancelled.flush();assert.equal(cancelled.classes.size,0);
new Function(source);new Function(read('js/sudo-home-art.js'));
console.log('PASS glass design: material hierarchy, density/stacking/book band preserved, contrast-aware accents/gleam, accessibility fallbacks, pointer-only coalescing/cleanup without data or input ownership.');
