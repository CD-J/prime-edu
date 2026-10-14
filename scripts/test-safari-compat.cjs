const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const html=read('index.html'),css=read('js/safari-layout.css');
for(const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
 if(!/\bsrc\s*=|\btype\s*=\s*["']module["']/.test(m[1]))new Function(m[2]);
}
assert(html.indexOf('js/browser-compat.js')<html.indexOf('js/ui-icons.js'));
assert(html.indexOf('js/safari-layout.css')>html.indexOf('js/ui-audit.css'));
assert(!/user-scalable\s*=\s*no|maximum-scale\s*=\s*1/.test(html));
assert.match(css,/\.tab-heading-row \{ display:flex; width:100%/);
assert.match(css,/font-size:16px!important/);
assert.match(css,/mobile-keyboard-open[\s\S]*visibility:hidden/);
assert.match(css,/@supports not \(translate:1px\)/);
assert.match(css,/@supports not \(aspect-ratio:1\)/);
assert.match(css,/@supports not \(inset:0\)/);
assert.match(css,/\.pomodoro-dial-track \{ top:0; right:0; bottom:0; left:0;/);
assert.match(css,/\.pomodoro-clock-face \{ top:15%; right:15%; bottom:15%; left:15%;/);
assert.match(css,/@supports not \(color:color-mix/);
const scope=vm.createContext({window:{}});
vm.runInContext('Object.hasOwn=undefined; Array.prototype.at=undefined;',scope);
vm.runInContext(read('js/browser-compat.js'),scope);
assert.equal(vm.runInContext('Object.hasOwn({x:1},"x")',scope),true);
assert.equal(vm.runInContext('Object.hasOwn(Object.create({x:1}),"x")',scope),false);
assert.equal(vm.runInContext('[1,2,3].at(-1)',scope),3);
assert.equal(vm.runInContext('[1,2,3].at(8)',scope),undefined);
assert.equal(vm.runInContext('Object.keys(Array.prototype).includes("at")',scope),false);
assert.equal(vm.runInContext('let input={items:[{score:80}],blank:undefined}; input.self=input; let copied=window.PrimeCompat.cloneData(input); copied.items[0].score=90; copied.self===copied && input.items[0].score===80 && Object.hasOwn(copied,"blank")',scope),true);
assert.equal(vm.runInContext('let hostile=JSON.parse(\'{"__proto__":{"polluted":true}}\'); let safe=window.PrimeCompat.cloneData(hostile); Object.hasOwn(safe,"__proto__") && !({}).polluted',scope),true);
const {legacyPalette}=require('../js/browser-compat.js');
for(const dark of [false,true])for(const color of ['#176b48','#2f6fed','#626d78','#df4d55','#7656d8','#df761d']) {
 const p=legacyPalette(color,dark);assert.equal(Object.keys(p).length,20);Object.values(p).forEach(v=>assert(!v.includes('color-mix')));assert(/^#[\da-f]{6}$/i.test(p['--shell-bg']));
}
for(const file of ['index.html','js/study-ai.js','js/utility-hub.js'])assert(!read(file).includes('structuredClone('));
// Pinch zoom is not a keyboard. Blur cannot move the send action before click.
const classes=new Set(),props={},events={},frames=[];
const mock={window:{innerHeight:659,innerWidth:393,visualViewport:{height:435,width:393,scale:1,offsetTop:0,offsetLeft:0,addEventListener:(n,f)=>events[n]=f},addEventListener(){}},document:{activeElement:{tagName:'TEXTAREA'},documentElement:{clientHeight:659,clientWidth:393,style:{setProperty:(k,v)=>props[k]=v}},body:{classList:{contains:n=>classes.has(n),toggle:(n,on)=>on?classes.add(n):classes.delete(n)}},addEventListener:(n,f)=>events[n]=f},requestAnimationFrame:f=>(frames.push(f),frames.length)};
vm.runInNewContext(read('js/mobile-layout.js'),mock);
assert(classes.has('mobile-keyboard-open'));
mock.document.activeElement={tagName:'BUTTON'};events.focusout();frames.shift()();assert(classes.has('mobile-keyboard-open'));
mock.window.visualViewport.height=659;events.resize();frames.shift()();assert(!classes.has('mobile-keyboard-open'));
mock.document.activeElement={tagName:'TEXTAREA'};mock.window.visualViewport.height=329.5;mock.window.visualViewport.scale=2;events.resize();frames.shift()();assert(!classes.has('mobile-keyboard-open'));
assert.equal(props['--mobile-visible-width'],'393px');
console.log('PASS Safari bridges: early init, app-owned deep clone, native preference, old API polyfills, themed fallback, readable inputs, viewport chat and user zoom preserved.');
