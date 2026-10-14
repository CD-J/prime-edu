const assert=require('node:assert/strict');
const D=require('../js/sudo-dialogue.js'),M=require('../js/sudo-notice-motion.js');
async function run(){
  const pick=D.createPicker(()=>.5);
  for(const k of ['hold','pet','wink','orbit','crown','dance','sleep','dizzy','impact','boing','peek','wake','unknown'])assert.equal(pick(k),'','Physical gestures and navigation do not interrupt study with chatter');
  for(const k of ['sparkle','breathe','thinking','answering','complete','checking'])assert(pick(k).length>0&&pick(k).length<28);
  assert(!Object.values(D.lines).flat().some(t=>/말랑|쫀득|뿅|반가|왕관|내 곁|보고 싶|임무/.test(t)));
  let reduce=false;const animations=[];
  const node={hidden:true,setAttribute(k,v){this[k]=v;},animate(keys,options){
    let resolve;const a={keys,options,cancelled:false,finished:new Promise(r=>resolve=r),cancel(){this.cancelled=true;},complete(){resolve();}};
    animations.push(a);return a;
  }};
  const motion=M.create(node,{reduced:()=>reduce,readStyle:()=>({opacity:'.45',transform:'matrix(1,0,0,1,0,1)',filter:'blur(1px)'})});
  motion.setVisible(true);assert(!node.hidden);assert.equal(animations[0].keys[0].opacity,0);
  motion.setVisible(true);assert.equal(animations.length,1,'Timer ticks and follow frames never restart the entrance');
  motion.setVisible(false);assert(!node.hidden,'Exit remains rendered until the fade ends');assert.equal(node['aria-hidden'],'true');assert(animations[0].cancelled);
  motion.setVisible(true);assert.equal(animations[2].keys[0].opacity,'.45','Interrupted exits resume from the presented opacity');
  animations[1].complete();await Promise.resolve();assert(!node.hidden,'Stale exit completion cannot hide a new caption');
  animations[2].complete();await Promise.resolve();assert(!node.hidden);assert(animations[2].cancelled);
  motion.setVisible(false);animations[3].complete();await Promise.resolve();assert(node.hidden);
  reduce=true;motion.setVisible(true);assert(!node.hidden);assert.equal(animations.length,4);
  reduce=false;motion.setVisible(false);motion.setVisible(false,{immediate:true});assert(node.hidden);assert(animations[4].cancelled,'Overlay/visibility interruptions cancel animations immediately');
  const fallback={hidden:true,setAttribute(){}};M.create(fallback).setVisible(true);assert(!fallback.hidden,'No animation API still yields the correct state');
  const fs=require('node:fs');
  assert.match(fs.readFileSync(require.resolve('../js/sudo-ai-button.css'),'utf8'),/width: max-content/,'Edge placement cannot squeeze and rewrap a caption during its entrance');
  assert.match(fs.readFileSync(require.resolve('../js/sudo-ai-physics.js'),'utf8'),/notice\.offsetWidth/,'Placement uses unscaled layout dimensions, not animation dimensions');
  assert(!fs.readFileSync(require.resolve('../js/sudo-ai-physics.js'),'utf8').includes('Math.random()<.3'),'Tab switching is not a random speech trigger');
  console.log('PASS Sudo quiet study captions, interruptible enter/exit, stable timer updates, reduced motion, immediate blockers, animation fallback.');
}
run().catch(e=>{console.error(e);process.exitCode=1;});
