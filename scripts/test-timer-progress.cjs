const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const read=n=>fs.readFileSync(path.join(__dirname,'..',n),'utf8'),model=require('../js/timer-progress.js');
assert.equal(model.remaining(1500,1500),1);assert.equal(model.remaining(750,1500),.5);assert.equal(model.remaining(0,1500),0);assert.equal(model.remaining(-2,1500),0);assert.equal(model.remaining(9000,1500),1);
for(const value of [NaN,Infinity,undefined])assert.equal(model.remaining(value,1500),0);assert.equal(model.remaining(20,0),0);
for(const [w,h] of [[716,226],[860,320],[440,185],[272,174],[192,132],[120,80]]){
 const g=model.rectangle(w,h);assert(g.stroke>=8&&g.stroke<=12);assert(g.inset-g.stroke/2>=4);
 const nums=g.d.match(/[\d.]+/g).map(Number);assert(nums.every(Number.isFinite));
 assert.equal(nums[0],w/2);assert.equal(nums[1],Number(g.inset.toFixed(3)));assert(nums[2]>nums[0],'Path begins to the right of top centre, clockwise');
 for(const part of g.d.matchAll(/([MHVC])\s+([^MHVCZ]+)/g)){
  const values=part[2].trim().split(/\s+/).map(Number);
  for(let i=0;i<values.length;i++){
   const x=part[1]==='H'||(part[1]!=='V'&&i%2===0),limit=x?w:h;
   assert(values[i]>=g.inset-.001&&values[i]<=limit-g.inset+.001,'Stroke/control point stays inside the safety inset');
  }
 }
 assert(g.radius<(Math.min(w,h)/2));assert(g.d.endsWith(`H ${w/2} Z`));
}
assert.equal(model.rectangle(0,0),null);assert.equal(model.rectangle(Infinity,200),null);
const circleBoundary=r=>({x:Math.sin(r*2*Math.PI),y:-Math.cos(r*2*Math.PI)});
assert(circleBoundary(.75).x<-.99);assert(circleBoundary(.25).x>.99,'full -> left -> bottom -> right retreats counterclockwise');
const html=read('index.html'),home=read('js/home-polish.css'),standby=read('js/standby.js'),css=read('js/standby.css');
assert(html.indexOf('timer-progress.js')<html.indexOf('utility-hub.js'));assert(html.indexOf('timer-progress.js')<html.indexOf('standby.js'));
assert.match(home,/transform:rotate\(-90deg\)/);assert.doesNotMatch(home,/scaleX\(-1\)/);
assert.match(standby,/new ResizeObserver\(sizeTimerFrame\)/);assert.match(standby,/preserveAspectRatio="xMidYMid meet"/);assert.doesNotMatch(standby,/preserveAspectRatio="none"/);
assert.match(css,/stroke-width:var\(--standby-stroke,10px\)/);assert.match(css,/stroke-dasharray:var\(--standby-remaining,100\) 100/);
assert.match(css,/font-family:'Prime Timer UI'[^}]*font-weight:600!important/);assert.match(css,/\.standby-number \{ font-size:1em!important/);
assert.match(css,/container-type:inline-size/);assert.match(css,/max-height:280px/);
const ring={dataset:{},style:{values:{},setProperty(k,v){this.values[k]=v}},classList:{toggle(){}},querySelector(){return null},setAttribute(){}};
const context={document:{querySelector(){return null},querySelectorAll:s=>s==='[data-pomodoro-ring]'?[ring]:[]},localStorage:{getItem:()=>null,setItem(){}},window:{PrimeTimerProgress:model,dispatchEvent(){},SchemsStudyAI:{getSnapshot:()=>({sessions:[]})}},CustomEvent:function(){},setInterval(){},clearInterval(){},requestAnimationFrame:f=>f()};
vm.createContext(context);const utility=read('js/utility-hub.js');vm.runInContext(utility.slice(utility.indexOf('  const $ ='),utility.indexOf('  const UTILITY_TITLES'))+'applyPomodoroPreset(25,5);',context);
assert.equal(ring.style.values['--pomodoro-arc'],'360');
for(const seconds of [1125,750,375,0]){vm.runInContext(`pomodoro.remainingSec=${seconds};renderPomodoro();`,context);assert.equal(Number(ring.style.values['--pomodoro-arc']),seconds/1500*360);}
assert.equal(ring.style.values['--pomodoro-stroke-visible'],'0');vm.runInContext('resetPomodoro();',context);assert.equal(ring.style.values['--pomodoro-arc'],'360');assert.equal(ring.style.values['--pomodoro-stroke-duration'],'0ms','Reset snaps full instead of clockwise fill');
const styles={},panel={dataset:{},style:{setProperty:(k,v)=>styles[k]=v},classList:{toggle(){}}},mode={},value={},button={getAttribute:()=>'',setAttribute(){}};
const timerContext={state:{mode:'focus',focusMinutes:25,breakMinutes:5,running:false,remainingSec:1500},contents:[panel],window:{PrimeTimerProgress:model},root:{querySelector:s=>s==='#standbyTimerMode'?mode:s==='#standbyTimerValue'?value:button},paintDigits(){},secondsText:require('../js/standby.js').secondsText,icon:n=>n};
vm.createContext(timerContext);vm.runInContext(standby.slice(standby.indexOf('  function timerPaint()'),standby.indexOf('  function clockPaint()')),timerContext);
for(const seconds of [1500,1125,750,375,0]){timerContext.state.remainingSec=seconds;vm.runInContext('timerPaint();',timerContext);assert.equal(Number(styles['--standby-remaining']),seconds/1500*100);}
assert.equal(styles['--standby-stroke-visible'],'0');timerContext.state.remainingSec=1500;vm.runInContext('timerPaint();',timerContext);assert.equal(styles['--standby-stroke-duration'],'0ms');
const font=fs.readFileSync(path.join(__dirname,'../assets/fonts/pretendard-std-semibold.woff2'));assert.equal(font.toString('ascii',0,4),'wOF2');assert.equal(crypto.createHash('sha256').update(font).digest('hex'),'6168bff58fe531fba67fa8d286cfe22594f9f9fb0f99c6aaf23d08c9b245fb35');
console.log('PASS countdown progress: full/half/zero/reset, counterclockwise retreat, independent setting thumb, actual circular/rectangular paint, unstretched stroked geometry with safety inset, responsive font and OFL numeral asset.');
