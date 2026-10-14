/* Program-owned dates, budgets, dependencies and immutable plan proposals. */
(function(root){
  const clone = value => JSON.parse(JSON.stringify(value));
  function dateKey(date=new Date()) {
    const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
    const value=type=>parts.find(p=>p.type===type).value;
    return `${value('year')}-${value('month')}-${value('day')}`;
  }
  function validDate(key){if(!/^\d{4}-\d{2}-\d{2}$/.test(String(key)))return false;const d=new Date(`${key}T12:00:00+09:00`);return !Number.isNaN(+d)&&dateKey(d)===key;}
  function addDays(key,n){if(!validDate(key))throw Error('날짜를 확인해주세요.');return dateKey(new Date(+new Date(`${key}T12:00:00+09:00`)+n*86400000));}
  function time(value){if(!/^\d{2}:\d{2}$/.test(String(value)))throw Error('시간을 확인해주세요.');const[h,m]=value.split(':').map(Number);if(h>23||m>59)throw Error('시간을 확인해주세요.');return h*60+m;}
  const timeText=n=>`${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;
  function validateAvailability(value){
    const checkWindows=windows=>{if(!Array.isArray(windows)||!windows.length||windows.length>4||windows.some(w=>time(w.start)<360||time(w.end)>1380||time(w.end)<=time(w.start)))throw Error('가능 시간은 06:00~23:00 사이로 확인해주세요.');};
    const checkMinutes=minutes=>{if(!Number.isInteger(minutes)||minutes<0||minutes>300)throw Error('하루 준비 시간은 0~300분으로 확인해주세요.');};
    if(!value||typeof value!=='object')throw Error('가능 시간을 확인해주세요.');
    checkWindows(value.windows);checkMinutes(value.minutes);
    for(const [date,exception] of Object.entries(value.exceptions||{})){if(!validDate(date)||!exception||typeof exception!=='object')throw Error('날짜별 가능 시간을 확인해주세요.');if(exception.windows!==undefined)checkWindows(exception.windows);if(exception.minutes!==undefined)checkMinutes(exception.minutes);}
    if(value.busy!==undefined&&(!Array.isArray(value.busy)||value.busy.length>8))throw Error('고정 시간은 최대 8개까지 정할 수 있어요.');
    for(const b of value.busy||[]){
      if(!String(b.title||'').trim()||String(b.title).length>60||!Array.isArray(b.days)||!b.days.length||b.days.some(d=>!Number.isInteger(d)||d<0||d>6)||new Set(b.days).size!==b.days.length)throw Error('고정 시간의 이름과 요일을 확인해주세요.');
      checkWindows([b]);
    }
    return value;
  }
  function busySlots(day,availability){
    const weekday=new Date(`${day}T00:00:00Z`).getUTCDay();
    return (availability.busy||[]).filter(b=>b.days.includes(weekday)).map(b=>({date:day,start:b.start,minutes:time(b.end)-time(b.start),title:b.title,source:'student-busy'}));
  }
  function slots(day,availability,fixed=[]){
    const setting={...availability,...availability.exceptions?.[day]};
    let windows=(setting.windows||[]).map(w=>[time(w.start),time(w.end)]).filter(([a,b])=>b>a&&a>=360&&b<=1380).sort((a,b)=>a[0]-b[0]);
    const merged=[];for(const w of windows){const last=merged.at(-1);if(last&&w[0]<=last[1])last[1]=Math.max(last[1],w[1]);else merged.push(w);}windows=merged;
    [...fixed.filter(b=>b.date===day),...busySlots(day,availability)].forEach(b=>{const a=time(b.start),z=a+Number(b.minutes);windows=windows.flatMap(([x,y])=>a>=y||z<=x?[[x,y]]:[[x,Math.min(a,y)],[Math.max(z,x),y]].filter(([i,j])=>j>i));});
    return {windows,cap:Math.max(0,Math.min(300,Number(setting.minutes)||0))};
  }
  function propose(activity,{today=dateKey(),dueDate=activity.dueDate,availability=activity.availability,fixed=[],notBeforeMinutes=0}={}){
    if(!validDate(today)||!validDate(dueDate))throw Error('마감 날짜를 확인해주세요.');
    validateAvailability(availability);
    const old=activity.blocks||[],kept=old.filter(b=>b.state==='done'||b.state==='active'||b.locked).map(clone);
    const pending=activity.steps.filter(s=>s.state!=='done').map(s=>({...s,left:Math.max(0,s.minutes-(s.completedMinutes||0)-kept.filter(b=>b.stepId===s.id&&b.state!=='done').reduce((n,b)=>n+b.minutes,0))}));
    const blocks=[...kept],unplaced=[],avoided=[];let seq=0;
    // Date-only deadlines are conservatively prepared BEFORE the deadline day.
    const horizon=Math.min(90,Math.max(0,Math.ceil((+new Date(`${dueDate}T12:00:00+09:00`)-+new Date(`${today}T12:00:00+09:00`))/86400000)));
    let stepIndex=0;
    for(let offset=0;offset<horizon;offset++){
      const date=addDays(today,offset),day=slots(date,availability,[...fixed,...kept]);
      const base=slots(date,{...availability,busy:[]}).windows;
      busySlots(date,availability).filter(b=>base.some(([start,end])=>time(b.start)<end&&time(b.start)+b.minutes>Math.max(start,offset===0?notBeforeMinutes:0))).forEach(b=>avoided.push(b));
      let budget=Math.max(0,day.cap-[...kept,...fixed].filter(b=>b.date===date).reduce((n,b)=>n+b.minutes,0));
      for(const[start,end]of day.windows){let cursor=Math.max(start,offset===0?notBeforeMinutes:0);while(cursor<end&&budget>0&&stepIndex<pending.length){
        const step=pending[stepIndex];if(step.left<=0){stepIndex++;continue;}
        const stepOrder=activity.steps.findIndex(s=>s.id===step.id),priorIds=new Set(activity.steps.slice(0,stepOrder).map(s=>s.id));
        const previous=blocks.filter(b=>priorIds.has(b.stepId)&&b.state!=='done').sort((a,b)=>(b.date+b.start).localeCompare(a.date+a.start))[0];
        if(previous){if(previous.date>date)break;if(previous.date===date)cursor=Math.max(cursor,time(previous.start)+previous.minutes);}
        const minutes=Math.min(60,step.left,end-cursor,budget);if(minutes<=0)break;
        blocks.push({id:`${activity.id}:v${activity.version+1}:${seq++}`,stepId:step.id,date,start:timeText(cursor),minutes,state:'planned',locked:false});
        cursor+=minutes;budget-=minutes;step.left-=minutes;if(!step.left)stepIndex++;
      }}
    }
    pending.filter(s=>s.left>0).forEach(s=>unplaced.push({stepId:s.id,title:s.title,minutes:s.left}));
    const warnings=kept.filter(b=>b.state!=='done'&&b.date>=dueDate).map(b=>({blockId:b.id,reason:'완료·진행 중·고정 블록은 이동하지 않았어요. 새 마감을 확인해주세요.'}));
    kept.filter(b=>b.state!=='done').forEach(b=>{try{const available=slots(b.date,availability,fixed);const from=time(b.start);if(!available.windows.some(([a,z])=>from>=a&&from+b.minutes<=z))warnings.push({blockId:b.id,reason:'고정 블록과 가능한 시간이 겹치지 않아요.'});}catch{warnings.push({blockId:b.id,reason:'기존 블록 시간을 확인해주세요.'});}});
    for(const date of new Set(kept.map(b=>b.date))){const cap=slots(date,availability,fixed).cap;if(kept.filter(b=>b.date===date).reduce((n,b)=>n+b.minutes,0)>cap)warnings.push({reason:`${date} 완료·진행·고정 분량이 가능한 시간을 넘어요. 이동하지 않고 남겨두었어요.`});}
    return {activityId:activity.id,baseVersion:activity.version,dueDate,availability:clone(availability),blocks,unplaced,warnings,avoided,
      missingMinutes:unplaced.reduce((n,b)=>n+b.minutes,0),keptIds:kept.map(b=>b.id),reason:dueDate!==activity.dueDate?'마감 변경':'가능 시간에 맞춰 남은 준비 배치'};
  }
  function accept(activity,proposal){if(activity.id!==proposal.activityId||activity.version!==proposal.baseVersion)throw Error('기록이 바뀌었어요. 조정안을 다시 확인해주세요.');
    const next=clone(activity);next.history=[...(next.history||[]),{version:next.version,dueDate:next.dueDate,availability:next.availability,blocks:next.blocks,unplaced:next.unplaced,needsReplan:Boolean(next.needsReplan),stepSignature:JSON.stringify(next.steps),sessionCount:next.sessionIds.length}].slice(-10);
    next.dueDate=proposal.dueDate;next.availability=clone(proposal.availability);next.blocks=clone(proposal.blocks);next.unplaced=clone(proposal.unplaced);next.needsReplan=false;next.version++;return next;}
  function undo(activity){const previous=activity.history?.at(-1);if(!previous)throw Error('되돌릴 계획이 없어요.');
    if(previous.sessionCount!==undefined&&previous.sessionCount!==activity.sessionIds.length)throw Error('실행 기록이 생겨 이전 계획으로 되돌릴 수 없어요. 새 조정안을 확인해주세요.');
    if(previous.stepSignature!==undefined&&previous.stepSignature!==JSON.stringify(activity.steps))throw Error('남은 분량이 바뀌었어요. 새 조정안을 확인해주세요.');
    if(activity.blocks.some(b=>['done','active'].includes(b.state)&&!previous.blocks.some(p=>p.id===b.id&&p.state===b.state)))throw Error('실행 기록이 생겨 이전 계획으로 되돌릴 수 없어요. 새 조정안을 확인해주세요.');
    // New work after acceptance must never be erased by an older snapshot.
    const preserved=activity.blocks.filter(b=>b.state==='done'||b.state==='active'||b.locked),ids=new Set(preserved.map(b=>b.id));
    const next=clone(activity);next.dueDate=previous.dueDate;next.availability=clone(previous.availability);next.blocks=[...preserved,...previous.blocks.filter(b=>!ids.has(b.id)&&!['done','active'].includes(b.state)&&next.steps.find(s=>s.id===b.stepId)?.state!=='done')];next.history=next.history.slice(0,-1);next.unplaced=clone(previous.unplaced||[]);next.needsReplan=Boolean(previous.needsReplan);next.version++;return next;}
  function create(input,id,today=dateKey(),fixed=[],notBeforeMinutes=0){
    const title=String(input.title||'').trim(),text=String(input.sourceText||'').trim();
    if(!title||title.length>100||!text||text.length>8000)throw Error('제목과 원문을 확인해주세요.');
    if(!validDate(input.dueDate))throw Error('마감일을 확인해주세요.');
    const steps=(input.steps||[]).slice(0,20).map((s,i)=>({id:`${id}:step:${i}`,title:String(s.title||'').trim().slice(0,160),minutes:Number(s.minutes),state:'planned',completedMinutes:0}));
    if(!steps.length||steps.some(s=>!s.title||!Number.isInteger(s.minutes)||s.minutes<1||s.minutes>600))throw Error('준비 단계와 예상 시간을 확인해주세요.');
    const activity={id,title,version:0,dueDate:input.dueDate,dueKind:'date',timeZone:'Asia/Seoul',source:{type:'manual',label:String(input.sourceLabel||'직접 가져온 안내').slice(0,100),text,url:safeUrl(input.sourceUrl),date:input.dueDate,status:'student-entered',revision:1,recordedAt:new Date().toISOString()},steps,blocks:[],unplaced:[],availability:clone(input.availability),materials:(input.materials||[]).slice(0,20),history:[],sessionIds:[]};
    const created=accept(activity,propose(activity,{today,fixed,notBeforeMinutes}));created.history=[];return created;
  }
  function safeUrl(value){if(!value)return '';try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)?u.href:'';}catch{return '';}}
  function record(activity,blockId,session){const next=clone(activity),block=next.blocks.find(b=>b.id===blockId);if(!block)throw Error('준비 블록을 찾을 수 없어요.');if(next.sessionIds.includes(session.id))return next;
    if(block.state==='done')throw Error('이미 끝낸 준비예요.');if(!['done','partial','more','missed'].includes(session.outcome))throw Error('진행 결과를 확인해주세요.');
    const step=next.steps.find(s=>s.id===block.stepId);if(!step)throw Error('준비 단계를 찾을 수 없어요.');
    block.state=session.outcome==='done'?'done':'planned';block.lastOutcome=session.outcome;block.actualMinutes=(block.actualMinutes||0)+Math.max(0,Number(session.minutes)||0);
    if(session.outcome==='done'){step.completedMinutes=Math.min(step.minutes,(step.completedMinutes||0)+block.minutes);step.state=step.completedMinutes>=step.minutes?'done':'planned';}
    next.sessionIds.push(session.id);next.version++;return next;
  }
  function isActivity(value){try{return Boolean(value&&value.id&&Number.isInteger(value.version)&&validDate(value.dueDate)&&value.source&&typeof value.source.text==='string'&&validateAvailability(value.availability)&&Array.isArray(value.steps)&&value.steps.length&&value.steps.every(s=>s.id&&s.title&&Number.isFinite(s.minutes))&&Array.isArray(value.blocks)&&value.blocks.every(b=>b.id&&validDate(b.date)&&Number.isFinite(b.minutes)&&['planned','active','done'].includes(b.state)&&Number.isFinite(time(b.start)))&&Array.isArray(value.materials)&&Array.isArray(value.unplaced)&&Array.isArray(value.history)&&Array.isArray(value.sessionIds));}catch{return false;}}
  // Student-estimated work is separate from elapsed time and completed work.
  function estimateRemaining(activity,stepId,minutes){
    const next=clone(activity),step=next.steps.find(s=>s.id===stepId);minutes=Number(minutes);
    if(!step||step.state==='done'||!Number.isInteger(minutes)||minutes<1||minutes>600)throw Error('남은 시간은 1~600분으로 확인해주세요.');
    if(next.blocks.some(b=>b.state==='active'))throw Error('진행 중인 준비를 먼저 마쳐주세요.');
    step.initialMinutes??=step.minutes;step.minutes=(step.completedMinutes||0)+minutes;
    step.remainingEstimate={minutes,recordedAt:new Date().toISOString(),source:'student'};
    next.needsReplan=true;next.version++;return next;
  }
  function recovery(activity,{today=dateKey(),nowMinutes=0}={}){
    const open=activity.blocks.filter(b=>b.state!=='done').sort((a,b)=>(a.date+a.start).localeCompare(b.date+b.start));
    const active=open.find(b=>b.state==='active'),missed=open.filter(b=>b.state!=='active'&&(b.date<today||b.date===today&&time(b.start)+b.minutes<=nowMinutes));
    const remaining=activity.steps.filter(s=>s.state!=='done').reduce((n,s)=>n+Math.max(0,s.minutes-(s.completedMinutes||0)),0);
    const shortage=activity.unplaced.reduce((n,s)=>n+s.minutes,0),expired=remaining>0&&activity.dueDate<=today;
    const needsRecovery=!active&&remaining>0&&Boolean(activity.needsReplan||missed.length||shortage||expired);
    const next=active||open.find(b=>b.date>=today&&(b.date>today||time(b.start)+b.minutes>nowMinutes))||open[0]||null;
    const reason=activity.needsReplan?'남은 분량이 바뀌었어요':expired?'마감을 다시 확인해요':missed.length?'지난 준비를 다시 배치해요':shortage?'배치할 시간이 부족해요':'';
    return {remaining,shortage,missedMinutes:missed.reduce((n,b)=>n+b.minutes,0),needsRecovery,expired,active:Boolean(active),next,reason};
  }
  const api={dateKey,validDate,addDays,time,timeText,slots,propose,accept,undo,create,record,safeUrl,isActivity,estimateRemaining,recovery,validateAvailability,busySlots};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.PrimeActivityCore=api;
})(typeof window==='object'?window:this);
