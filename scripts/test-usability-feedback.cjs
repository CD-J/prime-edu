const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const read = file => fs.readFileSync(path.join(__dirname,'..',file),'utf8');
const html=read('index.html'), timer=read('js/utility-hub.js');
const listeners={}, styles={}, attrs={}, classes=new Set(), storage=new Map();
const ring={dataset:{},style:{setProperty:(k,v)=>styles[k]=v},
 classList:{toggle(k,v){v?classes.add(k):classes.delete(k)},add:k=>classes.add(k),remove:k=>classes.delete(k)},
 setAttribute:(k,v)=>attrs[k]=v,addEventListener:(k,v)=>listeners[k]=v,
 getBoundingClientRect:()=>({left:0,top:0,width:200,height:200}),focus(){},setPointerCapture(){},releasePointerCapture(){}};
const context=vm.createContext({
 document:{querySelector(){return null},querySelectorAll:s=>s==='[data-pomodoro-ring]'?[ring]:[],activeElement:null},
 localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
 window:{dispatchEvent(){},PrimeTimerProgress:require('../js/timer-progress.js'),SchemsStudyAI:{getSnapshot:()=>({sessions:[]})}},CustomEvent:function(){},
 setInterval:()=>1,clearInterval(){},requestAnimationFrame:f=>{f();return 0},cancelAnimationFrame(){},
});
vm.runInContext(timer.slice(timer.indexOf('  const $ ='),timer.indexOf('  const UTILITY_TITLES')),context);
vm.runInContext('bindPomodoroDials();applyPomodoroPreset(120,5)',context);
assert.equal(attrs['aria-valuenow'],'120');
const before=parseFloat(styles['--pomodoro-angle']);
listeners.keydown({key:'Home',preventDefault(){}});
assert.equal(attrs['aria-valuenow'],'1');
assert(Math.abs(parseFloat(styles['--pomodoro-angle'])-before)<4,'120→1 cannot spin a full turn');
listeners.keydown({key:'End',preventDefault(){}});
assert.equal(attrs['aria-valuenow'],'120');
const event=(angle,extra={})=>({clientX:100+95*Math.sin(angle*Math.PI/180),clientY:100-95*Math.cos(angle*Math.PI/180),pointerId:1,button:0,preventDefault(){},...extra});
listeners.pointerdown(event(359));
listeners.pointermove(event(1));
assert.equal(attrs['aria-valuenow'],'120','clockwise crossing clamps at maximum');
listeners.pointermove(event(358));
assert(Number(attrs['aria-valuenow'])>=118,'reverse motion continues smoothly from seam');
listeners.pointerup(event(358));
const value=attrs['aria-valuenow'];
listeners.pointerdown(event(0,{clientX:100,clientY:100}));
assert.equal(attrs['aria-valuenow'],value,'center tap does not reset duration');
vm.runInContext('togglePomodoro()',context);
listeners.keydown({key:'Home',preventDefault(){}});
assert.equal(attrs['aria-valuenow'],value,'running duration cannot be changed');
vm.runInContext('resetPomodoro();applyPomodoroPreset(900,-1)',context);
assert.equal(attrs['aria-valuenow'],'120');
const restored=JSON.parse(storage.get('primeEduPomodoro.v1'));
assert.equal(restored.breakMinutes,1);
// Grade-specific events use the actual profile, never a guessed class default.
const academicEvents=[
 {id:'academic-2026-1109',grades:[3]},{id:'academic-2026-1207',grades:[1,2]}
];
const gradeScope=vm.createContext({academicEvents,currentUserProfile:null,
 data:{className:'2-1',events:[{id:'academic-2026-1109',date:'2026-11-09',grades:[3]},{id:'academic-2026-1207',date:'2026-12-07',grades:[1,2]}]},
 PrimeEduSchoolData:{isCompleteProfile:()=>false},eventEnd:e=>e.date});
const fn=html.slice(html.indexOf('    function getSortedEvents()'),html.indexOf('    function getWeekRange'));
vm.runInContext(fn,gradeScope);
assert.equal(gradeScope.getSortedEvents().length,0,'No profile cannot borrow a cached class grade');
vm.runInContext('currentUserProfile={grade:2}',gradeScope);
assert.equal(gradeScope.getSortedEvents()[0].date,'2026-12-07');
vm.runInContext('currentUserProfile={grade:3}',gradeScope);
assert.equal(gradeScope.getSortedEvents()[0].date,'2026-11-09');
assert.equal((html.match(/data-weekday-grid/g)||[]).length,3); // home, school, renderer
assert.doesNotMatch(html,/event.target.id === "authModal"/);
assert.match(html,/id="examStrategyMinutes" aria-label="하루 공부 시간\(분\)"/);
assert.match(html,/data-school-day/);
assert.match(html.slice(html.indexOf('    function renderCalendarPanel(')),/const events = getDisplayAcademicEvents\(sortedEvents\)/,'month navigation must keep display filtering');
assert.match(read('js/study-ai.js'),/if \(!books.length\) \{/);
const {createPlay}=require('../js/sudo-physics-core.js');
const play=createPlay({random:()=>0});
play.input({phase:'wink',time:1});const v=play.step(2).variant;
play.input({phase:'wink',time:2000});assert.notEqual(play.step(2001).variant,v,'variants are stable, not repeated');
for(const [keys,mode] of [[['ArrowLeft','ArrowRight','ArrowLeft','ArrowRight'],'dance'],[['ArrowUp','ArrowDown','ArrowUp','ArrowDown'],'sparkle']]){
 const p=createPlay(); keys.forEach((key,i)=>p.input({phase:'key',key,time:i*100}));
 assert.equal(p.step(310).mode,mode);
}
play.input({phase:'celebrate',time:4000});assert.equal(play.step(4001).mode,'sparkle');
console.log('PASS: real dial seam/clamp/center/running guards, 120-minute persistence, grade-specific sample/old cache, one school week, explicit auth dismissal, result access, stable Sudo variants and new reactions.');
// Grade filtering runs the actual NEIS converter, not a reimplemented predicate.
(async () => {
 const source=read('js/school-data.js');
 const rows=[{AA_YMD:'20261109',EVENT_NM:'2차 정기시험',ONE_GRADE_EVENT_YN:'N',TW_GRADE_EVENT_YN:'N',THREE_GRADE_EVENT_YN:'Y'},
 {AA_YMD:'20261207',EVENT_NM:'2차 정기시험',ONE_GRADE_EVENT_YN:'Y',TW_GRADE_EVENT_YN:'Y',THREE_GRADE_EVENT_YN:'N'}];
 const scope=vm.createContext({cachedRequest:async(type,parts,loader)=>{assert.equal(type,'events-v3');return loader()},
 profileParts:p=>[p.school.officeCode,p.school.schoolCode,p.schoolLevel,p.grade],compactDate:s=>s.replaceAll('-',''),clean:s=>String(s??'').trim(),fetchCompleteRange:async()=>rows});
 vm.runInContext(source.slice(source.indexOf('  async function fetchAcademicEvents('),source.indexOf('  async function fetchMeals(')),scope);
 for(const grade of [1,2,3]){
   const events=await scope.fetchAcademicEvents({school:{officeCode:'R10',schoolCode:'8761206'},schoolLevel:'middle',grade},'2026-11-01','2026-12-31');
   assert.equal(events.length,1); assert.equal(events[0].date,grade===3?'2026-11-09':'2026-12-07');
 }
 console.log('PASS: actual NEIS response converter independently filters grades 1, 2, 3 and invalidates old cache.');
 const bookSource=read('js/study-ai.js'), state={bookRecommendations:[{title:'이전 추천'}]}, states=[];
 const submit={disabled:false}, form={getAttribute:()=>null,querySelector:()=>submit};
 const bookScope=vm.createContext({state,buildLearnerProfile:()=>({}),
 $:s=>({value:s==='#studyBookTopic'?'과학':'',}),setOperation:(selector,mode,text)=>states.push({mode,text}),
 postJson:async()=>({books:[]}),persist:()=>{throw Error('Empty response must not erase saved recommendations')},
 renderBookRecommendations:()=>{throw Error('Empty recommendations must not look successful')},window:{dispatchEvent(){}},CustomEvent:function(){}});
 vm.runInContext(bookSource.slice(bookSource.indexOf('  async function onRecommendBooks('),bookSource.indexOf('  function renderBookRecommendations(')),bookScope);
 await bookScope.onRecommendBooks({preventDefault(){},currentTarget:form});
 assert.equal(state.bookRecommendations[0].title,'이전 추천');
 assert.equal(states.at(-1).mode,'info');assert.equal(submit.disabled,false);
 console.log('PASS: actual recommendation handler preserves old results and releases submit state for empty API results.');
})().catch(error=>{console.error(error);process.exitCode=1});
