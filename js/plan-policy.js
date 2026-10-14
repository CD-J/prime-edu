(function(root){
  const core=typeof module==='object'&&module.exports?require('./connected-activity-core.js'):root.PrimeActivityCore;
  function intent(prompt,today=core.dateKey()){
    const text=String(prompt||'').normalize('NFKC'),duration=/(\d+(?:\.\d+)?)\s*시간(?:\s*(\d+)\s*분)?|(\d+)\s*분/.exec(text);
    const minutes=duration?Math.round(Number(duration[1]||0)*60+Number(duration[2]||duration[3]||0)):null;
    const explicit=/(\d{4}-\d{2}-\d{2})/.exec(text)?.[1];
    const day=explicit&&core.validDate(explicit)?explicit:/내일/.test(text)?core.addDays(today,1):today;
    return {mode:/오늘|내일|당일/.test(text)||Boolean(explicit)?'routine':'long',selectedDate:day,availableMinutes:minutes&&minutes<=300?minutes:null};
  }
  function constrain(tasks,payload){
    if(payload.mode!=='routine')return {tasks,unplaced:[]};
    let budget=Math.max(0,Math.floor(Number(payload.availableMinutes)||0));const placed=[],unplaced=[];
    for(const task of tasks){const requested=Math.max(1,Math.floor(Number(task.minutes)||30)),minutes=Math.min(budget,requested);if(minutes)placed.push({...task,minutes,date:payload.selectedDate});if(minutes<requested)unplaced.push({...task,minutes:requested-minutes});budget-=minutes;}
    return {tasks:placed,unplaced};
  }
  const api={intent,constrain};if(typeof module==='object'&&module.exports)module.exports=api;else root.PrimePlanPolicy=api;
})(typeof window==='object'?window:this);
