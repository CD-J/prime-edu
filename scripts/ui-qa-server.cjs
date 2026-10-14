// Local-only UI fixture. Never shipped (.vercelignore excludes scripts).
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root=path.resolve(__dirname,'..');
const baselineHTML=require('node:child_process').execFileSync('git',['show','b47c560:index.html'],{cwd:root,maxBuffer:2*1024*1024});
const detail='분수의 분모는 전체를 나눈 수, 분자는 선택한 부분의 수입니다. 같은 분모일 때 분자끼리 더하고, 서로 다른 분모일 때는 통분해서 계산합니다. 계산한 뒤에는 약분할 수 있는지 확인하세요. '.repeat(5);
const fixtures={
 '/api/generateStudyPlan':{tasks:[{title:'핵심 개념 정리',subject:'수학',minutes:30,date:'2026-10-09',reason:'검수용 계획'},{title:'오답 복습',subject:'영어',minutes:25,date:'2026-10-10',reason:'검수용 계획'}]},
 '/api/analyzeLearningText': {summary:detail, keywords:['분수','분자','분모','통분'],visualThinking:{center:'분수의 덧셈',branches:['분수','분자','분모','통분'].map(title=>({title,detail}))}},
 '/api/generateQuiz': {title:'스크롤 검증용 분수 문제책',questions:Array.from({length:5},(_,i)=>({question:`${i+1}. ${detail}`,type:'multiple_choice',options:['1/2','1/3','1/4','1/5'],answer:'1/2',explanation:detail,concept:'분수'}))},
 '/api/recommendBooks': {summary:'읽기 추천',books:[{title:'분수와 수학',author:'검증용 예시',reason:detail,category:'수학'}]},
 '/api/chat': {reply:'공부매니저 **스도**예요.\n\n**통분**을 먼저 해보세요. <img src=x onerror=alert(1)>는 문자로만 보여요.',actions:[]},
 '/api/schoolCatalog': {schools:[{name:'검수용 고등학교',schoolCode:'8750133',officeCode:'R10',schoolType:'일반고',establishment:'공립',address:'검수용 예시 주소'}],dataAsOf:'2026-10-06',limited:false},
 '/api/gradeFeedback': {summary:'입력한 수학 성적이 높아졌어요. 다음에는 영어를 짧게 매일 복습해보세요.',strengths:['수학 점수가 70점에서 80점으로 올랐어요.'],nextSteps:['영어 오답 3개를 하루 10분씩 다시 풀어보세요.'],targetAdvice:['학교의 최신 모집요강과 성적 반영 항목을 확인하세요.'],sources:[{label:'나이스 공식 학교 정보',url:'https://open.neis.go.kr/'}],dataAsOf:'2026-10-06'},
};
http.createServer((req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1');
 if(req.method==='POST' && url.pathname.startsWith('/api/')) {
   req.resume();
   const failed=process.env.PRIME_QA_FAIL===url.pathname;
   const response=failed?{error:'검증용 오류: 잠시 후 다시 시도해주세요.'}:process.env.PRIME_QA_EMPTY===url.pathname?{books:[]}:fixtures[url.pathname];
   setTimeout(()=>{res.writeHead(!failed&&fixtures[url.pathname]?200:503,{'Content-Type':'application/json'});res.end(JSON.stringify(response||{error:'검증용 오류: 잠시 후 다시 시도해주세요.'}));},Number(process.env.PRIME_QA_DELAY)||1500);return;
 }
 const file=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
 if(!file.startsWith(root+path.sep)) {res.writeHead(403);res.end();return;}
 fs.readFile(file,(err,data)=>{
   if(err){res.writeHead(404);res.end();return;}
   res.setHeader('Cache-Control','no-store');
   res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.json':'application/json'})[path.extname(file)]||'application/octet-stream');
   // Geometry comparison only; old spacing, same local synthetic data.
   if(file===path.join(root,'index.html')&&url.searchParams.has('baseline'))data=baselineHTML;
   if(file===path.join(root,'index.html')&&url.searchParams.has('motionqa'))data=Buffer.from(data.toString().replace('</body>','<script src="scripts/sudo-mobile-fixture.js"></script></body>'));
   if(file===path.join(root,'index.html')&&url.searchParams.has('buttonqa'))data=Buffer.from(data.toString().replace('</body>','<script src="scripts/button-motion-fixture.js"></script></body>'));
   if(file===path.join(root,'index.html')&&url.searchParams.has('experienceqa'))data=Buffer.from(data.toString().replace('</body>','<script src="scripts/experience-fixture.js"></script></body>'));
   if(file===path.join(root,'index.html')&&url.searchParams.has('booklayoutqa'))data=Buffer.from(data.toString().replace('<script src="js/study-ai.js','<script src="scripts/notebook-layout-fixture.js"></script><script src="js/study-ai.js'));
   if(file===path.join(root,'index.html')&&url.searchParams.has('designqa'))data=Buffer.from(data.toString().replace('</body>','<script src="scripts/design-feedback-fixture.js"></script></body>'));
   if(file===path.join(root,'index.html')&&url.searchParams.has('returnqa'))data=Buffer.from(data.toString().replace('</body>','<script src="scripts/sudo-return-fixture.js"></script></body>'));
   if(file===path.join(root,'index.html')&&url.searchParams.has('schoolgateqa'))data=Buffer.from(data.toString().replace('  <script>\r\n    const STORAGE_KEY','  <script src="scripts/school-gate-fixture.js"></script>\r\n  <script>\r\n    const STORAGE_KEY').replace('  <script>\n    const STORAGE_KEY','  <script src="scripts/school-gate-fixture.js"></script>\n  <script>\n    const STORAGE_KEY'));
   if(file===path.join(root,'index.html')&&url.searchParams.has('calendarqa'))data=Buffer.from(data.toString().replace('<head>','<head><script src="scripts/calendar-layout-fixture.js"></script>').replace('events: academicEvents,','events: window.PrimeCalendarFixture?.events || academicEvents,'));
   res.end(data);
 });
}).listen(Number(process.env.PRIME_QA_PORT)||5190,'127.0.0.1',()=>console.log(`QA fixture: http://127.0.0.1:${Number(process.env.PRIME_QA_PORT)||5190} (synthetic AI only)`));
