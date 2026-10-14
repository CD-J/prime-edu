/* Local-only auth/profile transitions. No real account, Firebase or NEIS writes. */
(()=>{
 let user=null,complete=false;const listeners=[];
 const profile=()=>complete?{displayName:'검수 계정',schoolLevel:'middle',grade:3,classNo:7,school:{name:'검수 학교',officeCode:'TEST',schoolCode:'TEST',address:'검증용'}}:{};
 Object.assign(window.ClassHubFirebase,{isConfigured:()=>true,init:()=>true,getCurrentUser:()=>user,getUserProfile:async()=>profile(),onAuthStateChanged:fn=>{listeners.push(fn);queueMicrotask(()=>fn(user));return ()=>{};},subscribePersonalEvents:(_uid,fn)=>{fn([]);return ()=>{};}});
 Object.assign(window.PrimeEduSchoolData,{fetchStableTimetable:async()=>({matrix:Array.from({length:7},()=>['수학','국어','과학','영어','체육'])}),fetchAcademicEvents:async()=>({value:window.PrimeCalendarFixture?.events||[]}),fetchMeals:async()=>({value:[]})});
 document.addEventListener('DOMContentLoaded',()=>{
  const toolbar=document.createElement('aside');toolbar.dataset.schoolQa='true';toolbar.style.cssText='position:fixed;bottom:90px;left:10px;z-index:600;display:flex;gap:6px';
  for(const [label,loggedIn,ready] of [['미설정 검수',true,false],['설정 완료 검수',true,true],['로그아웃 검수',false,false]]){const b=document.createElement('button');b.textContent=label;b.onclick=()=>{complete=ready;user=loggedIn?{uid:'local-school-qa',email:'qa@example.invalid'}:null;listeners.forEach(fn=>fn(user));};toolbar.append(b);}
  const close=document.createElement('button');close.textContent='검수 도구 닫기';close.onclick=()=>toolbar.remove();toolbar.append(close);document.body.append(toolbar);
 });
})();
