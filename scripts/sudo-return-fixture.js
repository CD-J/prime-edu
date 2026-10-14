/* QA-only frame recording and synthetic overscroll; excluded from deployments. */
(function(){
  const output=document.createElement('output');output.id='sudoReturnQA';output.hidden=true;document.body.append(output);
  const rect=n=>{if(!n)return null;const r=n.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
  let frames=[],start=0,recording=false,initialScroll=0,initialHeight=0,handoff=null;
  function snapshot(now){
    const button=document.getElementById('aiFabButton'),bridge=document.querySelector('.sudo-return-bridge'),dock=document.querySelector('.sudo-return'),nav=document.querySelector('.bottom-nav'),wrap=button.parentElement;
    const b=rect(bridge),h=rect(document.querySelector('.topbar')),n=rect(nav);
    const obstacles=[];document.querySelectorAll('.panel.is-active').forEach(scope=>{
      obstacles.push(...(window.PrimeSudoLayout?.readingRects(scope,{top:0,bottom:innerHeight,width:innerWidth})||[]));
      scope.querySelectorAll('button,input,textarea').forEach(el=>{if(el.getClientRects().length&&!el.closest('[hidden],[inert]'))obstacles.push(rect(el));});
    });
    const d=!dock.hidden?rect(dock):null;
    const hit=r=>obstacles.filter(o=>r.left<o.right&&r.right>o.left&&r.top<o.bottom&&r.bottom>o.top).length;
    return {time:Math.round(now-start),progress:Number(dock.style.getPropertyValue('--return-progress')),seed:d?rect(dock.querySelector('.sudo-return-seed svg')):null,bridge:b,dock:d,dockHits:d?hit(d):0,disabled:button.disabled,returning:button.classList.contains('is-sudo-returning'),bridgeInBounds:!b||(b.left>=-.1&&b.right<=innerWidth+.1&&b.top>=(h?.bottom||0)-.1&&b.bottom<=((n?.height>0?n.top:innerHeight)+.1)),wrapVisible:getComputedStyle(wrap).visibility!=='hidden',active:document.body.dataset.activeTab,theme:document.documentElement.dataset.theme,width:innerWidth,height:innerHeight,scrollDelta:document.scrollingElement.scrollTop-initialScroll,heightDelta:document.scrollingElement.scrollHeight-initialHeight,live:document.querySelector('.sudo-return-live').textContent,ghosts:document.querySelectorAll('.sudo-return-bridge').length,handoff};
  }
  function record(now){frames.push(snapshot(now));if(frames.length%4===0)output.textContent=JSON.stringify(frames);if(recording&&frames.length<600)requestAnimationFrame(record);}
  function begin(){output.removeAttribute('data-complete');frames=[];handoff=null;start=performance.now();initialScroll=document.scrollingElement.scrollTop;initialHeight=document.scrollingElement.scrollHeight;recording=true;requestAnimationFrame(record);}
  document.addEventListener('click',e=>{if(e.target.closest('.sudo-return'))begin();},true);
  window.addEventListener('prime:sudo-revive',()=>{if(!recording)begin();});
  window.addEventListener('prime:sudo-return-handoff',e=>{handoff=e.detail;});
  window.addEventListener('prime:sudo-return-complete',()=>{setTimeout(()=>{recording=false;frames.push(snapshot(performance.now()));output.textContent=JSON.stringify(frames);output.dataset.complete='true';},80);});
  const controls=document.createElement('aside');controls.dataset.sudoQaTools='true';controls.style.cssText='position:fixed;left:8px;top:126px;z-index:500;display:flex;gap:4px';
  for(const [name,label,action] of [['+120','복귀 스크롤 120',()=>{if(!recording)begin();window.dispatchEvent(new WheelEvent('wheel',{deltaY:120}));}],['중단','복귀 중단 검수',()=>window.dispatchEvent(new Event('touchcancel'))],['숨김','검수 버튼 숨기기',()=>document.querySelectorAll('[data-sudo-qa-tools]').forEach(n=>n.hidden=true)]]){
    const b=document.createElement('button');b.textContent=name;b.setAttribute('aria-label',label);b.onclick=action;controls.append(b);
  }
  document.body.append(controls);
})();
