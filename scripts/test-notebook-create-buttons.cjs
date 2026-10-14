const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const buttons=[...html.matchAll(/<button\b([^>]*notebook-create-trigger[^>]*)>([\s\S]*?)<\/button>/g)];
assert.equal(buttons.length,2);
for(const [attrs,body] of buttons.map(m=>[m[1],m[2]])){
 assert.match(attrs,/class="ai-expand-trigger notebook-create-trigger"/);assert.match(attrs,/aria-expanded="false"/);
 const id=attrs.match(/data-ai-collapse="([^"]+)"/)[1];assert(attrs.includes(`aria-controls="${id}"`));
 assert.match(body,/<b aria-hidden="true">＋<\/b>/);
 const form=html.indexOf(`id="${id}"`),section=html.indexOf(id==='studyNoteEditor'?'id="studyNoteList"':'id="studyQuizLibrarySection"');assert(form<section);
}
assert.match(buttons[0][2],/개념노트 만들기/);assert.match(buttons[1][2],/문제노트 만들기/);
assert(!html.includes('새 문제 만들기'));assert.equal((html.match(/id="studyQuizEditor"/g)||[]).length,1);
for(const label of ['개념','문제'])assert(html.includes(`<span data-ui-symbol aria-hidden="true">✦</span> AI ${label}노트 만들기`));
console.log('PASS notebook create controls: shared class/position/labels/marks, aria-controls, single editor IDs and consistent AI submit actions.');
