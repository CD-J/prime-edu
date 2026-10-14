const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname,'..');
const ids = ['homeSettingsBackdrop','homeSettingsPanel','mobileChatDrawerBackdrop',
  'mobileChatDrawer','desktopChatHistoryBackdrop','desktopChatHistory','notificationPopover'];
const classes = new Set();
const nodes = new Map(ids.map(id=>[id,{id,hidden:true,matches:()=>false}]));
const modal = {matches:()=>true,classList:{contains:()=>modal.open},open:false};
const body = {append(e){e.parentElement=this;},classList:{toggle(name,on){on?classes.add(name):classes.delete(name);}}};
let sync;
const observed=[];
vm.runInNewContext(fs.readFileSync(path.join(root,'js/ui-layers.js'),'utf8'),{
  document:{body,getElementById:id=>nodes.get(id),querySelectorAll:()=>[modal]},
  MutationObserver:class {constructor(callback){sync=callback;} observe(e,options){observed.push({e,options});}},
  window:{addEventListener(){},innerWidth:390,innerHeight:844},
  requestAnimationFrame(){}
});
assert.ok([...nodes.values()].every(e=>e.parentElement===body && e.hidden));
assert.equal(classes.has('has-blocking-overlay'),false);
modal.open=true;sync();assert.ok(classes.has('has-blocking-overlay'));
nodes.get('homeSettingsPanel').hidden=false;modal.open=false;sync();
assert.ok(classes.has('has-blocking-overlay'),'one closing surface cannot unmask another open surface');
nodes.get('homeSettingsPanel').hidden=true;sync();assert.equal(classes.size,0);
assert.equal(observed.length,5);
assert.ok(observed.every(({options})=>!options.subtree && options.attributeFilter.join(',')==='class,hidden'));
const css=fs.readFileSync(path.join(root,'js/ui-refinement.css'),'utf8');
assert.match(css,/\.modal-backdrop,\.sheet-backdrop,\.utility-modal-backdrop \{ z-index:4000!important/);
assert.match(css,/visibility:hidden!important; opacity:0!important; animation:none!important/);
assert.match(css,/var\(--shell-blue\) 10%,var\(--shell-card\)/);
assert.match(css,/transform:none!important/);
assert.match(css,/align-items:stretch; background:var\(--workbook-paper\)!important/);
assert.match(css,/\.study-book-spread::before \{ display:none/);
assert.match(css,/\.study-book-page \{ background:transparent/);
assert.match(css,/\.study-problem-page \{ border-left:1px solid var\(--shell-line\)/);
assert.match(fs.readFileSync(path.join(root,'js/app-shell.js'),'utf8'),/closest\("#homeSettingsPanel"\)/);
console.log('PASS: portals preserve nodes/state, overlay masking restores, simultaneous surfaces remain masked, narrow observers, index theme and inactive-page layer invariants.');
