const assert=require('node:assert/strict');
const fs=require('node:fs');
const {timerCaption,surfaceWave}=require('../js/sudo-physics-core.js');
const play=require('../js/sudo-physics-core.js').createPlay();
play.input({phase:'wink',time:100});
['ArrowUp','ArrowUp','ArrowDown','ArrowDown'].forEach((key,i)=>play.input({phase:'key',key,time:120+i*30}));
assert.equal(play.step(250).mode,'crown','Explicit crown must not be swallowed by another reaction cooldown');
assert.equal(timerCaption({running:true,remainingSec:1500,mode:'focus'},'school'),'집중 25:00');
assert.equal(timerCaption({running:true,remainingSec:61,mode:'break'},'assistant'),'휴식 01:01');
for(const tab of ['school','plan','assistant','progress','settings'])assert(timerCaption({running:true,remainingSec:10},tab));
for(const state of [null,{}, {running:false,remainingSec:10},{running:true,remainingSec:0},{running:true,remainingSec:NaN}])assert.equal(timerCaption(state,'school'),'');
assert.equal(timerCaption({running:true,remainingSec:100},'home'),'');
for(let a=0;a<Math.PI*2;a+=.1){
 let previous=surfaceWave(a,0,1);
 for(let t=16;t<6000;t+=16){const v=surfaceWave(a,t,1);assert(Math.abs(v)<=40.32);assert(Math.abs(v-previous)<12);previous=v;}
 assert.equal(surfaceWave(a,2500,0),0);
}
assert(Math.max(...Array.from({length:400},(_,i)=>Math.abs(surfaceWave(i*.07,i*16,1))))>30,'Charged surface must visibly wobble beyond the old 12.6 bound');
const css=fs.readFileSync(require.resolve('../js/sudo-ai-button.css'),'utf8');
assert(css.includes('width: 88px')&&css.includes('width: 108px'));
assert(css.includes('width: 70px; height: 70px')&&css.includes('width: 92px; height: 92px'));
assert(!css.includes('border: 1px solid rgb(127 127 127'));
assert(fs.readFileSync(require.resolve('../index.html'),'utf8').includes('rel="apple-touch-icon"'));
assert(!fs.readFileSync(require.resolve('../assets/sudo-app-icon.svg'),'utf8').includes('<animate'),'App icon is a purpose-drawn static mark, not a reused animation');
const utility=fs.readFileSync(require.resolve('../js/utility-hub.js'),'utf8');
assert(utility.includes("new CustomEvent('prime:pomodoro-state'"));
assert(utility.includes('.mobile-pomodoro-widget, .utility-pomodoro-panel'));
const guide=fs.readFileSync(require.resolve('../js/sudo-guide.js'),'utf8');
assert(guide.includes('maskUnits="userSpaceOnUse"'));
assert(!guide.includes('data-mask="top"'));
console.log('PASS: shared countdown, five non-home tabs, pause/end/invalid state, continuous bounded fluid waves, mobile timer settings, rounded single mask.');
