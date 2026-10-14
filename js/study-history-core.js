/* A read-only timeline of actual work. No synthetic completion or mastery. */
(function(root){
  const outcomes={done:'끝냈어',partial:'일부만 했어',more:'더 준비해야 해',missed:'못 했어'};
  function validDay(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(String(value)))return false;const d=new Date(`${value}T00:00:00Z`);return Number.isFinite(+d)&&d.toISOString().slice(0,10)===value;}
  function stamp(row){
    const v=row.createdAt;
    if(Number.isFinite(v?.seconds)&&Math.abs(v.seconds)<8640000000000)return v.seconds*1000+(Number.isFinite(v.nanoseconds)&&v.nanoseconds>=0&&v.nanoseconds<1e9?v.nanoseconds/1e6:0);
    if(typeof v==='string'&&/T.*(?:Z|[+-]\d{2}:?\d{2})$/.test(v)&&Number.isFinite(Date.parse(v)))return Date.parse(v);
    const day=validDay(row.date)?row.date:validDay(v)?v:null;
    return day?Date.parse(`${day}T00:00:00+09:00`):0;
  }
  function parts(time,row){
    if(!time)return {date:validDay(row.date)?row.date:'',clock:''};
    const p=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(time)),get=n=>p.find(v=>v.type===n).value;
    const hasClock=typeof row.createdAt==='object'||typeof row.createdAt==='string'&&row.createdAt.includes('T');
    return {date:`${get('year')}-${get('month')}-${get('day')}`,clock:hasClock?`${get('hour')}:${get('minute')}`:''};
  }
  function duration(seconds){if(!Number.isFinite(seconds)||seconds<0)return '';const n=Math.round(seconds),m=Math.floor(n/60),s=n%60;return m?`${m}분${s?` ${s}초`:''}`:`${s}초`;}
  function build(data={}){
    const tasks=data.tasks||[],quizzes=data.quizzes||[],notes=data.notes||[],rows=new Map();
    const add=row=>{const old=rows.get(row.key);if(!old||row.time>old.time)rows.set(row.key,row);};
    (data.sessions||[]).forEach((s,i)=>{
      if(!s||typeof s!=='object')return;
      const time=stamp(s),when=parts(time,s),task=tasks.find(t=>t?.id===s.activityId&&t?.activity),quiz=quizzes.find(q=>q?.id===s.quizId&&!q?.archivedAt),note=notes.find(n=>n?.id===s.noteId&&!n?.archivedAt);
      const kind=s.source==='activity'?'activity':s.source==='review'?'review':s.source==='pomodoro'?'focus':'memo';
      const step=task?.activity.steps?.find(v=>v.id===task.activity.blocks?.find(b=>b.id===s.blockId)?.stepId);
      const content=typeof s.content==='string'?s.content:typeof s.done==='string'&&!Object.values(outcomes).includes(s.done)?s.done:'';
      const row={key:`session:${s.id||'legacy-'+i}`,id:s.id,time,...when,kind,label:({activity:'내 준비',review:'오답 복습',focus:'집중',memo:'공부 메모'})[kind],icon:({activity:'clipboard',review:'review',focus:'clock',memo:'notebook'})[kind],title:String(s.title||task?.title||quiz?.title||'공부 기록'),metric:duration(Number.isFinite(s.minutes)?s.minutes*60:NaN),status:outcomes[s.outcome]||(kind==='focus'&&s.completed===true?'집중 마침':''),context:step?.title||'',content,feedback:typeof s.feedback==='string'?s.feedback:'',target:task?{kind:'activity',id:task.id}:quiz?{kind:'quiz',id:quiz.id}:note?{kind:'note',id:note.id}:null,missing:Boolean(s.activityId||s.quizId||s.noteId)&&!task&&!quiz&&!note};
      if(kind==='review'){
        row.key=`review:${s.quizId||s.id||i}:${when.date||'unknown'}`;row.metric='1문항 복습';row.reviewIds=[s.id||'legacy-'+i];row.reviewCount=1;row.status='';
        const old=rows.get(row.key);if(old){if(old.reviewIds.includes(row.reviewIds[0]))return;row.reviewIds=[...old.reviewIds,...row.reviewIds];row.reviewCount=old.reviewCount+1;row.metric=`${row.reviewCount}문항 복습`;if(old.time>row.time){row.time=old.time;row.clock=old.clock;}rows.set(row.key,row);return;}
      }
      add(row);
    });
    (data.attempts||[]).forEach((a,i)=>{
      if(!a||a.kind==='review')return;
      const quiz=quizzes.find(q=>q?.id===a.quizId),available=quiz&&!quiz.archivedAt,time=stamp(a),score=Number.isFinite(a.score)&&Number.isFinite(a.total)&&a.total>0&&a.score>=0&&a.score<=a.total?`${a.score}/${a.total}문항`:'';
      add({key:`attempt:${a.id||'legacy-'+i}`,id:a.id,time,...parts(time,a),kind:'quiz',label:'문제 풀이',icon:'quiz',title:String(a.title||quiz?.title||quiz?.unit||'문제 풀이'),metric:score,status:duration(a.durationSec),context:quiz?.subject||'',content:'',feedback:typeof a.feedback==='string'?a.feedback:'',target:available?{kind:'quiz',id:quiz.id,attemptId:a.id}:null,missing:!available});
    });
    return [...rows.values()].sort((a,b)=>b.time-a.time||a.key.localeCompare(b.key));
  }
  const api={build,stamp,duration,validDay};if(typeof module==='object'&&module.exports)module.exports=api;else root.PrimeStudyHistory=api;
})(typeof window==='object'?window:this);
