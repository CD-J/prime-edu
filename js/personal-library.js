(() => {
  'use strict';
  const $=s=>document.querySelector(s),api=()=>window.SchemsStudyAI,core=()=>window.PrimePersonalLibraryCore;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const icon=name=>window.PrimeUI.svg(name);
  const categories=[['notes','개념노트','notebook'],['quizzes','문제노트','quiz'],['plans','내 준비','clipboard'],['books','읽을 책','openBook'],['records','공부기록','history'],['grades','성적','chart']];
  let kind='all',query='',limit=8,owner=null,snapshot={},history=[],graph={nodes:[],edges:[],documents:[]},selected=null,originKey='',originElement=null;
  function read(){
    snapshot=api().getSnapshot();history=api().getRecentHistory();
    const grades=window.PrimeGradeNotebook?.getSnapshot();if(grades?.owner===snapshot.owner){snapshot.gradeRecords=grades.records;snapshot.gradeFeedback=grades.feedback;}
    const records=core().graph(snapshot,history),personal=window.PrimePersonalData?.getGraph();
    return personal?{...records,nodes:personal.nodes,edges:personal.edges}:records;
  }
  function render(){
    if(!$('#personalLibrary')||!api())return;graph=read();
    if(owner!==snapshot.owner){owner=snapshot.owner;kind='all';query='';limit=8;$('#personalLibrarySearch').value='';close();}
    const matches=core().select(graph.documents,kind,query);
    $('#personalLibraryScope').textContent=owner==='guest'?'이 기기의 기록':'내 계정의 기록';
    $('#personalLibraryCollections').innerHTML=categories.map(([key,label,glyph])=>`<button type="button" class="personal-collection" data-personal-filter="${key}" aria-pressed="${key===kind}" data-ui-keep-label><span class="personal-collection-icon">${icon(glyph)}</span><span>${label}</span><b>${graph.documents.filter(r=>r.kind===key).length}</b></button>`).join('');
    $('#personalLibraryAll').setAttribute('aria-pressed',String(kind==='all'));
    $('#personalLibraryLabel').textContent=query?'검색 결과':kind==='all'?'최근 작업':categories.find(c=>c[0]===kind)[1];
    $('#personalLibraryCount').textContent=`${matches.length}개`;
    $('#personalLibraryGrid').innerHTML=matches.length?matches.slice(0,limit).map(row=>`<button type="button" class="personal-document" data-personal-open="${esc(row.key)}" data-kind="${row.kind}" data-ui-keep-label aria-label="${esc(row.title)} 보기"><span class="personal-document-top"><span>${icon(row.icon)}</span>${esc(row.label)}${icon('arrow')}</span><strong>${esc(row.title)}</strong><span class="personal-document-preview">${esc(row.preview||row.label)}</span><span class="personal-document-foot">${esc(row.subtitle||'저장됨')}</span></button>`).join(''):`<div class="personal-library-empty">${icon(query?'search':'notebook')}<p>${query?'일치하는 기록이 없어요':'첫 기록을 기다리고 있어요'}</p></div>`;
    $('#personalLibraryMore').hidden=matches.length<=limit;
    if(selected&&!graph.nodes.some(n=>n.key===selected))close();
  }
  const paragraph=text=>text?`<p class="personal-record-text">${esc(text)}</p>`:'';
  const section=(title,text)=>text?`<section class="personal-record-section"><h3>${esc(title)}</h3>${paragraph(text)}</section>`:'';
  function detail(row){
    if(row.target==='note'){
      const n=snapshot.notes.find(n=>n.id===row.id);return n?section('핵심 정리',n.summary)+section('필기',n.text||n.content||n.noteText)+(n.keywords?.length?`<div class="personal-record-tags">${n.keywords.map(k=>`<span>#${esc(k)}</span>`).join('')}</div>`:''):'';
    }
    if(row.target==='quiz'){
      const q=snapshot.quizzes.find(q=>q.id===row.id);return q?`<ol class="personal-record-questions">${(q.questions||[]).slice(0,8).map(n=>`<li>${esc(n.question||n.prompt||'문제')}</li>`).join('')}</ol>`:'';
    }
    if(row.target==='activity'){
      const a=snapshot.tasks.find(t=>t.id===row.id)?.activity;return a?section('원문',a.source?.text)+`<ol class="personal-record-questions">${a.steps.map(s=>`<li>${s.state==='done'?icon('check'):''}${esc(s.title)}<small>${s.minutes}분</small></li>`).join('')}</ol>`:'';
    }
    if(row.target==='books'){
      const b=snapshot.bookRecommendations[Number(row.id)];return b?section('읽을 이유',b.reason||b.description)+section('읽기 포인트',b.learningPoint):'';
    }
    if(row.target==='grades'){
      const values=(snapshot.gradeRecords||[]).filter(r=>[r.year,r.term,r.recordType,r.exam||'rank',r.gradeSystem||'score'].join(':')===row.id);
      return `<div class="personal-grade-values">${values.map(r=>`<div><span>${esc(r.subject)}</span><strong>${esc(r.recordType==='exam-score'?r.score+'점':r.rank+'등급')}</strong></div>`).join('')}</div>`;
    }
    if(row.target==='target'){
      const f=snapshot.gradeFeedback;return f?paragraph(f.summary)+[['잘하고 있는 점',f.strengths],['다음 공부 목표',f.nextSteps],['목표 확인',f.targetAdvice]].map(([name,items])=>section(name,items?.join('\n'))).join(''):'';
    }
    if(row.target==='record'){
      const r=history.find(r=>r.key===row.id);return r?paragraph(r.content||r.context||r.status)+section('피드백',r.feedback):'';
    }
    if(row.target==='identity')return section('내 데이터',row.subtitle);
    if(row.target==='fact')return paragraph(row.preview)+(row.evidence||[]).map(e=>section(e.label,e.text)).join('');
    return '';
  }
  function close(){const dialog=$('#personalRecordDialog');if(dialog?.open)dialog.close();selected=null;}
  function open(key,origin){
    graph=read();const row=graph.nodes.find(n=>n.key===key);if(!row){render();return;}
    const dialog=$('#personalRecordDialog');if(!dialog.open){originKey=origin?.dataset?.personalOpen||key;originElement=origin?.isConnected?origin:null;}selected=key;
    const adjacent=graph.edges.filter(e=>e.source===key||e.target===key).map(e=>({row:graph.nodes.find(n=>n.key===(e.source===key?e.target:e.source)),label:e.label})).filter(v=>v.row&&(row.target!=='fact'||!['identity','branch'].includes(v.row.target))).slice(0,4);
    const meta=row.target==='record'?(()=>{const r=history.find(r=>r.key===row.id);return [r?.date,r?.clock,r?.metric,r?.status].filter(Boolean).join(' · ');})():row.subtitle;
    $('#personalRecordBody').innerHTML=`<span class="personal-record-kind">${icon(row.icon)} ${esc(row.label)}</span><h2 id="personalRecordTitle" tabindex="-1">${esc(row.title)}</h2>${meta?`<p class="personal-record-meta">${esc(meta)}</p>`:''}${detail(row)}${adjacent.length?`<section class="personal-record-links"><h3>연결된 기록</h3>${adjacent.map(({row:r,label})=>`<button type="button" data-personal-related="${esc(r.key)}">${icon(r.icon)}<span>${esc(r.title)}<small>${esc(label)}</small></span>${icon('arrow')}</button>`).join('')}</section>`:''}`;
    $('#personalRecordFooter').innerHTML=`<button type="button" class="personal-record-source" data-personal-work="${esc(key)}" data-ui-keep-label><span>그 작업으로 돌아가기</span>${icon('arrow')}</button>`;
    if(['identity','fact','branch'].includes(row.target))$('#personalRecordFooter').insertAdjacentHTML('afterbegin',`<div class="personal-fact-controls"><span>${esc(row.source||'내 데이터')}</span><button type="button" data-personal-edit="${row.target==='identity'?'name':row.kind}" aria-label="개인 데이터 수정">${icon('edit')}</button>${row.target==='fact'?`<button type="button" data-personal-hide="${esc(key)}" aria-label="이 정보 숨기기">${icon('trash')}</button>`:''}</div>`);
    if(!dialog.open)dialog.showModal();else $('#personalRecordTitle').focus?.({preventScroll:true});
  }
  function work(row){
    if(row.target==='identity'){window.switchTab?.('settings');return;}
    if(row.target==='branch'){window.PrimePersonalMindmap?.focusBranch(row.kind);return;}
    if(row.target==='fact'){
      const w=row.work;if(!w)return;
      if(w.type==='resource'){const resource=graph.nodes.find(n=>n.key===w.key);if(resource&&resource.key!==row.key&&resource.target!=='fact')work(resource);}
      else if(w.type==='profile'){window.switchTab?.('settings');requestAnimationFrame(()=>{const b=$('#settingsProfileButton');if(b&&!b.disabled)b.click();});}
      else if(w.type==='target')window.dispatchEvent(new CustomEvent('prime:journey-open',{detail:'target'}));
      else if(w.type==='edit')window.PrimePersonalMindmap?.edit(w.category);
      else if(w.type==='consultation')window.PrimeStudyOnboarding?.open(w.step);
      else if(w.type==='chat')window.PrimeEduChat?.openConversation?.(w.id);
      else if(w.type==='timer'){window.switchTab?.('home');requestAnimationFrame(()=>[...document.querySelectorAll('[data-pomodoro-toggle]')].find(n=>n.getClientRects().length)?.focus({preventScroll:true}));}
      else if(w.type==='tab')window.switchTab?.(w.tab);
      else if(w.type==='notes')window.PrimeEduAI?.openCategory?.('notes','workspace');
      else{window.switchTab?.('progress');$('#personalLibrary')?.scrollIntoView({block:'start',behavior:'auto'});}
      return;
    }
    if(row.target==='subject'){
      const adjacent=graph.edges.filter(e=>e.source===row.key||e.target===row.key).map(e=>graph.nodes.find(n=>n.key===(e.source===row.key?e.target:e.source))).filter(n=>n&&n.target!=='subject');
      row=adjacent.find(n=>n.target==='note')||adjacent.find(n=>n.target==='quiz')||adjacent[0];if(!row)return;
    }
    if(row.target==='note'||row.target==='quiz')api().openLibraryItem(row.target,row.id);
    else if(row.target==='activity')window.dispatchEvent(new CustomEvent('prime:activity-open',{detail:{id:row.id,origin:[...document.querySelectorAll('[data-personal-open]')].find(b=>b.dataset.personalOpen===row.key)}}));
    else if(row.target==='books'){
      window.PrimeEduAI?.openCategory?.('books','workspace');requestAnimationFrame(()=>{const card=[...document.querySelectorAll('.book-recommendation-card')][Number(row.id)];if(card){card.tabIndex=-1;card.focus({preventScroll:true});card.scrollIntoView({block:'center',behavior:'auto'});}});
    }else if(row.target==='grades'||row.target==='target')window.dispatchEvent(new CustomEvent('prime:journey-open',{detail:row.target==='grades'?{id:'grades',year:row.year}:row.target}));
    else{
      const record=history.find(r=>r.key===row.id);
      if(record?.target)api().openHistoryRecord(row.id,[...document.querySelectorAll('[data-personal-open]')].find(b=>b.dataset.personalOpen===row.key));
      else if(record?.kind==='focus'){
        window.switchTab?.('home');requestAnimationFrame(()=>{const clock=[...document.querySelectorAll('[data-pomodoro-toggle]')].find(n=>n.getClientRects().length);clock?.scrollIntoView({block:'center',behavior:'auto'});clock?.focus({preventScroll:true});});
      }else{window.switchTab?.('progress');$('#studyHistoryList')?.scrollIntoView({block:'center',behavior:'auto'});}
    }
  }
  function init(){
    const host=$('#personalLibrary');if(!host)return;
    host.addEventListener('click',event=>{const button=event.target.closest('[data-personal-filter], #personalLibraryMore');if(!button)return;
      if(button.id==='personalLibraryMore'){limit+=8;render();return;}
      kind=button.dataset.personalFilter;limit=8;render();[...host.querySelectorAll('[data-personal-filter]')].find(b=>b.dataset.personalFilter===kind)?.focus({preventScroll:true});
    });
    host.addEventListener('click',e=>{const b=e.target.closest('[data-personal-open]');if(b)open(b.dataset.personalOpen,b);});
    $('#personalLibrarySearch').addEventListener('input',e=>{query=e.target.value;limit=8;render();});
    const dialog=$('#personalRecordDialog');
    dialog.addEventListener('click',e=>{
      if(e.target.closest('[data-personal-record-close]')){close();return;}
      const related=e.target.closest('[data-personal-related]');if(related){open(related.dataset.personalRelated);return;}
      const edit=e.target.closest('[data-personal-edit]');if(edit){const row=graph.nodes.find(n=>n.key===selected),category=edit.dataset.personalEdit;close();if(row?.work?.type==='consultation')window.PrimeStudyOnboarding?.open(row.work.step);else window.PrimePersonalMindmap?.edit(category);return;}
      const hide=e.target.closest('[data-personal-hide]');if(hide){window.PrimePersonalData?.hideFact(hide.dataset.personalHide);close();return;}
      const action=e.target.closest('[data-personal-work]');if(action){const row=graph.nodes.find(n=>n.key===action.dataset.personalWork);close();if(row){if(row.target!=='branch')window.PrimePersonalMindmap?.close();requestAnimationFrame(()=>work(row));}}
    });
    dialog.addEventListener('close',()=>{selected=null;if(originElement?.isConnected)originElement.focus({preventScroll:true});else [...document.querySelectorAll('[data-personal-open],[data-mind-item]')].find(n=>(n.dataset.personalOpen||n.dataset.mindItem)===originKey)?.focus({preventScroll:true});});
    ['schems:study-data','prime:study-owner-change','prime:grade-data','prime:personal-data'].forEach(name=>window.addEventListener(name,render));render();
  }
  window.PrimePersonalLibrary={open};
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
})();
