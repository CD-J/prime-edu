(() => {
  'use strict';
  const C=window.PrimeLearnerIntegrationCore,$=s=>document.querySelector(s),icon=n=>window.PrimeUI.svg(n),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const ids=['studyGoal','studyGoalAI','studyFocus','studyFocusAI','studyPlanStyle','studyPlanStyleAI','quizSubject','quizUnit','studyNoteSubject','studyBookTopic','studyBookCategory','studyBookPreference','manualChecklistMinutes'];
  let owner='',fields=new Map(),overrides={},timer=0,applying=false,lastSignature='',ribbon=null;
  const sourceDrafts=new Map();
  const uid=()=>window.ClassHubFirebase?.getCurrentUser?.()?.uid||'guest';
  const read=()=>uid()==='guest'?{}:window.PrimeStudyOnboarding?.getData?.()||{};
  const key=id=>`primeEdu.learnerDefaults.v1.${id}`;
  function readOverrides(id){try{const v=JSON.parse(localStorage.getItem(key(id))||'{}');return Object.fromEntries(ids.filter(k=>typeof v[k]==='string').map(k=>[k,v[k].slice(0,180)]));}catch{return {};}}
  function events(from,to){return uid()==='guest'?[]:C.events(read(),from,to);}
  function alerts(){return uid()==='guest'?[]:C.schoolAlerts(window.SchemsPlannerAPI?.getSchoolEvents?.()||[],window.SchemsStudyAI?.activityTasks?.()||[]);}
  function paintSchool(){const home=$('#connectedHomeAction');if(!home)return;const next=alerts().find(e=>e.home);home.hidden=!next;if(!next){home.innerHTML='';return;}home.setAttribute('aria-label','다가오는 학교 일정');home.innerHTML=`<div><span>${esc(next.type)} · ${esc(next.date.slice(5).replace('-','/'))}</span><h2>${esc(next.title)}</h2></div><strong class="school-alert-dday">${esc(next.dday)}</strong><button type="button" class="school-alert-open" data-important-date="${next.date}" ${next.activityId?`data-important-activity="${esc(next.activityId)}"`:''} aria-label="${esc(next.title)} 일정 보기">${icon('arrow')}</button>`;}
  function setValue(el,value){if(el.tagName==='SELECT'&&![...el.options].some(o=>o.value===value))return;const next=String(value).slice(0,el.maxLength>0?el.maxLength:180);if(el.value===next)return;el.value=next;applying=true;try{for(const type of ['input','change']){const event=new Event(type,{bubbles:true});event.primeAutoDefault=true;el.dispatchEvent(event);}}finally{applying=false;}}
  function prepare(kind='all'){
    const nextOwner=uid(),changed=owner!==nextOwner,hadOwner=Boolean(owner);
    const sourceFields=['quizNoteText','studyNoteText','quizSubject','quizUnit'];
    if(changed&&owner){sourceDrafts.set(owner,Object.fromEntries(sourceFields.map(id=>[id,{value:$('#'+id)?.value||'',source:$('#'+id)?.dataset.sourceNoteId||''}])));for(const id of sourceFields){const el=$('#'+id);if(el){el.value=sourceDrafts.get(nextOwner)?.[id]?.value||'';delete el.dataset.sourceNoteId;const source=sourceDrafts.get(nextOwner)?.[id]?.source;if(source)el.dataset.sourceNoteId=source;}}}
    owner=nextOwner;if(changed){overrides=readOverrides(owner);fields.forEach(s=>{s.previous=undefined;s.touched=false;});}
    const c=C.active(read()),d=C.defaults(c),subject=$('#quizSubject')?.value;
    const subjectState=fields.get('quizSubject'),unit=subject&&(subjectState?.touched||subjectState&&subject!==subjectState.previous&&subject!==subjectState.base)?C.defaults(c,subject).unit:d.unit;
    const suggested={studyGoal:d.planGoal,studyGoalAI:d.planGoal,studyPlanStyle:d.style,studyPlanStyleAI:d.style,quizSubject:d.subject,quizUnit:unit,studyNoteSubject:d.subject,studyBookTopic:d.bookTopic,studyBookCategory:d.bookCategory,studyBookPreference:d.bookPreference,manualChecklistMinutes:c.habits.length?String(d.focusMinutes):''};
    if(c.concerns.includes('오답'))suggested.studyFocus=suggested.studyFocusAI='오답 복습';
    ids.forEach(id=>{const el=$('#'+id);if(!el)return;let s=fields.get(id);if(!s){s={el,base:el.tagName==='SELECT'?[...el.options].find(o=>o.defaultSelected)?.value||el.options[0]?.value||'':el.defaultValue||'',previous:undefined,touched:false};fields.set(id,s);}else if(s.el!==el){s.el=el;s.previous=undefined;s.touched=false;}
      // Programmatic source-note selections are more specific than the initial consultation.
      if((id==='quizSubject'||id==='quizUnit')&&$('#quizNoteText')?.dataset.sourceNoteId)return;
      if(changed&&(hadOwner||Object.hasOwn(overrides,id))){setValue(el,overrides[id]??s.base);s.touched=Object.hasOwn(overrides,id);}else if(Object.hasOwn(overrides,id)){s.touched=true;}
      if(!changed&&el.closest('form')?.getAttribute('aria-busy')==='true')return;
      const value=suggested[id];if(value&&C.shouldFill(el.value,s.base,s.previous,s.touched)){setValue(el,value);s.previous=el.value;}
      // Removing an answer also removes only the default we supplied, not a user's draft.
      else if(!value&&s.previous!==undefined&&!s.touched&&el.value===s.previous){setValue(el,s.base);s.previous=undefined;}
    });
    window.dispatchEvent(new Event('prime:controls-sync'));
  }
  function paint(){
    paintSchool();if(!ribbon)return;const c=C.active(read()),d=C.defaults(c),today=C.dateKey(),weekRows=events(today,C.addDays(today,7)),clock=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date()),next=weekRows.find(e=>e.date>today||e.end>clock);
    ribbon.hidden=!next&&!d.subject&&!d.bookTopic;const items=[];
    if(next)items.push(`<button type="button" data-learner-date="${next.date}" data-ui-keep-label>${icon('calendar')}<div><small class="learner-ribbon-schedule"><span>${next.date===today?(next.start<=clock?'학원 수업 중':'오늘 학원'):C.days[new Date(next.date+'T00:00:00Z').getUTCDay()]+'요일 학원'}</span><time>${esc(next.start+'–'+next.end)}</time></small><strong>${esc(next.title)}</strong></div><span class="learner-ribbon-end">${icon('arrow')}</span></button>`);
    if(d.subject)items.push(`<button type="button" data-learner-quiz data-ui-keep-label>${icon('quiz')}<div><small>현재 진도 · ${esc(d.subject)}</small><strong>${esc(d.unit||'개념 확인')}</strong></div><span class="learner-ribbon-end">${icon('arrow')}</span></button>`);
    else if(d.bookTopic)items.push(`<button type="button" data-learner-books data-ui-keep-label>${icon('openBook')}<div><small>관심 진로 · 읽을 책</small><strong>${esc(d.bookTopic)}</strong></div><span class="learner-ribbon-end">${icon('arrow')}</span></button>`);
    ribbon.dataset.count=String(items.length);const html=items.join('');if(ribbon.innerHTML!==html)ribbon.innerHTML=html;
  }
  function refresh(force=false){clearTimeout(timer);if(window.PrimeStudyOnboarding?.isBusy?.())return;const signature=JSON.stringify([uid(),read()]);prepare();paint();if(force||signature!==lastSignature){lastSignature=signature;window.dispatchEvent(new CustomEvent('prime:learner-context',{detail:{owner:uid()}}));}}
  function queue(){clearTimeout(timer);timer=setTimeout(refresh,160);}
  function editAcademy(){for(const id of ['closeCalendarDayModal','closePlannerEventModal']){const b=$('#'+id);if(b?.closest('.modal-backdrop.is-open'))b.click();}window.PrimeJourneys?.close?.();requestAnimationFrame(()=>window.PrimeStudyOnboarding?.open(2));}
  function init(){
    ribbon=document.createElement('section');ribbon.id='learnerRibbon';ribbon.className='learner-ribbon';ribbon.hidden=true;ribbon.setAttribute('aria-label','내 학습과 일정');const panel=$('.panel-home');const anchor=$('#connectedHomeAction');if(anchor)anchor.after(ribbon);else panel?.prepend(ribbon);
    document.addEventListener('input',remember);document.addEventListener('change',remember);
    document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.hasAttribute('data-edit-academy'))editAcademy();else if(b.hasAttribute('data-important-activity'))window.dispatchEvent(new CustomEvent('prime:activity-open',{detail:{id:b.dataset.importantActivity,origin:b}}));else if(b.hasAttribute('data-learner-date')||b.hasAttribute('data-important-date')){window.switchTab?.('plan');window.dispatchEvent(new CustomEvent('prime:planner-open-date',{detail:b.dataset.learnerDate||b.dataset.importantDate}));}else if(b.hasAttribute('data-learner-quiz'))window.PrimeJourneys?.open('quiz',b);else if(b.hasAttribute('data-learner-books'))window.PrimeJourneys?.open('books',b);});
    ['prime:study-consultation','prime:study-owner-change','prime:profile-updated'].forEach(n=>window.addEventListener(n,queue));
    window.addEventListener('prime:study-consultation-finished',()=>{clearTimeout(timer);timer=setTimeout(()=>refresh(true),250);});
    window.addEventListener('prime:journey-active',e=>prepare(e.detail));window.addEventListener('prime:tab-change',()=>{prepare();paint();});
    window.addEventListener('prime:learner-goal-refresh',()=>prepare('target'));
    ['schems:planner-data','schems:study-data'].forEach(n=>window.addEventListener(n,paintSchool));
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh(true);});
    window.setInterval?.(()=>{if(!document.hidden&&!window.PrimeStudyOnboarding?.isBusy?.()){const old=C.dateKey();if(old!==ribbon.dataset.day){ribbon.dataset.day=old;refresh(true);}else paint();}},60000);
    refresh(true);
  }
  function remember(e){if(applying||!ids.includes(e.target.id)||uid()!==owner)return;const s=fields.get(e.target.id);if(!e.isTrusted&&s&&e.target.value===s.previous)return;if(s)s.touched=true;overrides[e.target.id]=String(e.target.value).slice(0,180);try{localStorage.setItem(key(owner),JSON.stringify(overrides));}catch{}}
  window.PrimeLearnerIntegration={events,prepare,editAcademy,paintSchool,getAlerts:alerts,getDefaults:()=>C.defaults(read()),getSelfReport:()=>C.selfReport(read()),getGoals:()=>C.active(read()).goals};
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
})();
