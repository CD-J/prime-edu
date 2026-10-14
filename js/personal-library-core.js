/* Reads only the active account's existing snapshot; never invents records. */
(function(root) {
  'use strict';
  const date = row => {
    const value = row.updatedAt || row.savedAt || row.createdAt;
    if (Number.isFinite(value?.seconds)) return value.seconds * 1000;
    return typeof value === 'string' && Number.isFinite(Date.parse(value)) ? Date.parse(value) : 0;
  };
  function build(snapshot = {}, history = []) {
    const rows = [], keys = new Set();
    const add = row => { if (!keys.has(row.key)) { keys.add(row.key); rows.push(row); } };
    (snapshot.notes || []).filter(n => n.id && !n.archivedAt).forEach(n => add({ key:`note:${n.id}`, kind:'notes', target:'note', id:n.id, title:n.title || n.subject || '개념노트', label:'개념노트', icon:'notebook', subtitle:[n.subject,n.unit].filter(Boolean).join(' · '), preview:n.summary || n.text || n.content || n.noteText || '', time:date(n) }));
    (snapshot.quizzes || []).filter(n => n.id && !n.archivedAt).forEach(n => add({ key:`quiz:${n.id}`, kind:'quizzes', target:'quiz', id:n.id, title:n.title || n.unit || '문제노트', label:'문제노트', icon:'quiz', subtitle:n.subject || '', preview:`${n.questions?.length || 0}문항`, time:date(n) }));
    (snapshot.tasks || []).filter(t => t.id && t.activity && !t.archivedAt).forEach(t => add({ key:`activity:${t.id}`, kind:'plans', target:'activity', id:t.id, title:t.title || t.activity.title || '내 준비', label:'내 준비', icon:'clipboard', subtitle:t.activity.dueDate ? `${t.activity.dueDate.slice(5).replace('-','/')} 마감` : '', preview:t.activity.steps?.filter(s => s.state !== 'done').map(s => s.title).join(' · ') || '준비 완료', time:date(t) }));
    (snapshot.bookRecommendations || []).forEach((b,i) => add({ key:`book:${b.id || i}`, kind:'books', target:'books', id:String(i), title:b.title || '추천 도서', label:'읽을 책', icon:'openBook', subtitle:b.author || '', preview:b.reason || b.description || '', time:date(b) }));
    const exams=new Map();
    (snapshot.gradeRecords||[]).forEach(r=>{const key=[r.year,r.term,r.recordType,r.exam||'rank',r.gradeSystem||'score'].join(':');if(!exams.has(key))exams.set(key,[]);exams.get(key).push(r);});
    exams.forEach((values,key)=>{const first=values[0],title=`${first.year}학년 · ${first.term}학기 ${first.recordType==='exam-score'?(first.exam==='mid'?'중간':'기말'):'내신'}`;add({key:`grade:${key}`,kind:'grades',target:'grades',id:key,year:first.year,title,label:'성적',icon:'chart',subtitle:`${values.length}과목`,preview:values.map(r=>`${r.subject} ${r.recordType==='exam-score'?r.score+'점':r.rank+'등급'}`).join(' · '),time:0});});
    if(snapshot.gradeFeedback?.summary)add({key:'grade:feedback',kind:'grades',target:'target',id:'feedback',title:'성적 피드백',label:'분석',icon:'chart',subtitle:snapshot.gradeFeedback.dataAsOf||'',preview:snapshot.gradeFeedback.summary,time:0});
    history.forEach(row => add({ key:`record:${row.key}`, kind:'records', target:'record', id:row.key, title:row.title, label:row.label, icon:row.icon || 'history', subtitle:[row.date?.slice(5).replace('-','/'),row.metric].filter(Boolean).join(' · '), preview:row.content || row.feedback || row.context || row.status || '', time:row.time || 0 }));
    return rows.sort((a,b) => b.time - a.time || a.key.localeCompare(b.key));
  }
  function select(rows, kind = 'all', query = '') {
    const q = String(query).trim().toLocaleLowerCase();
    return rows.filter(row => (kind === 'all' || row.kind === kind) && (!q || [row.title,row.subtitle,row.preview,row.label].some(value => String(value || '').toLocaleLowerCase().includes(q))));
  }
  function graph(snapshot = {}, history = []) {
    const documents=build(snapshot,history),nodes=[...documents],ids=new Set(nodes.map(n=>n.key)),edges=new Map();
    function link(a,b,label){if(a===b||!ids.has(a)||!ids.has(b))return;const key=[a,b].sort().join('|');if(!edges.has(key))edges.set(key,{key,source:a,target:b,label});}
    function subject(name,key){name=String(name||'').trim();if(!name||!ids.has(key))return;const id=`subject:${name}`;if(!ids.has(id)){ids.add(id);nodes.push({key:id,kind:'subjects',target:'subject',id:name,title:name,label:'과목',icon:'study',subtitle:'연결된 기록',preview:'',time:0});}link(id,key,'같은 과목');}
    (snapshot.notes||[]).filter(n=>!n.archivedAt).forEach(n=>subject(n.subject,`note:${n.id}`));
    (snapshot.quizzes||[]).filter(n=>!n.archivedAt).forEach(q=>{subject(q.subject,`quiz:${q.id}`);if(q.sourceNoteId||q.noteId)link(`quiz:${q.id}`,`note:${q.sourceNoteId||q.noteId}`,'출처 노트');});
    (snapshot.tasks||[]).forEach(t=>{if(!t.activity)return;for(const m of t.activity.materials||[]){if(['note','quiz'].includes(m.kind))link(`activity:${t.id}`,`${m.kind}:${m.id}`,'연결한 자료');}});
    history.forEach(r=>{if(r.target)link(`record:${r.key}`,`${r.target.kind==='activity'?'activity':r.target.kind}:${r.target.id}`,'공부한 자료');});
    (snapshot.gradeRecords||[]).forEach(r=>{const key=[r.year,r.term,r.recordType,r.exam||'rank',r.gradeSystem||'score'].join(':');subject(r.subject,`grade:${key}`);if(snapshot.gradeFeedback?.summary)link('grade:feedback',`grade:${key}`,'분석에 사용한 성적');});
    return {documents,nodes,edges:[...edges.values()]};
  }
  // Deterministic spring layout: no random data or external graph service.
  function layout(nodes,edges,width,height) {
    if(nodes.length===1)return [{key:nodes[0].key,x:0,y:0}];
    const positions=nodes.map((n,i)=>({key:n.key,x:Math.cos(i*2.39996)*Math.sqrt((i+1)/nodes.length)*width*.36,y:Math.sin(i*2.39996)*Math.sqrt((i+1)/nodes.length)*height*.36}));
    const byKey=new Map(positions.map(p=>[p.key,p]));
    for(let pass=0;pass<150;pass++){
      const movement=positions.map(p=>({x:-p.x*.003,y:-p.y*.003}));
      for(let i=0;i<positions.length;i++)for(let j=i+1;j<positions.length;j++){
        const a=positions[i],b=positions[j],dx=a.x-b.x,dy=a.y-b.y,d=Math.hypot(dx,dy)||1;
        const separation=width<500?62:90;
        const force=Math.min(8,4200/(d*d))+(d<separation?(separation-d)*.16:0);
        movement[i].x+=dx/d*force;movement[i].y+=dy/d*force;movement[j].x-=dx/d*force;movement[j].y-=dy/d*force;
      }
      for(const e of edges){const a=byKey.get(e.source),b=byKey.get(e.target);if(!a||!b)continue;const i=positions.indexOf(a),j=positions.indexOf(b),dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1,force=(d-(width<500?84:118))*.018;movement[i].x+=dx/d*force;movement[i].y+=dy/d*force;movement[j].x-=dx/d*force;movement[j].y-=dy/d*force;}
      const edge=width<500?62:100;
      positions.forEach((p,i)=>{p.x=Math.max(-width*.5+edge,Math.min(width*.5-edge,p.x+movement[i].x));p.y=Math.max(-height*.5+42,Math.min(height*.5-42,p.y+movement[i].y));});
    }
    if(positions.length>1){
      const xs=positions.map(p=>p.x),ys=positions.map(p=>p.y),spanX=Math.max(...xs)-Math.min(...xs),spanY=Math.max(...ys)-Math.min(...ys),cx=(Math.max(...xs)+Math.min(...xs))/2,cy=(Math.max(...ys)+Math.min(...ys))/2;
      const factor=Math.min((width-(width<500?124:200))/Math.max(1,spanX),(height-90)/Math.max(1,spanY));
      positions.forEach(p=>{p.x=(p.x-cx)*factor;p.y=(p.y-cy)*factor;});
    }
    return positions;
  }
  const api = {build,select,graph,layout};
  if (typeof module === 'object' && module.exports) module.exports = api; else root.PrimePersonalLibraryCore = api;
})(typeof window === 'object' ? window : this);
