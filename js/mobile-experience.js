(function () {
  'use strict';
  function rulerValues(min,max,current) { const values=new Set([min,max,Math.max(min,Math.min(max,Number(current)||min))]);for(let n=Math.ceil(min/5)*5;n<=max;n+=5)values.add(n);return [...values].sort((a,b)=>a-b); }
  if(typeof module==='object'&&module.exports){module.exports={rulerValues};return;}
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const controls = [];
  const timeIds = ['manualChecklistMinutes','utilityChecklistMinutes','studyAvailableMinutes','studyAvailableMinutesAI','examStrategyMinutes'];
  const choiceIds = ['manualChecklistDifficulty','utilityChecklistDifficulty','studyFocus','studyPlanStyle','studyFocusAI','studyPlanStyleAI','quizDifficulty'];
  const labelFor = input => input.getAttribute('aria-label') || input.closest('label')?.firstChild.textContent.trim() || '시간';
  function enhanceTime(input) {
    const name = labelFor(input);
    const min = Number(input.min) || 5, max = Number(input.max) || 360;
    const box = document.createElement('div'); box.className = 'prime-time-picker';
    const caption = document.createElement('div'); caption.className = 'prime-time-caption'; caption.setAttribute('aria-hidden','true');
    const value = document.createElement('strong'), unit = document.createElement('small'); unit.textContent = '분'; caption.append(value,unit);
    const ruler = document.createElement('div'); ruler.className = 'prime-time-ruler'; ruler.tabIndex = 0;
    ruler.setAttribute('role','slider'); ruler.setAttribute('aria-label',name); ruler.setAttribute('aria-valuemin',min); ruler.setAttribute('aria-valuemax',max);
    box.append(caption,ruler); input.after(box);
    input.classList.add('prime-picker-source'); input.tabIndex = -1; input.setAttribute('aria-hidden','true');
    input.closest('label')?.classList.add('prime-picker-label');
    // Retain the original input/ID/value for the existing save and edit handlers.
    if(input.parentElement.matches('.field-with-unit,.checklist-number-field')) {
      [...input.parentElement.children].filter(node => node !== box && node !== input).forEach(node => { node.hidden = true; });
    }
    let ticks = [], timer = 0, frame = 0, syncing = false;
    function readValue() { return Math.max(min,Math.min(max,Number(input.value) || min)); }
    function paint(next, emit) {
      value.textContent = next; ruler.setAttribute('aria-valuenow',next); ruler.setAttribute('aria-valuetext',`${next}분`);
      ticks.forEach(tick => tick.classList.toggle('is-selected',Number(tick.dataset.value) === next));
      if(emit && Number(input.value) !== next) { input.value = next; input.dispatchEvent(new Event('input',{bubbles:true})); input.dispatchEvent(new Event('change',{bubbles:true})); }
    }
    function makeTicks() {
      ruler.replaceChildren();
      ticks = rulerValues(min,max,readValue()).map(n=>{const tick=document.createElement('span');tick.className='prime-time-tick';tick.dataset.value=n;tick.textContent=n;tick.setAttribute('aria-hidden','true');ruler.append(tick);return tick;});
    }
    function scrollToValue(next, animate=false) {
      const tick=ticks.find(node=>Number(node.dataset.value)===next); if(!tick||!ruler.clientWidth)return;
      ruler.scrollTo({left:tick.offsetLeft-(ruler.clientWidth-tick.offsetWidth)/2,behavior:animate&&!reduced.matches?'smooth':'instant'});
    }
    function sync() {
      const next=readValue(); if(!ticks.some(node=>Number(node.dataset.value)===next))makeTicks();
      syncing=true;paint(next,false);scrollToValue(next); requestAnimationFrame(()=>{syncing=false;});
    }
    function nearest() {
      const centre=ruler.scrollLeft+ruler.clientWidth/2;
      return ticks.reduce((a,b)=>Math.abs(a.offsetLeft+a.offsetWidth/2-centre)<Math.abs(b.offsetLeft+b.offsetWidth/2-centre)?a:b);
    }
    ruler.addEventListener('scroll',()=>{
      if(syncing||!ruler.clientWidth)return;
      if(!frame)frame=requestAnimationFrame(()=>{frame=0;const tick=nearest();paint(Number(tick.dataset.value),true);});
      clearTimeout(timer); timer=setTimeout(()=>{if(ruler.clientWidth)paint(Number(nearest().dataset.value),true);},100);
    },{passive:true});
    ruler.addEventListener('click',event=>{const tick=event.target.closest('.prime-time-tick');if(tick){const n=Number(tick.dataset.value);paint(n,true);scrollToValue(n,true);}});
    ruler.addEventListener('keydown',event=>{
      const keys=['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End']; if(!keys.includes(event.key))return;event.preventDefault();
      const index=ticks.findIndex(node=>Number(node.dataset.value)===readValue());
      const next=event.key==='Home'?0:event.key==='End'?ticks.length-1:Math.max(0,Math.min(ticks.length-1,index+(['ArrowRight','ArrowUp'].includes(event.key)?1:-1)));
      const n=Number(ticks[next].dataset.value);paint(n,true);scrollToValue(n,true);
    });
    // Mouse-wheel adjustment is confined to this focused/hovered ruler.
    ruler.addEventListener('wheel',event=>{if(Math.abs(event.deltaX)>Math.abs(event.deltaY)||!event.deltaY)return;event.preventDefault();ruler.scrollBy({left:Math.sign(event.deltaY)*42,behavior:reduced.matches?'instant':'smooth'});},{passive:false});
    input.addEventListener('change',()=>{if(!syncing&&Number(ruler.getAttribute('aria-valuenow'))!==readValue())sync();});
    new ResizeObserver(()=>sync()).observe(ruler);makeTicks();sync();controls.push(sync);
  }
  function enhanceChoice(input) {
    const name=labelFor(input), box=document.createElement('div');box.className='prime-choice-picker';box.setAttribute('role','radiogroup');box.setAttribute('aria-label',name);
    const buttons=[...input.options].map(option=>{
      const button=document.createElement('button');button.type='button';button.textContent=option.text;button.dataset.value=option.value;button.setAttribute('role','radio');box.append(button);
      button.addEventListener('click',()=>{input.value=option.value;input.dispatchEvent(new Event('change',{bubbles:true}));sync();});return button;
    });
    function sync(){buttons.forEach(button=>{const selected=button.dataset.value===input.value;button.setAttribute('aria-checked',selected);button.tabIndex=selected?0:-1;});}
    box.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;event.preventDefault();const index=buttons.findIndex(b=>b.dataset.value===input.value);const next=buttons[(index+(['ArrowRight','ArrowDown'].includes(event.key)?1:-1)+buttons.length)%buttons.length];next.click();next.focus();});
    input.after(box);input.classList.add('prime-picker-source');input.tabIndex=-1;input.setAttribute('aria-hidden','true');input.closest('label')?.classList.add('prime-picker-label');input.addEventListener('change',sync);sync();controls.push(sync);
  }
  timeIds.forEach(id=>{const input=document.getElementById(id);if(input)enhanceTime(input);});
  choiceIds.forEach(id=>{const input=document.getElementById(id);if(input)enhanceChoice(input);});
  const syncAll=()=>requestAnimationFrame(()=>controls.forEach(sync=>sync()));
  document.addEventListener('reset',syncAll,true); window.addEventListener('prime:controls-sync',syncAll);
})();
