const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const P=require('../js/sudo-physics-core.js'),M=require('../js/sudo-return-motion.js');
function harness(reducedMotion=false){
  let now=0,next=0;const events={},frames=new Map(),timers=new Map(),observers=[],created=[],emitted=[];
  const on=(target,type,fn)=>{(events[target+type]||=[]).push(fn);};
  function node(tag='span'){
    const attrs={},classes=new Set();const n={tagName:tag.toUpperCase(),children:[],hidden:false,disabled:false,dataset:{},style:{setProperty(k,v){this[k]=v;}},
      classList:{add(...v){v.forEach(x=>classes.add(x));},remove(...v){v.forEach(x=>classes.delete(x));},contains:v=>classes.has(v),toggle(v,on){if(on??!classes.has(v))classes.add(v);else classes.delete(v);}},
      setAttribute(k,v){attrs[k]=v;},removeAttribute(k){delete attrs[k];},getAttribute:k=>attrs[k]??null,
      append(...nodes){nodes.forEach(c=>{c.parentElement?.children.splice(c.parentElement.children.indexOf(c),1);c.parentElement=n;n.children.push(c);});},
      replaceChildren(...nodes){n.children=[];n.append(...nodes);},remove(){if(n.parentElement)n.parentElement.children.splice(n.parentElement.children.indexOf(n),1);},
      querySelector(s){return n.querySelectorAll(s)[0]||null;},querySelectorAll(s){const result=[];for(const c of n.children){if(s==='svg'&&c.tagName==='SVG'||s.startsWith('.')&&c.classList.contains(s.slice(1)))result.push(c);result.push(...c.querySelectorAll(s));}return result;},
      addEventListener(t,f){(n.listeners[t]||=[]).push(f);},listeners:{},focus(){n.focused=true;},getContext(){return null;},
      getBoundingClientRect(){return n.rect||{left:100,top:100,right:152,bottom:152,width:52,height:52};},cloneNode(deep){const copy=node(tag);if(deep)n.children.forEach(c=>copy.append(c.cloneNode(true)));return copy;}};
    Object.defineProperty(n,'firstChild',{get:()=>n.children[0]});Object.defineProperty(n,'className',{get:()=>[...classes].join(' '),set:v=>{classes.clear();v.split(' ').forEach(x=>classes.add(x));}});created.push(n);return n;
  }
  const holder=node();holder.className='sudo-ai-character';holder.append(node('svg'));holder.rect={left:250,top:570,right:342,bottom:662,width:92,height:92};
  const button=node('button'),wrap=node();wrap.append(button);button.append(holder);button.dataset.sudoState='idle';
  const panel=node();panel.hidden=true;const body=node('body');body.dataset.activeTab='home';
  const doc={body,hidden:false,activeElement:null,scrollingElement:{scrollHeight:1400,clientHeight:852,scrollTop:548},getElementById:id=>({aiFabButton:button,aiFabPanel:panel}[id]),querySelector:()=>null,querySelectorAll:()=>[],createElement:node,createElementNS:(_,tag)=>node(tag),addEventListener:(t,f)=>on('doc:',t,f)};
  const reduced={matches:reducedMotion,addEventListener:(t,f)=>on('reduce:',t,f)};
  const viewport={width:393,height:852,scale:1,addEventListener:(t,f)=>on('vv:',t,f)};
  const emit=(type,detail)=>{emitted.push({type,detail});(events['win:'+type]||[]).forEach(f=>f({type,detail}));};
  const win={visualViewport:viewport,PrimeSudoPhysics:P,PrimeSudoReturnMotion:M,addEventListener:(t,f)=>on('win:',t,f),dispatchEvent:e=>emit(e.type,e.detail)};
  const fire=(prefix,type,event={})=>(events[prefix+type]||[]).forEach(f=>f(event));
  vm.runInNewContext(fs.readFileSync(require.resolve('../js/sudo-ai-physics.js'),'utf8'),{window:win,document:doc,navigator:{},innerWidth:393,innerHeight:852,devicePixelRatio:1,matchMedia:()=>reduced,performance:{now:()=>now},
    getComputedStyle:()=>({display:'block',visibility:'visible',getPropertyValue:()=>''}),MutationObserver:class{constructor(fn){observers.push(fn);}observe(){}},CustomEvent:class{constructor(type,options){this.type=type;this.detail=options?.detail;}},
    requestAnimationFrame:f=>{frames.set(++next,f);return next;},cancelAnimationFrame:id=>frames.delete(id),setTimeout:(f,ms)=>{timers.set(++next,{f,at:now+ms});return next;},clearTimeout:id=>timers.delete(id)});
  const dock=created.find(n=>n.className==='sudo-return');
  function advance(ms){const end=now+ms;while(now<end){now=Math.min(end,now+16);const pending=[...frames.values()];frames.clear();pending.forEach(f=>f(now));for(const [id,t] of [...timers])if(t.at<=now){timers.delete(id);t.f();}}}
  const click=detail=>dock.listeners.click.forEach(f=>f({detail}));
  const burst=()=>{emit('prime:sudo-drag',{phase:'start',time:now-5300});advance(32);assert(button.disabled);assert(!dock.hidden);};
  return {button,dock,body,doc,viewport,created,emitted,advance,click,burst,fire,observe:()=>observers.forEach(f=>f()),ghosts:()=>body.children.filter(n=>n.className==='sudo-return-bridge')};
}
const normal=harness();normal.burst();normal.click(0);normal.advance(240);assert.equal(normal.ghosts().length,1);assert(normal.button.disabled);normal.click(0);normal.advance(1000);
assert(!normal.button.disabled);assert(normal.dock.hidden);assert.equal(normal.ghosts().length,0);assert(normal.button.focused);assert.equal(normal.emitted.filter(e=>e.type==='prime:sudo-return-complete').length,1);
const reduce=harness(true);reduce.burst();reduce.click(1);assert(!reduce.button.disabled);assert(reduce.dock.hidden);assert.equal(reduce.ghosts().length,0);assert(!reduce.button.focused,'Pointer activation must not steal focus');
for(const phase of ['prepare','travel'])for(const action of ['hidden','rotate','tab','touchcancel']){
  const h=harness();h.burst();h.click(1);if(phase==='travel')h.advance(240);
  if(action==='hidden'){h.doc.hidden=true;h.fire('doc:','visibilitychange');}
  if(action==='rotate'){h.viewport.width=852;h.fire('vv:','resize');}
  if(action==='tab'){h.body.dataset.activeTab='plan';h.observe();}
  if(action==='touchcancel')h.fire('win:','touchcancel');
  h.advance(1200);assert(!h.button.disabled);assert(h.dock.hidden);assert.equal(h.ghosts().length,0);assert.equal(h.emitted.filter(e=>e.type==='prime:sudo-return-complete').length,1,action+' '+phase);
}
const toolbar=harness();toolbar.burst();toolbar.click(1);toolbar.advance(240);toolbar.viewport.height=780;toolbar.fire('vv:','resize');assert.equal(toolbar.ghosts().length,1,'Toolbar resize must not truncate the flight');toolbar.advance(1000);assert.equal(toolbar.ghosts().length,0);
const scroll=harness();scroll.burst();for(let i=0;i<5;i++)scroll.fire('win:','wheel',{deltaY:120,deltaMode:0});assert.equal(scroll.ghosts().length,0);scroll.advance(100);assert.equal(scroll.ghosts().length,0,'Seed must follow before launching');scroll.advance(1500);assert(!scroll.button.disabled);assert.equal(scroll.ghosts().length,0);assert.equal(scroll.emitted.filter(e=>e.type==='prime:sudo-return-complete').length,1);
const cancelPull=harness();cancelPull.burst();for(let i=0;i<5;i++)cancelPull.fire('win:','wheel',{deltaY:120,deltaMode:0});cancelPull.advance(100);cancelPull.fire('win:','touchcancel');cancelPull.advance(1500);assert(cancelPull.button.disabled,'Cancelled pull must not revive later');assert.equal(cancelPull.ghosts().length,0);
const blocked=harness();blocked.burst();blocked.body.classList.add('journey-open');for(let i=0;i<8;i++)blocked.fire('win:','wheel',{deltaY:120,deltaMode:0});blocked.advance(600);blocked.body.classList.remove('journey-open');blocked.observe();blocked.advance(600);assert(blocked.button.disabled,'Modal scrolling cannot accumulate revival');
const touch=harness();touch.burst();touch.fire('win:','touchstart',{touches:[{clientY:800}]});for(let i=1;i<=5;i++)touch.fire('win:','touchmove',{touches:[{clientY:800-i*120}]});touch.fire('win:','touchend');touch.advance(1600);assert(!touch.button.disabled,'Touch pull uses the same follow/flight path');
const lines=harness();lines.burst();for(let i=0;i<5;i++)lines.fire('win:','wheel',{deltaY:8,deltaMode:1});lines.advance(1600);assert(!lines.button.disabled,'Line-mode mouse wheel units are normalized');
const reducedScroll=harness(true);reducedScroll.burst();for(let i=0;i<5;i++)reducedScroll.fire('win:','wheel',{deltaY:120,deltaMode:0});reducedScroll.advance(32);assert(!reducedScroll.button.disabled);assert.equal(reducedScroll.ghosts().length,0,'Reduced motion skips scrub and flight');
console.log('PASS actual renderer lifecycle: shared bridge, repeat guard, keyboard focus, reduced motion, prepare/travel hidden/rotation/tab/touch cancel, toolbar-height continuity and single completion.');
