// Only injected on the isolated QA origin. Uses the normal public save pipeline.
document.addEventListener('DOMContentLoaded',()=>{
  const footer=document.querySelector('#personalMindView .personal-mind-foot');if(!footer)return;
  const button=document.createElement('button');button.type='button';button.textContent='+';button.setAttribute('aria-label','[예시] 공부 기록 추가');button.title='합성 기록 추가 · 실제 계정에 저장하지 않음';
  button.addEventListener('click',async()=>{button.disabled=true;try{await window.SchemsStudyAI.addStudySession({id:'qa-growth-'+Date.now(),title:'[예시] 새 복습 기록',source:'review',noteId:'linked-note',minutes:15,completed:true});}finally{button.disabled=false;}});footer.append(button);
});
