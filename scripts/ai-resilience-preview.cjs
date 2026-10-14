// Isolated UI fault injection. Synthetic output, no Firebase or external AI.
const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '..'), port = Number(process.env.PRIME_AI_QA_PORT) || 5197;
let requests = 0, gradeRequests = 0,chatRequests=0;
http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if(req.method==='POST'&&url.pathname==='/api/chat'){
    let body='';req.on('data',chunk=>{body+=chunk;if(body.length>100000)req.destroy();});req.on('end',()=>{try{const input=JSON.parse(body),failed=++chatRequests===1;res.writeHead(failed?503:200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(failed?{error:'[검수] 일시적 연결 오류',code:'AI_TEMPORARY_UNAVAILABLE',retryable:true}:{reply:'[검수용 예시 · 실제 AI 답변 아님] 계정 참고 정보에 '+(String(input.scheduleContext).includes('개발자')?'개발자 목표와 ':'')+(String(input.scheduleContext).includes('[검수] 중간고사')?'중간고사 일정이 ':'학습 진도가 ')+'전달됐어요.',actions:[]}));}catch{res.writeHead(400);res.end();}});return;
  }
  if(req.method==='POST'&&['/api/recommendBooks','/api/generateQuiz'].includes(url.pathname)){
    let body='';req.on('data',chunk=>{body+=chunk;if(body.length>50000)req.destroy();});req.on('end',()=>{try{const p=JSON.parse(body),report=p.learningContext||p.learnerProfile?.selfReport||{},career=report.goals?.career||'미입력',unit=report.progress?.[p.subject]||'미입력';const value=url.pathname.includes('recommendBooks')?{summary:'[예시] 상담 진로 연결: '+career,books:[{title:'[예시] 진로 탐색 책',author:'로컬 검수',category:p.category,reason:'[예시] 전달된 진로: '+career,learningPoint:'[예시] 학습 배경을 확인한 검수 결과'}]}:{title:'[예시] 학습 맥락 연결',questions:[{type:'short_answer',question:'[예시] 전달된 학습 진도는?',answer:unit,explanation:'[예시] 입력 배경 전달 검수',concept:p.unit||'단원'}]};res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value));}catch{res.writeHead(400);res.end();}});return;
  }
  if(req.method==='POST'&&url.pathname==='/api/personalInsights'){
    let body='';req.on('data',chunk=>{body+=chunk;if(body.length>1000000)req.destroy();});req.on('end',()=>{try{const input=JSON.parse(body),rows=input.activities||[],note=rows.find(r=>r.id.startsWith('note:')),quiz=rows.find(r=>r.id.startsWith('quiz:')),logs=rows.filter(r=>r.id.startsWith('log:')),patterns=[];if(note)patterns.push({id:'interests:qa-science',category:'interests',title:'[예시] 과학 자료 연결',summary:'[예시] 노트의 주제와 저장 기록을 연결한 검수용 요약입니다.',sourceIds:[note.id]});if(quiz)patterns.push({id:'habits:qa-review',category:'habits',title:'[예시] 문제와 복습 기록',summary:'[예시] 문제풀이 자료가 저장되어 있습니다.',sourceIds:[quiz.id]});if(logs.length)patterns.push({id:'activity:qa-use',category:'activity',title:'[예시] 앱 탐색 흐름',summary:'[예시] 화면 이동과 기능 사용을 연결한 검수용 요약입니다.',sourceIds:logs.slice(0,6).map(r=>r.id)});setTimeout(()=>{res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({facts:[],patterns}));},1200);}catch{res.writeHead(400);res.end();}});return;
  }
  if (req.method === 'POST' && url.pathname === '/api/gradeFeedback') {
    req.resume();const failed=++gradeRequests===1;
    setTimeout(()=>{res.writeHead(failed?504:200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(failed?{error:'검수용 지연 · 성적은 유지돼요',code:'AI_CONNECTION_TIMEOUT',retryable:true}:{summary:'[예시] 성적 피드백 화면 검수입니다.',strengths:['[예시] 수학 점수를 기록했어요.'],nextSteps:['[예시] 오답 한 문제를 다시 풀어봐요.'],targetAdvice:['[예시] 공식 모집요강을 확인해요.'],sources:[],dataAsOf:'2026-10-14'}));},failed?1200:9000);return;
  }
  if (req.method === 'POST' && url.pathname === '/api/generateStudyPlan') {
    req.resume(); const failed = ++requests === 1;
    setTimeout(() => { res.writeHead(failed ? 502 : 200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(failed ? { error: '검수용 AI 서버 오류', code: 'AI_TEMPORARY_UNAVAILABLE', retryable: true } : { tasks: [{ title: '[예시] 개념 복습', subject: '수학', minutes: 20, date: '2026-10-13', reason: 'UI 검수용 합성 결과' }] })); }, 1200);
    return;
  }
  if (req.method !== 'GET') { req.resume(); res.writeHead(405); res.end(); return; }
  if (url.pathname.startsWith('/api/') || url.pathname.includes('firebase-config')) { res.writeHead(200, { 'Content-Type': 'text/javascript' }); res.end('window.FIREBASE_CONFIG = {};'); return; }
  let file; try { file = path.resolve(root, '.' + (url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname))); } catch { res.writeHead(400); res.end(); return; }
  if (!file.startsWith(root + path.sep) || /(^|[\\/])\./.test(path.relative(root, file)) || !/\.(html|js|css|svg|png|jpg|woff2?|ttf)$/.test(file) || /[\\/]node_modules[\\/]/.test(file)) { res.writeHead(404); res.end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end(); return; }
    if (file === path.join(root, 'index.html')) {
      let html=data.toString().replace(/<script src="https:\/\/www\.gstatic\.com\/firebasejs[^\"]+"><\/script>/g, '');
      if(url.searchParams.has('personalqa'))html=html.replace('<script src="js/study-ai.js','<script src="scripts/continuity-fixture.js"></script><script src="scripts/grade-feedback-fixture.js"></script><script src="js/study-ai.js');
      if(url.searchParams.has('profileqa'))html=html.replace('</body>','<script src="scripts/profile-layout-fixture.js"></script></body>');
      if(url.searchParams.has('mindgrowthqa'))html=html.replace('</body>','<script src="scripts/mindmap-growth-fixture.js"></script></body>');
      if(url.searchParams.has('sudoqa'))html=html.replace('</body>','<script src="scripts/sudo-copy-motion-fixture.js"></script></body>');
      if(url.searchParams.has('calendarqa'))html=html.replace('<head>','<head><script src="scripts/calendar-layout-fixture.js"></script>').replace('events: academicEvents,','events: window.PrimeCalendarFixture?.events || academicEvents,');
      if(url.searchParams.has('schoolgateqa'))html=html.replace('  <script>\r\n    const STORAGE_KEY','  <script src="scripts/school-gate-fixture.js"></script>\r\n  <script>\r\n    const STORAGE_KEY').replace('  <script>\n    const STORAGE_KEY','  <script src="scripts/school-gate-fixture.js"></script>\n  <script>\n    const STORAGE_KEY');
      if(url.searchParams.has('onboardingqa'))html=html.replace(/(  <script>\r?\n    const STORAGE_KEY)/,'  <script src="scripts/study-onboarding-fixture.js"></script>\n$1');
      data=Buffer.from(html);
    }
    res.writeHead(200, { 'Cache-Control': 'no-store', 'Content-Type': ({ '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.ttf': 'font/ttf' })[path.extname(file)] }); res.end(data);
  });
}).listen(port, '127.0.0.1', () => console.log(`AI resilience UI: http://127.0.0.1:${port}/ (synthetic, first request fails then recovers; no cloud/paid API)`));
