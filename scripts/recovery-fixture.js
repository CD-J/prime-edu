// Disposable synthetic data, injected ONLY by the isolated local QA server.
(() => {
  const key='schemsStudyAI.v2:guest';if(localStorage.getItem(key))return;
  const c=window.PrimeActivityCore,today=c.dateKey(),yesterday=c.addDays(today,-1);
  const input={title:'[예시] 과학 발표: 자료 조사와 발표 연습',dueDate:c.addDays(today,3),sourceText:'금요일까지 자료 조사, 발표 정리, 발표 연습을 준비하기. 실제 공지가 아닌 화면 검수용 예시입니다.',sourceLabel:'화면 검수용 안내',steps:[{title:'자료 조사',minutes:20},{title:'발표 정리',minutes:30},{title:'발표 연습',minutes:20}],availability:{windows:[{start:'19:00',end:'21:00'}],minutes:40},materials:[{kind:'note',id:'recovery-note',label:'[예시] 발표 조사 메모'}]};
  let a=c.create(input,'recovery-example',yesterday);a=c.record(a,a.blocks[0].id,{id:'example-done',minutes:16,outcome:'done'});a=c.record(a,a.blocks[1].id,{id:'example-partial',minutes:12,outcome:'partial'});
  let finished=c.create({...input,title:'[예시] 마친 독서 준비',steps:[{title:'독서 정리',minutes:15}],materials:[]},'finished-example',yesterday);finished=c.record(finished,finished.blocks[0].id,{id:'finished-session',minutes:10,outcome:'done'});
  localStorage.setItem(key,JSON.stringify({tasks:[{id:a.id,title:a.title,source:'activity',subject:'과학',date:yesterday,minutes:20,done:false,activity:a},{id:finished.id,title:finished.title,source:'activity',date:yesterday,minutes:0,done:true,activity:finished}],sessions:[{id:'example-partial',date:yesterday,title:'발표 정리',minutes:12,source:'activity',activityId:a.id,blockId:a.blocks[1].id,outcome:'partial'},{id:'example-done',date:yesterday,title:'자료 조사',minutes:16,source:'activity',activityId:a.id,blockId:a.blocks[0].id,outcome:'done'}],quizzes:[],attempts:[],diagnostics:[],notes:[{id:'recovery-note',title:'[예시] 발표 조사 메모',subject:'과학',text:'발표에서 사용할 자료를 요약한 예시 메모입니다. 실제 학생 자료는 포함하지 않습니다.',keywords:[],createdAt:new Date().toISOString()}]}));
  document.title='Prime Edu · 다시 시작하기 로컬 예시';
})();
