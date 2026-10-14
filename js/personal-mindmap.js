(() => {
  const $=s=>document.querySelector(s),icon=n=>window.PrimeUI.svg(n),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let view,renderer,entry=false,closing=false,blocked=[],owner='',branch='all',origin=null,categoryMarkup='',limit=8;
  function layout(data,w,h){
    return window.PrimePersonalMindmapDesign.layout(data,w,h,branch);
  }
  function render(){
    if(!view||view.hidden)return;const data=window.PrimePersonalData.getGraph();
    if(owner&&owner!==window.SchemsStudyAI.getSnapshot().owner){close();return;}owner=window.SchemsStudyAI.getSnapshot().owner;
    const D=window.PrimePersonalMindmapDesign,{groups}=D.essential(data,branch);
    if(branch!=='all'&&!groups.some(n=>n.kind===branch)){branch='all';limit=8;}
    view.dataset.branch=branch;const stage=$('#personalMindStage');stage.hidden=branch!=='all'||!groups.length;if(!stage.hidden)renderer.draw(D.overview(data));
    $('#personalMindName').textContent=`${data.name}의 데이터`;
    const markup=`<button type="button" data-mind-category="all" aria-pressed="${branch==='all'}" data-ui-keep-label>전체</button>`+groups.filter(n=>['goals','learning'].includes(n.kind)).map(n=>`<button type="button" data-mind-category="${n.kind}" aria-pressed="${branch===n.kind}" data-ui-keep-label>${n.kind==='learning'?'진도':'목표'}</button>`).join('');
    if(categoryMarkup!==markup){categoryMarkup=markup;$('#personalMindCategories').innerHTML=markup;}
    $('#personalMindStatus').textContent='목표 · 진도 · 공부 습관';$('#personalMindStatus').hidden=false;
    const display=D.essential(data,branch).facts;$('#personalMindItems').innerHTML=display.length?display.slice(0,limit).map(n=>`<button type="button" data-mind-item="${esc(n.key)}" data-ui-keep-label><span class="personal-mind-item-icon">${icon(n.icon||'study')}</span><span><small>${esc(n.key.includes('consultation:')&&n.kind==='goals'?n.preview:n.label)}</small><strong>${esc(n.title)}</strong></span>${icon('arrow')}</button>`).join(''):'<button type="button" data-mind-consultation data-ui-keep-label><span class="personal-mind-item-icon">'+icon('user')+'</span><span><strong>나의 학습 정보</strong></span>'+icon('plus')+'</button>';
    $('#personalMindMore').hidden=display.length<=limit;
    $('#personalTrackingToggle').checked=data.tracking;
    view.querySelector('[data-mind-restore]').hidden=!window.PrimePersonalData.getStore().hidden.length;
  }
  function open(button){
    if(closing){setTimeout(()=>open(button),160);return;}if(!view.hidden)return;
    origin=button||document.activeElement;owner=window.SchemsStudyAI.getSnapshot().owner;branch='all';limit=8;view.hidden=false;document.body.classList.add('personal-mind-open');
    blocked=[...document.body.children].filter(n=>n!==view&&!['personalRecordDialog','personalEditDialog'].includes(n.id)&&!['SCRIPT','STYLE','LINK'].includes(n.tagName)).map(n=>[n,n.inert]);blocked.forEach(([n])=>n.inert=true);
    history.pushState({...history.state,personalMind:true},'','#my-data');entry=true;renderer.reset(true);render();$('#personalMindName').focus({preventScroll:true});
  }
  function close(fromHistory=false){
    if(!view||view.hidden)return;view.hidden=true;document.body.classList.remove('personal-mind-open');blocked.forEach(([n,inert])=>n.inert=inert);blocked=[];
    if(!fromHistory&&entry&&history.state?.personalMind){closing=true;history.back();}entry=false;if(origin?.isConnected)origin.focus({preventScroll:true});
  }
  function focusBranch(key){branch=key;limit=8;renderer.reset(true);render();}
  function edit(category){
    if(category==='school'){close();window.switchTab?.('settings');requestAnimationFrame(()=>{const b=$('#settingsProfileButton');if(b&&!b.disabled)b.click();});return;}
    if(category==='activity'){focusBranch(category);return;}
    const names={name:'이름',traits:'나의 성향',habits:'공부 습관',goals:'목표',interests:'관심사'};if(!names[category])return;
    const dialog=$('#personalEditDialog'),value=window.PrimePersonalData.getStore().manual[category]||'';
    dialog.innerHTML=`<form id="personalEditForm"><header><h2>${names[category]}</h2><button type="button" data-personal-edit-close aria-label="수정 닫기">${icon('close')}</button></header><label><span class="sr-only">${names[category]} 직접 입력</span><textarea name="value" maxlength="${category==='name'?30:240}" rows="3" placeholder="직접 적어주세요">${esc(value)}</textarea></label><footer><button type="submit" data-ui-keep-label>저장 ${icon('check')}</button></footer></form>`;
    dialog.showModal();dialog.querySelector('textarea').focus();dialog.querySelector('[data-personal-edit-close]').onclick=()=>dialog.close();dialog.querySelector('form').onsubmit=e=>{e.preventDefault();window.PrimePersonalData.setManual({[category]:dialog.querySelector('textarea').value});dialog.close();};
  }
  function init(){
    view=document.createElement('section');view.id='personalMindView';view.className='personal-mind-view';view.hidden=true;view.setAttribute('role','dialog');view.setAttribute('aria-modal','true');view.setAttribute('aria-labelledby','personalMindName');
    view.innerHTML=`<header class="personal-mind-head"><button type="button" data-mind-close aria-label="개인 데이터 닫기">${icon('back')}</button><div><h2 id="personalMindName" tabindex="-1">나의 데이터</h2><p id="personalMindStatus" role="status"></p></div><button type="button" data-mind-refresh aria-label="데이터 연결 갱신">${icon('reset')}</button></header><nav id="personalMindCategories" aria-label="개인 데이터 분류"></nav><div id="personalMindStage" class="personal-graph-stage"><svg aria-label="나를 중심으로 한 개인 데이터 마인드맵" tabindex="0"><g class="personal-graph-scene"></g></svg><div class="personal-graph-controls"><button type="button" data-graph-action="out" aria-label="마인드맵 축소">${icon('minus')}</button><span data-graph-scale>100%</span><button type="button" data-graph-action="in" aria-label="마인드맵 확대">${icon('plus')}</button><button type="button" data-graph-action="reset" aria-label="마인드맵 위치 초기화">${icon('reset')}</button></div></div><footer class="personal-mind-foot"><label><input type="checkbox" id="personalTrackingToggle" checked><span>활동 반영</span></label><button type="button" data-mind-edit aria-label="내 성향과 습관 직접 입력">${icon('edit')}</button><button type="button" data-mind-restore aria-label="숨긴 정보 복원">${icon('history')}</button></footer>`;
    document.body.append(view);
    view.querySelector('[data-mind-refresh]').hidden=true;view.querySelector('[data-mind-edit]').setAttribute('aria-label','학습 정보 수정');
    const dialog=document.createElement('dialog');dialog.id='personalEditDialog';dialog.className='personal-edit-dialog';document.body.append(dialog);
    const stage=$('#personalMindStage'),body=document.createElement('div');body.className='personal-mind-body';stage.before(body);body.append(stage);stage.querySelector('.personal-graph-controls').hidden=true;
    const list=document.createElement('section');list.className='personal-mind-items';list.setAttribute('aria-label','내 학습 정보');list.innerHTML='<div id="personalMindItems"></div><button type="button" id="personalMindMore" data-mind-more data-ui-keep-label hidden>더 보기</button>';body.append(list);
    renderer=window.PrimePersonalGraph.mount(stage,(key,node)=>{const branchNode=window.PrimePersonalData.getGraph().nodes.find(n=>n.key===key&&n.target==='branch');if(branchNode)focusBranch(branchNode.kind);else window.PrimePersonalLibrary.open(key,node);},{mindmap:true,network:true,autoFit:true,staticViewport:true,layout});
    $('#openPersonalData').addEventListener('click',e=>open(e.currentTarget));
    view.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
      if(b.hasAttribute('data-mind-close'))close();else if(b.hasAttribute('data-mind-category'))focusBranch(b.dataset.mindCategory);else if(b.hasAttribute('data-mind-item'))window.PrimePersonalLibrary.open(b.dataset.mindItem,b);else if(b.hasAttribute('data-mind-more')){limit+=8;render();}else if(b.hasAttribute('data-mind-consultation')){close();window.PrimeStudyOnboarding?.open();}else if(b.hasAttribute('data-mind-refresh'))window.PrimePersonalData.refreshInsights(true);else if(b.hasAttribute('data-mind-edit')){close();window.PrimeStudyOnboarding?.open();}else if(b.hasAttribute('data-mind-restore'))window.PrimePersonalData.restoreFacts();
    });
    $('#personalTrackingToggle').addEventListener('change',e=>window.PrimePersonalData.toggleTracking(e.target.checked));
    window.addEventListener('prime:personal-data',render);window.addEventListener('popstate',()=>{if(closing){closing=false;return;}if(entry)close(true);});
    view.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();close();}if(e.key==='Tab'){const items=[...view.querySelectorAll('button,input,[tabindex="0"]')].filter(n=>!n.disabled&&n.getClientRects().length),first=items[0],last=items.at(-1);if(e.shiftKey&&(document.activeElement===first||!items.includes(document.activeElement))){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}});
    new ResizeObserver(()=>{if(!view.hidden)render();}).observe(view);
  }
  window.PrimePersonalMindmap={open,close,edit,focusBranch};document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
})();
