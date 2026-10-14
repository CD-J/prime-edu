const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const P=require('../js/sudo-physics-core.js'),D=require('../js/sudo-dialogue.js'),M=require('../js/sudo-return-motion.js');
let now=0,next=0;const events={},frames=new Map(),timers=new Map(),buzz=[];
const classes=()=>({add(){},remove(){},toggle(){},contains(){return false;}});
const node=()=>({hidden:true,style:{setProperty(){}},dataset:{},classList:classes(),setAttribute(){},append(){},addEventListener(){},querySelector(){return null;},getBoundingClientRect(){return {left:100,top:100,right:170,bottom:170,width:70,height:70};},remove(){},getContext(){return null;}});
const holder=node(),button=node();button.parentElement=node();button.disabled=false;button.dataset.sudoState='idle';button.querySelector=()=>holder;
const panel=node();panel.hidden=true;
const document={hidden:false,body:node(),getElementById:id=>({aiFabButton:button,aiFabPanel:panel}[id]),createElement:node,createElementNS:node,addEventListener:(k,f)=>events['doc:'+k]=f,scrollingElement:{scrollHeight:1000,clientHeight:700,scrollTop:0}};
const reduced={matches:false,addEventListener:(k,f)=>events.reduce=f};
const window={PrimeSudoPhysics:P,PrimeSudoDialogue:D,PrimeSudoReturnMotion:M,addEventListener:(k,f)=>events[k]=f,dispatchEvent(){}};
vm.runInNewContext(fs.readFileSync(require.resolve('../js/sudo-ai-physics.js'),'utf8'),{window,document,navigator:{vibrate:p=>{buzz.push({now,p});return true;}},innerWidth:390,innerHeight:700,devicePixelRatio:2,
 matchMedia:()=>reduced,performance:{now:()=>now},getComputedStyle:()=>({display:'block',getPropertyValue:()=>''}),MutationObserver:class{observe(){}},CustomEvent:class{},
 requestAnimationFrame:f=>{frames.set(++next,f);return next;},cancelAnimationFrame:id=>frames.delete(id),setTimeout:f=>{timers.set(++next,f);return next;},clearTimeout:id=>timers.delete(id)});
const gesture=phase=>events['prime:sudo-drag']({detail:{phase,time:now}});
const advance=ms=>{const end=now+ms;while(now<end){now=Math.min(end,now+16);const pending=[...frames.values()];frames.clear();pending.forEach(f=>f(now));}};
gesture('start');advance(1000);assert.equal(buzz[0].p,8);assert(buzz.filter(b=>b.p===6).length>=4,'Hold gives separate short taps');
for(let i=1;i<buzz.length;i++)assert(buzz[i].now-buzz[i-1].now>100,'Hold pulses cannot overlap');
assert(buzz.every(b=>b.p<=10),'No long buzz');
const n=buzz.length;gesture('move');advance(600);assert(buzz.length>=n+2,'Dragging retains separated taps');
gesture('end');assert.equal(buzz.at(-1).p,0);const stops=buzz.length;advance(500);assert.equal(buzz.length,stops,'Release stops renewals');
gesture('start');advance(200);gesture('cancel');assert.equal(buzz.at(-1).p,0);
gesture('start');advance(300);document.hidden=true;events['doc:visibilitychange']();assert.equal(buzz.at(-1).p,0);assert.equal(frames.size,0);
document.hidden=false;events['doc:visibilitychange']();gesture('start');advance(100);reduced.matches=true;events.reduce();assert.equal(buzz.at(-1).p,0);const before=buzz.length;advance(300);assert.equal(buzz.length,before,'Reduced motion stops haptics');
reduced.matches=false;gesture('start');advance(5320);
const burst=buzz.findLast(b=>Array.isArray(b.p));assert.deepEqual(Array.from(burst.p),[10,32,12,38,16]);assert.equal(burst.p.filter((_,i)=>i%2===0).length,3);
const burstCount=buzz.length;gesture('end');assert.equal(buzz.length,burstCount,'Lifting after burst does not cut off the three taps');advance(160);assert.equal(buzz.length,burstCount,'Absent mascot cannot keep vibrating');gesture('cancel');assert.equal(buzz.at(-1).p,0);
console.log('PASS actual renderer haptics: spaced 6-10ms hold taps, one 108ms three-tap burst, release preserves burst tail, cancel/hidden/reduced-motion stop; physical motor remains unverified.');
