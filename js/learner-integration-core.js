(function(root){
  'use strict';
  const C=typeof module==='object'&&module.exports?require('./study-onboarding-core.js'):root.PrimeStudyOnboardingCore;
  const active=value=>{const c=C.clean(value);return ['draft','completed'].includes(c.status)?c:C.clean();};
  const dateKey=(date=new Date())=>{const p=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date),get=t=>p.find(v=>v.type===t).value;return `${get('year')}-${get('month')}-${get('day')}`;};
  const validDate=v=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(String(v)))return false;const d=new Date(v+'T00:00:00Z');return Number.isFinite(+d)&&d.toISOString().slice(0,10)===v;};
  const addDays=(key,n)=>new Date(+new Date(key+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
  const hash=text=>{let h=2166136261;for(const c of text)h=Math.imul(h^c.charCodeAt(0),16777619);return(h>>>0).toString(36);};
  function events(value,from=dateKey(),to,today=dateKey()){
    if(!validDate(from)||!validDate(today))return [];to=to||addDays(from,6);if(!validDate(to)||from>to)return [];
    // A current weekly plan is not proof of past attendance. Expand upcoming dates only.
    const c=active(value),rows=new Map();if(c.noAcademy)return [];
    for(const s of c.academy){const sid=hash(JSON.stringify([s.title,s.days,s.start,s.end]));let date=from<today?today:from;
      for(let count=0;date<=to&&count<120;date=addDays(date,1),count++){if(!s.days.includes(new Date(date+'T00:00:00Z').getUTCDay()))continue;
        const id=`academy-${sid}-${date}`;rows.set(id,{id,date,title:s.title,category:'event',source:'consultation',recurring:true,start:s.start,end:s.end,minutes:C.minute(s.end)-C.minute(s.start),memo:`${s.start}–${s.end} · 매주 ${s.days.map(d=>C.days[d]).join('·')}`,consultationSlot:sid});
      }
    }return [...rows.values()].sort((a,b)=>(a.date+a.start+a.title).localeCompare(b.date+b.start+b.title));
  }
  function defaults(value,subject=''){
    const c=active(value),subjects=Object.keys(c.progress).filter(s=>c.progress[s]);
    const mentioned=subjects.find(s=>c.concerns.includes(s)),chosen=subject||(mentioned||subjects.find(s=>s==='수학')||subjects[0]||'');
    const unit=c.progress[chosen]||'',short=c.habits.includes('짧게 나눠서')&&!c.habits.includes('한 번에 길게'),long=c.habits.includes('한 번에 길게')&&!c.habits.includes('짧게 나눠서');
    const focusMinutes=short?20:long?45:25,goal=c.goals.career||c.goals.university||c.goals.highSchool;
    const review=chosen?`${chosen} ${unit||'현재 진도'}${/복습\s*$/.test(unit)?'':' 복습'}`:'';
    return {subject:chosen,unit,focusMinutes,style:short?'짧고 강하게':c.habits.includes('계획부터')?'차근차근':'균형형',planGoal:[goal,review].filter(Boolean).join(' · ').slice(0,80),bookTopic:(c.goals.career||unit||goal).slice(0,80),bookCategory:c.goals.career?'진로':chosen==='수학'?'수학':'',bookPreference:short?'짧은 장으로 나누어 읽을 수 있는 구성':''};
  }
  function selfReport(value){const c=active(value);return {goals:c.goals,progress:c.progress,habits:c.habits,habitNote:c.habitNote};}
  function shouldFill(current,base,previous,touched=false){return !touched&&(current===''||current===base||previous!==undefined&&current===previous);}
  function schoolAlerts(school=[],activities=[],today=dateKey()){
    if(!validDate(today))return [];
    const rows=[...school.map(e=>({...e,sourceLabel:e.source==='neis'?'나이스 학사일정':e.sourceLabel||'학교 일정'})),...activities.filter(t=>!t.done).map(t=>({id:t.id,title:t.title,date:t.activity?.dueDate,activityId:t.id,sourceLabel:t.activity?.source?.label||'내 준비'}))],seen=new Set(),result=[];
    for(const e of rows){if(!validDate(e.date))continue;const days=Math.round((+new Date(e.date+'T00:00:00Z')-+new Date(today+'T00:00:00Z'))/86400000),title=String(e.title||'').trim();if(days<0||days>14||!title)continue;
      const type=/수행|발표|보고서|제출|과제/.test(title)?'수행':/시험|고사|중간|기말/.test(title)?'시험':/운동회|체육|축제|대회|학예|전시|체험/.test(title)?'행사':'';if(!type)continue;const id=title+':'+e.date;if(seen.has(id))continue;seen.add(id);result.push({...e,title,type,days,dday:days===0?'D-day':`D-${days}`,home:days<=(type==='시험'?14:3)});
    }return result.sort((a,b)=>a.days-b.days||a.title.localeCompare(b.title));
  }
  const api={active,dateKey,addDays,validDate,events,defaults,selfReport,shouldFill,schoolAlerts,days:C.days};if(typeof module==='object'&&module.exports)module.exports=api;else root.PrimeLearnerIntegrationCore=api;
})(typeof window==='object'?window:this);
