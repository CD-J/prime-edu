const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const P=require('../js/sudo-physics-core.js'),D=require('../js/sudo-dialogue.js');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
for(const [key,pool] of Object.entries(D.lines)){assert.equal(new Set(pool).size,pool.length,key);const pick=D.createPicker(()=>0);assert.equal(typeof pick(key),'string');assert(pool.every(t=>t.length<28),'Short study captions: '+key);if(pool.length>1)assert.notEqual(pick(key),pick(key),'No immediate repeat: '+key);}
for(const key of ['hold','pet','wink','orbit','crown','wake','dance','sleep','dizzy','impact','boing','peek'])assert.equal(D.createPicker()(key),'','Quiet physical gestures: '+key);
const play=P.createPlay();play.input({phase:'start',time:0});
assert.equal(play.step(2999).heldMs,2999);assert(play.step(3000).pressed);assert(!play.step(5299).burst);assert(play.step(5300).burst);assert(!play.step(5301).burst);
for(const [phase,mode] of [['landing','boing'],['pause','breathe'],['peek','peek']]){const p=P.createPlay();p.input({phase,time:1});assert.equal(p.step(2).mode,mode);assert.equal(p.step(4000).mode,'');}
const outline=[166,58,219,57,257,87,264,140,273,195,249,246,198,263,149,279,99,260,77,218,52,174,63,123,94,87,112,67,138,58,166,58];
for(const charge of [0,.2,.5,1])for(let t=0;t<=5300;t+=40){
 const d=P.gelPath(outline,{left:0,right:0,top:0,bottom:0,charge,rippleX:3,rippleY:2},t);
 assert(!/NaN|Infinity|undefined/.test(d));assert.equal((d.match(/ C/g)||[]).length,30);
 const nums=d.match(/-?\d+(?:\.\d+)?/g).map(Number),segments=[];
 for(let i=2;i<nums.length;i+=6)segments.push(nums.slice(i,i+6));
 for(let i=0;i<segments.length;i++){
  const a=segments[i],b=segments[(i+1)%segments.length];
  assert(Math.abs((a[4]-a[2])-(b[0]-a[4]))<.004,'Continuous x tangent');
  assert(Math.abs((a[5]-a[3])-(b[1]-a[5]))<.004,'Continuous y tangent');
 }
}
const css=read('js/mobile-compact.css'),motion=read('js/sudo-ai-physics.js'),shell=read('js/app-shell.js'),html=read('index.html');
assert(html.indexOf('mobile-compact.css')>html.indexOf('timetable-round.css'));
assert(html.indexOf('sudo-dialogue.js')<html.indexOf('sudo-ai-physics.js'));
assert.match(motion,/fun\.heldMs>=3000/);assert.match(motion,/230-100\*fun.charge/);assert.doesNotMatch(motion,/vibrate\(180\)/);
assert.match(motion,/\['end','cancel','settle'\].*vibrate\(0\)/);
assert.match(shell,/header\?\.bottom/);assert.match(shell,/nav\?\.top/);assert.match(shell,/visiblePosition/);
assert.doesNotMatch(css,/zoom\s*:/);assert.match(css,/min-height:80px/);assert.match(css,/position:static!important/);
assert(!read('js/grade-notebook.js').includes('회원정보 기준'));
assert.match(css,/sudo-spring-return/);assert.match(motion,/i<112/);assert.match(motion,/devicePixelRatio/);
console.log('PASS compact mobile/Sudo: concise study captions and silent gestures, 5.3s boundary, delayed hold, continuous-tangent gel, extra reactions, bounded launcher/bubbles, separated supported haptic taps, layered retina particles and spring revival.');
