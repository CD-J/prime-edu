(function () {
  'use strict';
  const VERSION = 1;
  const key = uid => `primeEdu.sudoGuide.v${VERSION}.${encodeURIComponent(uid || 'guest')}`;
  const steps = [
    {tab:'home', intro:true, title:'공부매니저 스도', text:'공부 질문, 계획, 복습을 도와드려요. 필요한 기능부터 살펴보세요.'},
    {tab:'home', title:'공부 질문', target:'.home-ai-form, .mobile-study-search', text:'궁금한 개념이나 공부 고민을 입력하세요. 이전 대화도 다시 열 수 있어요.'},
    {tab:'home', title:'집중 시간', target:'.home-pomodoro [data-pomodoro-ring], .mobile-home-timer [data-pomodoro-ring]', text:'테두리를 돌려 시간을 정하세요. 시작한 뒤 시계를 누르면 스탠바이 모드로 이어져요.'},
    {tab:'school', title:'학교 정보', target:'.schedule-card', text:'학교, 학년, 반을 설정하면 시간표와 급식을 확인할 수 있어요.'},
    {tab:'school', title:'학사일정', target:'#monthEventList', text:'시험과 학교 행사를 확인하세요. 날짜를 누르면 그날의 정보를 볼 수 있어요.'},
    {tab:'plan', title:'오늘 할 일', target:'#manualChecklistForm', text:'할 일과 예상 시간을 기록하세요. 완료한 일은 체크해서 구분할 수 있어요.'},
    {tab:'plan', title:'계획 캘린더', target:'#plannerCalendarGrid', text:'날짜를 선택하면 일정과 할 일을 볼 수 있어요. 공부 계획도 날짜별로 확인하세요.'},
    {tab:'plan', title:'공부 계획', target:'#studyPlanForm', text:'목표와 공부 시간을 정하세요. 생성된 계획은 확인한 뒤 필요한 항목만 추가하세요.'},
    {tab:'assistant', category:'notes', title:'공부노트', target:'.study-book-spread', text:'필기는 개념노트로, 연습 문제는 문제노트로 모아두세요. 저장한 책을 눌러 이어서 공부할 수 있어요.'},
    {tab:'assistant', category:'books', title:'도서추천', target:'#studyBookForm', text:'관심 주제와 분야로 책을 찾아보세요. 제목과 저자는 도서관이나 서점에서 한 번 더 확인하세요.'},
    {tab:'progress', title:'성장 기록', target:'#gradeComboChart', text:'성적 변화, 공부 시간, 계획 달성도를 확인하세요. 전체 데이터에서는 기록 사이의 연결도 볼 수 있어요.'},
    {tab:'settings', title:'사용자 설정', target:'#openGuideButton', text:'회원정보와 화면 테마를 설정하세요. 기능 안내는 가이드에서 다시 볼 수 있어요.'}
  ];
  // Pure helpers are shared with the test harness; no account data leaves this app.
  const spotlight = (rect, width, height, bubbleTop, headerBottom=78) => {
    const left=Math.max(8,rect.left-8), top=Math.max(headerBottom,rect.top-8);
    const right=Math.min(width-8,rect.right+8), bottom=Math.min(height-8,bubbleTop-12,rect.bottom+8);
    return {left,top,width:Math.max(0,right-left),height:Math.max(0,bottom-top)};
  };
  const shouldAutoStart = (uid, completed, active) => Boolean(uid) && !completed && !active;
  if (typeof module==='object' && module.exports) {module.exports={steps,key,spotlight,shouldAutoStart,VERSION};return;}
  function roundedHole(h) {
    const {left:x,top:y,width:w,height:z}=h, r=Math.min(22,w/2,z/2);
    if(w<1||z<1)return '';
    return `M${x+r} ${y}H${x+w-r}Q${x+w} ${y} ${x+w} ${y+r}V${y+z-r}Q${x+w} ${y+z} ${x+w-r} ${y+z}H${x+r}Q${x} ${y+z} ${x} ${y+z-r}V${y+r}Q${x} ${y} ${x+r} ${y}Z`;
  }
  let root, bubble, hole, spacer, target, index=0, active=false, frame=0, sequence=0, observer;
  let returnFocus, returnTab='home', returnScroll=0, inertNodes=[], autoTimer=0, playing=false, authUser=null, pendingUser=null, checkToken=0;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  function read(uid){try{return JSON.parse(localStorage.getItem(key(uid))||'null')?.version===VERSION;}catch{return false;}}
  function remember(){
    const uid=authUser?.uid;
    try{localStorage.setItem(key(uid),JSON.stringify({version:VERSION,completedAt:new Date().toISOString()}));}catch{}
    if(uid) window.ClassHubFirebase?.updateUserProfile?.(uid,{sudoGuideVersion:VERSION}).catch(()=>{});
  }
  function create(){
    if(root)return;
    root=document.createElement('div');root.id='sudoGuide';root.className='sudo-guide';root.hidden=true;
    root.innerHTML=`<svg class="sudo-guide-mask" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><defs><filter id="sudoGuideFeather" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="2.5"/></filter><mask id="sudoGuideCutout" maskUnits="userSpaceOnUse"><rect width="100%" height="100%" fill="white"/><path data-guide-cutout fill="black" filter="url(#sudoGuideFeather)"/></mask></defs><rect width="100%" height="100%" fill="rgba(12,17,20,.55)" mask="url(#sudoGuideCutout)"/></svg><div class="sudo-guide-spotlight" aria-hidden="true"></div>
      <section class="sudo-guide-bubble" role="dialog" aria-modal="true" aria-labelledby="sudoGuideTitle" aria-describedby="sudoGuideText" tabindex="-1">
        <span class="sudo-guide-avatar" aria-hidden="true"></span><header><div><strong>스도</strong><span id="sudoGuideCount"></span></div><button type="button" data-guide="close" aria-label="사용 가이드 닫기">×</button></header>
        <div class="sudo-guide-copy" aria-live="polite" aria-atomic="true"><h2 id="sudoGuideTitle"></h2><p id="sudoGuideText"></p></div>
        <div class="sudo-guide-progress" aria-hidden="true"></div>
        <footer><button type="button" data-guide="auto" aria-pressed="false">자동 안내</button><div><button type="button" data-guide="prev">이전</button><button type="button" data-guide="next">다음</button></div></footer>
      </section>`;
    document.body.append(root);bubble=root.querySelector('.sudo-guide-bubble');hole=root.querySelector('.sudo-guide-spotlight');
    spacer=document.createElement('div');spacer.className='sudo-guide-scroll-space';spacer.hidden=true;spacer.setAttribute('aria-hidden','true');document.body.append(spacer);
    root.querySelector('.sudo-guide-avatar').innerHTML=window.PrimeSudoAssets?.idle || document.querySelector('.sudo-ai-character')?.innerHTML || '';
    if(reduced.matches)root.querySelector('svg')?.pauseAnimations?.();
    root.addEventListener('click', e=>{const action=e.target.closest('[data-guide]')?.dataset.guide;
      if(action==='close')close();if(action==='prev')go(index-1);if(action==='next'){if(index===steps.length-1)close(true);else go(index+1);}
      if(action==='auto'){playing=!playing;updateAuto();}
    });
    root.addEventListener('keydown',e=>{
      if(e.key==='Escape'){e.preventDefault();close();return;}
      if(e.key==='ArrowRight'){e.preventDefault();if(index<steps.length-1)go(index+1);return;}
      if(e.key==='ArrowLeft'){e.preventDefault();go(index-1);return;}
      if(e.key==='Tab'){
        const buttons=[...root.querySelectorAll('button:not(:disabled)')],first=buttons[0],last=buttons.at(-1);
        if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
        else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
      }
    });
    observer=new ResizeObserver(scheduleMeasure);observer.observe(bubble);
  }
  function visible(selector){return [...document.querySelectorAll(selector)].find(el=>el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden');}
  function rect(node){return node?.getBoundingClientRect();}
  function measure(){
    frame=0;if(!active)return;
    const viewport=window.visualViewport, width=window.innerWidth,height=viewport?.height||window.innerHeight;
    // Keyboard and screen rotation never move the speech bubble beyond the visual viewport.
    root.style.setProperty('--guide-bottom',`${Math.max(0,window.innerHeight-height-(viewport?.offsetTop||0))}px`);
    const r=rect(target),b=rect(bubble),avatar=visible('.sudo-guide-avatar');
    const avatarHeight=avatar?rect(avatar).height:0;
    spacer.style.height=`${Math.ceil(b.height+avatarHeight+20)}px`;
    const topBar=visible('.topbar, .app-header, .header');
    const headerBottom=Math.min(96,Math.max(12,rect(topBar)?.bottom||78));
    const clearTop=Math.min(b.top,avatar?rect(avatar).top:b.top);
    const h=r?spotlight(r,width,window.innerHeight,clearTop,headerBottom):{left:width/2,top:headerBottom,width:0,height:0};
    Object.assign(hole.style,{left:`${h.left}px`,top:`${h.top}px`,width:`${h.width}px`,height:`${h.height}px`});
    hole.hidden=h.width<1||h.height<1;
    root.querySelector('[data-guide-cutout]').setAttribute('d',roundedHole(h));
  }
  function scheduleMeasure(){if(active&&!frame)frame=requestAnimationFrame(measure);}
  function updateAuto(){
    clearTimeout(autoTimer);autoTimer=0;
    const btn=root.querySelector('[data-guide="auto"]');btn.textContent=playing?'일시정지':'자동 안내';btn.setAttribute('aria-pressed',String(playing));
    if(playing&&active&&!document.hidden)autoTimer=setTimeout(()=>{if(index<steps.length-1)go(index+1);else{playing=false;updateAuto();}},5500);
  }
  function go(next){
    if(!active)return;index=Math.min(steps.length-1,Math.max(0,next));const step=steps[index],token=++sequence;
    window.switchTab?.(step.tab);
    if(step.intro)window.scrollTo({top:0,behavior:'instant'});
    root.classList.toggle('is-introduction',Boolean(step.intro));
    if(step.category)document.querySelector(`[data-ai-category-target="${step.category}"]`)?.click();
    root.querySelector('#sudoGuideTitle').textContent=step.title;root.querySelector('#sudoGuideText').textContent=step.text;
    if(!reduced.matches)root.querySelector('.sudo-guide-copy').animate?.([{opacity:0,transform:'translateY(4px)'},{opacity:1,transform:'translateY(0)'}],{duration:220,easing:'ease-out'});
    root.querySelector('#sudoGuideCount').textContent=`${index+1} / ${steps.length}`;
    root.querySelector('[data-guide="prev"]').disabled=index===0;
    root.querySelector('[data-guide="next"]').textContent=step.intro?'같이 둘러보기':index===steps.length-1?'시작하기':'다음 ›';
    root.querySelector('.sudo-guide-progress').innerHTML=steps.map((_,i)=>`<i class="${i===index?'is-active':''}"></i>`).join('');
    const avatar=visible('.sudo-guide-avatar');
    spacer.style.height=`${Math.ceil(bubble.offsetHeight+(avatar?.offsetHeight||0)+20)}px`;
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      if(!active||token!==sequence)return;
      if(target)observer.unobserve(target);
      target=step.intro?null:visible(step.target)||visible(`.panel[data-tab="${step.tab}"] .card`)||visible(`.panel[data-tab="${step.tab}"]`);
      if(target){
        observer.observe(target);target.scrollIntoView({block:'start',behavior:'instant'});
        const topBar=visible('.topbar, .app-header, .header');
        const clearance=Math.max(16,Math.min(100,rect(topBar)?.bottom||64))+16;
        window.scrollBy({top:-clearance,behavior:'instant'});
      }
      measure();updateAuto();
    }));
  }
  function start(){
    if(active)return;create();pendingUser=null;checkToken++;returnFocus=document.activeElement;returnTab=document.querySelector('main > .panel.is-active')?.dataset.tab||'home';returnScroll=window.scrollY;
    document.getElementById('aiFabClose')?.click();
    root.hidden=false;spacer.hidden=false;active=true;playing=false;document.body.classList.add('sudo-guide-open');
    inertNodes=[...document.body.children].filter(n=>n!==root&&!['SCRIPT','LINK','STYLE'].includes(n.tagName)).map(n=>({n,inert:n.inert}));
    inertNodes.forEach(({n})=>n.inert=true);go(0);root.querySelector('[data-guide="next"]').focus({preventScroll:true});
  }
  function close(startApp=false){
    if(!active)return;remember();active=false;sequence++;playing=false;clearTimeout(autoTimer);cancelAnimationFrame(frame);frame=0;
    if(target)observer.unobserve(target);target=null;root.hidden=true;spacer.hidden=true;document.body.classList.remove('sudo-guide-open');
    inertNodes.forEach(({n,inert})=>n.inert=inert);inertNodes=[];
    window.switchTab?.(startApp?'home':returnTab);
    if(!startApp)window.scrollTo({top:returnScroll,behavior:'instant'});
    if(returnFocus?.isConnected&&returnFocus.getClientRects().length)returnFocus.focus({preventScroll:true});
    else document.querySelector('main > .panel.is-active button')?.focus({preventScroll:true});
  }
  function ready(){
    if(!pendingUser||active||document.hidden||window.PrimeStudyOnboarding?.shouldBlockGuide?.()||document.querySelector('.modal-backdrop.is-open'))return;
    const uid=pendingUser;pendingUser=null;if(authUser?.uid===uid&&!read(uid))start();
  }
  async function checkFirstLogin(user=window.ClassHubFirebase?.getCurrentUser?.()){
    const token=++checkToken;authUser=user||null;pendingUser=null;
    if(!shouldAutoStart(user?.uid,read(user?.uid),active))return;
    let profile=null;
    try{profile=await Promise.race([window.ClassHubFirebase?.getUserProfile?.(user.uid),new Promise(resolve=>setTimeout(()=>resolve(null),2000))]);}catch{}
    if(token!==checkToken||authUser?.uid!==user.uid||active)return;
    if(['pending','draft'].includes(profile?.studyConsultation?.status))return;
    if(Number(profile?.sudoGuideVersion)>=VERSION){try{localStorage.setItem(key(user.uid),JSON.stringify({version:VERSION}));}catch{}return;}
    pendingUser=user.uid;ready();
  }
  window.PrimeSudoGuide={start,close,checkFirstLogin};
  // Re-align the current target on rotation, not just the cutout coordinates.
  function viewportChanged(){if(active)go(index);}
  window.addEventListener('resize',viewportChanged);window.addEventListener('scroll',scheduleMeasure,{passive:true});
  window.visualViewport?.addEventListener('resize',viewportChanged);window.visualViewport?.addEventListener('scroll',scheduleMeasure);
  document.addEventListener('visibilitychange',()=>{if(root)updateAuto();ready();});
  const modalObserver=new MutationObserver(ready);
  document.querySelectorAll('.modal-backdrop').forEach(modal=>modalObserver.observe(modal,{attributes:true,attributeFilter:['class']}));
  window.ClassHubFirebase?.onAuthStateChanged?.(user=>{if(!user&&active)close();checkFirstLogin(user);});
  checkFirstLogin();
})();
