const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
const source=read('js/standby.js'),utility=read('js/utility-hub.js');
const start=source.indexOf("  document.addEventListener('click',event=>{");
const end=source.indexOf("  window.addEventListener('prime:pomodoro-state'",start);
let listener,running=false,opened=0;
vm.runInNewContext(source.slice(start,end),{document:{addEventListener:(name,fn)=>listener=fn},window:{PrimeEduPomodoro:{getState:()=>({running})}},open:()=>opened++});
const clock={closest:selector=>selector==='.mobile-pomodoro-widget,.home-pomodoro'?{}:null};
const click=target=>listener({target:{closest:selector=>selector==='[data-pomodoro-ring]'&&target==='home-clock'?clock:null}});
click('home-clock');assert.equal(opened,0,'idle clock must not open standby');
running=true;click('start');assert.equal(opened,0,'start must not open standby');
click('home-clock');assert.equal(opened,1,'running clock must open standby');
click('pause');click('reset');click('utility-clock');assert.equal(opened,1);
const buttonSource=utility.slice(utility.indexOf('    $$("[data-pomodoro-switch]").forEach(button => {'),utility.indexOf('    $$("[data-pomodoro-toggle]").forEach',utility.indexOf('    $$("[data-pomodoro-switch]").forEach(button => {')));
function button(home,running){const b={closest:()=>home?{}:null,setAttribute:(name,value)=>b[name]=value};vm.runInNewContext(buttonSource,{$$:()=>[b],pomodoro:{mode:'focus',running},Boolean});return b;}
assert.equal(button(true,true).disabled,false);assert.match(button(true,true)['aria-label'],/스탠바이 열기/);
assert.equal(button(false,true).disabled,true);assert.equal(button(true,false).disabled,false);assert.match(button(true,false)['aria-label'],/휴식으로 전환/);
console.log('PASS standby entry: start stays home, only running home clock opens, idle mode switch preserved, running clock enabled with accessible action.');
