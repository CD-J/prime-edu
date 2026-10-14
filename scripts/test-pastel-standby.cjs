const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
const css=read('js/standby.css'),standby=read('js/standby.js'),home=read('js/home-polish.css'),glass=read('js/glass-design.css'),palette=require('../js/glass-design.js'),icons=require('../js/ui-icons.js');
assert.match(standby,/class="standby-timer-remaining" pathLength="100"/,'Latest correction uses a thick remaining-time frame');
assert.match(home,/\.panel-home \.pomodoro-clock-face \[data-pomodoro-time\][^}]*font-family:var\(--app-font\)!important;font-weight:400!important/);
assert.doesNotMatch(css,/\.panel-home \.pomodoro-clock-face \[data-pomodoro-time\]/,'StandBy must not reapply its heavy clock face to the home dial');
assert.match(css,/#standbyTimerValue[^}]*font-family:'Prime Timer UI'[^}]*font-weight:600!important/);
assert.match(css,/#standbyTimerValue \.standby-number[^}]*font-size:1em!important/);
assert.match(css,/\.standby-title[^}]*color:var\(--standby-ink\)!important/);
assert.match(css,/\.standby-check-copy strong[^}]*color:var\(--standby-ink\)!important/);
assert.match(home,/\.grade-input-table thead th[^}]*font-family:'Prime Grade Header'[^}]*font-weight:500!important/);
assert.match(home,/\.panel-home :is\(\.mobile-study-submit,\.home-ai-form button\[type=submit\]\)[^}]*--glass-control-fill/);
assert.match(icons.svg('send'),/M12 18V6m-5 5 5-5 5 5/);assert.match(icons.svg('hourglass'),/M7 3h10/);
assert.match(glass,/--glass-control-fill:color-mix\(in srgb,var\(--shell-blue\) 54%,#f4f1fb\)/);
for(const value of ['#7656d8','#b9a2ff','#dd7812','#ffad6c','#14825b','#6acaaa','#3265ad','#70a5f2']){
 const base=palette.rgb(palette.pastelAccent(value)),m=palette.accentMaterial(palette.pastelAccent(value));
 assert.equal(m.ink,'#10131b');assert(m.contrast>=4.5);assert(palette.contrast(palette.rgb(m.ink),base.map(v=>v+(1-v)*m.gleam))>=4.5);
}
const font=fs.readFileSync(path.join(__dirname,'../assets/fonts/pretendard-medium.woff2'));
assert.equal(font.toString('ascii',0,4),'wOF2');assert.equal(crypto.createHash('sha256').update(font).digest('hex'),'d03481330eeba0659ab5b87f25ceb504a35de377dd90a0d0aba2982eb2d05e2c');
assert(read('assets/fonts/pretendard-OFL.txt').includes('SIL OPEN FONT LICENSE Version 1.1'));
const mode={textContent:''},value={},button={label:'',getAttribute(){return this.label},setAttribute(k,v){this.label=v}},context={state:{mode:'focus',running:false,remainingSec:7200,focusMinutes:120,breakMinutes:5},contents:[{style:{setProperty(){}},classList:{toggle(){}},dataset:{}}],window:{PrimeTimerProgress:require('../js/timer-progress.js')},root:{querySelector:s=>s==='#standbyTimerMode'?mode:s==='#standbyTimerValue'?value:button},secondsText:require('../js/standby.js').secondsText,paintDigits:(e,t)=>e.text=t,icon:n=>n};
vm.createContext(context);vm.runInContext(standby.slice(standby.indexOf('  function timerPaint()'),standby.indexOf('  function clockPaint()'))+'timerPaint();',context);
assert.equal(value.text,'120:00');assert.equal(mode.textContent,'남은 집중 시간');context.state.mode='break';context.state.remainingSec=61;vm.runInContext('timerPaint();',context);assert.equal(value.text,'01:01');assert.equal(mode.textContent,'남은 휴식 시간');
console.log('PASS pastel refinement: regular home Gothic, separate semibold countdown/full-size seconds and bold clock, remaining-time frame, theme-derived pastel contrast, readable title, named send icon and unmodified OFL grade font.');
