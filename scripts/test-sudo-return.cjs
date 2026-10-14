const assert=require('node:assert/strict'),fs=require('node:fs'),M=require('../js/sudo-return-motion.js');
for(const [width,height] of [[320,700],[393,852],[852,393],[1280,800]]){
  const limits={left:8,right:width-8,top:80,bottom:height-80};
  const from={left:width/2-26,top:limits.bottom-52,width:52,height:52};
  const to={left:width-116,top:limits.bottom-104,width:92,height:92};
  const travel=M.duration(from,to);assert(travel>=360&&travel<=520);
  const first=M.pose(from,to,0,travel,limits),last=M.pose(from,to,travel+140,travel,limits);
  assert.equal(first.x,from.left);assert.equal(first.y,from.top);assert.equal(first.width,52);
  assert.equal(last.x,to.left);assert.equal(last.y,to.top);assert.equal(last.width,92);assert(last.done);
  for(let t=0;t<=travel+140;t+=8){const p=M.pose(from,to,t,travel,limits);for(const v of Object.values(p).filter(v=>typeof v==='number'))assert(Number.isFinite(v));assert(p.x>=limits.left-.01&&p.x+p.width<=limits.right+.01);assert(p.y>=limits.top-.01&&p.y+p.height<=limits.bottom+.01);}
}
let previous=-1;for(let i=0;i<=1000;i++){const q=M.ease(i/1000);assert(q>=previous&&q>=0&&q<=1);previous=q;}
for(const hz of [30,60,120]){let value=0;for(let i=0;i<hz;i++)value=M.follow(value,1,1000/hz);assert(Math.abs(value-(1-Math.exp(-1000/85)))<1e-10,'Refresh-rate independent following');}
for(const target of [0,.25,.8,1])for(const start of [0,.4,1]){let v=start;for(let i=0;i<200;i++){const next=M.follow(v,target,16);assert(next>=Math.min(v,target)&&next<=Math.max(v,target));v=next;}assert(Math.abs(v-target)<.0001);}
assert.equal(M.wheelPixels(3,1,700),48);assert.equal(M.wheelPixels(1,2,700),700);assert.equal(M.wheelPixels(120,0,700),120);
const endLimits={left:0,right:1000,top:0,bottom:1000},from={left:200,top:500,width:52,height:52},to={left:400,top:300,width:92,height:92};
const near=M.pose(from,to,399.99,400,endLimits),end=M.pose(from,to,400,400,endLimits);assert(Math.abs(near.y-end.y)<.001,'No arc velocity kick at handoff');
const vv={width:393,height:852,scale:1};
assert(!M.viewportChanged(vv,{...vv,height:780}),'Toolbar height change must not cancel a pull');
assert(!M.viewportChanged(vv,{...vv,height:650},false),'Height alone is not proof of a keyboard');
assert(M.viewportChanged(vv,{...vv,height:500},true),'Real editing shrink cancels');
assert(M.viewportChanged(vv,{...vv,width:852}),'Rotation cancels');
assert(M.viewportChanged(vv,{...vv,scale:1.2}),'Pinch zoom cancels');
const source=fs.readFileSync(require.resolve('../js/sudo-ai-physics.js'),'utf8'),css=fs.readFileSync(require.resolve('../js/sudo-return.css'),'utf8');
assert.match(css,/width:128px;height:64px/);assert.match(css,/width:52px;height:52px/);
assert.doesNotMatch(css,/width:\s*calc\([^\n]*return-progress/);
assert.match(source,/copy.style.transform='none';copy.style.opacity='1'/,'bridge cannot inherit the hidden seed pose');
assert.match(source,/window.visualViewport\?\.addEventListener\('resize'/);
assert.match(source,/if\(returnFlight\|\|performance.now\(\)<returnGestureUntil\)return/);
assert.match(source,/returnLive.textContent='스도가 돌아왔어요'/);
assert.match(source,/prime:sudo-return-complete/);
assert.match(source,/flight.keyboard&&!document.hidden/);
assert.doesNotMatch(source,/localStorage|sessionStorage/,'motion renderer cannot become a second storage owner');
assert.match(css,/prefers-reduced-motion:reduce/);
console.log('PASS: bounded 4-size shared-element geometry, exact endpoints, monotonic easing, fixed recovery footprint, clone sanitization, cancellation and accessibility contracts.');
