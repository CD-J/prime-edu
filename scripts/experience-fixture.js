// Local-only interaction evidence; no network/user record writes.
(() => {
  const proof=document.createElement('output');proof.id='experienceProof';proof.hidden=true;document.body.append(proof);
  const samples=[];
  const add=(type,data)=>{samples.push({type,...data});proof.textContent=JSON.stringify(samples.slice(-24));};
  const scrollTo=Element.prototype.scrollTo;
  Element.prototype.scrollTo=function(...args){if(this.classList.contains('standby-stack'))add('scrollTo',{top:args[0]?.top,scroll:this.scrollTop,h:this.clientHeight});return scrollTo.apply(this,args);};
  window.addEventListener('resize',()=>add('resize',{w:innerWidth,h:innerHeight}));
  document.addEventListener('click',event=>{const button=event.target.closest('button');if(button?.matches('[data-pomodoro-toggle]')){add('timer-click',{running:window.PrimeEduPomodoro.getState().running,home:!!button.closest('.mobile-pomodoro-widget,.home-pomodoro')});queueMicrotask(()=>add('timer-after',{running:window.PrimeEduPomodoro.getState().running,hidden:document.getElementById('primeStandby').hidden}));}if(event.target.closest('#primeStandby'))add('click',{label:button?.getAttribute('aria-label'),index:button?.dataset.standbyIndex});});
  document.addEventListener('focusin',event=>{if(event.target.closest('#primeStandby'))add('focus',{label:event.target.getAttribute('aria-label')});});
  if(new URLSearchParams(location.search).has('longlistqa')) {
    const titles=['수학 오답을 다시 풀고 풀이 과정을 한 줄로 정리하기','영어 단어 20개 복습하기','국어 수업 필기와 핵심 개념 연결하기'];
    window.PrimeEduStandbyData={getTodayItems:()=>Array.from({length:18},(_,i)=>({key:`local-proof-${i}`,title:titles[i%titles.length],minutes:25+i,done:i%4===0})),toggle:async key=>add('local-check',{key})};
  }
})();
