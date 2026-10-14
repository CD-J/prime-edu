(function(root){
  'use strict';
  const holiday=/공휴일|휴업|휴교|휴일|한글날|개천절|광복절|삼일절|어린이날|현충일|성탄절|크리스마스|추석|설날|신정|방학/;
  const exam=/시험|고사|수능|평가일/;
  const special=/체험학습|체육한마당|운동회|축제|졸업식|입학식|종업식|방학식/;
  const classify=title=>holiday.test(title)?'holiday':exam.test(title)?'exam':special.test(title)?'special':'';
  function dateKey(raw){const s=String(raw||'');return /^\d{8}$/.test(s)?s.slice(0,4)+'-'+s.slice(4,6)+'-'+s.slice(6):s;}
  function coordinates(row){const date=dateKey(row.date),d=new Date(date+'T00:00:00'),day=d.getDay()-1,p=Number(row.period)-1;return {date,day,p};}
  function normalMatrix(rows,cached=[]){
    const valid=rows.filter(r=>{const c=coordinates(r);return c.day>=0&&c.day<5&&Number.isInteger(c.p)&&c.p>=0&&c.p<12;});
    const n=Math.max(7,Math.min(12,cached.length),...valid.map(r=>Number(r.period)));
    const matrix=Array.from({length:n},(_,p)=>Array.from({length:5},(_,d)=>classify(String(cached[p]?.[d]||''))?'':String(cached[p]?.[d]||'')));
    const days=new Map();
    valid.forEach(r=>{const c=coordinates(r);if(!days.has(c.date))days.set(c.date,[]);days.get(c.date).push(r);});
    const latest=new Map();
    [...days].sort(([a],[b])=>a.localeCompare(b)).forEach(([date,items])=>{
      // An exceptional date must never become the saved regular weekly schedule.
      if(items.some(r=>classify(String(r.subject||''))))return;
      if(items.filter(r=>String(r.subject||'').trim()).length<3)return;
      latest.set(coordinates(items[0]).day,items);
    });
    latest.forEach((items,day)=>{matrix.forEach(row=>row[day]='');items.forEach(r=>{matrix[Number(r.period)-1][day]=String(r.subject||'').trim();});});
    return matrix;
  }
  function displayMatrix(normal,weekRows){
    const matrix=normal.map(row=>[...row]);
    weekRows.forEach(r=>{const c=coordinates(r);if(classify(String(r.subject||''))==='exam'&&c.day>=0&&c.day<5&&matrix[c.p])matrix[c.p][c.day]=String(r.subject);});
    return matrix;
  }
  function weekHolidays(base,events){
    const start=new Date(base);start.setDate(start.getDate()+(start.getDay()===0?-6:1-start.getDay()));
    return Array.from({length:5},(_,day)=>{const d=new Date(start);d.setDate(d.getDate()+day);const key=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');return events.filter(e=>classify(String(e.title||''))==='holiday'&&e.date<=key&&(e.endDate||e.date)>=key).map(e=>e.title).join(' · ');});
  }
  const api={classify,dateKey,normalMatrix,displayMatrix,weekHolidays};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PrimeTimetable=api;
})(typeof window==='undefined'?globalThis:window);
