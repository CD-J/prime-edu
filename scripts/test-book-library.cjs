const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../js/study-ai.js'),'utf8');
const list={innerHTML:''},reader={innerHTML:''},quizzes={innerHTML:''},count={textContent:''};
const escaped=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const state={notes:[{id:'note1',subject:'수학',unit:'<img title="긴 단원">',summary:'비공개 요약',text:'비공개 원문',createdAt:'2026-10-07',keywords:['분수']}],currentNoteId:null,
 quizzes:[{id:'quiz1',subject:'수학',title:'<script>긴 문제책</script>',questions:[{},{}],createdAt:'2026-10-07'}],attempts:[]};
const scope=vm.createContext({state,PrimeUI:require('../js/ui-icons.js'),window:{PrimeStudyHistory:require('../js/study-history-core.js')},escapeHtml:escaped,
 $:s=>({'#studyNoteList':list,'#studyConceptReader':reader,'#studyQuizLibrary':quizzes,'#studyQuizLibraryCount':count})[s],
 formatAiText:escaped,renderVisualThinking:()=>'',renderNotebookNavigation:()=>{}});
vm.runInContext(source.match(/function activeAttempts\(\)[^\n]+/)[0],scope);
vm.runInContext(source.slice(source.indexOf('  function renderNotes('),source.indexOf('  function mountNotebookReader()')),scope);
vm.runInContext(source.slice(source.indexOf('  function renderQuizLibrary()'),source.indexOf('  async function onQuizLibraryClick(')),scope);
scope.renderNotes();scope.renderQuizLibrary();
for(const html of [list.innerHTML,quizzes.innerHTML]){assert.match(html,/quiz-book-cover stored-book-cover is-blue/);assert.match(html,/quiz-book-spine/);assert.match(html,/quiz-book-badge/);assert.match(html,/stored-book-footer/);assert(!html.includes('<img'));assert(!html.includes('<script>'));assert(!html.includes('quiz-book-copy'));}
assert(!list.innerHTML.includes('비공개'));assert.equal(reader.innerHTML,'');
assert.match(list.innerHTML,/data-open-concept-note="note1"/);assert.match(quizzes.innerHTML,/data-open-quiz-book="quiz1"/);assert.match(quizzes.innerHTML,/data-delete-quiz-book="quiz1"/);
assert.match(quizzes.innerHTML,/미풀이 · 2문항/);assert.equal(count.textContent,'1권');
state.attempts=[{quizId:'quiz1',score:1,total:2,accuracy:50}];scope.renderQuizLibrary();assert.match(quizzes.innerHTML,/1\/2 · 50%/);
state.attempts=[{quizId:'quiz1',score:0,total:2,accuracy:0,createdAt:'2026-10-11T10:00:00Z'},{quizId:'quiz1',score:2,total:2,accuracy:100,createdAt:'2026-10-12T10:00:00Z'}];scope.renderQuizLibrary();assert.match(quizzes.innerHTML,/2\/2 · 100%/,'shelf agrees with chronological history instead of raw array order');
state.currentNoteId='note1';scope.renderNotes();assert.match(reader.innerHTML,/비공개 원문/);
state.notes=[];state.quizzes=[];scope.renderNotes();scope.renderQuizLibrary();assert.match(list.innerHTML,/study-empty/);assert.match(quizzes.innerHTML,/quiz-library-empty/);assert.equal(count.textContent,'0권');
console.log('PASS restored cover libraries: both covers/spines/badges, escaped full titles, no private text in shelf, stable IDs/delete controls, selected-only reader, attempt/empty states.');
