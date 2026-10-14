const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const T=require('../js/timetable-model.js'),I=require('../js/ui-icons.js'),G=require('../js/sudo-guide.js');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const regular=Array.from({length:7},(_,p)=>['국어','수학','과학','영어','체육']);
const rows=[];for(let d=0;d<5;d++)for(let p=1;p<=7;p++)rows.push({date:'202609'+(14+d),period:p,subject:regular[p-1][d]});
rows.push(...Array.from({length:7},(_,p)=>({date:'20261005',period:p+1,subject:'대체공휴일'})));
rows.push(...Array.from({length:7},(_,p)=>({date:'20261009',period:p+1,subject:'한글날'})));
assert.deepEqual(T.normalMatrix(rows),regular,'Closed days must never replace regular subjects');
assert.deepEqual(T.normalMatrix(rows.slice(-14),regular),regular,'Only holidays preserve verified saved table');
const normal=T.normalMatrix(rows),exam=[{date:'20261007',period:1,subject:'2차 정기시험'}];
assert.equal(T.displayMatrix(normal,exam)[0][2],'2차 정기시험');assert.equal(T.displayMatrix(normal,exam)[1][2],'과학');assert.equal(normal[0][2],'과학');
assert.deepEqual(T.weekHolidays(new Date('2026-10-07T12:00:00'),[{date:'2026-10-05',title:'대체공휴일'},{date:'2026-10-09',title:'한글날'}]),['대체공휴일','','','','한글날']);
assert.equal(T.classify('동아리활동'),'');assert.equal(T.classify('자율·자치활동'),'');
assert.deepEqual(T.normalMatrix([{date:'bad',period:NaN,subject:'x'}],regular),regular);
for(const name of ['book','back','close','trash','calendar','reset']){assert(I.paths[name]);assert.match(I.svg(name),/aria-hidden="true"/);assert.match(I.svg(name),/currentColor/);}
for(const step of G.steps){assert.doesNotMatch(step.title+step.text,/말랑|쫀득|뿅|늘 네 곁|응원해줄게|축하해줄게/);assert(step.title.length<24&&step.text.length<110,'Concise factual feature guide, without character chatter');}
const html=read('index.html'),css=read('js/interface-quality.css'),study=read('js/study-ai.js');
assert(html.indexOf('interface-quality.css')>html.indexOf('mobile-compact.css'));
assert(!html.includes('sudo-home-name">스도'));
assert.match(css,/dday-value[^}]*font-size:46px/s);
assert.match(css,/\.cal-dot[^}]*font-size:11px/s);assert.match(css,/\.planner-day \.planner-event[^}]*font-size:10px/s);
assert.match(css,/is-holiday-col[^}]*#ee717a/s);
assert.equal((study.match(/class="quiz-book-cover stored-book-cover/g)||[]).length,2);
assert.equal((study.match(/quiz-book-badge[^\n]+PrimeUI\.svg\('book'\)/g)||[]).length,2);
assert.match(read('js/ui-icons.js'),/setAttribute\('aria-label',label\)/);
assert.match(read('js/school-data.js'),/regular-v1/);assert.match(read('js/school-data.js'),/history\.setDate\(history\.getDate\(\)-28\)/);
const body={innerHTML:''},page={innerHTML:''};
const context=vm.createContext({data:{schedule:regular},PrimeTimetable:T,getSortedEvents:()=>[{date:'2026-10-05',title:'대체공휴일'},{date:'2026-10-09',title:'한글날'}],Date:class extends Date{constructor(...a){super(...(a.length?a:['2026-10-07T12:00:00']));}},escapeHtml:s=>String(s).replaceAll('<','&lt;'),normalizeTimetableSubject:s=>s,$:s=>({'#scheduleBody':body,'#scheduleBodyPage':page})[s]});
vm.runInContext(html.slice(html.indexOf('    function renderScheduleTable'),html.indexOf('    function renderCalendarPanel')),context);context.renderScheduleTable();
assert.equal((body.innerHTML.match(/is-holiday-col/g)||[]).length,14);assert.equal((body.innerHTML.match(/<td /g)||[]).length,35);assert(!body.innerHTML.includes('대체공휴일'));
console.log('PASS interface quality: regular subjects independent of closures, exam-only exceptions, shared book SVGs, named utility icons, spoken guide, calendar text and countdown-first hierarchy.');
// Execute the real stable loader: class/year/term scoped cache, four-week
// recovery, failure fallback, and no exceptional rows in the saved baseline.
(async()=>{
 const source=read('js/school-data.js'),saved=new Map(),calls=[];
 const profile={school:{officeCode:'R10',schoolCode:'001'},schoolLevel:'middle',grade:2,classNo:1};
 let historyFails=false;
 const scope=vm.createContext({window:{PrimeTimetable:T},Date,
  cacheKey:(type,parts)=>type+'.'+parts.join('.'),profileParts:p=>[p.school.officeCode,p.school.schoolCode,p.schoolLevel,p.grade,p.classNo],
  readCache:k=>saved.get(k),writeCache:(k,v)=>saved.set(k,v),
  fetchTimetable:async(p,from,to)=>{calls.push({from,to});if(from==='2026-10-05')return {value:rows.slice(-14)};if(historyFails)throw Error('history unavailable');return {value:rows};}});
 vm.runInContext(source.slice(source.indexOf('  async function fetchStableTimetable'),source.indexOf('  async function fetchCompleteRange')),scope);
 const result=await scope.fetchStableTimetable(profile,'2026-10-05','2026-10-09');
 assert.deepEqual(JSON.parse(JSON.stringify(result.matrix)),regular);assert.equal(calls[1].from,'2026-09-07');
 assert([...saved.keys()][0].includes('R10.001.middle.2.1.2026.2'));
 historyFails=true;const fallback=await scope.fetchStableTimetable(profile,'2026-10-05','2026-10-09');assert.deepEqual(JSON.parse(JSON.stringify(fallback.matrix)),regular);
 const other=await scope.fetchStableTimetable({...profile,classNo:2},'2026-10-05','2026-10-09');assert(other.matrix.flat().every(s=>!s),'A different class must never borrow the cache');
 console.log('PASS real stable timetable loader: class/term isolation, recent normal-data recovery, closure preservation and verified-cache-only fallback.');
})().catch(e=>{console.error(e);process.exitCode=1;});
