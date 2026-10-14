(function(root){
  'use strict';
  const paths={
    back:'M19 12H5m6-6-6 6 6 6',close:'m6 6 12 12M18 6 6 18',edit:'m15 5 4 4M4 20l4-1L20 7a2.1 2.1 0 0 0-3-3L5 16Z',info:'M21 12a9 9 0 1 0-18 0 9 9 0 0 0 18 0ZM12 11v6M12 7v.2',logout:'M10 7V3H4v18h6v-4M8 12h13m-4-4 4 4-4 4',
    trash:'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 10v7m4-7v7',reset:'M4 10a8 8 0 1 1 1 8M4 4v6h6',
    calendar:'M8 3v4m8-4v4M4 10h16M6 5h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2ZM8 14h2m4 0h2',
    history:'M3 10a9 9 0 1 1 2 8M3 4v6h6M12 7v5l3 2',settings:'M9.5 3h5l.6 2.3 2 .9 2.1-.7 2.5 4.3-1.6 1.6v2.3l1.6 1.6-2.5 4.3-2.1-.7-2 .9-.6 2.2h-5l-.6-2.2-2-.9-2.1.7-2.5-4.3L4 13.7v-2.3L2.4 9.8l2.5-4.3 2.1.7 2-.9ZM15.5 12a3.5 3.5 0 1 0-7 0 3.5 3.5 0 0 0 7 0',
    arrow:'m9 6 6 6-6 6',previous:'m15 6-6 6 6 6',down:'m6 9 6 6 6-6',plus:'M12 5v14M5 12h14',minus:'M5 12h14',search:'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm5 12 5 5',play:'m9 5 10 7-10 7Z',pause:'M9 5v14M15 5v14',check:'m5 12 4 4 10-10',
    book:'M7 3h11a2 2 0 0 1 2 2v15H7a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3ZM7 3v14m-3 0a3 3 0 0 1 3-3h13M11 7h5',
    send:'M12 18V6m-5 5 5-5 5 5',hourglass:'M7 3h10M7 21h10M8 3v4c0 2 2 3 4 5-2 2-4 3-4 5v4M16 3v4c0 2-2 3-4 5 2 2 4 3 4 5v4',
    home:'m4.5 10 7.5-6 7.5 6v8a2 2 0 0 1-2 2H15v-5H9v5H6.5a2 2 0 0 1-2-2Z',school:'m3.5 9 8.5-4.5L20.5 9 12 13.5ZM6.5 11v5c3.5 2.6 7.5 2.6 11 0v-5M20.5 9v7',
    chart:'M5.5 18.5v-7m6.5 7v-13m6.5 13v-10M4 20h16',growth:'M5 17.5v-6m6 6v-9m6 9V5M4 20h16',menu:'M5 6.5h14M5 12h14M5 17.5h14',
    bell:'M5.5 16.5h13a1 1 0 0 0 .7-1.7c-1.5-1.4-1.7-2.7-1.7-5.3a5.5 5.5 0 0 0-11 0c0 2.6-.2 3.9-1.7 5.3a1 1 0 0 0 .7 1.7ZM10 19a2.2 2.2 0 0 0 4 0',camera:'M8 6l1-2h6l1 2h3a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Zm8 7a4 4 0 1 0-8 0 4 4 0 0 0 8 0',
    sliders:'M4 6h9m4 0h3M4 12h3m4 0h9M4 18h11m4 0h1M13 4v4M7 10v4M15 16v4',
    sparkles:'M12 3c1 5 3 7 8 8-5 1-7 3-8 8-1-5-3-7-8-8 5-1 7-3 8-8ZM19 16c.4 2 1 2.6 3 3-2 .4-2.6 1-3 3-.4-2-1-2.6-3-3 2-.4 2.6-1 3-3Z',
    notebook:'M7 4h10a2 2 0 0 1 2 2v13.5H7a2.5 2.5 0 0 1-2.5-2.5V6.5A2.5 2.5 0 0 1 7 4ZM8 4v15.5M11 8h5m-5 4h4',
    quiz:'M7 4h10a2 2 0 0 1 2 2v13.5H7a2.5 2.5 0 0 1-2.5-2.5V6.5A2.5 2.5 0 0 1 7 4ZM8 4v15.5m2.5-7.5 2 2 3.5-4',
    study:'M12 6c-2.5-1.8-5.5-2.3-9-1.3v14c3.5-1 6.5-.5 9 1.3 2.5-1.8 5.5-2.3 9-1.3v-14c-3.5-1-6.5-.5-9 1.3ZM12 6v14',
    review:'M3 10a9 9 0 0 1 15.5-4.5L21 8m0-5v5h-5M21 14a9 9 0 0 1-15.5 4.5L3 16m0 5v-5h5',
    clipboard:'M9 3h6v4H9ZM9 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-3M8 12h8m-8 4h5',
    openBook:'M12 6c-2.5-1.8-5.5-2.3-9-1.3v14c3.5-1 6.5-.5 9 1.3 2.5-1.8 5.5-2.3 9-1.3v-14c-3.5-1-6.5-.5-9 1.3ZM12 6v14',
    user:'M15.5 7.5a3.5 3.5 0 1 0-7 0 3.5 3.5 0 0 0 7 0ZM5.5 19.5a6.5 6.5 0 0 1 13 0',shield:'m12 3-8 4v5c0 4 3 7 8 9 5-2 8-5 8-9V7ZM9 12l2 2 4-4',
    sun:'M16 12a4 4 0 1 0-8 0 4 4 0 0 0 8 0ZM12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.4 1.4M17.6 17.6 19 19M5 19l1.4-1.4M17.6 6.4 19 5',moon:'M20 14a8 8 0 0 1-10-10 8 8 0 1 0 10 10Z',auto:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM12 3v18m0-18a9 9 0 0 1 0 18',
    clock:'M20.5 12a8.5 8.5 0 1 0-17 0 8.5 8.5 0 0 0 17 0ZM12 7.5V12l3 2',target:'M20.5 12a8.5 8.5 0 1 0-17 0 8.5 8.5 0 0 0 17 0ZM16 12a4 4 0 1 0-8 0 4 4 0 0 0 8 0ZM12 12h.01',external:'M14 4h6v6m0-6-9 9M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4',
    mindmap:'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM7 5a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm10 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM7 9l3 2m4 2 3 2M15 9l3-3'
  };
  function svg(name){return `<svg class="prime-icon" data-ui-icon="${Object.hasOwn(paths,name)?name:'arrow'}" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${paths[name]||paths.arrow}"/></svg>`;}
  const exact={닫기:['close','닫기'],삭제:['trash','삭제'],수정:['edit','수정'],이전:['previous','이전'],다음:['arrow','다음'],'다음 ›':['arrow','다음'],검색:['search','검색'],취소:['close','취소'],'새 대화':['plus','새 대화'],초기화:['reset','초기화'],'날짜 설정':['calendar','D-day 날짜 설정'],'문제책으로':['back','저장 노트로 돌아가기'],'저장 노트':['back','저장 노트로 돌아가기'],'홈 화면 변경':['settings','홈 화면 변경'],'홈 설정':['settings','홈 화면 설정'],'‹':['previous','이전 달'],'›':['arrow','다음 달'],'●':['calendar','이번 달로 이동']};
  const byId={mobileLandingHistoryButton:['history','이전 대화 열기'],desktopHistoryButton:['history','이전 대화 열기'],desktopChatBackButton:['back','홈으로 돌아가기'],mobileChatBackButton:['back','홈으로 돌아가기'],settingsProfileButton:['edit','회원정보 수정'],settingsPrivacyButton:['chart','개인정보·학습 통계'],settingsLogoutButton:['logout','로그아웃'],gradeTargetClear:['close','목표 학교 해제'],gradeFeedbackInfoButton:['info','성적 분석 안내']};
  const originals=new WeakMap();
  function polish(button){
    if(button.tagName!=='BUTTON')return;
    if(button.hasAttribute('data-ui-keep-label'))return;
    const text=button.textContent.trim();
    if(!text&&button.dataset.primeIcon&&button.querySelector('.prime-icon'))return;
    const sendControl=button.matches('.mobile-study-submit,.home-ai-form button[type="submit"]')&&(!text||text==='전송');
    const spec=byId[button.id]||exact[text]||(sendControl?['send','스도에게 질문하기']:null)||(['×','✕'].includes(text)?['close',button.getAttribute('aria-label')||'닫기']:null)||
      (button.hasAttribute('data-notebook-library')?['back','저장 노트로 돌아가기']:null)||
      (button.hasAttribute('data-pomodoro-reset')?['reset','타이머 초기화']:null);
    if(!spec){
      // Stateful buttons can become a labelled CTA again (guide intro/final,
      // edit -> add). Restore their sizing and original accessible name.
      const before=originals.get(button);
      if(before){button.classList.remove('prime-icon-button');delete button.dataset.primeIcon;for(const [name,value] of Object.entries(before)){if(value===null)button.removeAttribute(name);else button.setAttribute(name,value);}originals.delete(button);}
      return;
    }
    if(button.dataset.primeIcon===spec[0]&&button.querySelector('.prime-icon')&&!text)return;
    if(!originals.has(button))originals.set(button,{'aria-label':button.getAttribute('aria-label'),title:button.getAttribute('title')});
    const label=originals.get(button)['aria-label']||spec[1];
    button.setAttribute('aria-label',label);button.title=label;button.dataset.primeIcon=spec[0];button.classList.add('prime-icon-button');
    button.innerHTML=svg(spec[0]);
  }
  const symbols={'✦':'sparkles','✓':'check','▤':'book','▦':'calendar','▥':'chart','✎':'edit','↗':'growth','›':'arrow','◷':'clock','◎':'target','⌂':'home','＋':'plus','−':'minus','–':'minus','－':'minus'};
  function polishSymbol(node){
    if(node.nodeType!==1)return;
    const name=node.dataset?.uiIcon||symbols[node.textContent?.trim()];
    if(!Object.hasOwn(paths,name))return;
    if(node.tagName.toLowerCase()==='svg'){
      if(node.classList.contains('prime-icon'))return;
      node.classList.add('prime-icon');
      for(const [k,v] of Object.entries({viewBox:'0 0 24 24','aria-hidden':'true',focusable:'false',fill:'none',stroke:'currentColor','stroke-width':'1.8','stroke-linecap':'round','stroke-linejoin':'round'}))node.setAttribute(k,v);
      node.innerHTML=`<path d="${paths[name]}"/>`;
    }else if(!node.querySelector?.('.prime-icon')||node.dataset.renderedIcon!==name){
      node.innerHTML=svg(name);node.dataset.renderedIcon=name;
    }
  }
  // Only decorative icon slots, not labels, user prose, graphs or mascot art.
  const symbolSelector='svg[data-ui-icon],[data-ui-icon],[data-ui-symbol],.study-book-page-icon,.home-widget-icon,.home-notice-arrow,.settings-link-arrow,.section-icon[aria-hidden],.tab-heading-icon[aria-hidden],.guide-step-icon,.notebook-create-trigger b[aria-hidden],#studyDashboardSummary article>span[aria-hidden]';
  function inspectSymbols(scope){if(scope.matches?.(symbolSelector))polishSymbol(scope);scope.querySelectorAll?.(symbolSelector).forEach(polishSymbol);}
  function start(){
    document.querySelectorAll('button').forEach(polish);
    document.querySelectorAll('.study-book-page-icon').forEach(n=>{n.dataset.uiIcon=n.closest('#studyTrainingSection')?'quiz':'notebook';});
    inspectSymbols(document);
    // Only inspect changed buttons/subtrees. Never rebuild a dialog or its inputs.
    const queued=new Set();let frame=0;
    new MutationObserver(records=>{
      records.forEach(r=>{
        const own=r.target.nodeType===1?r.target.closest('button'):r.target.parentElement?.closest('button');if(own)queued.add(own);
        if(r.target.nodeType===1)inspectSymbols(r.target);
        r.addedNodes.forEach(n=>{if(n.nodeType!==1)return;if(n.tagName==='BUTTON')queued.add(n);n.querySelectorAll('button').forEach(b=>queued.add(b));});
      });
      if(queued.size&&!frame)frame=requestAnimationFrame(()=>{frame=0;queued.forEach(polish);queued.clear();});
    }).observe(document.body,{childList:true,subtree:true});
  }
  const api={svg,paths,polishSymbol,symbols};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else{root.PrimeUI=api;if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();}
})(typeof window==='undefined'?globalThis:window);
