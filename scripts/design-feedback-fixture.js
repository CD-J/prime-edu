// Read-only diagnostics on our isolated QA origin; not shipped to production.
(() => {
  const output=document.createElement('output');output.id='designFeedbackQA';output.hidden=true;document.body.append(output);let timer=0;
  function sample(){
    const b=document.querySelector('#aiFabButton'),wrap=b?.parentElement,rect=b?.getBoundingClientRect();
    const visible=wrap&&getComputedStyle(wrap).visibility!=='hidden'&&getComputedStyle(wrap).display!=='none';
    const viewport={top:visualViewport?.offsetTop||0,bottom:(visualViewport?.offsetTop||0)+(visualViewport?.height||innerHeight),width:innerWidth};
    let textCollisions=0,controlCollisions=0;
    if(visible&&rect)for(const panel of document.querySelectorAll('.panel.is-active')){
      for(const r of window.PrimeSudoLayout.readingRects(panel,viewport))if(window.PrimeSudoLayout.overlaps({x:rect.left,y:rect.top},{width:rect.width,height:rect.height},r,0))textCollisions++;
      for(const n of panel.querySelectorAll('button,input,textarea'))if(!n.closest('[hidden],[inert]')&&n.getClientRects().length&&getComputedStyle(n).visibility!=='hidden'&&window.PrimeSudoLayout.overlaps({x:rect.left,y:rect.top},{width:rect.width,height:rect.height},n.getBoundingClientRect(),0))controlCollisions++;
    }
    const next=document.querySelector('[data-journey-next]'),nr=next?.getBoundingClientRect();
    output.textContent=JSON.stringify({tab:document.body.dataset.activeTab,theme:document.documentElement.dataset.theme,width:innerWidth,height:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth,sudoVisible:Boolean(visible),textCollisions,controlCollisions,summaryHeight:document.querySelector('#studyDashboardSummary')?.getBoundingClientRect().height,missingAccuracy:document.querySelector('#studyDashboardSummary')?.textContent.includes('—'),journey:!document.querySelector('#primeJourney')?.hidden,nextInside:!nr||!nr.width||(nr.left>=0&&nr.right<=innerWidth&&nr.top>=viewport.top&&nr.bottom<=viewport.bottom),nextText:next?.textContent.trim()});
    output.dataset.tab=document.body.dataset.activeTab;output.dataset.theme=document.documentElement.dataset.theme;output.dataset.width=String(innerWidth);
  }
  const schedule=()=>{clearTimeout(timer);timer=setTimeout(sample,750);};
  for(const event of ['scroll','resize','prime:notebook-content-change','prime:controls-sync'])window.addEventListener(event,schedule,{passive:true});
  new MutationObserver(schedule).observe(document.body,{attributes:true,attributeFilter:['class','data-active-tab']});
  new MutationObserver(schedule).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
  schedule();
})();
