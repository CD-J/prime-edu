(function () {
  'use strict';
  function pageIndex(value) { return Math.max(0,Math.min(4,Math.round(Number(value)||0))); }
  function secondsText(value) { const n=Number(value),left=Number.isFinite(n)?Math.max(0,Math.ceil(n)):0;return `${String(Math.floor(left/60)).padStart(2,'0')}:${String(left%60).padStart(2,'0')}`; }
  function eventOnDate(event,key) { const start=String(event.date||event.startDate||event.start||'').slice(0,10),end=String(event.endDate||event.end||start).slice(0,10);return /^\d{4}-\d{2}-\d{2}$/.test(start)&&key>=start&&key<=end; }
  function gestureDistance(dx,dy,rotated) { return rotated?-dx:dy; }
  function sevenSegmentMarkup(text){
    const paths=['M7 2H35L31 8H11Z','M36 4L41 9V35L35 39L33 33V11Z','M35 43L41 49V74L36 80L33 73V50Z','M7 80H35L31 74H11Z','M5 43L9 50V73L5 80L0 74V49Z','M5 4L9 11V33L5 39L0 35V9Z','M7 38H34L38 41L34 44H7L3 41Z'];
    const masks=['abcdef','bc','abdeg','abcdg','bcfg','acdfg','acdefg','abc','abcdefg','abcdfg'],digits=String(text).replace(/\D/g,'').padStart(4,'0').slice(-4);
    return `<svg class="standby-lcd-display" viewBox="0 0 250 86" aria-hidden="true">${[0,50,148,198].map((x,i)=>`<g transform="translate(${x} 3)">${paths.map((d,j)=>`<path class="standby-lcd-segment ${masks[Number(digits[i])].includes('abcdefg'[j])?'is-lit':''}" d="${d}"/>`).join('')}</g>`).join('')}<circle cx="122" cy="29" r="3"/><circle cx="122" cy="59" r="3"/></svg>`;
  }
  if(typeof module==='object'&&module.exports){module.exports={pageIndex,secondsText,eventOnDate,gestureDistance,sevenSegmentMarkup};return;}
  const names=['집중 타이머','시계','달력','학교 시간표','오늘 할 일'];
  const pageKeys=['timer','clock','calendar','school','tasks'];
  let preferences=window.PrimeStandbyPreferences.getState();
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const icon=name=>window.PrimeUI.svg(name);
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const root=document.createElement('section');root.id='primeStandby';root.className='prime-standby';root.hidden=true;root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label','집중 스탠바이');
  root.innerHTML=`<div class="standby-landscape"><button type="button" class="standby-close" aria-label="스탠바이 닫기">${icon('close')}</button>
    <div class="standby-stack" tabindex="-1"><div class="standby-track">${names.map((name,i)=>`<section class="standby-page" data-standby-page="${i}" aria-label="${name}" tabindex="-1"><div class="standby-content" data-standby-content="${i}"></div></section>`).join('')}</div></div>
    <nav class="standby-dots" aria-label="스탠바이 화면">${names.map((name,i)=>`<button type="button" data-standby-index="${i}" aria-label="${name}" aria-current="${i===0}"></button>`).join('')}</nav></div>`;
  document.body.append(root);
  const stack=root.querySelector('.standby-stack'),track=root.querySelector('.standby-track'), pages=[...root.querySelectorAll('.standby-page')], contents=[...root.querySelectorAll('.standby-content')];
  let state=window.PrimeEduPomodoro.getState(), active=0, closing=0, opener=null, wakeLock=null, animation=null;
  let presentationToken=0,ownsFullscreen=false,ownsOrientation=false;
  const inertBefore=new Map();
  const todayKey=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
  function paintDigits(element,text) {
    element.setAttribute('role',element.id==='standbyTimerValue'?'timer':'img');
    element.setAttribute('aria-live','off');
    if(!element.querySelector('.standby-number'))element.innerHTML='<span class="standby-number" aria-hidden="true"></span><span class="standby-colon" aria-hidden="true">:</span><span class="standby-number" aria-hidden="true"></span>';
    const parts=text.split(':'),digits=element.querySelectorAll('.standby-number');
    digits[0].textContent=parts[0];digits[1].textContent=parts[1];element.setAttribute('aria-label',`${element.id==='standbyTimerValue'?'남은 시간':'현재 시각'} ${text}`);
  }
  contents[0].classList.add('standby-timer-content');
  contents[0].innerHTML=`<div class="standby-timer-display"><svg class="standby-timer-frame" aria-hidden="true" preserveAspectRatio="xMidYMid meet"><defs><linearGradient id="standby-timer-glass" x2="1" y2="1"><stop class="standby-timer-glass-top"/><stop class="standby-timer-glass-bottom" offset="1"/></linearGradient></defs><path class="standby-timer-surface"/><path class="standby-timer-track"/><path class="standby-timer-remaining" pathLength="100"/></svg><div class="standby-timer-heading">${icon('hourglass')}<span class="standby-eyebrow" id="standbyTimerMode">남은 집중 시간</span></div><strong class="standby-digits" id="standbyTimerValue"></strong></div><div class="standby-timer-actions"><button type="button" data-standby-toggle aria-label="타이머 일시정지">${icon('pause')}</button><button type="button" data-standby-reset aria-label="타이머 초기화">${icon('reset')}</button></div>`;
  const timerDisplay=contents[0].querySelector('.standby-timer-display'),timerFrame=contents[0].querySelector('.standby-timer-frame');
  // The outline inherits countdown state, but is anchored to the whole page.
  timerDisplay.before(timerFrame);
  function sizeTimerFrame(){
    const g=window.PrimeTimerProgress.rectangle(timerFrame.clientWidth,timerFrame.clientHeight);if(!g)return;
    timerFrame.setAttribute('viewBox',`0 0 ${g.width} ${g.height}`);timerFrame.style.setProperty('--standby-stroke',`${g.stroke}px`);
    timerFrame.querySelectorAll('path').forEach(path=>path.setAttribute('d',g.d));
  }
  new ResizeObserver(sizeTimerFrame).observe(timerFrame);
  contents[1].classList.add('standby-clock-content');contents[1].innerHTML='<span class="standby-clock-date"></span><strong class="standby-digits" id="standbyClockValue"></strong>';
  contents[2].classList.add('standby-calendar-content');contents[3].classList.add('standby-school-content');contents[4].classList.add('standby-checklist-content');
  function timerPaint() {
    const left=state.running?Math.max(0,Math.ceil((state.endAt-Date.now())/1000)):state.remainingSec;
    const text=secondsText(left);
    paintDigits(root.querySelector('#standbyTimerValue'),text);
    const remaining=window.PrimeTimerProgress.remaining(left,(state.mode==='focus'?state.focusMinutes:state.breakMinutes)*60);
    contents[0].style.setProperty('--standby-remaining',String(remaining*100));
    contents[0].style.setProperty('--standby-stroke-visible',String(remaining>0?1:0));
    contents[0].classList.toggle('is-countdown-full',remaining===1);
    const previousRemaining=Number(contents[0].dataset.remainingRatio);
    contents[0].style.setProperty('--standby-stroke-duration',!Number.isFinite(previousRemaining)||remaining>previousRemaining?'0ms':'900ms');
    contents[0].dataset.remainingRatio=String(remaining);
    root.querySelector('#standbyTimerMode').textContent=state.mode==='focus'?'남은 집중 시간':'남은 휴식 시간';
    const button=root.querySelector('[data-standby-toggle]'),label=state.running?'일시정지':'계속하기';
    if(button.getAttribute('aria-label')!==`타이머 ${label}`){button.innerHTML=icon(state.running?'pause':'play');button.setAttribute('aria-label',`타이머 ${label}`);}
  }
  function analogMarkup(){return `<div class="standby-analog"><svg viewBox="0 0 240 240" role="img" aria-label="현재 시각"><circle class="standby-analog-face" cx="120" cy="120" r="115"/>${Array.from({length:60},(_,i)=>`<path class="standby-hour-mark ${i%5===0?'is-hour':'is-minute'}" d="M120 8v${i%5===0?8:4}" transform="rotate(${i*6} 120 120)"/>`).join('')}<g text-anchor="middle" dominant-baseline="central">${Array.from({length:12},(_,i)=>{const a=(i+1)*Math.PI/6;return `<text x="${(120+86*Math.sin(a)).toFixed(2)}" y="${(120-86*Math.cos(a)).toFixed(2)}">${i+1}</text>`;}).join('')}</g><path class="standby-clock-hand hour" d="M120 124v-57"/><path class="standby-clock-hand minute" d="M120 128v-88"/><path class="standby-clock-hand second" d="M120 140V18"/><circle class="standby-clock-pivot" cx="120" cy="120" r="4"/></svg></div>`;}
  function compactCalendar(date){
    const start=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-01`,end=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${new Date(date.getFullYear(),date.getMonth()+1,0).getDate()}`;
    const events=[...(window.SchemsPlannerAPI?.getSchoolEvents?.()||[]),...(window.SchemsPlannerAPI?.getPersonalEvents?.(start,end)||[])],m=window.PrimeStandbyPreferences.monthDays(date,events);
    return `<h2 class="standby-compact-month">${m.month}월</h2><div class="standby-compact-grid" aria-label="${m.year}년 ${m.month}월">${['일','월','화','수','목','금','토'].map((name,i)=>`<span class="compact-weekday" data-weekday="${i}">${name}</span>`).join('')}${'<span aria-hidden="true"></span>'.repeat(m.first)}${m.days.map(d=>`<span class="${d.today?'is-today':''}" data-weekday="${d.weekday}" aria-label="${m.month}월 ${d.day}일${d.count?`, 일정 ${d.count}개`:''}"><b>${d.day}</b>${d.count?'<i class="standby-event-point" aria-hidden="true"></i>':''}</span>`).join('')}</div>`;
  }
  function clockPaint() {
    const date=new Date(),kind=preferences.clock,c=contents[1];
    if(c.dataset.clockKind!==kind){c.dataset.clockKind=kind;c.classList.toggle('is-duo',kind==='duo');c.innerHTML=kind==='duo'?`<div class="standby-duo-clock">${analogMarkup()}<span class="standby-clock-date"></span><span class="standby-period"></span></div><div class="standby-duo-calendar"></div>`:kind==='analog'?`${analogMarkup()}<span class="standby-clock-date"></span><span class="standby-period"></span>`:'<span class="standby-clock-date"></span><strong class="standby-digits" id="standbyClockValue"></strong><span class="standby-period"></span>';}
    const parts=window.PrimeStandbyPreferences.clockParts(date,preferences.hourCycle),time=parts.text,digits=root.querySelector('#standbyClockValue');if(digits){if(kind==='lcd'){if(digits.dataset.clockStamp!==parts.label){digits.innerHTML=sevenSegmentMarkup(time);digits.dataset.clockStamp=parts.label;}digits.setAttribute('role','img');}else paintDigits(digits,time);digits.setAttribute('aria-label',`현재 시각 ${parts.label}`);}const period=c.querySelector('.standby-period');period.textContent=parts.period;period.hidden=!parts.period;
    c.querySelector('.standby-clock-date').textContent=new Intl.DateTimeFormat('ko-KR',{month:'long',day:'numeric',weekday:'long'}).format(date);
    const analog=c.querySelector('.standby-analog');if(analog){const angles=window.PrimeStandbyPreferences.angles(date);analog.querySelector('svg').setAttribute('aria-label',`현재 시각 ${parts.label}`);analog.querySelector('.hour').setAttribute('transform',`rotate(${angles.hour} 120 120)`);analog.querySelector('.minute').setAttribute('transform',`rotate(${angles.minute} 120 120)`);analog.querySelector('.second').setAttribute('transform',`rotate(${date.getSeconds()*6} 120 120)`);}
    if(kind==='duo'){const stamp=todayKey();if(c.dataset.calendarStamp!==stamp){c.querySelector('.standby-duo-calendar').innerHTML=compactCalendar(date);c.dataset.calendarStamp=stamp;}}
  }
  function calendarPaint() {
    const d=new Date(),y=d.getFullYear(),m=d.getMonth(),first=new Date(y,m,1).getDay(),last=new Date(y,m+1,0).getDate();
    const monthStart=`${y}-${String(m+1).padStart(2,'0')}-01`,monthEnd=`${y}-${String(m+1).padStart(2,'0')}-${last}`;
    const school=window.SchemsPlannerAPI?.getSchoolEvents?.()||[], personal=window.SchemsPlannerAPI?.getPersonalEvents?.(monthStart,monthEnd)||[];
    const events=[...school,...personal];
    contents[2].dataset.standbyWeeks=String(Math.ceil((first+last)/7));
    contents[2].style.setProperty('--standby-weeks',contents[2].dataset.standbyWeeks);
    contents[2].innerHTML=`<h2 class="standby-title">${m+1}월</h2><div class="standby-month-grid">${['일','월','화','수','목','금','토'].map((day,i)=>`<span class="standby-weekday" data-weekday="${i}">${day}</span>`).join('')}${'<span aria-hidden="true"></span>'.repeat(first)}${Array.from({length:last},(_,i)=>{
      const key=`${y}-${String(m+1).padStart(2,'0')}-${String(i+1).padStart(2,'0')}`;
      const event=events.find(e=>eventOnDate(e,key));
      return `<span class="${key===todayKey()?'is-today':''}" data-weekday="${(first+i)%7}" aria-label="${m+1}월 ${i+1}일${event?`, ${escape(event.title||event.name)}`:''}"><strong>${i+1}</strong>${event?'<i class="standby-event-point" aria-hidden="true"></i>':''}</span>`;
    }).join('')}</div>`;
  }
  function schoolPaint() {
    const source=document.querySelector('.panel-school .table-wrap table');
    contents[3].innerHTML='<h2 class="standby-title">학교 시간표</h2>';
    if(!source?.querySelector('tbody tr')) {contents[3].insertAdjacentHTML('beforeend','<p class="standby-empty">학교 시간표를 불러오면 여기에 표시돼요.</p>');return;}
    const table=source.cloneNode(true);table.className='standby-timetable';table.removeAttribute('id');table.querySelectorAll('[id]').forEach(node=>node.removeAttribute('id'));contents[3].append(table);
  }
  function checklistPaint() {
    const items=window.PrimeEduStandbyData?.getTodayItems?.()||[];
    contents[4].classList.toggle('is-empty',!items.length);
    contents[4].innerHTML=`<h2 class="standby-title">오늘 할 일 <span class="standby-clock-date">${items.filter(i=>i.done).length}/${items.length}</span></h2><div class="standby-list">${items.length?items.map(item=>`<button type="button" class="${item.done?'is-done':''}" data-standby-task="${escape(item.key)}" aria-pressed="${Boolean(item.done)}"><span class="standby-check-dot" aria-hidden="true">${item.done?icon('check'):''}</span><span class="standby-check-copy"><strong>${escape(item.title)}</strong><small>${Number(item.minutes)||30}분</small></span></button>`).join(''):'<p class="standby-empty">오늘 할 일을 계획에 추가해보세요.</p>'}</div>`;
  }
  function refresh(){timerPaint();clockPaint();calendarPaint();schoolPaint();checklistPaint();}
  function select(index) {
    active=pageIndex(index);
    root.querySelectorAll('[data-standby-index]').forEach((button,i)=>button.setAttribute('aria-current',String(i===active)));
    const sourceIndex=pageKeys.indexOf(preferences.order[active]);
    pages.forEach((page,i)=>{page.inert=i!==sourceIndex;page.setAttribute('aria-hidden',String(i!==sourceIndex));});
    track.style.setProperty('--standby-page',active);track.style.setProperty('--standby-drag','0px');
  }
  function applyPreferences(){const before=preferences.order[active];preferences=window.PrimeStandbyPreferences.getState();root.dataset.clockStyle=preferences.clock;root.dataset.frame=preferences.frame;root.style.setProperty('--standby-mood-strength',`${preferences.mood}%`);preferences.order.forEach((key,i)=>{track.append(pages[pageKeys.indexOf(key)]);const b=root.querySelector(`[data-standby-index="${i}"]`);b.setAttribute('aria-label',names[pageKeys.indexOf(key)]);});delete contents[1].dataset.calendarStamp;select(Math.max(0,preferences.order.indexOf(before)));if(!root.hidden){refresh();sizeTimerFrame();}}
  async function keepAwake() {
    if(root.hidden||document.hidden||wakeLock||!navigator.wakeLock)return;
    try{const lock=await navigator.wakeLock.request('screen');if(root.hidden||document.hidden){await lock.release();return;}wakeLock=lock;lock.addEventListener('release',()=>{if(wakeLock===lock)wakeLock=null;});}catch{}
  }
  async function enterPresentation() {
    // A temporary presentation request, never an OS setting. CSS provides the
    // same landscape canvas when mobile fullscreen/orientation is unavailable.
    if(navigator.maxTouchPoints<1||!matchMedia('(max-width:999px)').matches)return;
    const token=++presentationToken;
    try {
      if(document.fullscreenElement&&document.fullscreenElement!==root)return;
      if(!document.fullscreenElement&&document.fullscreenEnabled&&root.requestFullscreen){await root.requestFullscreen({navigationUI:'hide'});ownsFullscreen=document.fullscreenElement===root;}
      if(token!==presentationToken||root.hidden||root.classList.contains('is-closing')){releasePresentation();return;}
      if(document.fullscreenElement===root&&screen.orientation?.lock){await screen.orientation.lock('landscape');ownsOrientation=true;}
      if(token!==presentationToken||root.hidden||root.classList.contains('is-closing'))releasePresentation();
    } catch { /* The rotated canvas is the non-blocking fallback. */ }
  }
  function releasePresentation() {
    presentationToken++;
    if(ownsOrientation){screen.orientation?.unlock?.();ownsOrientation=false;}
    if(ownsFullscreen&&document.fullscreenElement===root){ownsFullscreen=false;document.exitFullscreen?.().catch(()=>{});}
    else ownsFullscreen=false;
  }
  function open(source) {
    if(!root.hidden){select(0);return;}
    clearTimeout(closing);opener=source?.querySelector('[data-pomodoro-switch]')||source||document.activeElement;state=window.PrimeEduPomodoro.getState();refresh();
    [...document.body.children].filter(node=>node!==root&&!['SCRIPT','STYLE'].includes(node.tagName)).forEach(node=>{inertBefore.set(node,{inert:node.inert,hidden:node.getAttribute('aria-hidden')});node.inert=true;node.setAttribute('aria-hidden','true');});
    root.hidden=false;document.body.classList.add('standby-open');select(0);
    requestAnimationFrame(()=>{
      root.classList.remove('is-closing');root.classList.add('is-open');
      sizeTimerFrame();
      if(!reduced.matches&&contents[0].animate){
        animation=contents[0].animate([{opacity:0},{opacity:1}],{duration:420,easing:'cubic-bezier(.22,1,.36,1)'});
      }
      root.querySelector('.standby-close').focus({preventScroll:true});
    });keepAwake();enterPresentation();
  }
  function close() {
    if(root.hidden||root.classList.contains('is-closing'))return;root.classList.add('is-closing');root.classList.remove('is-open');animation?.cancel();wakeLock?.release().catch(()=>{});wakeLock=null;releasePresentation();
    clearTimeout(closing);closing=setTimeout(()=>{
      root.hidden=true;root.classList.remove('is-closing');document.body.classList.remove('standby-open');inertBefore.forEach((value,node)=>{node.inert=value.inert;if(value.hidden===null)node.removeAttribute('aria-hidden');else node.setAttribute('aria-hidden',value.hidden);});inertBefore.clear();if(opener?.isConnected)opener.focus({preventScroll:true});
    },reduced.matches?0:420);
  }
  root.addEventListener('click',async event=>{
    if(event.target.closest('.standby-close')){close();return;}
    const page=event.target.closest('[data-standby-index]');if(page){select(Number(page.dataset.standbyIndex));return;}
    if(event.target.closest('[data-standby-toggle]')){window.PrimeEduPomodoro.toggle();return;}
    if(event.target.closest('[data-standby-reset]')){window.PrimeEduPomodoro.reset();return;}
    const task=event.target.closest('[data-standby-task]');if(task){task.disabled=true;try{await window.PrimeEduStandbyData.toggle(task.dataset.standbyTask);checklistPaint();}catch{task.disabled=false;task.setAttribute('aria-label','저장하지 못했어요. 다시 눌러주세요.');}}
  });
  root.addEventListener('keydown',event=>{
    if(event.key==='Escape'){event.stopPropagation();close();return;}
    if(event.key==='Tab'){const buttons=[...root.querySelectorAll('.standby-close,.standby-dots button')];const live=[...pages[pageKeys.indexOf(preferences.order[active])].querySelectorAll('button:not(:disabled)')];const focusables=[...buttons,...live];const index=focusables.indexOf(document.activeElement);const next=event.shiftKey?(index<=0?focusables.length-1:index-1):(index+1)%focusables.length;event.preventDefault();focusables[next]?.focus({preventScroll:true});return;}
    if(['ArrowDown','PageDown','ArrowUp','PageUp'].includes(event.key)&&!event.target.closest('.standby-list')){event.preventDefault();select(active+(['ArrowDown','PageDown'].includes(event.key)?1:-1));}
  });
  let wheelIntent=0,wheelUntil=0,touch=null;
  stack.addEventListener('wheel',event=>{
    const list=event.target.closest('.standby-list');
    if(list&&((event.deltaY>0&&list.scrollTop+list.clientHeight<list.scrollHeight-2)||(event.deltaY<0&&list.scrollTop>2)))return;
    event.preventDefault();if(performance.now()<wheelUntil)return;wheelIntent+=event.deltaY;
    if(Math.abs(wheelIntent)>=35){select(active+Math.sign(wheelIntent));wheelIntent=0;wheelUntil=performance.now()+600;}
  },{passive:false});
  stack.addEventListener('pointerdown',event=>{if(event.pointerType!=='touch'||event.target.closest('button,.standby-list'))return;touch={id:event.pointerId,x:event.clientX,y:event.clientY,rotated:innerHeight>innerWidth,dy:0};stack.setPointerCapture(event.pointerId);track.classList.add('is-dragging');});
  stack.addEventListener('pointermove',event=>{if(!touch||touch.id!==event.pointerId)return;touch.dy=gestureDistance(event.clientX-touch.x,event.clientY-touch.y,touch.rotated);track.style.setProperty('--standby-drag',`${Math.max(-stack.clientHeight*.3,Math.min(stack.clientHeight*.3,touch.dy))}px`);});
  function endTouch(event){if(!touch||event.pointerId!==touch.id)return;const dy=touch.dy;touch=null;track.classList.remove('is-dragging');select(active+(event.type==='pointerup'&&Math.abs(dy)>45?-Math.sign(dy):0));}
  stack.addEventListener('pointerup',endTouch);stack.addEventListener('pointercancel',endTouch);
  stack.addEventListener('lostpointercapture',endTouch);
  document.addEventListener('click',event=>{
    // Starting only starts the timer. Its running clock is the presentation
    // trigger; an idle clock keeps the existing focus/break mode switch.
    const source=event.target.closest('[data-pomodoro-ring]');
    if(source?.closest('.mobile-pomodoro-widget,.home-pomodoro')&&window.PrimeEduPomodoro.getState().running)open(source);
  });
  window.addEventListener('prime:pomodoro-state',()=>{state=window.PrimeEduPomodoro.getState();if(!root.hidden)timerPaint();});
  ['schems:planner-data','schems:study-data'].forEach(name=>window.addEventListener(name,()=>{delete contents[1].dataset.calendarStamp;if(!root.hidden){clockPaint();calendarPaint();schoolPaint();checklistPaint();}}));
  window.addEventListener('prime:standby-settings',applyPreferences);applyPreferences();
  window.PrimeStandby={preview:source=>open(source)};
  document.addEventListener('visibilitychange',()=>{root.classList.toggle('is-mood-paused',document.hidden);if(document.hidden){wakeLock?.release().catch(()=>{});wakeLock=null;}else if(!root.hidden){state=window.PrimeEduPomodoro.getState();refresh();keepAwake();}});
  document.addEventListener('fullscreenchange',()=>{if(ownsFullscreen&&document.fullscreenElement!==root){ownsFullscreen=false;close();}});
  window.addEventListener('resize',()=>{touch=null;track.classList.remove('is-dragging');animation?.cancel();animation=null;if(!root.hidden){sizeTimerFrame();select(active);}});
  // Only repaint the clock while visible; no new timer or study-session writer.
  setInterval(()=>{if(!root.hidden&&!document.hidden){state=window.PrimeEduPomodoro.getState();timerPaint();clockPaint();}},1000);
})();
