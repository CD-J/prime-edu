(function(root){
  'use strict';
  const behavior=typeof module==='object'&&module.exports?require('./personal-behavior-core.js'):root.PrimePersonalBehaviorCore;
  const consultationCore=typeof module==='object'&&module.exports?require('./study-onboarding-core.js'):root.PrimeStudyOnboardingCore;
  const groups=[['school','학교','school'],['goals','목표','target'],['traits','나의 성향','user'],['habits','공부 습관','clock'],['interests','관심사','openBook'],['activity','앱 활동','chart'],['learning','학습 현황','study']];
  const text=(v,n=100)=>String(v||'').trim().slice(0,n);
  function cleanStore(value={}){
    value=value&&typeof value==='object'?value:{};
    const actions={};Object.entries(value.actions||{}).slice(0,180).forEach(([key,n])=>{if(/^(tab|action):[a-zA-Z0-9_-]{1,70}$/.test(key)&&Number.isInteger(n)&&n>0)actions[key]=Math.min(n,1e6);});
    const manual={};for(const key of ['name','traits','habits','goals','interests'])if(typeof value.manual?.[key]==='string')manual[key]=text(value.manual[key],key==='name'?30:240);
    const facts=(Array.isArray(value.facts)?value.facts:[]).filter(f=>f&&['goals','traits','habits','interests'].includes(f.category)&&f.title&&f.sourceId&&f.quote).slice(-256).map(f=>({category:f.category,title:text(f.title,70),sourceId:text(f.sourceId,160),quote:text(f.quote,350)}));
    const safe={version:2,manual,actions,facts,hidden:(Array.isArray(value.hidden)?value.hidden:[]).filter(v=>typeof v==='string').slice(-100).map(v=>text(v,240)),tracking:value.tracking!==false,chatSignature:text(value.chatSignature,60),updatedAt:text(value.updatedAt,40),...behavior.normalize(value)};
    // Compact rolling detail before this account preference reaches cloud limits.
    const bytes=()=>new TextEncoder().encode(JSON.stringify(safe)).length;
    if(bytes()>700000){safe.trace=[];while(safe.activity.length&&bytes()>700000)safe.activity.splice(0,100);if(bytes()>700000)for(const p of safe.patterns)p.evidence=p.evidence.slice(-4);if(bytes()>700000)for(const p of safe.patterns)p.evidence=p.evidence.slice(-1).map(r=>({...r,tags:[]}));while(safe.facts.length&&bytes()>700000)safe.facts.splice(0,32);while(Object.keys(safe.summarizedSources).length&&bytes()>700000)safe.summarizedSources=Object.fromEntries(Object.entries(safe.summarizedSources).slice(100));if(bytes()>700000)for(const p of safe.patterns)p.summary=p.summary.slice(0,300);}
    return safe;
  }
  function statements(conversations=[]){
    const rows=[];
    conversations.filter(c=>!c.deleted).sort((a,b)=>String(a.updatedAt).localeCompare(String(b.updatedAt))).forEach(c=>{(c.messages||[]).forEach((m,i)=>{
      if(m.role!=='user'||m.error||typeof m.content!=='string')return;
      // Only explicit self-description, never credentials, diagnoses or quoted assignments.
      if(!/(?:나는|난\s|저는|내가|내\s|제\s|나의|목표|진학|되고 싶|좋아해|선호|성격|습관|집중이|집중을)/.test(m.content)||/가상|가정하면|예를 들어|비밀번호|패스워드|password|api[_ -]?key|주민등록|진단|질환|장애|우울증|adhd|@|\b01[016789][- ]?\d{3,4}[- ]?\d{4}\b/i.test(m.content))return;
      rows.push({id:`${c.id}:${i}`,conversationId:c.id,text:text(m.content,1200),date:c.updatedAt});
    });});return rows;
  }
  function localFacts(rows){
    const facts=[];for(const s of rows){
      if(/[?？]|(?:일까|인가요|일까요|인가)[.!\s]*$/.test(s.text))continue;
      const patterns=[['traits',/(?:나는|난|저는|내 성격은|성격이)\s*(?:좀\s*)?(내향적|외향적|차분한|꼼꼼한|활발한|계획적인|즉흥적인|소심한)(?:이|인|한|편|\s|$)/],['traits',/\b(INFP|INFJ|INTP|INTJ|ISFP|ISFJ|ISTP|ISTJ|ENFP|ENFJ|ENTP|ENTJ|ESFP|ESFJ|ESTP|ESTJ)\b/i],['habits',/(?:나는|난|저는|내가)\s*(.{1,45}(?:공부하는 편|공부해|집중이 잘|집중이 안|복습하는 편|짧게 공부|밤에 공부))/],['goals',/(?:목표는|목표가|목표로|가고 싶은 곳은)\s*([^.!?\n]{2,55})/],['interests',/(?:나는|난|저는)\s*([^.!?\n]{1,35})(?:을|를)\s*(?:좋아해|좋아하|선호해|선호하)/]];
      for(const[category,re]of patterns){const m=re.exec(s.text);if(m&&!/아니|않|말고|싫/.test(s.text.slice(Math.max(0,m.index-8),m.index+m[0].length+8)))facts.push({category,title:text(m[1],65),sourceId:s.id,quote:m[0]});}
    }return facts;
  }
  const stamp=value=>typeof value==='string'?Date.parse(value)||0:Number.isFinite(value?.seconds)?value.seconds*1000:0;
  function build({owner='guest',profile={},user={},study={},grades={},history=[],conversations=[],store={},consultation={},now=Date.now()}={}){
    const saved=cleanStore(store),sourceRows=statements(conversations),sourceMap=new Map(sourceRows.map(s=>[s.id,s])),nodes=[],edges=[];
    const initial=consultationCore.clean(consultation),provided=['draft','completed'].includes(initial.status);
    const name=saved.manual.name||(provided&&initial.name)||profile.name||profile.displayName||user.displayName||'나';
    const root={key:'person:self',target:'identity',kind:'person',title:text(name,30),label:'나',icon:'user',subtitle:owner==='guest'?'이 기기의 데이터':'내 계정의 데이터',evidence:[],source:'직접 설정'};nodes.push(root);
    for(const[id,title,icon]of groups){nodes.push({key:`branch:${id}`,target:'branch',kind:id,title,label:'분류',icon,subtitle:'',evidence:[],source:'분류'});edges.push({key:`self:${id}`,source:root.key,target:`branch:${id}`,label:title});}
    const ids=new Set(nodes.map(n=>n.key));
    function add(category,id,title,detail,source,work=null,evidence=[]){const key=`fact:${category}:${id}`;if(ids.has(key)||saved.hidden.includes(key))return;ids.add(key);nodes.push({key,target:'fact',kind:category,title:text(title,90),label:groups.find(g=>g[0]===category)?.[1]||'내 데이터',icon:groups.find(g=>g[0]===category)?.[2]||'user',subtitle:source,preview:text(detail,700),source,work,evidence});edges.push({key,source:`branch:${category}`,target:key,label:source});}
    if(profile.school?.name)add('school','current',profile.school.name,[profile.schoolLevel==='high'?'고등학교':profile.schoolLevel==='middle'?'중학교':'',profile.grade?`${profile.grade}학년`:'',profile.classNo?`${profile.classNo}반`:''].filter(Boolean).join(' · '),'회원정보',{type:'profile'});
    else add('school','unset','학교 설정', '학교와 반을 설정하면 여기에 반영돼요.','미설정',{type:'profile'});
    for(const[level,target]of Object.entries(grades.targets||{}))if(target?.name)add('goals',level,target.name,level==='middle'?'목표 고등학교':'목표 대학·학과','직접 설정',{type:'target'});
    for(const category of ['traits','habits','goals','interests'])if(saved.manual[category])add(category,'manual',saved.manual[category],'직접 입력한 내용','직접 입력',{type:'edit',category});
    if(provided){
      const work=step=>({type:'consultation',step});
      for(const[k,label]of [['highSchool','목표 고등학교'],['university','목표 대학'],['career','관심 진로']])if(initial.goals[k])add('goals','consultation:'+k,initial.goals[k],label,'초기 상담',work(1));
      initial.academy.forEach((s,i)=>add('school','academy:'+i,s.title,consultationCore.scheduleLabel(s),'초기 상담',work(2)));
      if(initial.noAcademy)add('school','academy:none','학원에 다니지 않아요','직접 입력한 시간표','초기 상담',work(2));
      if(initial.habits.length||initial.habitNote)add('habits','consultation',initial.habits.join(' · ')||'내 공부 방식',initial.habitNote||initial.habits.join(' · '),'초기 상담',work(3));
      for(const[subject,progress]of Object.entries(initial.progress))if(progress)add('learning',subject,subject+' · '+progress,'현재 배우고 있는 진도(직접 입력): '+progress,'초기 상담',work(4));
      if(initial.concerns)add('learning','concerns','요즘 공부 고민',initial.concerns,'초기 상담',work(5));
    }
    const order=new Map(sourceRows.map((s,i)=>[s.id,i])),facts=[...localFacts(sourceRows),...saved.facts].sort((a,b)=>(order.get(a.sourceId)??-1)-(order.get(b.sourceId)??-1)),latest=new Map();
    for(const f of facts){const s=sourceMap.get(f.sourceId);if(!s||!s.text.includes(f.quote)||!/나는|난\s|저는|내가|내\s|제\s|나의|목표|좋아해|선호|성격|습관|집중/.test(s.text))continue;
      const family=f.category==='traits'&&/^[IE][NS][FT][PJ]$/i.test(f.title)?'traits:mbti':f.category==='traits'&&/^(내향적|외향적)$/.test(f.title)?'traits:orientation':`${f.category}:${f.title}`;
      latest.set(family,f);
    }
    [...latest.values()].forEach(f=>{const s=sourceMap.get(f.sourceId);add(f.category,`${f.sourceId}:${f.title}`,f.title,f.quote,'상담에서 말한 내용',{type:'chat',id:s.conversationId},[{label:'내가 말한 내용',text:f.quote,date:s.date}]);});
    const sessions=(study.sessions||[]).filter(s=>Number.isFinite(s.minutes)&&s.minutes>0),focus=sessions.filter(s=>s.source==='pomodoro');
    if(focus.length){const average=Math.round(focus.reduce((n,s)=>n+s.minutes,0)/focus.length);add('habits','focus-length',`한 번에 평균 ${average}분`,`${focus.length}회의 실제 집중 기록 기준`,'활동 기록',{type:'timer'});}
    if(sessions.length){const times=new Map();sessions.forEach(s=>{const t=stamp(s.createdAt);if(!t)return;const h=Number(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Seoul',hour:'numeric',hourCycle:'h23'}).format(new Date(t)));const part=h<6?'새벽':h<12?'오전':h<18?'오후':'저녁';times.set(part,(times.get(part)||0)+1);});const most=[...times].sort((a,b)=>b[1]-a[1])[0];if(most)add('habits','record-hours',`${most[0]} 기록이 많아요`,`${most[1]}개의 기록 시각 기준 · 공부 시작 시각과 다를 수 있어요`,'활동 기록',{type:'records'});}
    const recent=sessions.filter(s=>{const t=stamp(s.createdAt)||stamp(`${s.date}T00:00:00+09:00`);return t>=now-7*86400000&&t<=now;});
    if(recent.length)add('activity','week-time',`최근 7일 ${Math.round(recent.reduce((n,s)=>n+s.minutes,0))}분`,`${recent.length}개의 공부 기록`,'활동 기록',{type:'records'});
    const subjectCounts=new Map();[...(study.notes||[]),...(study.quizzes||[])].forEach(n=>{if(n.subject&&!n.archivedAt)subjectCounts.set(n.subject,(subjectCounts.get(n.subject)||0)+1);});
    [...subjectCounts].sort((a,b)=>b[1]-a[1]).forEach(([subject,count])=>add('interests',`subject:${subject}`,subject,`저장한 학습 자료 ${count}개 · 선호도 판단이 아닌 기록량`,'학습 자료',{type:'notes',subject}));
    const tabNames={home:'홈',school:'학교',plan:'계획',assistant:'학습',progress:'성장',settings:'설정'};
    Object.entries(saved.actions).filter(([k])=>k.startsWith('tab:')).sort((a,b)=>b[1]-a[1]).forEach(([key,count])=>{const tab=key.slice(4);add('activity',key,`${tabNames[tab]||tab} ${count}회`, '활동 반영을 켠 이후 화면 사용 횟수','앱 사용',{type:'tab',tab});});
    const complete=(study.tasks||[]).filter(t=>t.done).length;if(complete)add('activity','tasks',`완료한 할 일 ${complete}개`,'현재 저장된 할 일 기준','활동 기록',{type:'tab',tab:'plan'});
    if(sourceRows.length)add('activity','consultations',`상담 기록 ${conversations.filter(c=>!c.deleted).length}개`,'내 대화 중 명시적으로 말한 내용이 반영돼요','상담 기록',{type:'chat',id:sourceRows.at(-1).conversationId});
    edges.forEach(e=>e.hierarchy=true);const expanded=behavior.extend(nodes,edges,{study,grades,history,store:saved});
    return {...expanded,name,sourceRows,updatedAt:saved.updatedAt||'',tracking:saved.tracking};
  }
  function signature(rows){let h=2166136261;for(const s of JSON.stringify(rows.map(s=>[s.id,s.text])))h=Math.imul(h^s.charCodeAt(0),16777619);return(h>>>0).toString(36);}
  const api={groups,cleanStore,statements,localFacts,build,signature};if(typeof module==='object'&&module.exports)module.exports=api;else root.PrimePersonalDataCore=api;
})(typeof window==='object'?window:this);
