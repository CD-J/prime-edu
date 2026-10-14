const assert=require('node:assert/strict');
const {create,createFlight,releaseVelocity,placeOverlay}=require('../js/sudo-physics-core.js');
const bounds={minX:0,minY:0,maxX:1000,maxY:700};
function feed(m,phase,time,x,y,rawX=x,rawY=y){m.input({phase,time,pointerX:x,pointerY:y,rawX,rawY,...bounds});}
function settle(m,from,until){let s;for(let t=from;t<=until;t+=16){s=m.step(.016,t);for(const v of Object.values(s))if(typeof v==='number')assert(Number.isFinite(v));}return s;}
const slow=create();feed(slow,'start',0,100,100);
for(let t=16;t<800;t+=16){feed(slow,'move',t,100+t*.2,100);assert(!slow.step(.016,t).dizzy);}
assert(slow.step(.016,800).held&&slow.step(.016,816).press>.9,'Moving retains press compression until release');
const shake=create();feed(shake,'start',0,100,100);
for(let i=1;i<=7;i++){feed(shake,'move',i*120,i%2?220:100,100);settle(shake,(i-1)*120,i*120);}
assert(shake.step(.016,840).dizzy,'Repeated fast direction changes should trigger spiral eyes');
feed(shake,'end',850,100,100);assert(shake.step(.016,1000).dizzy);
assert(!settle(shake,1000,3600).dizzy,'Dizzy must recover after release');
for(const [name,x,y] of [['left',-50,200],['right',1050,200],['top',300,-50],['bottom',300,750]]){
 const m=create();feed(m,'start',0,300,200);feed(m,'move',16,x,y);
 const s=settle(m,16,500);assert(s[name]>.95,`${name} must compress`);
 assert(Math.abs(s.tilt*(1-s[name]))<.01,'Contact plane should stop rotating while pressed');
 feed(m,'end',510,x,y);const rest=settle(m,510,2000);assert(rest[name]<.001,`${name} must recover`);
}
const canceled=create();feed(canceled,'start',0,0,0);feed(canceled,'move',16,200,0);feed(canceled,'cancel',32,0,0);assert(!settle(canceled,32,2000).active);
console.log('PASS: gentle drag is not dizzy; repeated shake triggers/recover; four wall faces squash/recover; cancel settles; all spring values finite.');
const press=create();feed(press,'start',0,300,200);
assert(settle(press,0,1000).squeeze>.95,'Stationary hold should squeeze');
feed(press,'end',1010,300,200);assert(settle(press,1010,2300).squeeze<.001);
press.input({phase:'impact',edge:'left',speed:1000,time:2400});
assert(press.step(.016,2400).impact);assert(press.step(.016,2400).left>.5);
assert(!settle(press,2416,4000).active,'Impact should recover and stop its RAF');
const samples=[{time:0,x:100,y:100},{time:20,x:130,y:100},{time:40,x:160,y:100}];
assert.equal(releaseVelocity(samples,40).vx,1400,'Throw speed must be capped');
assert.equal(releaseVelocity(samples,200).vx,0,'Hold then release must not throw');
assert.equal(releaseVelocity([{time:1,x:1,y:1}],1).vx,0);
assert.equal(releaseVelocity([{time:0,x:1,y:1},{time:40,x:2,y:2}],40).vx,0,'Slow drop should stay');
for(const [edge,x,y,vx,vy] of [['left',5,300,-1400,0],['right',995,300,1400,0],['top',500,5,0,-1400],['bottom',500,695,0,1400]]){
 const f=createFlight({x,y,vx,vy});let hit=false,s;
 for(let i=0;i<150;i++){
  s=f.step(1/60,bounds);hit ||=s.impacts.some(h=>h.edge===edge);
  assert(s.x>=0&&s.x<=1000&&s.y>=0&&s.y<=700,'Flight stays in viewport');
  for(const k of ['x','y','vx','vy'])assert(Number.isFinite(s[k]));
 }
 assert(hit,`${edge} collision should be detected`);assert(!s.active,'Flight must settle within 1.8s');
}
const energy=createFlight({x:995,y:350,vx:1000,vy:100});let maximum=1005;
for(let i=0;i<120;i++){const s=energy.step(.016,bounds);assert(Math.hypot(s.vx,s.vy)<=maximum+.01,'Bounce must not gain energy');maximum=Math.hypot(s.vx,s.vy);}
const corner=createFlight({x:999,y:699,vx:900,vy:900});assert.equal(corner.step(.016,bounds).impacts.length,2,'Corner collision handles both walls');
const resizing=createFlight({x:950,y:650,vx:200,vy:200});const clipped=resizing.step(.05,{minX:0,minY:0,maxX:300,maxY:200});assert(clipped.x<=300&&clipped.y<=200);
const invalid=createFlight({x:NaN,y:0,vx:Infinity,vy:0});assert(!invalid.step(.016,bounds).active);
console.log('PASS: long hold/release; impact recovery; release speed cap/stale/slow; four throw collisions; bounded travel; energy damping; corner; resize; invalid input.');
const gaze=create();gaze.input({phase:'cursor',time:0,x:-300,y:0});const leftGaze=settle(gaze,0,900);
gaze.input({phase:'cursor',time:1000,x:300,y:0});const rightGaze=settle(gaze,1000,1900);assert(rightGaze.lookX-leftGaze.lookX>65,'Idle gaze must visibly track left/right cursor');
gaze.input({phase:'cursor',time:2000,x:0,y:-300});const upGaze=settle(gaze,2000,2900);
gaze.input({phase:'cursor',time:3000,x:0,y:300});const downGaze=settle(gaze,3000,3900);assert(downGaze.lookY-upGaze.lookY>55,'Idle gaze tracks above/below');
const directional=create();feed(directional,'start',0,500,300);
for(let t=16;t<=160;t+=16){feed(directional,'move',t,500-t,300);directional.step(.016,t);}
const travelLeft=directional.step(.016,176);assert(travelLeft.lookX<-50&&travelLeft.gazeMode==='travel');
directional.input({phase:'cursor',time:176,x:500,y:0});assert(directional.step(.016,192).lookX<-50,'Cursor must not overwrite travel gaze');
feed(directional,'end',200,340,300);assert(settle(directional,200,1100).lookX>-10,'Release switches back to cursor gaze');
const jelly=create();feed(jelly,'start',0,100,100);let deformed=false;
for(let t=16;t<=160;t+=16){feed(jelly,'move',t,100+t*2,100+t);const s=jelly.step(.016,t);deformed ||= Math.abs(s.rippleX)>2&&Math.abs(s.lagX)>2&&Math.abs(s.shear)>.01;}
assert(deformed,'Gel needs contour wave and lag, not only a rigid scale');
feed(jelly,'end',176,420,260);const jellyRest=settle(jelly,176,2400);
for(const k of ['lagX','lagY','rippleX','rippleY','shear'])assert(Math.abs(jellyRest[k])<.001,`${k} must settle`);
function overlaps(a,p,s){return a.left<p.x+s.width&&a.left+a.width>p.x&&a.top<p.y+s.height&&a.top+a.height>p.y;}
let placements=0;
for(const v of [{width:1000,height:600},{width:1366,height:900},{width:1920,height:1080}]){
 for(let x=-8;x<v.width-60;x+=83)for(let y=-8;y<v.height-60;y+=67){
  const a={left:x,top:y,width:72,height:72};
  for(const size of [{width:120,height:30},{width:380,height:Math.min(520,v.height-32)}]){
   const p=placeOverlay(a,size,v,{gap:20,inset:16});assert(p,'A desktop bubble should find free space');
   assert(!overlaps(a,p,size),'Neither reaction label nor chat may cover Sudo');
   assert(p.x>=16&&p.y>=16&&p.x+size.width<=v.width-16&&p.y+size.height<=v.height-16);placements++;
  }
 }
}
assert.equal(placeOverlay({left:10,top:10,width:72,height:72},{width:90,height:50},{width:100,height:100}),null,'No safe placement should hide instead of cover the mascot');
console.log(`PASS: directional/cursor gaze and priority; bounded gel contour/lag/shear recovery; ${placements} non-overlap overlay placements; tiny viewport protection.`);
