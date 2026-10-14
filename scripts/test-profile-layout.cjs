const assert=require('node:assert/strict'),fs=require('node:fs');
const html=fs.readFileSync('index.html','utf8'),css=fs.readFileSync('js/profile-layout.css','utf8');
for(const prefix of ['profile','signup']){
 const fields=html.slice(html.indexOf(`id="${prefix==='profile'?'profileForm':'signupStudentFields'}"`),html.indexOf(`id="${prefix}SelectedSchool"`)+200);
 for(const id of ['SchoolLevel','Grade','ClassNo','SchoolQuery'])assert(fields.includes(`id="${prefix}${id}"`));
 assert.match(fields,/class="student-level-field"/);assert.match(fields,/class="student-grade-field"/);assert.match(fields,/class="student-class-field"/);
 assert.match(fields,/inputmode="numeric"/);assert.match(fields,/aria-label="학년"/);
}
assert.match(css,/student-level-field[^}]+grid-column:1\/-1/);
assert.match(css,/white-space:nowrap;overflow-wrap:normal;word-break:keep-all/);
assert.match(css,/grid-template-columns:minmax\(0,1fr\) 72px/);
assert.match(css,/profileForm[^}]+overflow-y:auto/);assert.match(css,/max-height:100%/);
assert.match(css,/profileForm>button\[type=submit\][^}]+position:sticky;bottom:0/);
assert.match(css,/school-search-results:empty[^}]+display:none/);
assert.match(html,/profile-layout.css\?v=20261014-80/);
assert(!css.includes('.panel-home'));assert(!css.includes('select.prime-select-source'));
console.log('PASS profile layout: separate labeled school level and grade/class rows, unbroken capsule labels, original field IDs/events, responsive scrollable form and visible save action; account values and other app surfaces preserved.');
