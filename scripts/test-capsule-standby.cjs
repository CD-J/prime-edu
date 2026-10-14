const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const P=require('../js/standby-preferences.js'),S=require('../js/standby.js'),T=require('../js/liquid-tabs.js');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
assert.deepEqual(P.clockStyles,['digital','analog','duo','minimal','solar','float','lcd','flip']);
for(const clock of P.clockStyles)assert.equal(P.normalize({clock}).clock,clock);
const old=P.normalize({clock:'duo',frame:'card',mood:4,order:['calendar','clock']});assert.equal(old.hourCycle,'24');assert.equal(old.clock,'duo');assert.equal(old.order[0],'calendar');assert.equal(old.mood,4);
for(const [hour,expected,period] of [[0,'12:08','AM'],[11,'11:08','AM'],[12,'12:08','PM'],[23,'11:08','PM']]){
const parts=P.clockParts(new Date(2026,9,8,hour,8),'12');assert.equal(parts.text,expected);assert.equal(parts.period,period);assert.equal(parts.label,period+' '+expected);
const full=P.clockParts(new Date(2026,9,8,hour,8),'24');assert.equal(full.text,String(hour).padStart(2,'0')+':08');assert.equal(full.period,'');}
assert.equal(P.normalize({hourCycle:'bad'}).hourCycle,'24');assert.equal(P.normalize({hourCycle:'12'}).hourCycle,'12');
const svg=S.sevenSegmentMarkup('10:08');assert.equal((svg.match(/<path /g)||[]).length,28);assert.equal((svg.match(/is-lit/g)||[]).length,21);assert.match(svg,/viewBox="0 0 250 86"/);assert.doesNotMatch(S.sevenSegmentMarkup('<script>'),/<script>/);
assert(T.configs.some(([bar,buttons])=>bar==='.standby-settings-tabs'&&buttons.includes('data-standby-category')));assert(T.configs.some(([,buttons])=>buttons.includes('data-standby-cycle')));
const css=read('js/capsule-standby.css'),prefs=read('js/standby-preferences.js'),standby=read('js/standby.js'),html=read('index.html');
assert.match(css,/border-radius:999px!important/);assert.match(css,/color:var\(--shell-blue\)!important/);assert.match(css,/left:50%!important;right:auto/);assert.match(css,/grid-template-columns:repeat\(6,minmax\(0,1fr\)\)/);assert.match(css,/min-width:44px!important/);
assert.match(css,/margin:0 0 14px!important/);assert.match(css,/study-book-page-head \{ min-height:44px/);assert.match(css,/padding-bottom:calc\(96px/);
assert.match(css,/drop-shadow\(0 0 32px/);assert.match(css,/standby-mood-drift 34s/);assert.match(css,/standby-mood-return 43s/);assert.match(css,/prefers-reduced-motion:reduce/);assert.match(css,/is-mood-paused/);
for(const style of ['solar','float','lcd','flip'])assert(css.includes('data-clock-style='+style));
assert.match(prefs,/panel.append\(page\)/);assert.match(prefs,/data-standby-options="clock"/);assert.match(prefs,/data-standby-options="mood" hidden/);assert.match(prefs,/data-standby-options="pages" hidden/);assert.match(prefs,/aria-controls="standbyClockOptions"/);assert.match(prefs,/p.hidden=p.dataset.standbyOptions!==category/);assert.match(prefs,/aria-label="사용자 설정으로 돌아가기"/);
assert.doesNotMatch(prefs,/fetch\(|Firestore|setInterval/);assert.match(standby,/clockParts\(date,preferences.hourCycle\)/);assert.match(standby,/digits.dataset.clockStamp!==parts.label/);
const shell=read('js/app-shell.js');assert.doesNotMatch(shell,/readingSlot|sudo-reading-docked|nextMode==='reading'/);assert.doesNotMatch(css,/sudo-reading-docked/);assert.match(shell,/data-sudo-chat-dock/);assert.match(shell,/const dockSize=to\?to.width:0/);
assert(html.indexOf('capsule-standby.css')>html.indexOf('timer-setting.css'));assert.match(html,/standby-preferences.js\?v=20261009-50/);
console.log('PASS capsule and standby: 8 designs, legacy preferences preserved, 12/24h midnight/noon boundaries, own 7-segment digits, classified settings, shared slide controls, mobile safe capsule and hierarchy, edge glow and paused/reduced mood.');
