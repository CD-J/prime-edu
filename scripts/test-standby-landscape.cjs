const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
const source=read('js/standby.js'),css=read('js/standby.css'),model=require('../js/standby.js');
assert.equal(model.gestureDistance(50,20,false),20);
assert.equal(model.gestureDistance(50,20,true),-50);
assert.equal(model.gestureDistance(-80,10,true),80);
assert.match(source,/contents\[0\]\.animate/);
assert.doesNotMatch(source,/flightOffset|rotate\(\$\{offset/,'The old spinning numeral flight is replaced by a gentle card entrance');
assert.match(source,/animation\?\.cancel\(\);animation=null;if\(!root.hidden\)\{sizeTimerFrame\(\)/);
assert.match(css,/--standby-accent:color-mix\(in srgb,var\(--shell-blue\) 54%,#f4f1fb\)/);
assert.match(css,/width:100dvh; height:100dvw; transform:translate\(-50%,-50%\) rotate\(90deg\)/);
assert.match(css,/container:standby-frame \/ size/);
assert.match(css,/font-weight:1000!important/);
assert.match(css,/\.standby-colon \{ font-size:\.64em/);
assert.match(css,/radial-gradient\(ellipse at 16% 8%/);
assert.match(source,/screen\.orientation\.lock\('landscape'\)/);
assert.match(source,/fullscreenchange/);
assert.match(source,/element\.id==='standbyTimerValue'\?'timer':'img'/);
assert.match(source,/element\.setAttribute\('aria-live','off'\)/);
assert(!source.includes('localStorage.setItem'));assert(!source.includes('addStudySession'));
assert.equal(fs.readFileSync(path.join(__dirname,'../assets/fonts/nunito-variable.ttf')).readUInt32BE(0),0x00010000);
assert(read('assets/fonts/nunito-OFL.txt').includes('SIL OPEN FONT LICENSE Version 1.1'));
// Execute the actual presentation controller, including rejection and close races.
const controller=source.slice(source.indexOf('  async function enterPresentation()'),source.indexOf('  function open(source)'));
async function scenario({touch=1,fullscreenFailure=false,orientationFailure=false,closeWhilePending=false}={}) {
  let locked=0,unlocked=0,requested=0,exited=0,resume;
  const root={hidden:false,classList:{contains:()=>false}},document={fullscreenEnabled:true,fullscreenElement:null,exitFullscreen:async()=>{exited++;document.fullscreenElement=null;}};
  root.requestFullscreen=async()=>{requested++;if(fullscreenFailure)throw Error('unsupported');if(closeWhilePending)await new Promise(r=>resume=r);document.fullscreenElement=root;};
  const screen={orientation:{lock:async()=>{if(orientationFailure)throw Error('unsupported');locked++;},unlock:()=>unlocked++}};
  const context={navigator:{maxTouchPoints:touch},matchMedia:()=>({matches:true}),root,document,screen};
  vm.createContext(context);vm.runInContext('let presentationToken=0,ownsFullscreen=false,ownsOrientation=false;'+controller+';this.enter=enterPresentation;this.release=releasePresentation;',context);
  const pending=context.enter();
  if(closeWhilePending){context.release();root.hidden=true;resume();}
  await pending;context.release();await Promise.resolve();
  return {locked,unlocked,requested,exited};
}
(async()=>{
  assert.deepEqual(await scenario(),{locked:1,unlocked:1,requested:1,exited:1});
  assert.deepEqual(await scenario({touch:0}),{locked:0,unlocked:0,requested:0,exited:0});
  assert.deepEqual(await scenario({fullscreenFailure:true}),{locked:0,unlocked:0,requested:1,exited:0});
  assert.deepEqual(await scenario({orientationFailure:true}),{locked:0,unlocked:0,requested:1,exited:1});
  assert.deepEqual(await scenario({closeWhilePending:true}),{locked:0,unlocked:0,requested:1,exited:1});
  console.log('PASS landscape standby: theme-derived pastel, rounded clock font/OFL, logical gesture axes, mobile fullscreen/orientation ownership, rejection fallback and close-race cleanup.');
})().catch(error=>{console.error(error);process.exitCode=1;});
