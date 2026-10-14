const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const source=read('js/utility-hub.js'),html=read('index.html'),css=read('js/home-polish.css');
const listeners={},faceListeners={},attrs={},dialStyle={},store=new Map();
const face={disabled:false,setAttribute(){},addEventListener:(type,fn)=>faceListeners[type]=fn};
const ring={dataset:{},style:{setProperty:(key,value)=>dialStyle[key]=value},classList:{toggle(){},add(){},remove(){}},
 setAttribute:(key,value)=>attrs[key]=value,addEventListener:(type,fn)=>listeners[type]=fn,
 getBoundingClientRect:()=>({left:0,top:0,width:200,height:200}),focus(){},setPointerCapture(){},releasePointerCapture(){}};
const scope=vm.createContext({document:{querySelector(){return null},querySelectorAll:s=>s==='[data-pomodoro-ring]'?[ring]:s==='[data-pomodoro-switch]'?[face]:[],activeElement:null},
 localStorage:{getItem:key=>store.get(key)||null,setItem:(key,value)=>store.set(key,value)},
 window:{dispatchEvent(){},PrimeTimerProgress:require('../js/timer-progress.js'),SchemsStudyAI:{getSnapshot:()=>({sessions:[]})}},CustomEvent:function(){},
 requestAnimationFrame:fn=>{fn();return 0},cancelAnimationFrame(){},setInterval(){},clearInterval(){}});
vm.runInContext(source.slice(source.indexOf('  const $ ='),source.indexOf('  const UTILITY_TITLES')),scope);
vm.runInContext('bindPomodoroDials();applyPomodoroPreset(25,5)',scope);
assert.equal(dialStyle['--pomodoro-arc'],'360','Every freshly set duration starts with a full countdown arc');
faceListeners.click();assert.equal(ring.dataset.mode,'break');assert.equal(attrs['aria-valuemax'],'30');assert.equal(attrs['aria-valuenow'],'5');
listeners.keydown({key:'End',preventDefault(){}});assert.equal(attrs['aria-valuenow'],'30');
listeners.keydown({key:'Home',preventDefault(){}});assert.equal(attrs['aria-valuenow'],'1');
faceListeners.click();assert.equal(ring.dataset.mode,'focus');assert.equal(attrs['aria-valuenow'],'25','focus duration persists across modes');
listeners.keydown({key:'End',preventDefault(){}});assert.equal(attrs['aria-valuenow'],'120');
assert.equal(dialStyle['--pomodoro-arc'],'360');
listeners.keydown({key:'Home',ctrlKey:true,preventDefault(){throw Error('Page navigation shortcut must not be intercepted')}});
assert.equal(attrs['aria-valuenow'],'120');
faceListeners.click();assert.equal(attrs['aria-valuenow'],'1','independent rest duration persists');
vm.runInContext('togglePomodoro()',scope);assert.equal(face.disabled,true);faceListeners.click();assert.equal(ring.dataset.mode,'break');
listeners.keydown({key:'End',preventDefault(){}});assert.equal(attrs['aria-valuenow'],'1','running rest cannot be edited');
vm.runInContext('resetPomodoro()',scope);assert.equal(face.disabled,false);
assert.equal(JSON.parse(store.get('primeEduPomodoro.v1')).breakMinutes,1);
for(const marker of ['mobile-pomodoro-widget','home-pomodoro card']){
 const start=html.indexOf(marker),end=html.indexOf('</section>',start),block=html.slice(start,end);
 assert.match(block,/data-pomodoro-switch/);assert.match(block,/data-pomodoro-adjust role="slider"/);
 assert.doesNotMatch(block,/pomodoro-inline-settings|data-pomodoro-apply/);
 assert.match(block,/data-pomodoro-toggle/);assert.match(block,/data-pomodoro-reset/);
}
assert.doesNotMatch(html,/data-pomodoro-ring role="slider"/,'a slider must not hide a nested accessible mode button');
assert.match(html,/class="academic-event-card" data-school-day=/);assert.match(css,/\.meal-menu[^\n]+font-size:16px/);
assert.match(css,/mask:none/,'old tick mask cannot leave a full conic wedge behind the face');
assert.equal((html.match(/class="pomodoro-dial-track"/g)||[]).length,3,'all shared clocks use the same SVG dial');
assert.match(html,/class="dial-progress"[^>]+pathLength="360"/);
assert.match(css,/stroke-linecap:round;stroke-dasharray:var\(--pomodoro-arc/,'progress ends must be rounded without a CSS conic seam');
assert.match(css,/\[data-pomodoro-time\]\{[^\n]+font-weight:400!important/,'The latest user correction requires regular home numerals');
assert.match(css,/box-shadow:0 0 44px color-mix/,'the dial has a bounded theme-colored glow');
assert.doesNotMatch(css,/clock-bell|clock-foot|clock-awake|clock-soft-blink|pomodoro-clock-expression/,'clock has no facial or alarm-clock decorations');
const art=read('js/sudo-home-art.js');assert.match(art,/var|sudo-glass/);assert.match(art,/index/);
assert.match(read('js/sudo-ai-button.js'),/contains\('sudo-glass-portrait'\)/);
assert.match(html,/sudo-ai-button\.js\?v=20261010-62/,'changed runtime must not reuse the old cached mascot renderer');
assert.match(html,/<section class="home-ai-hero card"[^>]+>\s*<span class="sudo-home-logo"/,'desktop scene must be a direct background layer');
assert.match(html,/<section class="mobile-home-landing mobile-only"[^>]+>\s*<span class="sudo-home-logo"/,'mobile scene must be a direct background layer');
assert.match(css,/\.sudo-home-logo\.sudo-glass-portrait\{position:absolute;inset:0;/,'art must not occupy an image box above the copy');
assert.match(css,/\.home-ai-hero\.has-conversation>\.sudo-glass-portrait\{display:none!important\}/,'the scene must disappear in actual chat');
assert.doesNotMatch(art,/data-pomodoro-ring|clock-charm|clock-expression/,'home artwork must never inject clock faces or decorations');
assert.match(css,/\.pomodoro-dial-track\{[^\n]+pointer-events:none/,'painted arc cannot intercept drag or the center button');
assert.match(css,/--glass-tone:color-mix\(in srgb,var\(--shell-blue[^;]+55%/,'glass color follows the selected theme');
assert.match(css,/prefers-reduced-motion:reduce/);
assert.match(css,/\.panel-home \.mobile-pomodoro-copy \.pomodoro-actions \[data-pomodoro-toggle\]/,'mobile primary action must beat generic white action-button styling');
const artHosts=[true,false].map(mobile=>({classList:{add(){}},closest:()=>mobile?{}:null,innerHTML:''}));
const artScope={document:{querySelectorAll:s=>{assert.equal(s,'[data-sudo-home-logo]');return artHosts}}};
vm.runInNewContext(art,artScope);vm.runInNewContext(art,artScope);
assert.match(artHosts[0].innerHTML,/viewBox="540 0 740 800"/);assert.match(artHosts[1].innerHTML,/viewBox="0 0 1400 700"/);
assert.match(artHosts[0].innerHTML,/sudo-portrait-0-reading-space/);assert.match(artHosts[1].innerHTML,/sudo-portrait-1-reading-space/);
for(const host of artHosts){assert.equal((host.innerHTML.match(/<svg /g)||[]).length,1);assert.match(host.innerHTML,/sudo-glass-prism/)}
assert.match(css,/flex-wrap:nowrap!important/,'two home actions cannot wrap into a column');
for(const weight of ['regular','semibold','bold']){
 const file=path.join(__dirname,'..','assets/fonts',`apple-gothic-${weight}.woff2`),data=fs.readFileSync(file);
 assert.equal(data.subarray(0,4).toString(),'wOF2');assert(data.length<1500000);
}
console.log('PASS: focus/rest switch, independent bounds, running guard, persistence, two actions, accessible center, rounded SVG arc, regular home numerals without facial decorations, idempotent theme-colored background, reduced motion, event/meal type and valid fonts.');
