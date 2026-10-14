const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const html = read('index.html'), css = read('js/layout-balance.css');
assert(html.indexOf('js/layout-balance.css') > html.indexOf('js/typography.css'));
assert.match(html, /<h1>Prime Edu<\/h1>/);
assert.doesNotMatch(html, /id="todayText"|\$\("#todayText"\)/);
assert.doesNotMatch(html, /weekday-detail-link|일정과 급식 전체 보기/);
assert.match(css, /grid-auto-rows: minmax\(54px,auto\)!important/);
assert.match(css, /grid-auto-rows: max-content/);
assert.match(css, /@media\(min-width:1100px\)[\s\S]*\.panel-plan\.is-active/);
assert.doesNotMatch(css, /font-size:\s*(?:9|10|11|12|13)px|transform:\s*scale\(/);
assert.match(css, /--shell-bg: #111419; --shell-card: #1c2027/);
assert.match(css, /\.btn\.primary,\.plan-mode-tabs button\.is-active\) \{ color: #17191c!important/);
assert.match(css, /\.field[^}]*min-height: 46px!important/s);
const density = read('js/interface-density.css');
assert(html.indexOf('js/interface-density.css') > html.indexOf('js/notebook-grade.css'));
assert.match(density, /html, body \{ scrollbar-width: none; \}/);
assert.doesNotMatch(density, /overflow:\s*hidden|zoom:|transform:\s*scale\(/, 'compact spacing must not disable scrolling or zoom the app');
assert.match(density, /\.panel-school \.card > h2 \{ margin: 0 0 14px!important/);
assert.match(density, /min-width: 0!important; table-layout: fixed/);
assert.match(density, /width: 20px!important/);
assert.match(density, /font-size: 14px!important; line-height: 1.5/);
assert.match(density, /data-pomodoro-toggle[^}]*background: var\(--shell-blue\)!important/s);
assert.match(density, /data-pomodoro-reset[^}]*color: color-mix\(in srgb,var\(--shell-blue\) 70%,var\(--shell-ink\)\)!important/s);
assert.equal((html.match(/<th><span class="sr-only">교시<\/span><\/th>/g) || []).length, 2);
const guide = read('js/sudo-guide.js');
assert.doesNotMatch(guide, /b\.height\+112|top:-100/);
assert.match(guide, /bubble\.offsetHeight\+\(avatar\?\.offsetHeight\|\|0\)\+20/);

// Exercise the actual renderer; menu items are preserved and hostile markup is escaped.
const escapeHtml = s => String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const scope = vm.createContext({escapeHtml, normalizeMealText: s => String(s || '').trim()});
vm.runInContext(html.slice(html.indexOf('    function formatMealMenuHtml'), html.indexOf('    function isCalendarDayModalOpen')), scope);
const meals = [{name:'중식',menu:'쌀밥\n추가밥\n아주 긴 급식 메뉴 이름\n<script>alert(1)</script>',calorie:'800 Kcal'}];
const compact = scope.renderMealListHtml(meals, '없음', true);
assert.equal((compact.match(/<li>/g) || []).length, 4);
assert.match(compact, /meal-detail-items/);
assert.match(compact, /800 Kcal/);
assert.doesNotMatch(compact, /<script>/);
const wide=scope.renderMealListHtml(meals);
assert.match(wide, /<ul class="meal-menu meal-menu-items">/);
assert.equal((wide.match(/<li>/g)||[]).length,4);
assert.doesNotMatch(wide,/<script>/);
assert.match(scope.renderMealListHtml([], '급식 없음', true), /급식 없음/);
// Compact proportions must preserve the original per-period grid and styling.
const tableBody = {innerHTML: ''}, pageBody = {innerHTML: ''};
const scheduleContext = vm.createContext({data: {schedule: Array.from({length:7},()=>['대체공휴일','수학','앱과 코딩','국어','한글날'])},
  PrimeTimetable:require('../js/timetable-model.js'),getSortedEvents:()=>[],
  escapeHtml, escapeAttr:escapeHtml, normalizeTimetableSubject:s=>s,
  $:selector=>({'#scheduleBody':tableBody,'#scheduleBodyPage':pageBody})[selector]});
vm.runInContext(html.slice(html.indexOf('    function renderScheduleTable'),html.indexOf('    function renderCalendarPanel')), scheduleContext);
scheduleContext.renderScheduleTable();
assert.equal((tableBody.innerHTML.match(/<td /g)||[]).length,35);
assert.doesNotMatch(tableBody.innerHTML,/rowspan|<wbr>|timetable-dayoff/);
assert.doesNotMatch(density,/timetable-dayoff|\.table-wrap td[^}]*font-weight/);
assert.equal((tableBody.innerHTML.match(/>대체공휴일<\/td>/g)||[]).length,7);
assert.equal((tableBody.innerHTML.match(/>한글날<\/td>/g)||[]).length,7);
assert.equal((tableBody.innerHTML.match(/>수학<\/td>/g)||[]).length,7);
assert.equal((tableBody.innerHTML.match(/<th scope="row">/g)||[]).length,7);
assert.equal(tableBody.innerHTML,pageBody.innerHTML);
scheduleContext.data.schedule[5][4]='-';scheduleContext.data.schedule[6][4]='-';scheduleContext.renderScheduleTable();
assert.equal((tableBody.innerHTML.match(/>한글날<\/td>/g)||[]).length,5,'Untaught final periods retain their original empty values');
scheduleContext.data.schedule[3][0]='체육';scheduleContext.renderScheduleTable();
assert.match(tableBody.innerHTML,/>체육<\/td>/);
scheduleContext.data.schedule[0][2]='<img src=x onerror=alert(1)>';
scheduleContext.renderScheduleTable();
assert.doesNotMatch(tableBody.innerHTML,/<img/);
assert.match(tableBody.innerHTML,/&lt;img/);
assert.equal((tableBody.innerHTML.match(/<td /g)||[]).length,35);
// No header-date element is required to refresh school information.
const calls = [];
const today = vm.createContext({renderDday:()=>calls.push('dday'),renderWeekdayGrid:()=>calls.push('week'),loadWeekMeals:async()=>({})});
vm.runInContext(html.slice(html.indexOf('    async function renderTodayPanel'),html.indexOf('    function getDdayLocalKey')),today);
today.renderTodayPanel([]).then(()=>{
  assert.deepEqual(calls,['dday','week','week']);
  console.log('PASS layout balance: compact desktop/mobile structure, readable type, unclipped notes, graphite theme, full safe meal detail and header-free school refresh');
}).catch(error=>{console.error(error);process.exitCode=1});
