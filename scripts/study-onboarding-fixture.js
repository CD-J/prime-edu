/* Explicit local-only signup simulations. No real accounts, credentials or cloud. */
(() => {
  let user=null,fail=false,chatSlow=false,events=[];const listeners=[],cloud=new Map();
  const profile=()=>({displayName:'검수 학생',sudoGuideVersion:1,schoolLevel:'middle',grade:2,classNo:1,school:{name:'검수 학교',officeCode:'TEST',schoolCode:'TEST'},...(cloud.has(user?.uid)?{studyConsultation:cloud.get(user.uid)}:{})});
  window.firebase={};
  Object.assign(window.ClassHubFirebase,{listUserCollectionDocs:async()=>[],listChatConversations:async()=>[],saveChatConversation:async()=>{},getChatStudyContext:()=>chatSlow?new Promise(()=>{}):Promise.resolve({tasks:[]}),addUserCollectionDoc:async(_uid,_kind,payload)=>payload.id||'local-fixture'});
  Object.assign(window.ClassHubFirebase,{isConfigured:()=>true,init:()=>true,getCurrentUser:()=>user,getUserProfile:async()=>profile(),getStudyConsultation:async id=>cloud.get(id)||null,onAuthStateChanged:fn=>{listeners.push(fn);queueMicrotask(()=>fn(user));return ()=>{};},getPersonalDataPreferences:async()=>null,savePersonalDataPreferences:async()=>{},saveStudyConsultation:async(id,value)=>{await new Promise(r=>setTimeout(r,120));if(fail)throw Error('검수용 동기화 실패');if(user?.uid===id)cloud.set(id,JSON.parse(JSON.stringify(value)));},subscribePersonalEvents:(_id,fn)=>{fn([]);return ()=>{};}});
  Object.assign(window.PrimeEduSchoolData,{fetchStableTimetable:async()=>({matrix:Array.from({length:7},()=>['국어','수학','영어','과학','체육'])}),fetchAcademicEvents:async()=>({value:events}),fetchMeals:async()=>({value:[]})});
  document.addEventListener('DOMContentLoaded',()=>{
    const toolbar=document.createElement('aside');toolbar.dataset.onboardingQa='true';toolbar.style.cssText='position:fixed;bottom:84px;left:8px;z-index:9000;display:flex;flex-wrap:wrap;max-width:90vw;gap:4px;background:#fff;padding:6px;border-radius:10px;color:#222;font-size:12px';
    const button=(label,fn)=>{const b=document.createElement('button');b.textContent=label;b.onclick=fn;toolbar.append(b);};
    button('새 가입 검수',()=>{localStorage.removeItem('primeEdu.studyConsultation.v1.local-onboarding-qa');cloud.set('local-onboarding-qa',{version:1,status:'pending'});window.dispatchEvent(new CustomEvent('prime:signup-start'));user={uid:'local-onboarding-qa',email:'qa@example.invalid',getIdToken:async()=>''};listeners.forEach(f=>f(user));window.dispatchEvent(new CustomEvent('prime:signup-end',{detail:{user}}));setTimeout(()=>toolbar.inert=false,300);});
    button('같은 계정 재로그인',()=>{user={uid:'local-onboarding-qa',email:'qa@example.invalid',getIdToken:async()=>''};listeners.forEach(f=>f(user));setTimeout(()=>toolbar.inert=false,300);});
    button('상담 정보 연결 검수',()=>{const id='local-learner-qa',value={version:1,status:'completed',step:0,name:'하늘',goals:{highSchool:'검수 과학고',university:'검수 대학 · 컴퓨터공학',career:'개발자'},academy:[{title:'수학 학원',days:[0,1,2,3,4,5,6],start:'19:00',end:'20:30'}],habits:['짧게 나눠서','저녁에'],progress:{국어:'문학 3단원',영어:'교과서 4과',수학:'일차함수 · 개념 복습'},concerns:'수학 풀이 시간이 고민이에요.'};cloud.set(id,value);localStorage.setItem('primeEdu.studyConsultation.v1.'+id,JSON.stringify({data:value,pending:false}));user={uid:id,email:'learner@example.invalid',getIdToken:async()=>''};listeners.forEach(f=>f(user));});
    button('기존 계정 검수',()=>{user={uid:'local-onboarding-existing',email:'existing@example.invalid',getIdToken:async()=>''};listeners.forEach(f=>f(user));setTimeout(()=>toolbar.inert=false,300);});
    button('동기화 실패 토글',()=>{fail=!fail;toolbar.dataset.saveFails=String(fail);});
    button('학교 알림 검수',()=>{if(user)user.getIdToken=async()=>'local-fixture-token';const C=window.PrimeLearnerIntegrationCore,t=C.dateKey();events=[{id:'qa-exam',title:'[검수] 중간고사',date:C.addDays(t,7),source:'neis'},{id:'qa-performance',title:'[검수] 과학 수행평가',date:C.addDays(t,2),source:'neis'},{id:'qa-sports',title:'[검수] 운동회',date:C.addDays(t,5),source:'neis'}];listeners.forEach(f=>f(user));});
    button('기록 조회 지연 검수',()=>{chatSlow=!chatSlow;});
    button('로그아웃 검수',()=>{user=null;listeners.forEach(f=>f(null));});
    button('도구 숨기기',()=>{toolbar.hidden=true;});document.body.append(toolbar);
  });
})();
