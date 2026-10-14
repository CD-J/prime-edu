// Synthetic calendar data on an isolated localhost origin; never deployed.
(() => {
  const mode=new URLSearchParams(location.search).get('calendarqa'),d=new Date(),y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),date=day=>`${y}-${m}-${String(day).padStart(2,'0')}`;
  if(mode!=='dense'&&mode!=='empty')return;
  const events=mode==='empty'?[]:[...Array.from({length:20},(_,i)=>({id:`calendar-qa-${i}`,date:date(10),title:i?'과학 탐구와 독서 토론의 아주 긴 일정 제목':'1차 정기시험',type:'검수 일정'})),{id:'calendar-qa-range',date:date(11),endDate:date(13),title:'체험학습(여)'},...Array.from({length:15},(_,i)=>({id:`notification-qa-${i}`,date:date(d.getDate()),title:'과학 탐구와 독서 토론의 아주 긴 일정 제목을 끝까지 읽을 수 있어야 해요 '+i,type:'검수 일정'}))];
  window.PrimeCalendarFixture={events};
  localStorage.setItem('classPlannerData.v3',JSON.stringify({events,meals:mode==='empty'?{}:{[date(10)]:'검수용 급식'}}));
  localStorage.setItem('schemsLocalPlanEvents.v1',JSON.stringify(mode==='empty'?[]:Array.from({length:20},(_,i)=>({id:`calendar-task-${i}`,date:date(10),title:'수학 오답을 다시 풀고 풀이 과정을 정리하는 매우 긴 체크리스트',category:'checklist',minutes:30}))));
  localStorage.setItem('schemsPlanChecks.v1',JSON.stringify(Object.fromEntries(Array.from({length:10},(_,i)=>[`personal:local:calendar-task-${i}`,true]))));
})();
