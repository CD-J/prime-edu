const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const core = require('../js/study-review-core.js');
const source = fs.readFileSync(require.resolve('../js/study-ai.js'),'utf8');
const slots = new Map(), callbacks = [], requests = [];
let user = null, remoteLists = async()=>[], failSave = false;
const localStorage = {getItem:key=>slots.get(key)||null,setItem(key,value){if(failSave)throw Error('quota');slots.set(key,value);}};
const day=core.dateKey(new Date());
const legacy = JSON.stringify({quizzes:[{id:'q',title:'함수',questions:[{question:'기울기?',options:['1','2'],answer:'2'}]}],attempts:[{id:'a',quizId:'q',date:day,details:[{correct:false}]}],notes:[{id:'private-guest',text:'original'}]});
slots.set('schemsStudyAI.v2',legacy);
const hub = {getCurrentUser:()=>user,onAuthStateChanged:fn=>callbacks.push(fn),listUserCollectionDocs:(...args)=>remoteLists(...args),addUserCollectionDoc:async(uid,c,payload)=>{requests.push({uid,c,payload});return payload.id;}};
const document = {readyState:'loading',querySelector:()=>null,querySelectorAll:()=>[],getElementById:()=>null,addEventListener(){}};
const window = {ClassHubFirebase:hub,PrimeCompat:{cloneData:x=>JSON.parse(JSON.stringify(x))},SchemsReviewCore:core,dispatchEvent(){}};
const ctx = vm.createContext({window,document,localStorage,console,CustomEvent:class{},AbortController,setTimeout,clearTimeout,fetch:async()=>({ok:true,json:async()=>({})})});
const exposed = source.replace(/\}\)\(\);\s*$/, 'window.__test = {state,hydrate,persist,bindRemoteAuth,loadRemote,postJson,onGenerateQuiz,onGeneratePlan};})();');
vm.runInContext(exposed,ctx);
const test=window.__test, api=window.SchemsStudyAI;
const switchUser=async uid=>{user=uid?{uid,getIdToken:async()=>`test-token-${uid}`}:null;await callbacks[0](user);};
(async()=>{
  test.hydrate();test.bindRemoteAuth();assert.equal(api.getSnapshot().owner,'guest');assert.equal(api.getReviewQueue().length,1);
  assert.equal(api.addReviewsToPlan(),1);assert.equal(api.addReviewsToPlan(),0,'review tasks idempotent');
  const saved=await api.saveReviewResult('q:0',true);assert.equal(saved.cloud,null);assert.equal(api.getReviewQueue()[0].ready,false);
  assert.equal(api.getSnapshot().tasks[0].done,true,'review completes its linked checklist task');
  await assert.rejects(()=>api.saveReviewResult('q:0',true),/이미/);
  await switchUser('A');assert.equal(api.getSnapshot().notes.length,0,'unattributed guest data is not silently assigned');
  assert.equal(api.canImportDeviceRecords(),true);api.importDeviceRecords();assert.equal(api.getSnapshot().notes[0].id,'private-guest');assert.equal(requests.length,0,'import is local only');
  await switchUser('B');assert.equal(api.getSnapshot().notes.length,0,'A cache is not visible in B');
  await switchUser('A');assert.equal(api.getSnapshot().notes[0].id,'private-guest');
  // All six reads are pending. Leave A before any old read finishes.
  const pending=[];remoteLists=()=>new Promise(resolve=>pending.push(resolve));
  const delayedLoad=test.loadRemote('A');
  remoteLists=async()=>[];await switchUser('B');pending.forEach(resolve=>resolve([{id:'old-A',text:'secret'}]));await delayedLoad;
  assert.equal(api.getSnapshot().notes.length,0,'late A results cannot hydrate B');
  // AI requests started on A must not turn into B fallback quizzes/plans.
  await switchUser('A');let resolveFetch;ctx.fetch=()=>new Promise(resolve=>{resolveFetch=resolve;});
  const operation=test.onGenerateQuiz({preventDefault(){}});await new Promise(resolve=>setImmediate(resolve));
  await switchUser('B');resolveFetch({ok:true,json:async()=>({questions:[{question:'A question',answer:'2'}]})});await operation;
  assert.equal(api.getSnapshot().notes.length,0);assert.equal(test.state.quizzes.length,0);
  assert.equal(slots.get('schemsStudyAI.v2'),legacy,'legacy bytes preserved');
  await switchUser(null);assert.equal(api.getSnapshot().notes[0].id,'private-guest');
  const current=api.getReviewQueue()[0];current.ready=true;
  // A fresh wrong full attempt provides a review due today.
  test.state.attempts.unshift({id:'fresh',quizId:'q',date:day,createdAt:new Date().toISOString(),details:[{correct:false}]});
  const before=JSON.stringify(test.state.quizzes[0].reviewProgress);failSave=true;
  await assert.rejects(()=>api.saveReviewResult('q:0',false),/저장/);assert.equal(JSON.stringify(test.state.quizzes[0].reviewProgress),before,'failed storage rolls back progress');failSave=false;
  slots.set('schemsStudyAI.v2:guest','{broken');test.hydrate();assert.equal(slots.get('schemsStudyAI.v2:guest'),'{broken','unreadable cache is not destroyed');
  test.persist();assert.ok([...slots].some(([key,value])=>key.startsWith('schemsStudyAI.v2:guest:recovery:')&&value==='{broken'),'later saves retain malformed bytes in a recovery slot');
  console.log('PASS review owner: guest/A/B scopes, opt-in local import, legacy preservation, late cloud/AI exclusion, no cross-account fallback, linked-task completion, duplicate guard, storage rollback, corrupt-cache preservation.');
})().catch(error=>{console.error(error);process.exitCode=1;});
