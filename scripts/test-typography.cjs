const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const html = read('index.html'), css = read('js/typography.css'), source = read('js/utility-hub.js');

assert(html.indexOf('js/typography.css') > html.indexOf('js/home-polish.css'), 'the shared scale must follow legacy responsive rules');
for (const [role, size] of [['body', 16], ['secondary', 15], ['compact', 14]]) {
  assert.match(css, new RegExp(`--type-${role}: ${size}px`));
}
assert.match(css, /\.table-wrap td\s*\{[^}]*font-size: var\(--type-body\)!important/s);
assert.match(css, /min-width: 580px!important/);
assert.match(css, /overflow-x: auto!important/);
assert.match(css, /white-space: normal!important; text-overflow: clip!important/);
assert.equal((html.match(/class="table-wrap" role="region"[^>]+tabindex="0"/g) || []).length, 2);
assert.match(html, /<th scope="row">/);
assert.match(html, /cell\.setAttribute\("scope", "col"\)/);
assert.match(html, /aria-label="\$\{escapeAttr\(dayLabel\)\}"/);
assert.match(css, /\.cal-num\s*\{[^}]*font-size: var\(--type-body\)!important/s);
assert.match(css, /@media\(max-width: 600px\)[\s\S]*\.cal-dot[\s\S]*font-size: 0!important/);
for (const target of ['.note-keywords>span', '.weekday-date', '.dashboard-bars strong', '.grade-axis-label', '.study-bar-row>span', '.planner-legend>span', '.planner-detail-kind', '.notification-item-icon', '.home-accent-palette button>span', '.mobile-chat-history-item time', '[data-theme-choice]', '.checklist-number-field>b']) {
  assert(css.includes(target), `${target} must use the shared content scale`);
}
assert.doesNotMatch(css, /font-size:\s*(?:9|10|11|12|13)px/, 'new content styles cannot reintroduce tiny text');
assert.doesNotMatch(css, /\.sr-only|svg\s*\*|\*\s*\{/, 'do not overwrite intentionally hidden labels or every icon');

// Exercise the real chart renderer using synthetic records, never cloud data.
const chart = {innerHTML: '',dataset:{}}, list = {innerHTML: ''}, filter = {value: 'all', innerHTML: ''};
const academicGrades = Array.from({length: 12}, (_, i) => ({
  id: `fixture-${i}`, year: 1 + Math.floor(i / 4), term: 1 + Math.floor(i / 2) % 2,
  exam: i % 2 ? 'final' : 'mid', subject: '수학', score: 70 + i,
}));
const context = vm.createContext({academicGrades, $: selector => ({'#gradeComboChart': chart, '#gradeRecordList': list, '#gradeChartSubject': filter})[selector],
  escapeHtml: value => String(value).replace(/[&<>"']/g, ''),});
vm.runInContext(source.slice(source.indexOf('  function gradePeriodLabel'), source.indexOf('  function bindEvents')), context);
vm.runInContext('renderAcademicGrades()', context);
assert.match(chart.innerHTML, /min-width:1680px/);
assert.match(chart.innerHTML, /viewBox="0 0 1680 260"/);
assert.equal((chart.innerHTML.match(/class="grade-axis-label"/g) || []).length, 12);
academicGrades.splice(0, 11);
vm.runInContext('renderAcademicGrades()', context);
assert.match(chart.innerHTML, /min-width:720px/);
academicGrades.splice(0);
vm.runInContext('renderAcademicGrades()', context);
assert.match(chart.innerHTML, /data-journey="grades"/);assert.equal(chart.dataset.empty,'true');assert.equal(filter.hidden,true);
console.log('PASS typography: readable roles, local timetable scroll, accessible dates and 12-semester chart labels');
