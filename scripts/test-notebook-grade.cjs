const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = file => fs.readFileSync(path.join(__dirname,'..',file),'utf8');
const M = require('../js/grade-notebook-model.js');
const formatScope=vm.createContext({});
const gradeSource=read('js/grade-notebook.js');
vm.runInContext(gradeSource.slice(gradeSource.indexOf('  const esc ='),gradeSource.indexOf('  const DOC_ID'))+'\nthis.safeRich=rich;',formatScope);
assert.equal(formatScope.safeRich('**10분** 복습 <img src=x>'),'<strong>10분</strong> 복습 &lt;img src=x&gt;');
assert.deepEqual(M.years(2),[1,2]);
assert.deepEqual(M.years(3),[1,2,3]);
assert.equal(M.config({schoolLevel:'high',grade:3},{},2026).gradeSystem,9);
assert.equal(M.config({schoolLevel:'high',grade:2},{},2026).gradeSystem,5);
assert.equal(M.config({schoolLevel:'high',grade:1},{gradeSystem:9},2026).gradeSystem,9);
assert.throws(()=>M.number('101',0,100));
assert.throws(()=>M.number('2.5',1,5,true));
assert.equal(M.number('',0,100),null);
const exams = M.normalize([{year:2,term:1,exam:'final',subject:'수학',score:80},{year:2,term:1,exam:'mid',subject:'수학',score:0}]);
assert.equal(exams.length,2);
assert.equal(M.summary(exams)[0].average,0);
assert.equal(M.summary(exams)[0].exam,'mid');
assert.equal(M.normalize([...exams, {...exams[0],score:90}]).length,2);
assert.equal(M.normalize([{schoolLevel:'high',recordType:'semester-rank',year:1,term:1,subject:'수학',gradeSystem:5,rank:2,credits:3}])[0].credits,3);
assert.equal(M.normalize([{schoolLevel:'middle',recordType:'semester-rank',year:1,term:1,subject:'수학',rank:2}]).length,0);

const studySource = read('js/study-ai.js');
const list = {innerHTML:''}, reader = {innerHTML:''};
const studyState = {notes:[{id:'n1',subject:'수학',text:'긴 필기 '.repeat(300),summary:'요약',keywords:['분수']},{id:'n2',subject:'영어',text:'다른 비공개 필기'}],currentNoteId:null};
const studyScope = vm.createContext({state:studyState,PrimeUI:require('../js/ui-icons.js'),$:s=>s==='#studyNoteList'?list:s==='#studyConceptReader'?reader:null,
 escapeHtml:s=>String(s).replace(/</g,'&lt;'),formatAiText:s=>s,renderVisualThinking:()=>'<section>개념도</section>',renderNotebookNavigation:()=>{}});
vm.runInContext(studySource.slice(studySource.indexOf('  function renderNotes('),studySource.indexOf('  function mountNotebookReader()')),studyScope);
studyScope.renderNotes();
assert.equal((list.innerHTML.match(/data-open-concept-note/g)||[]).length,2);
assert(!list.innerHTML.includes('note-original'));
assert.equal(reader.innerHTML,'');
studyState.currentNoteId='n1'; studyScope.renderNotes();
assert(reader.innerHTML.includes('긴 필기 '.repeat(300)));
assert(!reader.innerHTML.includes('다른 비공개 필기'));
assert(reader.innerHTML.includes('data-quiz-from-note="n1"'));
assert(studySource.includes('state.quizDrafts[state.currentQuiz?.id]?.[index]'));
const shellSource=read('js/app-shell.js'), mealOutput={innerHTML:''};
const mealCard={querySelector:s=>s==='strong'?{textContent:'중식'}:s==='.meal-menu'?{childNodes:[{nodeType:3,textContent:'찰보리밥'},{nodeType:1,textContent:''},{nodeType:3,textContent:'비빔막국수'},{nodeType:1,textContent:''},{nodeType:3,textContent:'<img src=x>'},{nodeType:1,textContent:' · 842.5 Kcal'}]}:s==='.meal-calorie'?{textContent:' · 842.5 Kcal'}:null,querySelectorAll:()=>[]};
const notificationScope=vm.createContext({window:{},todayKey:()=> '2026-10-06',getPlannerData:()=>({schedule:[]}),getSchoolEvents:()=>[],getPersonalEvents:()=>[],eventOccursOn:()=>false,
 $:s=>s==='#mealDetailListPage'?{querySelectorAll:()=>[mealCard]}:s==='#notificationMealList'?mealOutput:null,
 escapeHtml:s=>String(s).replace(/</g,'&lt;').replace(/>/g,'&gt;')});
vm.runInContext(shellSource.slice(shellSource.indexOf('  function renderNotifications()'),shellSource.indexOf('  function setNotificationsOpen(')),notificationScope);
notificationScope.renderNotifications();
assert(mealOutput.innerHTML.includes('<li>찰보리밥</li><li>비빔막국수</li>'));
assert(mealOutput.innerHTML.includes('&lt;img src=x&gt;'));
assert(!mealOutput.innerHTML.includes('<img'));
assert(mealOutput.innerHTML.includes('842.5 Kcal'));
const utilitySource=read('js/utility-hub.js'), chart={innerHTML:'',dataset:{}}, gradeList={innerHTML:''}, filter={innerHTML:'',value:'all'};
const chartScope=vm.createContext({academicGrades:exams,$:s=>({'#gradeComboChart':chart,'#gradeRecordList':gradeList,'#gradeChartSubject':filter})[s],escapeHtml:s=>String(s)});
vm.runInContext(utilitySource.slice(utilitySource.indexOf('  function gradePeriodLabel'),utilitySource.indexOf('  function bindEvents')),chartScope);
chartScope.renderAcademicGrades();
assert(chart.innerHTML.indexOf('2-1 중간') < chart.innerHTML.indexOf('2-1 기말'));
assert(chart.innerHTML.includes('>0</text>'), 'zero is a recorded score, not an empty cell');

(async()=>{
 const {validateGrades,gradeStatistics,sanitizeFeedback} = await import('../netlify/functions/grade-feedback-core.mjs');
 const input={schoolLevel:'middle',grade:2,entries:exams,name:'Do not forward',email:'Do not forward'};
 const validated=validateGrades(input);
 assert(!JSON.stringify(validated).includes('Do not forward'));
 assert.equal(gradeStatistics(validated.entries)[0].latestScore,80);
 assert.equal(gradeStatistics(validated.entries)[0].scoreChange,80);
 assert.throws(()=>validateGrades({...input,grade:1}),/학년/);
 assert.throws(()=>validateGrades({...input,entries:[...exams,exams[0]]}),/중복/);
 assert.throws(()=>validateGrades({...input,entries:[{...exams[0],score:'90'}]}),/점수/);
 assert.throws(()=>sanitizeFeedback({summary:'합격 가능성 80%'}),/확인되지/);
 assert.equal(sanitizeFeedback({summary:'수학 복습을 이어가요.',nextSteps:['하루 10분 복습']}).nextSteps.length,1);
 const {schoolMetadata,fetchSchools,resolveHighSchool}=await import('../netlify/functions/school-catalog-core.mjs');
 assert.equal(schoolMetadata({HMPG_ADRES:'javascript:alert(1)'}).website,'');
 const official=await fetchSchools({SCHUL_NM:'검수 테스트 학교'},async url=>{
   assert(url.startsWith('https://open.neis.go.kr/hub/schoolInfo?')); assert(url.includes('SCHUL_KND_SC_NM'));
   return {ok:true,json:async()=>({schoolInfo:[{head:[{list_total_count:10},{RESULT:{CODE:'INFO-000'}}]},{row:[{SCHUL_NM:'학교',SCHUL_KND_SC_NM:'고등학교',ATPT_OFCDC_SC_CODE:'R10',SD_SCHUL_CODE:'8750133',HS_SC_NM:'일반고',HMPG_ADRES:'school.example.edu'}]}]})};
 });
 assert.equal(official.schools[0].schoolType,'일반고'); assert.equal(official.limited,true);
 await assert.rejects(()=>resolveHighSchool({name:'가짜 학교',website:'https://bad.invalid'}),/검색 결과/);
 const {handler}=await import('../netlify/functions/gradeFeedback.mjs');
 assert.equal((await handler({httpMethod:'GET'})).statusCode,405);
 assert.equal((await handler({httpMethod:'OPTIONS'})).statusCode,204);
 assert.equal((await handler({httpMethod:'POST',body:'{'})).statusCode,400);
 assert.equal((await handler({httpMethod:'POST',headers:{authorization:'Bearer broken'},body:JSON.stringify(input)})).statusCode,401);

 // Execute the actual account loader and saver with a fake DOM; never touches browser/private data.
 const elements=new Map(), storage=new Map(), requests=[]; let failLoad=false;
 const node=id=>{if(!elements.has(id)) elements.set(id,{innerHTML:'',textContent:'',disabled:false,dataset:{},setAttribute(){},reportValidity(){return true}});return elements.get(id)};
 const doc={readyState:'loading',addEventListener(){},querySelector:selector=>selector==='.grade-tracker>.planner-section-title'?null:node(selector),querySelectorAll:()=>[]};
 const callbacks=new Map();
 const win={firebase:{},PrimeEduGradeModel:M,PrimeUI:require('../js/ui-icons.js'),addEventListener:(name,callback)=>callbacks.set(name,callback),dispatchEvent(){},PrimeEduGradeChart:{setRecords:r=>requests.push({chart:r})},ClassHubFirebase:{isConfigured:()=>true,onAuthStateChanged:()=>()=>{},
   getUserProfile:async uid=>({schoolLevel:uid==='A'?'middle':'high',grade:2}),
   listUserCollectionDocs:async uid=>{if(failLoad)throw Error('offline');return [{id:'grade-notebook-v2',entries:[{...exams[0],schoolLevel:uid==='A'?'middle':'high',score:uid==='A'?81:92}],settings:{}}]},
   addUserCollectionDoc:async(uid,collection,payload)=>requests.push({uid,collection,payload}),
 }};
 const context=vm.createContext({window:win,document:doc,localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},CustomEvent:function(){},setTimeout,clearTimeout,AbortSignal,AbortController,fetch:async()=>{throw Error('not expected')}});
 const frontend=read('js/grade-notebook.js').replace('  document.readyState ===', '  window.gradeTest = {load,save,init,request};\n  document.readyState ===');
 vm.runInContext(frontend,context);
 win.gradeTest.init();
 await win.gradeTest.load({uid:'A'}); assert.equal(requests.at(-1).chart[0].score,81);
 await callbacks.get('prime:profile-updated')();
 assert.equal(requests.at(-1).chart[0].score,81,'profile refresh must preserve loaded grades');
 assert.equal(JSON.parse(storage.get('primeEduGradeNotebook.v2.A')).pending,false,'profile refresh is not an unsaved grade edit');
 await win.gradeTest.load({uid:'B'}); assert.equal(requests.at(-1).chart[0].score,92);
 await win.gradeTest.load(null); assert.equal(requests.at(-1).chart.length,0);
 assert(storage.has('primeEduGradeNotebook.v2.A')); assert(storage.has('primeEduGradeNotebook.v2.B'));
 failLoad=true; await win.gradeTest.load({uid:'C'}); await win.gradeTest.save();
 assert(!requests.some(r=>r.uid==='C'),'failed reads must not overwrite unseen cloud grades');
 assert(node('#gradeSaveStatus').textContent.includes('덮어쓰지'));
 context.fetch=async()=>new Response(JSON.stringify({error:'synthetic delay',code:'AI_CONNECTION_TIMEOUT',retryable:true}),{status:504});
 await assert.rejects(win.gradeTest.request('/api/gradeFeedback',{}),e=>e.code==='AI_CONNECTION_TIMEOUT'&&e.retryable&&e.status===504);
 context.fetch=async()=>new Response('<html>function deadline</html>',{status:504});
 await assert.rejects(win.gradeTest.request('/api/gradeFeedback',{}),e=>e.code==='AI_CONNECTION_TIMEOUT');
 context.fetch=async()=>new Response('[]');
 await assert.rejects(win.gradeTest.request('/api/gradeFeedback',{}),e=>e.code==='AI_INVALID_RESPONSE');
 context.fetch=async()=>{throw new TypeError('synthetic network failure')};
 await assert.rejects(win.gradeTest.request('/api/gradeFeedback',{}),e=>e.code==='AI_NETWORK_ERROR');
 let release;context.fetch=()=>new Promise(resolve=>release=resolve);
 const pending=win.gradeTest.request('/api/gradeFeedback',{});
 await Promise.resolve();await win.gradeTest.load(null);release(new Response('{"summary":"other owner"}'));
 await assert.rejects(pending,e=>e.code==='ACCOUNT_CHANGED','late feedback cannot cross account boundaries');
 console.log('PASS notebook/grades: selected-only reader, draft answers, profile year limits, zero/blank distinction, chronological chart model, independent 5/9 ranks, UID cache isolation, failed-read overwrite prevention, trusted NEIS target lookup, bounded anonymous feedback and fabricated probability rejection.');
})().catch(error=>{console.error(error);process.exitCode=1});
