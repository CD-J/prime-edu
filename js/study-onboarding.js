(() => {
  'use strict';
  const C=window.PrimeStudyOnboardingCore,$=s=>document.querySelector(s),icon=n=>window.PrimeUI.svg(n),clone=v=>JSON.parse(JSON.stringify(v));
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const questions=[['처음 만나는 나','어떻게 불러드릴까요?'],['목표 · 진로','어떤 미래를 생각하고 있나요?'],['일주일 시간표','학원은 언제 다니나요?'],['공부 습관','어떻게 공부하는 편인가요?'],['국어 · 영어 · 수학','지금 어디까지 배우고 있나요?'],['요즘 고민','공부하면서 어떤 게 고민인가요?']];
  let owner='',data=C.clean(),generation=0,revision=0,pending=false,remoteReady=false,saving=false,timer=0,root=null,active=false,creating=false,blocked=[],origin=null,step=0,editor=null,animations=[],suspended=false,editingCompleted=false,closing=false,closeMotion=null;
  const uid=()=>window.ClassHubFirebase?.getCurrentUser?.()?.uid||'';
  const key=id=>`primeEdu.studyConsultation.v1.${id}`;
  function read(id){try{const v=JSON.parse(localStorage.getItem(key(id))||'{}');return {data:C.clean(v.data),pending:v.pending===true};}catch{return {data:C.clean(),pending:false};}}
  function notify(){window.dispatchEvent(new CustomEvent('prime:study-consultation',{detail:{owner,status:data.status,pending}}));updateEntry();}
  function cache(){try{localStorage.setItem(key(owner),JSON.stringify({data,pending}));return true;}catch{return false;}}
  function write(status=data.status){if(!owner||uid()!==owner)throw Error('계정이 변경됐어요. 다시 열어주세요.');if(editingCompleted&&status==='draft')status='completed';data=C.clean({...data,status,step,updatedAt:new Date().toISOString()});pending=true;revision++;if(!cache())throw Error('기기에 저장하지 못했어요. 입력은 유지돼요. 저장 공간을 확인해주세요.');clearTimeout(timer);timer=setTimeout(sync,650);notify();}
  async function sync(){
    if(!pending||!remoteReady||saving||uid()!==owner)return;
    const id=owner,token=generation,version=revision,value=clone(data);saving=true;
    try{await window.ClassHubFirebase.saveStudyConsultation(id,value);if(token!==generation||uid()!==id)return;if(version===revision){pending=false;cache();notify();}}
    catch{if(token===generation)notify();}
    finally{if(token===generation){saving=false;if(version!==revision){clearTimeout(timer);timer=setTimeout(sync,650);}}}
  }
  async function load(user){
    const id=user?.uid||'',token=++generation;if(active)close(false);clearTimeout(timer);owner=id;revision=0;remoteReady=false;saving=false;suspended=false;editor=null;
    const local=read(id);data=id?local.data:C.clean();pending=id&&local.pending;notify();if(!id)return;
    try{const remote=await window.ClassHubFirebase.getStudyConsultation(id);if(token!==generation||uid()!==id)return;
      if(remote&&!pending)data=C.clean(remote);remoteReady=true;cache();notify();if(pending)sync();ready();
    }catch{if(token===generation){notify();ready();}}
  }
  function updateEntry(){const b=$('#openStudyConsultation');if(!b)return;b.disabled=!uid();const s=$('#studyConsultationSummary');s.textContent=!uid()?'로그인 후 시작':pending?'기기에 저장됨 · 동기화 대기':data.status==='completed'?'내 답변 수정':data.status==='draft'?'이어서 답하기':'스도와 시작하기';}
  function ready(){if(suspended||creating||active||!owner||uid()!==owner||document.hidden||!['pending','draft'].includes(data.status)||document.querySelector('.modal-backdrop.is-open,dialog[open]')||document.body.classList.contains('sudo-guide-open'))return;open();}
  function art(){return `<svg class="study-intake-sudo" viewBox="0 0 320 320" aria-hidden="true"><defs>
    <radialGradient id="intake-body" cx=".28" cy=".18" r=".9"><stop class="intake-glass-white"/><stop offset=".45" class="intake-glass-base"/><stop offset="1" class="intake-glass-deep"/></radialGradient>
    <radialGradient id="intake-prism" cx=".78" cy=".76" r=".74"><stop class="intake-glass-prism" stop-opacity=".3"/><stop offset="1" stop-color="white" stop-opacity="0"/></radialGradient>
    <linearGradient id="intake-rim" x2=".7" y2="1"><stop stop-color="white" stop-opacity=".95"/><stop offset=".4" stop-color="white" stop-opacity=".25"/><stop offset="1" class="intake-glass-prism" stop-opacity=".5"/></linearGradient>
    <linearGradient id="intake-shine" x2=".6" y2="1"><stop stop-color="white" stop-opacity=".64"/><stop offset="1" stop-color="white" stop-opacity="0"/></linearGradient>
    <clipPath id="intake-clip"><path d="M158 39C226 31 275 83 277 150c3 74-45 124-115 126C89 279 41 230 42 160c0-68 45-112 116-121Z"/></clipPath></defs>
    <g clip-path="url(#intake-clip)"><path d="M158 39C226 31 275 83 277 150c3 74-45 124-115 126C89 279 41 230 42 160c0-68 45-112 116-121Z" fill="url(#intake-body)"/>
    <rect width="320" height="320" fill="url(#intake-prism)"/>
    <path d="m63 91 69-47 98 16 34 55-73 17-81-3Z" fill="url(#intake-shine)"/><path d="m63 91 47 38 22-85m-22 85 81 3 39-72m-39 72 53 93 20-110" stroke="white" stroke-opacity=".18" stroke-width=".8" fill="none"/>
    <path d="M70 84c38-35 98-42 137-27" stroke="white" stroke-opacity=".65" stroke-linecap="round" stroke-width="3" fill="none"/><path d="M58 153c-4 53 27 94 65 103" stroke="white" stroke-opacity=".18" stroke-linecap="round" stroke-width="6" fill="none"/>
    <ellipse cx="109" cy="76" rx="39" ry="10" fill="white" opacity=".16" transform="rotate(-25 109 76)"/>
    <g class="intake-eyes"><g transform="rotate(-18 160 150)"><rect x="133" y="126" width="13" height="40" rx="6.5" fill="currentColor"/><rect x="164" y="126" width="13" height="40" rx="6.5" fill="currentColor"/><path d="M137 131v22m31-22v22" stroke="white" stroke-opacity=".18" stroke-linecap="round" stroke-width="2"/></g></g></g>
    <path d="M158 39C226 31 275 83 277 150c3 74-45 124-115 126C89 279 41 230 42 160c0-68 45-112 116-121Z" fill="none" stroke="url(#intake-rim)" stroke-width="2"/>
    </svg>`;}
  function field(label,name,value,placeholder='',max=100){return `<label>${label}<input name="${name}" value="${esc(value)}" maxlength="${max}" placeholder="${placeholder}" autocomplete="off"></label>`;}
  function academyMarkup(){return `<button type="button" class="intake-choice" data-intake-no-academy aria-pressed="${data.noAcademy}" data-ui-keep-label>학원에 다니지 않아요</button><div class="intake-timeline" aria-label="요일별 학원 일정">${[1,2,3,4,5,6,0].map(d=>`<div><b>${C.days[d]}</b>${(data.noAcademy?[]:data.academy).filter(s=>s.days.includes(d)).map(s=>`<i title="${esc(s.title+' · '+s.start+'–'+s.end)}"></i>`).join('')}</div>`).join('')}</div><div class="intake-academy-list">${data.academy.map((s,i)=>`<div class="intake-academy-row"><div><strong>${esc(s.title)}</strong><span>${esc(C.scheduleLabel(s))}</span></div><button type="button" class="intake-icon" data-intake-edit-slot="${i}" aria-label="${esc(s.title)} 시간 수정">${icon('edit')}</button><button type="button" class="intake-icon" data-intake-remove-slot="${i}" aria-label="${esc(s.title)} 삭제">${icon('trash')}</button></div>`).join('')}</div>${editor!==null?editorMarkup():`<button type="button" class="intake-choice" data-intake-add-slot data-ui-keep-label>${icon('plus')} 시간 추가</button>`}`;}
  function editorMarkup(){const s=editor.value;return `<section class="intake-academy-editor" aria-label="학원 시간 추가">${field('학원 · 과목','academyTitle',s.title,'예: 수학 학원',60)}<div class="intake-days" role="group" aria-label="학원 요일">${[1,2,3,4,5,6,0].map(d=>`<button type="button" class="intake-day" data-intake-day="${d}" aria-pressed="${s.days.includes(d)}" aria-label="${C.days[d]}요일">${C.days[d]}</button>`).join('')}</div><div class="intake-time-pair"><label>시작<input type="time" name="academyStart" value="${esc(s.start)}" step="300"></label><label>끝<input type="time" name="academyEnd" value="${esc(s.end)}" step="300"></label></div><div class="intake-editor-actions"><button type="button" class="intake-icon" data-intake-cancel-slot aria-label="시간 추가 취소">${icon('close')}</button><button type="button" class="intake-next" data-intake-save-slot data-ui-keep-label>${editor.index>=0?"저장":"추가"} ${icon('check')}</button></div></section>`;}
  function answer(){
    if(step===0)return `<div class="study-intake-fields">${field('이름 · 닉네임','name',data.name,'사용할 이름',30)}</div><p class="intake-note">답변은 내 학습 상담에 사용돼요. 나중에 수정할 수 있어요.</p>`;
    if(step===1)return `<div class="study-intake-fields">${field('목표 고등학교','highSchool',data.goals.highSchool,'아직 정하지 않아도 괜찮아요')}${field('목표 대학 · 학과','university',data.goals.university,'예: 대학, 학과')}${field('관심 있는 진로','career',data.goals.career,'예: 개발자')}</div>`;
    if(step===2)return academyMarkup();
    if(step===3)return `<div class="intake-options" role="group" aria-label="공부 습관">${C.habits.map(h=>`<button type="button" class="intake-choice" data-intake-habit="${h}" aria-pressed="${data.habits.includes(h)}" data-ui-keep-label>${h}</button>`).join('')}</div><label>내 공부 방식<textarea name="habitNote" maxlength="240" rows="2" placeholder="더 적고 싶은 습관이 있다면">${esc(data.habitNote)}</textarea></label>`;
    if(step===4)return `<div class="study-intake-fields">${['국어','영어','수학'].map(s=>field(s,s,data.progress[s],s==='국어'?'예: 문학 · 3단원':s==='영어'?'예: 교과서 4과 · 관계대명사':'예: 일차함수 · 개념 공부 중',180)).join('')}</div>`;
    return `<label>지금 가장 신경 쓰이는 것<textarea name="concerns" maxlength="600" rows="4" placeholder="집중, 성적, 진로… 편하게 적어주세요.">${esc(data.concerns)}</textarea></label><p class="intake-note">말하고 싶지 않은 항목은 비워둬도 괜찮아요.</p>`;
  }
  function collect(){if(!active)return;const get=name=>root.querySelector(`[name="${name}"]`)?.value||'';
    if(step===0)data.name=get('name');if(step===1)for(const k of ['highSchool','university','career'])data.goals[k]=get(k);if(step===3)data.habitNote=get('habitNote');if(step===4)for(const s of ['국어','영어','수학'])data.progress[s]=get(s);if(step===5)data.concerns=get('concerns');
    if(editor){editor.value.title=get('academyTitle');editor.value.start=get('academyStart');editor.value.end=get('academyEnd');}
  }
  function error(message){$('#studyIntakeError').textContent=message;}
  function render(move=false){animations.forEach(a=>a.cancel());animations=[];root.querySelector('.study-intake-question p').textContent=questions[step][0];$('#studyIntakeTitle').textContent=questions[step][1];$('#studyIntakeAnswer').innerHTML=answer();$('#studyIntakeNext').innerHTML=(step===5?(editingCompleted?'완료':'시작하기'):'다음')+icon(step===5?'check':'arrow');$('#studyIntakeBack').disabled=step===0;$('#studyIntakeBack').style.visibility=step===0?'hidden':'visible';$('.intake-page-dots').innerHTML=questions.map((_,i)=>`<span class="${i===step?'is-current':''}"></span>`).join('');$('#studyIntakePage').textContent=`${step+1} / ${questions.length}`;error('');
    if(move){root.querySelector('.study-intake-scroll').scrollTop=0;$('#studyIntakeTitle').focus({preventScroll:true});if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches){for(const s of ['.study-intake-question','#studyIntakeAnswer']){const el=root.querySelector(s);if(el.animate)animations.push(el.animate([{opacity:0,transform:'translateY(10px)',filter:'blur(3px)'},{opacity:1,transform:'translateY(0)',filter:'blur(0)'}],{duration:300,easing:'cubic-bezier(.2,.8,.2,1)'}));}const face=root.querySelector('.study-intake-scene');if(face.animate)animations.push(face.animate([{transform:'scale(1)'},{transform:'scale(1.025,.97)'},{transform:'scale(1)'}],{duration:380,easing:'ease-out'}));}}
  }
  function open(startAt){if(!owner||uid()!==owner||active||!root)return false;window.PrimeSudoGuide?.close?.();window.PrimePersonalMindmap?.close?.();origin=document.activeElement;step=Number.isInteger(startAt)?Math.max(0,Math.min(5,startAt)):data.step||0;editingCompleted=data.status==='completed';root.querySelector('[data-intake-skip]').textContent=editingCompleted?'닫기':'나중에 할래요';editor=null;active=true;suspended=false;root.hidden=false;document.body.classList.add('study-onboarding-open');blocked=[...document.body.children].filter(n=>n!==root&&!['SCRIPT','STYLE','LINK'].includes(n.tagName)).map(n=>[n,n.inert]);blocked.forEach(([n])=>n.inert=true);render(true);viewport();return true;}
  function close(restore=true){if(!active)return;if(closing&&restore)return;closeMotion?.cancel();closeMotion=null;animations.forEach(a=>a.cancel());animations=[];
    const hide=()=>{active=false;closing=false;root.hidden=true;root.style.removeProperty('pointer-events');root.style.removeProperty('height');root.style.removeProperty('top');document.body.classList.remove('study-onboarding-open');blocked.forEach(([n,inert])=>n.inert=inert);blocked=[];editor=null;if(restore&&origin?.isConnected&&!origin.closest('[inert]'))origin.focus({preventScroll:true});};
    if(restore&&root.animate&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches){closing=true;root.style.pointerEvents='none';closeMotion=root.animate([{opacity:1,filter:'blur(0)'},{opacity:0,filter:'blur(6px)'}],{duration:190,easing:'ease-out'});closeMotion.onfinish=()=>{closeMotion=null;hide();};}else hide();
  }
  function finish(skip){if(closing)return;collect();if(editor&&!skip){if(!saveSlot())return;}try{write(skip&&!editingCompleted?'skipped':'completed');suspended=true;close();notify();window.dispatchEvent(new CustomEvent('prime:study-consultation-finished',{detail:{owner,skipped:skip&&!editingCompleted}}));}catch(e){error(e.message);}}
  function saveSlot(){collect();const message=C.validateSlot(editor?.value);if(message){error(message);return false;}if(editor.index<0&&data.academy.length>=21){error('학원 시간은 21개까지 추가할 수 있어요.');return false;}if(editor.index<0)data.academy.push(editor.value);else data.academy[editor.index]=editor.value;editor=null;data.noAcademy=false;write('draft');render();return true;}
  function viewport(){if(!active)return;const v=window.visualViewport;root.style.height=(v?.height||window.innerHeight)+'px';root.style.top=(v?.offsetTop||0)+'px';}
  function init(){
    root=document.createElement('section');root.id='studyOnboarding';root.hidden=true;root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-labelledby','studyIntakeTitle');root.innerHTML=`<header class="study-intake-head"><span>스도 · 학습 상담</span><button type="button" class="intake-skip" data-intake-skip data-ui-keep-label>나중에 할래요</button></header><div class="study-intake-scroll"><div class="study-intake-main"><div class="study-intake-scene">${art()}</div><div class="study-intake-question"><p></p><h1 id="studyIntakeTitle" tabindex="-1"></h1></div><form id="studyIntakeForm" class="study-intake-answer" novalidate><div id="studyIntakeAnswer"></div><p id="studyIntakeError" class="intake-error" role="alert"></p></form></div></div><footer class="study-intake-foot"><div class="intake-foot-left"><button type="button" class="intake-icon" id="studyIntakeBack" aria-label="이전 질문">${icon('back')}</button><span id="studyIntakePage" class="sr-only"></span><div class="intake-page-dots" aria-hidden="true"></div></div><button type="submit" form="studyIntakeForm" class="intake-next" id="studyIntakeNext" data-ui-keep-label>다음 ${icon('arrow')}</button></footer>`;document.body.append(root);
    root.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;try{
      if(b.hasAttribute('data-intake-skip')){finish(true);return;}collect();
      if(b.id==='studyIntakeBack'){if(step>0){if(editor){error('추가 중인 시간을 저장하거나 닫아주세요.');return;}write('draft');step--;data.step=step;write('draft');render(true);}return;}
      if(b.hasAttribute('data-intake-habit')){const h=b.dataset.intakeHabit;data.habits=data.habits.includes(h)?data.habits.filter(v=>v!==h):[...data.habits,h];b.setAttribute('aria-pressed',String(data.habits.includes(h)));write('draft');return;}
      if(b.hasAttribute('data-intake-no-academy')){data.noAcademy=!data.noAcademy;if(data.noAcademy){data.academy=[];editor=null;}write('draft');render();return;}
      if(b.hasAttribute('data-intake-day')){const d=Number(b.dataset.intakeDay),s=editor.value;s.days=s.days.includes(d)?s.days.filter(v=>v!==d):[...s.days,d];b.setAttribute('aria-pressed',String(s.days.includes(d)));return;}
      if(b.hasAttribute('data-intake-save-slot')){saveSlot();return;}
      if(b.hasAttribute('data-intake-cancel-slot')){editor=null;render();return;}
      if(b.hasAttribute('data-intake-remove-slot')){const index=Number(b.dataset.intakeRemoveSlot);data.academy.splice(index,1);if(editor?.index===index)editor=null;else if(editor&&editor.index>index)editor.index--;write('draft');render();return;}
      if(b.hasAttribute('data-intake-edit-slot')||b.hasAttribute('data-intake-add-slot')){const index=b.hasAttribute('data-intake-add-slot')?-1:Number(b.dataset.intakeEditSlot);editor={index,value:index<0?{title:'',days:[],start:'17:00',end:'18:00'}:clone(data.academy[index])};render();root.querySelector('[name=academyTitle]').focus();}
    }catch(e){error(e.message);}});
    $('#studyIntakeForm').addEventListener('submit',e=>{e.preventDefault();try{collect();if(editor&&!saveSlot())return;if(step===5){finish(false);return;}write('draft');step++;data.step=step;write('draft');render(true);}catch(e){error(e.message);}});
    root.addEventListener('input',()=>{try{collect();write('draft');}catch(e){error(e.message);}});
    root.addEventListener('focusin',e=>root.querySelector('.study-intake-scene').classList.toggle('is-listening',e.target.matches('input,textarea')));
    root.addEventListener('focusout',()=>root.querySelector('.study-intake-scene').classList.remove('is-listening'));
    root.addEventListener('keydown',e=>{if(closing){e.preventDefault();return;}if(e.key==='Escape'){e.preventDefault();finish(true);}if(e.key==='Tab'){const nodes=[...root.querySelectorAll('button,input,textarea')].filter(n=>!n.disabled&&n.getClientRects().length&&getComputedStyle(n).visibility!=='hidden'),first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&(document.activeElement===first||!nodes.includes(document.activeElement))){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}});
    $('#openStudyConsultation')?.addEventListener('click',open);
    window.addEventListener('prime:signup-start',()=>{creating=true;});
    window.addEventListener('prime:signup-end',async e=>{creating=false;if(e.detail?.user){await load(e.detail.user);ready();}});
    window.addEventListener('online',()=>{if(!remoteReady&&uid())load(window.ClassHubFirebase.getCurrentUser());else sync();});
    window.addEventListener('storage',e=>{if(e.key===key(owner)&&!active&&!pending){const v=read(owner);data=v.data;pending=v.pending;notify();}});
    window.addEventListener('resize',viewport);window.visualViewport?.addEventListener('resize',viewport);window.visualViewport?.addEventListener('scroll',viewport);
    document.addEventListener('visibilitychange',()=>{root.classList.toggle('is-hidden-tab',document.hidden);if(document.hidden&&active&&!closing){collect();try{write('draft');}catch{}}else ready();});
    const observer=new MutationObserver(ready);document.querySelectorAll('.modal-backdrop').forEach(n=>observer.observe(n,{attributes:true,attributeFilter:['class']}));
    if(window.ClassHubFirebase?.isConfigured?.())window.ClassHubFirebase.onAuthStateChanged(load);else load(null);
  }
  window.PrimeStudyOnboarding={open,close,isBusy:()=>active||creating,shouldBlockGuide:()=>active||creating||['pending','draft'].includes(data.status),getData:()=>uid()===owner?clone(data):C.clean(),getContext:()=>uid()===owner?C.context(data):'',getBusy:(from,to)=>uid()===owner?C.busy(data,from,to):[]};
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
})();
