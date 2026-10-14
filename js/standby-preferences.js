(function(root){
  'use strict';
  const key='primeEdu.standbyAppearance.v1';
  const pageKeys=['timer','clock','calendar','school','tasks'];
  const labels={timer:'남은 시간',clock:'시계',calendar:'캘린더',school:'시간표',tasks:'체크리스트'};
  const clockStyles=['digital','analog','duo','minimal','solar','float','lcd','flip'];
  function normalize(value={}){
    value=value&&typeof value==='object'?value:{};
    return {version:1,clock:clockStyles.includes(value.clock)?value.clock:'digital',hourCycle:value.hourCycle==='12'?'12':'24',
      frame:value.frame==='card'?'card':'edge',mood:Number.isFinite(Number(value.mood))?Math.max(0,Math.min(16,Math.round(Number(value.mood)))):10,
      order:[...new Set([...(Array.isArray(value.order)?value.order.filter(x=>pageKeys.includes(x)):[]),...pageKeys])]};
  }
  function move(order,id,delta){const next=normalize({order}).order,i=next.indexOf(id),step=Number.isFinite(Number(delta))?Math.trunc(Number(delta)):0,j=Math.max(0,Math.min(next.length-1,i+step));if(i>=0)[next[i],next[j]]=[next[j],next[i]];return next;}
  function angles(d){return {hour:(d.getHours()%12+d.getMinutes()/60)*30,minute:(d.getMinutes()+d.getSeconds()/60)*6};}
  function clockParts(d,cycle='24'){
    const h=d.getHours(),hours=String(cycle==='12'?(h%12||12):h).padStart(2,'0'),minutes=String(d.getMinutes()).padStart(2,'0'),period=cycle==='12'?(h<12?'AM':'PM'):'';
    return {hours,minutes,period,text:`${hours}:${minutes}`,label:`${period?period+' ':''}${hours}:${minutes}`};
  }
  function monthDays(d,events=[]){events=Array.isArray(events)?events.filter(e=>e&&typeof e==='object'):[];const y=d.getFullYear(),m=d.getMonth(),first=new Date(y,m,1).getDay(),last=new Date(y,m+1,0).getDate();return {year:y,month:m+1,first,weeks:Math.ceil((first+last)/7),days:Array.from({length:last},(_,i)=>{const day=i+1,date=`${y}-${String(m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;return {day,date,weekday:(first+i)%7,today:day===d.getDate(),count:events.filter(e=>{const start=String(e.date||e.startDate||e.start||'').slice(0,10),end=String(e.endDate||e.end||start).slice(0,10);return /^\d{4}-\d{2}-\d{2}$/.test(start)&&date>=start&&date<=end;}).length};})};}
  const api={normalize,move,angles,clockParts,monthDays,pageKeys,labels,key,clockStyles};
  if(typeof module==='object'&&module.exports){module.exports=api;return;}
  function read(){try{return normalize(JSON.parse(localStorage.getItem(key)||'{}'));}catch{return normalize();}}
  let state=read(),page=null,category='clock';
  const icon=name=>root.PrimeUI.svg(name);
  api.getState=()=>({...state,order:[...state.order]});
  api.update=patch=>{
    state=normalize({...state,...patch});let saved=true;
    try{localStorage.setItem(key,JSON.stringify(state));}catch{saved=false;}
    root.dispatchEvent(new CustomEvent('prime:standby-settings'));paint();
    const status=document.getElementById('standbyPreferenceStatus');
    if(status)status.textContent=saved?'이 기기에 저장했어요.':'이번 화면에 적용했어요. 브라우저 저장을 사용할 수 없어요.';
  };
  root.addEventListener('storage',e=>{if(e.key===key){state=read();paint();root.dispatchEvent(new CustomEvent('prime:standby-settings'));}});
  root.PrimeStandbyPreferences=api;
  function paint(){
    if(!page)return;
    page.querySelectorAll('[data-standby-style]').forEach(b=>b.setAttribute('aria-checked',String(b.dataset.standbyStyle===state.clock)));
    page.querySelectorAll('[data-standby-frame]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.standbyFrame===state.frame)));
    page.querySelectorAll('[data-standby-cycle]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.standbyCycle===state.hourCycle)));
    page.querySelector('#standbyMood').value=state.mood;
    page.querySelector('#standbyPageOrder').innerHTML=state.order.map(id=>`<li data-sort-key="${id}"><span>${icon({timer:'hourglass',clock:'clock',calendar:'calendar',school:'school',tasks:'clipboard'}[id])}${labels[id]}</span><button type="button" data-sort-handle aria-grabbed="false" aria-label="${labels[id]} 순서 이동"><svg class="prime-icon" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">${[8,16].map(x=>[6,12,18].map(y=>`<circle cx="${x}" cy="${y}" r="1.3"/>`).join('')).join('')}</svg></button></li>`).join('');
  }
  function chooseCategory(next){
    category=['clock','mood','pages'].includes(next)?next:'clock';
    page.querySelectorAll('[data-standby-category]').forEach(b=>{const active=b.dataset.standbyCategory===category;b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;});
    page.querySelectorAll('[data-standby-options]').forEach(p=>p.hidden=p.dataset.standbyOptions!==category);
  }
  function start(){
    const host=document.getElementById('standbyPreferencesHost');if(!host)return;
    const panel=host.closest('.panel-settings');if(!panel)return;
    host.innerHTML=`<button type="button" class="standby-settings-launch" id="openStandbySettings"><span class="feature-icon" aria-hidden="true">${icon('clock')}</span><span><strong>스탠바이 모드</strong><small>시계 · 분위기 · 페이지</small></span><span class="standby-launch-arrow" aria-hidden="true">${icon('arrow')}</span></button>`;
    page=document.createElement('section');page.id='standbySettingsPage';page.className='standby-settings-page';page.hidden=true;page.setAttribute('aria-label','스탠바이 모드 설정');
    const templates=[['digital','디지털','<b>10:08</b>'],['analog','아날로그','<i class="standby-preview-dial"></i>'],['duo','시계 + 캘린더','<i class="standby-preview-dial"></i><i class="standby-preview-calendar">10월<br>· · · · ·</i>'],['minimal','미니멀','<b class="standby-preview-thin">10:08</b>'],['solar','솔라','<b class="preview-solar">10:08</b>'],['float','플로트','<b class="preview-float">10<br>08</b>'],['lcd','LCD','<b class="preview-lcd">10:08</b>'],['flip','플립','<b class="preview-flip">10</b><b class="preview-flip">08</b>']];
    page.innerHTML=`<header class="standby-settings-header"><button type="button" class="icon-btn" id="closeStandbySettings" aria-label="사용자 설정으로 돌아가기">${icon('back')}</button><h2>스탠바이 모드</h2><button type="button" class="icon-btn" id="standbyPreviewButton" aria-label="스탠바이 미리보기">${icon('play')}</button></header>
      <div class="standby-settings-tabs" role="tablist" aria-label="스탠바이 설정 분류"><button type="button" role="tab" data-standby-category="clock" id="standbyClockTab" aria-controls="standbyClockOptions">시계</button><button type="button" role="tab" data-standby-category="mood" id="standbyMoodTab" aria-controls="standbyMoodOptions">분위기</button><button type="button" role="tab" data-standby-category="pages" id="standbyPagesTab" aria-controls="standbyPagesOptions">페이지</button></div>
      <section class="standby-options-card" role="tabpanel" aria-labelledby="standbyClockTab" id="standbyClockOptions" data-standby-options="clock"><h3>시계 디자인</h3><div class="standby-template-grid" role="radiogroup" aria-label="시계 디자인">${templates.map(([id,name,preview])=>`<button type="button" data-standby-style="${id}" role="radio" aria-checked="false"><span class="standby-template-preview" aria-hidden="true">${preview}</span><strong>${name}</strong></button>`).join('')}</div><div class="standby-setting-row"><h3>시간 표시</h3><div class="standby-cycle-options segmented-control" aria-label="시계 시간 표시"><button type="button" data-standby-cycle="24">24시간</button><button type="button" data-standby-cycle="12">AM · PM</button></div></div></section>
      <section class="standby-options-card" role="tabpanel" aria-labelledby="standbyMoodTab" id="standbyMoodOptions" data-standby-options="mood" hidden><h3>무드 조명</h3><div class="standby-mood-swatch" aria-hidden="true"></div><label for="standbyMood">조명 강도</label><input id="standbyMood" type="range" min="0" max="16" step="2" /><div class="standby-setting-row"><h3>남은 시간 테두리</h3><div class="standby-frame-options segmented-control" aria-label="남은 시간 디자인"><button type="button" data-standby-frame="edge">화면 가장자리</button><button type="button" data-standby-frame="card">카드</button></div></div></section>
      <section class="standby-options-card" role="tabpanel" aria-labelledby="standbyPagesTab" id="standbyPagesOptions" data-standby-options="pages" hidden><h3>페이지 순서</h3><ol id="standbyPageOrder"></ol></section>
      <footer class="standby-preference-actions"><button class="btn" type="button" id="standbyDefaultsButton">기본값 복원</button></footer><p class="status-text" id="standbyPreferenceStatus" role="status" aria-live="polite"></p>`;
    panel.append(page);paint();chooseCategory('clock');
    root.PrimeReorder.attach(page.querySelector('#standbyPageOrder'),order=>api.update({order}));
    host.querySelector('#openStandbySettings').addEventListener('click',()=>{panel.classList.add('is-standby-settings');page.hidden=false;chooseCategory(category);root.dispatchEvent(new Event('resize'));page.querySelector('#closeStandbySettings').focus({preventScroll:true});page.scrollIntoView({block:'start'});});
    page.addEventListener('click',e=>{
      const b=e.target.closest('button');if(!b||b.disabled)return;
      if(b.dataset.standbyStyle)api.update({clock:b.dataset.standbyStyle});
      else if(b.dataset.standbyFrame)api.update({frame:b.dataset.standbyFrame});
      else if(b.dataset.standbyCycle)api.update({hourCycle:b.dataset.standbyCycle});
      else if(b.dataset.standbyCategory){chooseCategory(b.dataset.standbyCategory);root.dispatchEvent(new Event('resize'));}
      else if(b.dataset.orderPage){api.update({order:move(state.order,b.dataset.orderPage,Number(b.dataset.orderShift))});page.querySelector(`[data-order-page="${b.dataset.orderPage}"][data-order-shift="${b.dataset.orderShift}"]`)?.focus({preventScroll:true});}
      else if(b.id==='standbyPreviewButton')root.PrimeStandby?.preview(b);
      else if(b.id==='standbyDefaultsButton')api.update(normalize());
      else if(b.id==='closeStandbySettings'){page.hidden=true;panel.classList.remove('is-standby-settings');host.querySelector('#openStandbySettings').focus({preventScroll:true});root.dispatchEvent(new Event('resize'));}
    });
    page.querySelector('#standbyMood').addEventListener('input',e=>api.update({mood:e.target.value}));
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})(typeof window==='object'?window:globalThis);
