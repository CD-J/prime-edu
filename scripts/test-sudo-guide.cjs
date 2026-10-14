const assert=require('node:assert/strict');
const {steps,key,spotlight,shouldAutoStart,VERSION}=require('../js/sudo-guide.js');
assert.equal(new Set(steps.map(s=>s.tab)).size,6);
assert.equal(steps.length,12);
assert.equal(steps[0].intro,true);
assert(steps[0].title.includes('공부매니저 스도'));
assert(steps.every(s=>s.title&&(s.target||s.intro)&&s.text.length>20));
assert(steps.find(s=>s.category==='notes')&&steps.find(s=>s.category==='books'));
assert.notEqual(key('a'),key('b'));assert.notEqual(key('guest'),key('a'));
assert.equal(shouldAutoStart(null,false,false),false);
assert.equal(shouldAutoStart('uid',false,false),true);
assert.equal(shouldAutoStart('uid',true,false),false);
assert.equal(shouldAutoStart('uid',false,true),false);
assert.equal(VERSION,1);
for(const [width,height,bubbleTop] of [[360,740,450],[390,844,560],[1440,900,580],[844,390,140]]){
 for(const rect of [{left:-30,top:-200,right:1100,bottom:1500},{left:25,top:110,right:300,bottom:320}]){
  const s=spotlight(rect,width,height,bubbleTop);
  assert(s.left>=0&&s.top>=78&&s.width>=0&&s.height>=0);
  assert(s.left+s.width<=width&&s.top+s.height<=height);
  if(s.height)assert(s.top+s.height<=bubbleTop-12,'Speech bubble never covers highlight');
 }
}
const core=require('../js/sudo-physics-core.js');
assert(core.pressScale(1,0,0)<.85,'Press squashes whole body immediately');
assert(core.pressScale(1,1,.98)>1.7,'Held body grows before burst');
assert(core.pressScale(1,1,1,true)<1.2,'Reduced motion growth is limited');
for(const value of [undefined,NaN,-1,1,5])assert(Number.isFinite(core.pressScale(value,value,value)));
console.log('PASS: Sudo greeting, six tabs, 12 guide steps, account-separated first-login policy, spotlight clearance, uniform press and pre-burst growth.');
