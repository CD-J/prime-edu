/* One shared subpage controller. Original forms/IDs/listeners remain owners of
   validation, AI requests and storage. This module never writes learning data. */
(function(root){
  const definitions={
    checklist:{title:'오늘 할 일',form:'manualChecklistForm',status:'manualChecklistStatus',steps:[['어떤 일을 할까요?','manualChecklistTitle']]},
    event:{title:'일정',form:'plannerQuickAddForm',status:'plannerQuickStatus',steps:[['어떤 일정인가요?','plannerQuickTitle'],['메모를 남길까요?','plannerQuickMemo']]},
    plan:{title:'공부 계획',form:'studyPlanForm',status:'studyPlanStatus',result:'studyPlanPreview',steps:[['공부 목표는?','studyGoal'],['어떻게 공부할까요?','studyPlanStyle'],['어떤 내용을 공부할까요?','studyFocus'],['하루 공부 시간은?','studyAvailableMinutes']]},
    exam:{title:'시험 전략',form:'examStrategyForm',status:'examStrategyStatus',result:'examStrategyResult',steps:[['어떤 시험을 준비하나요?','examStrategyName'],['시험은 언제인가요?','examStrategyDate'],['어떤 과목과 범위인가요?','examStrategySubjects'],['하루 공부 시간은?','examStrategyMinutes'],['어려운 부분은?','examStrategyWeakness']]},
    concept:{title:'개념노트',form:'studyNoteForm',status:'studyNoteStatus',steps:[['어떤 과목인가요?','studyNoteSubject'],['정리할 내용은?','studyNoteText']]},
    quiz:{title:'문제노트',form:'studyQuizForm',status:'studyQuizStatus',steps:[['어떤 과목인가요?','quizSubject'],['어떤 단원인가요?','quizUnit'],['문제로 만들 내용은?','quizNoteText'],['몇 문제를 풀어볼까요?','quizCount'],['난이도는?','quizDifficulty']]},
    books:{title:'읽을 책',form:'studyBookForm',status:'studyBookStatus',result:'studyBookResults',steps:[['어떤 주제가 궁금한가요?','studyBookTopic'],['어떤 분야를 읽을까요?','studyBookCategory'],['어느 정도 깊이 읽을까요?','studyBookLevel'],['어떤 책을 좋아해요?','studyBookPreference']]}
  };
  const wheelValues=(min,max)=>Array.from({length:max-min+1},(_,i)=>String(min+i));
  if(typeof module==='object'&&module.exports){module.exports={definitions,wheelValues};return;}
  const $=s=>document.querySelector(s),icon=n=>root.PrimeUI.svg(n),configs=new Map(),pending=new Set(),disabledBefore=new WeakMap(),backgroundIds=new Set(['plan','exam','concept','quiz','books']);let current=null,index=0,origin=null,inertState=[],submitting=false,entry=false,closingEntry=false,deferredOpen=null;
  const view=document.createElement('section');view.id='primeJourney';view.hidden=true;view.className='prime-journey';view.setAttribute('role','dialog');view.setAttribute('aria-modal','true');
  view.innerHTML=`<header class="journey-header"><button type="button" data-journey-back aria-label="이전 단계">${icon('back')}</button><h2 id="journeyName"></h2><button type="button" data-journey-close aria-label="닫기">${icon('close')}</button></header><div class="journey-progress" role="progressbar" aria-label="입력 단계"></div><div class="journey-body"></div><footer class="journey-navigation"><span class="journey-step-counter" aria-hidden="true"></span><button type="button" data-journey-next data-ui-keep-label aria-label="다음 단계">다음 ${icon('arrow')}</button></footer>`;document.body.append(view);
  function lockLaunchers(){document.querySelectorAll('[data-journey],.journey-book-create').forEach(b=>{const id=b.dataset.journey||(b.dataset.aiCollapse==='studyNoteEditor'?'concept':'quiz');if(pending.has(configs.get(id))){if(!disabledBefore.has(b))disabledBefore.set(b,b.disabled);b.disabled=true;}else if(disabledBefore.has(b)){b.disabled=disabledBefore.get(b);disabledBefore.delete(b);}});}
  function taskCard(c){
    if(c.task)return c.task;const card=document.createElement('section');card.className='journey-task';card.dataset.journeyTask=c.id;card.hidden=true;card.tabIndex=-1;
    const copy=document.createElement('div'),title=document.createElement('strong'),message=document.createElement('p'),action=document.createElement('button');title.textContent=c.title;message.setAttribute('role','status');message.setAttribute('aria-live','polite');copy.append(title,message);action.type='button';action.className='journey-task-action';card.append(copy,action);
    const anchor=c.id==='concept'?$('#studyNoteEditor'):c.id==='quiz'?$('#studyQuizEditor'):c.marker;anchor.before(card);
    action.addEventListener('click',()=>{if(pending.has(c))return;if(c.outcome==='ready')openResult(c,action);else open(c.id,action);});c.task={card,message,action};return c.task;
  }
  function openResult(c,button){
    if(c.result){open(c.id,button,true);return;}
    const attribute=c.id==='concept'?'data-open-concept-note':'data-open-quiz-book';
    const book=[...document.querySelectorAll(`[${attribute}]`)].find(b=>b.getAttribute(attribute)===c.resultId);
    if(book){root.PrimeEduAI?.openCategory?.('notes','workspace');book.click();c.task.card.hidden=true;}
    else {c.outcome='retry';c.task.message.textContent='결과를 찾을 수 없어요. 다시 만들어주세요.';c.task.action.innerHTML=icon('reset');}
  }
  root.addEventListener('prime:study-operation',e=>{
    const c=[...configs.values()].find(c=>c.status?.id===e.detail.statusId);if(!c||!backgroundIds.has(c.id))return;
    const {kind,message,resultId,available=true}=e.detail,busy=kind==='loading';if(!busy&&!pending.has(c))return;const t=taskCard(c);
    if(busy){pending.add(c);c.outcome='loading';c.resultId=null;if(c.id==='plan'||c.id==='exam')c.result?.classList.add('journey-background-result');t.card.hidden=false;t.card.setAttribute('aria-busy','true');t.message.textContent=message;t.action.disabled=true;t.action.setAttribute('aria-label',`${c.title} 생성 중`);t.action.innerHTML='<span class="operation-spinner" aria-hidden="true"></span>';lockLaunchers();
      // Close after all submit listeners have captured their original inputs.
      queueMicrotask(()=>{if(current===c)close();});return;
    }
    if(!pending.has(c))return;pending.delete(c);lockLaunchers();c.resultId=resultId;c.outcome=kind==='error'||!available?'retry':'ready';t.card.removeAttribute('aria-busy');t.message.textContent=kind==='success'?'준비됐어요':message;t.action.disabled=false;const name=c.outcome==='ready'?`${c.title} 결과 열기`:`${c.title} 다시 시도`;t.action.setAttribute('aria-label',name);t.action.title=name;t.action.innerHTML=icon(c.outcome==='ready'?'arrow':'reset');
    // Completion only updates the feature card; it never changes page or focus.
    root.dispatchEvent(new Event('prime:notebook-content-change'));
  });
  root.addEventListener('prime:study-result-consumed',e=>{const c=configs.get(e.detail);if(!c)return;if(c.task)c.task.card.hidden=true;if(current===c)close();});
  function wheel(input){
    if(input.dataset.journeyWheel)return;const options=input.tagName==='SELECT'?[...input.options].map(o=>({value:o.value,label:o.text})):wheelValues(Number(input.min)||2,Number(input.max)||10).map(value=>({value,label:`${value}문항`}));
    const name=input.getAttribute('aria-label')||[...(input.closest('label')?.childNodes||[])].find(n=>n.nodeType===3&&n.textContent.trim())?.textContent.trim()||'선택';
    input.dataset.journeyWheel='true';input.classList.add('prime-picker-source');input.tabIndex=-1;input.setAttribute('aria-hidden','true');const box=document.createElement('div');box.className='journey-wheel';box.setAttribute('role','listbox');box.setAttribute('aria-label',name);box.tabIndex=0;
    options.forEach(o=>{const b=document.createElement('button');b.type='button';b.setAttribute('role','option');b.dataset.wheelValue=o.value;b.textContent=o.label;b.addEventListener('click',()=>pick(o.value,true));box.append(b);});input.after(box);
    const buttons=[...box.children],enabled=()=>buttons.filter(b=>!b.disabled);let timer=0,syncing=false;
    function pick(value,scroll=false){input.value=value;input.dispatchEvent(new Event('change',{bubbles:true}));buttons.forEach(b=>b.setAttribute('aria-selected',String(b.dataset.wheelValue===value)));if(scroll){syncing=true;const b=buttons.find(x=>x.dataset.wheelValue===value);box.scrollTo({top:b.offsetTop-(box.clientHeight-b.offsetHeight)/2,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});setTimeout(()=>syncing=false,250);}}
    function sync(){buttons.forEach(b=>{b.setAttribute('aria-selected',String(b.dataset.wheelValue===input.value));if(input.options)b.disabled=[...input.options].find(o=>o.value===b.dataset.wheelValue)?.disabled||false;});if(!box.clientHeight)return;const b=enabled().find(b=>b.dataset.wheelValue===input.value)||enabled()[0];if(!b)return;syncing=true;box.scrollTo({top:b.offsetTop-(box.clientHeight-b.offsetHeight)/2,behavior:'instant'});requestAnimationFrame(()=>syncing=false);}
    box.addEventListener('scroll',()=>{if(syncing||!box.clientHeight)return;clearTimeout(timer);timer=setTimeout(()=>{const mid=box.scrollTop+box.clientHeight/2,b=enabled().reduce((a,b)=>Math.abs(a.offsetTop+a.offsetHeight/2-mid)<Math.abs(b.offsetTop+b.offsetHeight/2-mid)?a:b);pick(b.dataset.wheelValue);},110);},{passive:true});
    box.addEventListener('keydown',e=>{if(!['ArrowUp','ArrowDown','Home','End'].includes(e.key))return;e.preventDefault();const list=enabled();let n=list.findIndex(b=>b.dataset.wheelValue===input.value);n=e.key==='Home'?0:e.key==='End'?list.length-1:Math.max(0,Math.min(list.length-1,n+(e.key==='ArrowDown'?1:-1)));pick(list[n].dataset.wheelValue,true);});input.addEventListener('change',sync);new ResizeObserver(sync).observe(box);sync();
  }
  function register(id,def){
    const form=$('#'+def.form);if(!form||configs.has(id))return;
    const submit=form.querySelector('button[type=submit]'),status=$('#'+def.status),home=form.parentElement,marker=document.createElement('span');marker.hidden=true;form.before(marker);
    const body=document.createElement('div');body.className='journey-form-pages';const steps=[];
    def.steps.forEach(([question,inputId])=>{const input=$('#'+inputId);if(!input)return;let field=input.closest('label');if(!field){field=document.createElement('label');field.append(input);}field.classList.add('journey-field');const page=document.createElement('section');page.className='journey-step';page.hidden=true;const title=document.createElement('h3');title.textContent=question;title.tabIndex=-1;page.append(title,field);body.append(page);steps.push({page,input,title});if(input.tagName==='SELECT'||inputId==='quizCount')wheel(input);});
    if(id==='checklist'){const details=document.createElement('details');details.className='activity-quick-options';const summary=document.createElement('summary');summary.textContent='날짜 · 시간 · 난이도';details.append(summary);['manualChecklistDate','manualChecklistMinutes','manualChecklistDifficulty'].forEach(key=>{const input=$('#'+key),field=input?.closest('label');if(field){details.append(field);if(input.tagName==='SELECT')wheel(input);}});steps[0].page.append(details);}
    const misc=document.createElement('div');misc.className='journey-source-misc';while(form.firstChild)misc.append(form.firstChild);form.append(body,misc);if(status)form.append(status);form.classList.add('journey-source');form.setAttribute('aria-label',def.title);
    if(id==='plan'){const mode=home.querySelector('.plan-mode-tabs');if(mode){const caption=document.createElement('div');caption.className='journey-choice-caption';caption.textContent='계획 종류';steps[0].page.append(caption,mode);}$('#studyGoal').required=true;}
    const result=def.result?$('#'+def.result):null;if(result){const rm=document.createElement('span');rm.hidden=true;result.before(rm);def.resultMarker=rm;}
    const config={...def,id,form,submit,status,steps,marker,result};configs.set(id,config);
    form.addEventListener('submit',e=>{if(!view.hidden&&current===config&&index<steps.length-1){e.preventDefault();e.stopImmediatePropagation();next();}},true);
    form.addEventListener('submit',()=>{if(backgroundIds.has(id))return;pending.add(config);lockLaunchers();if(current===config){submitting=true;view.setAttribute('aria-busy','true');view.querySelector('[data-journey-next]').disabled=true;view.querySelector('[data-journey-back]').disabled=true;}});
    if(status)new MutationObserver(()=>{
      if(backgroundIds.has(id)||!pending.has(config))return;const done=status.matches('.is-success,.is-error,.is-info,.ok,.error')||status.dataset.state==='success'||status.dataset.state==='error'||config.form.getAttribute('aria-busy')==='false';if(!done)return;pending.delete(config);lockLaunchers();if(current!==config)return;submitting=false;view.removeAttribute('aria-busy');view.querySelector('[data-journey-next]').disabled=false;view.querySelector('[data-journey-back]').disabled=false;
      if(status.matches('.is-error,.error')||status.dataset.state==='error')return;
      if(result&&!result.hidden&&result.textContent.trim()){showResult();}else if(['concept','quiz','checklist','event'].includes(id)){close();}
    }).observe(status,{childList:true,subtree:true,attributes:true,attributeFilter:['class','data-state']});
  }
  function open(id,button,resultOnly=false,year){const c=configs.get(id);if(!c||pending.has(c))return;if(closingEntry){deferredOpen=[id,button,resultOnly,year];return;}if(current&&!view.hidden)close(false);if(!resultOnly)root.PrimeLearnerIntegration?.prepare(id);root.dispatchEvent(new CustomEvent('prime:journey-active',{detail:id}));current=c;index=0;c.prepare?.();origin=button||document.activeElement;submitting=false;view.removeAttribute('aria-busy');view.querySelector('[data-journey-back]').disabled=false;view.hidden=false;document.body.classList.add('journey-open');view.setAttribute('aria-labelledby','journeyName');$('#journeyName').textContent=c.title;const body=view.querySelector('.journey-body');body.replaceChildren(c.form);if(c.result){body.append(c.result);c.result.classList.add('journey-result');}
    // Reopening inputs must not display the previous request's failure as a new error.
    // Keep the draft/result intact; result-only views retain their provenance message.
    if(!resultOnly&&c.status){c.status.replaceChildren();c.status.className='status-text';}
    inertState=[...document.body.children].filter(n=>n!==view&&n.tagName!=='SCRIPT'&&n.tagName!=='STYLE').map(n=>[n,n.inert]);inertState.forEach(([n])=>n.inert=true);if(!entry){history.pushState({primeJourney:id},'',`#journey/${id}`);entry=true;}if(resultOnly)showResult();else show();
    if(id==='grades'&&Number.isInteger(year)){
      const select=c.form.querySelector('[aria-label="학년 선택"]'),option=select&&[...select.options].find(o=>Number(o.value)===year&&!o.disabled);
      if(option){select.value=option.value;select.dispatchEvent(new Event('change'));index=1;show();}
    }
  }
  function close(back=true){if(view.hidden)return;view.hidden=true;document.body.classList.remove('journey-open');inertState.forEach(([n,b])=>n.inert=b);inertState=[];current?.reset?.();current?.result?.classList.remove('journey-result');if(current?.result&&current.resultMarker?.isConnected)current.resultMarker.after(current.result);current?.marker.after(current.form);let focus=origin?.disabled?current?.task?.card:origin;if(!focus?.getClientRects?.().length)focus=document.querySelector(`[data-journey="${current?.id}"]`);focus?.focus?.({preventScroll:true});if(back&&entry){entry=false;closingEntry=true;history.back();}current=null;}
  function show(){if(!current)return;current.steps.forEach((s,i)=>s.page.hidden=i!==index);const resultMode=index===current.steps.length;current.form.hidden=false;current.form.classList.toggle('is-journey-result',resultMode);current.result?.classList.toggle('journey-result-current',resultMode);const next=view.querySelector('[data-journey-next]');next.disabled=submitting;next.hidden=resultMode||current.panel&&index===current.steps.length-1;next.setAttribute('aria-label',index===current.steps.length-1?'완료':'다음 단계');next.innerHTML=`<span>${index===current.steps.length-1?'완료':'다음'}</span>${icon(index===current.steps.length-1?'check':'arrow')}`;view.querySelector('.journey-step-counter').textContent=resultMode?'':`${String(index+1).padStart(2,'0')} / ${String(current.steps.length).padStart(2,'0')}`;const progress=view.querySelector('.journey-progress');progress.setAttribute('aria-valuemin','1');progress.setAttribute('aria-valuemax',String(current.steps.length));progress.setAttribute('aria-valuenow',String(Math.min(index+1,current.steps.length)));progress.style.setProperty('--journey-progress',`${Math.min(index+1,current.steps.length)/current.steps.length*100}%`);view.querySelector('.journey-body').scrollTop=0;current.steps[index]?.title.focus({preventScroll:true});if(current.apply)current.apply();root.dispatchEvent(new Event('prime:controls-sync'));root.dispatchEvent(new Event('resize'));}
  function showResult(){index=current.steps.length;show();const c=current;requestAnimationFrame(()=>{if(current!==c||view.hidden)return;const h=c.result?.querySelector('h3,h4');if(h){h.tabIndex=-1;h.focus({preventScroll:true});}});}
  function valid(s){if(!s.input.checkValidity?.()&&s.input.checkValidity)return false;return true;}
  function next(){if(!current||submitting)return;const step=current.steps[index];if(!valid(step)){step.input.reportValidity();step.input.focus();return;}if(index<current.steps.length-1){index++;show();return;}const bad=current.steps.findIndex(s=>!valid(s));if(bad>=0){index=bad;show();return;}current.form.requestSubmit(current.submit);}
  view.querySelector('[data-journey-close]').addEventListener('click',()=>close());view.querySelector('[data-journey-back]').addEventListener('click',()=>{if(index>0){index--;show();}else close();});view.querySelector('[data-journey-next]').addEventListener('click',next);
  view.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();close();}if(e.key==='Tab'){const items=[...view.querySelectorAll('button,input,textarea,[tabindex="0"]')].filter(n=>!n.disabled&&!n.closest('[hidden]')&&n.getClientRects().length);const a=items[0],z=items[items.length-1];if(e.shiftKey&&document.activeElement===a){e.preventDefault();z.focus();}else if(!e.shiftKey&&document.activeElement===z){e.preventDefault();a.focus();}}});
  window.addEventListener('popstate',()=>{if(closingEntry){closingEntry=false;const next=deferredOpen;deferredOpen=null;if(next)open(...next);return;}if(entry){entry=false;close(false);}});window.addEventListener('prime:journey-open',e=>{
    const detail=e.detail,id=typeof detail==='string'?detail:detail?.id;
    open(id,undefined,false,detail?.year);
  });
  function launch(parent,id,name,kind='plus'){if(!parent||parent.querySelector(`[data-journey="${id}"]`))return;const b=document.createElement('button');b.type='button';b.className='journey-launch';b.dataset.journey=id;b.setAttribute('aria-label',name);b.title=name;b.innerHTML=icon(kind);parent.append(b);}
  Object.entries(definitions).forEach(([id,d])=>register(id,d));
  if(configs.has('event'))configs.get('event').prepare=()=>{const date=$('#plannerQuickDate')?.value;configs.get('event').title=date?date.slice(5).replace('-','월 ')+'일 일정':'일정';};
  function registerPanel(id,title,source,question,chooseYear=false){
    const node=$(source);if(!node)return;const marker=document.createElement('span');marker.hidden=true;node.before(marker);node.classList.add('journey-source');const form=document.createElement('div');form.className='journey-source journey-panel-source';const page=document.createElement('section');page.className='journey-step';const h=document.createElement('h3');h.textContent=question;h.tabIndex=-1;page.append(h,node);form.append(page);const config={id,title,form,marker,steps:[{page,input:node,title:h}],panel:true};
    if(chooseYear){const first=document.createElement('section');first.className='journey-step';const q=document.createElement('h3');q.textContent='몇 학년의 기록을 볼까요?';q.tabIndex=-1;const label=document.createElement('label'),select=document.createElement('select');label.className='journey-field';select.setAttribute('aria-label','학년 선택');[1,2,3].forEach(y=>select.add(new Option(`${y}학년`,String(y))));label.append(select);first.append(q,label);form.prepend(first);wheel(select);config.steps.unshift({page:first,input:select,title:q});config.prepare=()=>{const max=Number(node.querySelector('#gradeStudentYear')?.value)||1;[...select.options].forEach(o=>o.disabled=Number(o.value)>max);select.value=String(max);select.dispatchEvent(new Event('change'));};config.apply=()=>{if(index!==1)return;node.querySelectorAll('.grade-year-block').forEach(d=>{const year=d.querySelector('summary')?.textContent.trim().charAt(0);d.hidden=year!==select.value;if(!d.hidden)d.open=true;});};config.reset=()=>node.querySelectorAll('.grade-year-block').forEach(d=>d.hidden=false);}
    marker.after(form);configs.set(id,config);
  }
  registerPanel('grades','성적 기록','#gradeNotebook','시험 성적',true);
  registerPanel('target','다음 목표','#gradeGoalPanel','다음 목표는?');
  launch($('.planner-checklist-card .planner-section-title'),'checklist','할 일 추가');launch($('#studyCoachSection .planner-section-title'),'plan','공부 계획 세우기','calendar');launch($('.exam-strategy-card .planner-section-title'),'exam','시험 전략 세우기','target');launch($('#aiBooksPanel .book-page-actions')||$('#aiBooksPanel .ai-category-head'),'books','읽을 책 찾기','search');
  launch($('#plannerDayEventsTitle')?.parentElement,'event','일정 추가');
  launch($('.grade-tracker>.planner-section-title'),'grades','성적 기록하기','edit');launch($('.grade-tracker>.planner-section-title'),'target','목표 설정하기','target');
  document.querySelectorAll('#aiNotesPanel .notebook-create-trigger').forEach(b=>{const name=b.dataset.aiCollapse==='studyNoteEditor'?'개념노트 만들기':'문제노트 만들기';b.setAttribute('aria-label',name);b.title=name;b.innerHTML=icon('plus');b.classList.add('journey-book-create');b.parentElement.querySelector('.study-book-page-head')?.append(b);});
  const actionIcons={'계획 미리보기':'calendar','샘플 만들기':'plus','체크리스트에 추가':'check','계획에 추가':'check','시험 공부 계획 만들기':'target','AI 개념노트 만들기':'notebook','AI 문제노트 만들기':'quiz','추천 받기':'search','추천 결과 보기':'arrow','성적 저장':'check','과목 추가':'plus','학교 찾기':'search','목표 설정':'target','성적 분석':'chart','목표 해제':'close','기본값 복원':'reset','문제로 풀기':'quiz','바로 채점하기':'check','시작하기':'arrow','분석 갱신':'reset'};
  function polishActions(scope){[...(scope.matches?.('button')?[scope]:[]),...(scope.querySelectorAll?.('button')||[])].forEach(b=>{const name=b.textContent.trim(),i=actionIcons[name];if(!i){
    // A stateful owner can replace an icon with a loading/CTA label. Restore
    // normal text geometry instead of leaving prose inside a fixed icon box.
    if(name&&b.classList.contains('journey-icon-action')){b.classList.remove('journey-icon-action');b.setAttribute('aria-label',name);b.title=name;}return;
  }if(b.hasAttribute('data-ui-keep-label'))return;b.setAttribute('aria-label',name);b.title=name;b.classList.add('journey-icon-action');b.innerHTML=icon(i);});}
  polishActions(document);new MutationObserver(records=>{records.forEach(r=>{if(r.target.nodeType===1)polishActions(r.target);r.addedNodes.forEach(n=>{if(n.nodeType===1)polishActions(n);});});if(pending.size)lockLaunchers();}).observe(document.body,{childList:true,subtree:true});
  document.addEventListener('click',e=>{const b=e.target.closest('[data-journey], [data-ai-collapse="studyNoteEditor"], [data-ai-collapse="studyQuizEditor"]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();open(b.dataset.journey||(b.dataset.aiCollapse==='studyNoteEditor'?'concept':'quiz'),b);},true);
  root.PrimeJourneys={open,close,definitions,isManaged:id=>backgroundIds.has(id)&&configs.has(id)};
})(typeof window==='object'?window:globalThis);
