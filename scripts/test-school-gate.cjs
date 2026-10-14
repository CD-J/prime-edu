const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(require.resolve('../index.html'),'utf8');
const section=(from,to)=>html.slice(html.indexOf(from),html.indexOf(to,html.indexOf(from)));
assert.doesNotMatch(html,/포항제철중학교|8761206|aria-label="2-1 시간표"/);
assert.match(html,/data-school-state="setup"/);assert.match(html,/id="schoolContent" inert aria-hidden="true"/);
assert.doesNotMatch(html,/ClassHubFirebase\.subscribeClassData\(/);
const schoolConfig={};vm.runInNewContext(fs.readFileSync(require.resolve('../js/school-config.js'),'utf8'),{window:schoolConfig});assert(Object.values(schoolConfig.CLASS_HUB_SCHOOL_DEFAULT).every(v=>v===''));
const clone=x=>JSON.parse(JSON.stringify(x)),defer=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
function harness(){
 const storage=new Map([['classPlannerData.v3',JSON.stringify({className:'2-1',schedule:[['WRONG CLASS']],events:[{title:'OLD SCHOOL'}]})],['classHubSchoolConfig','old config'],['meal.v2.20261010','old meal']]);
 const nodes=new Map();const node=()=>({dataset:{},attrs:new Set(),textContent:'',hidden:false,toggleAttribute(k,on){on?this.attrs.add(k):this.attrs.delete(k);},setAttribute(k){this.attrs.add(k);},removeAttribute(k){this.attrs.delete(k);},querySelector(k){return nodes.get(k);}});
 for(const s of ['.panel-school','#schoolContent','#schoolProfileNotice','strong','p','button'])nodes.set(s,node());
 const calls=[];let user=null,profileWait=null,timetableWait=null,mealWait=null;
 const profile={schoolLevel:'middle',grade:3,classNo:7,school:{officeCode:'R10',schoolCode:'TEST',name:'검수 학교'}};
 const scope=vm.createContext({window:{PrimeCompat:{cloneData:clone},dispatchEvent(){}},CustomEvent:class{},Date,console,
  $:s=>nodes.get(s),localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
  defaultData:{className:'',schedule:Array.from({length:7},()=>Array(5).fill('')),events:[],meals:{}},DEFAULT_SCHOOL_CONFIG:{schoolName:'',officeCode:'',schoolCode:''},SCHOOL_CONFIG:{},SCHOOL_CONFIG_KEY:'classHubSchoolConfig',STORAGE_KEY:'classPlannerData.v3',
  currentUserProfile:null,schoolProfileUid:'',schoolSyncGeneration:0,profileLoadGeneration:0,activeSchoolProfileKey:'',homeCustomizing:true,firebaseEnabled:true,personalEventsCache:[],calendarMealMonthKey:'',weekMealCache:new Map(),mealDetailCache:new Map(),
  ClassHubFirebase:{getCurrentUser:()=>user,getUserProfile:async()=>profileWait?profileWait.promise:profile},
  PrimeEduSchoolData:{isCompleteProfile:p=>!!p?.school?.schoolCode&&p?.classNo>0&&p?.grade>0,fetchStableTimetable:async p=>{calls.push(['table',p.classNo]);return timetableWait?timetableWait.promise:{matrix:[['VERIFIED CLASS']]};},fetchAcademicEvents:async()=>({value:[{date:'2026-10-10',title:'VERIFIED EVENT'}]}),fetchMeals:async()=>{calls.push(['meal']);return mealWait?mealWait.promise:{value:[{date:'2026-10-10',menu:'VERIFIED MEAL'}]};}},
  mondayOf:d=>d,formatDate:()=> '2026-10-10',academicYearRange:()=>({from:'2026-03-01',to:'2027-02-28'}),applyHomeLayout(){},loadHomeLayout(){},renderAll(){scope.setSchoolGate(scope.hasVerifiedSchoolProfile());}});
 vm.runInContext(section('    function loadData()','    function hasBrokenKorean')+section('    function applyRemoteData','    function hasMealInfo')+section('    function hasVerifiedSchoolProfile','    function studentProfileFromFields')+section('    function resetSchoolData()','    function updateAuthUi')+section('    async function loadUserProfile','    function populateProfileForm')+section('    async function getMealsForDate','    async function getMealSummaryForDate'),scope);
 scope.data=scope.loadData();
 return {scope,nodes,storage,calls,profile,user:v=>user=v,profileWait:v=>profileWait=v,timetableWait:v=>timetableWait=v,mealWait:v=>mealWait=v};
}
(async()=>{
 const h=harness(),s=h.scope;s.showSchoolSetupNotice();assert(s.data.schedule.flat().every(x=>x===''));assert.equal(s.data.className,'');assert.equal(h.nodes.get('.panel-school').dataset.schoolState,'setup');assert(h.nodes.get('#schoolContent').attrs.has('inert'));
 s.applyRemoteData({schedule:[['LEAK']],className:'2-1'});assert(s.data.schedule.flat().every(x=>x===''));assert.equal((await s.getMealsForDate('2026-10-10')).length,0);assert.equal(h.calls.length,0);assert(h.storage.has('classPlannerData.v3'));
 h.user({uid:'a'});await s.loadUserProfile({uid:'a'});assert.equal(s.data.className,'3-7');assert.equal(s.data.schedule[0][0],'VERIFIED CLASS');assert.equal(h.nodes.get('.panel-school').dataset.schoolState,'ready');assert(!h.nodes.get('#schoolContent').attrs.has('inert'));assert.equal((await s.getMealsForDate('2026-10-10'))[0].menu,'VERIFIED MEAL');
 h.user(null);await s.loadUserProfile(null);assert.equal(s.data.className,'');assert(s.data.schedule.flat().every(x=>x===''));assert.equal(s.data.events.length,0);assert(h.storage.has('classPlannerData.v3'));assert(h.storage.has('meal.v2.20261010'));assert.equal(h.nodes.get('.panel-school').dataset.schoolState,'setup');
 const missing=harness();missing.profile.classNo=0;missing.user({uid:'a'});await missing.scope.loadUserProfile({uid:'a'});assert.equal(missing.calls.length,0);assert.equal(missing.nodes.get('.panel-school').dataset.schoolState,'setup');
 const late=harness(),wait=defer();late.user({uid:'a'});late.profileWait(wait);const loading=late.scope.loadUserProfile({uid:'a'});late.user(null);await late.scope.loadUserProfile(null);wait.resolve(late.profile);await loading;assert(!late.scope.hasVerifiedSchoolProfile());assert.equal(late.calls.length,0);
 const stale=harness(),table=defer();stale.user({uid:'a'});stale.timetableWait(table);const request=stale.scope.loadUserProfile({uid:'a'});await Promise.resolve();await Promise.resolve();stale.user(null);await stale.scope.loadUserProfile(null);table.resolve({matrix:[['LATE LEAK']]});await request;assert(stale.scope.data.schedule.flat().every(x=>x===''));assert.equal(stale.scope.data.events.length,0);
 const meal=harness();meal.user({uid:'a'});await meal.scope.loadUserProfile({uid:'a'});const m=defer();meal.mealWait(m);const mealRequest=meal.scope.getMealsForDate('2026-10-10');meal.user(null);await meal.scope.loadUserProfile(null);m.resolve({value:[{date:'2026-10-10',menu:'LATE MEAL'}]});assert.equal((await mealRequest).length,0);assert.equal(meal.scope.mealDetailCache.size,0);
 console.log('PASS actual school/auth loaders: no guest default/cache/remote/meal leak, configured profile unlock, incomplete profile stays gated, logout preserves storage, stale profile/table/meal responses discarded.');
})().catch(e=>{console.error(e);process.exitCode=1;});
