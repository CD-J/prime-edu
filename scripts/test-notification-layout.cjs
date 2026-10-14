const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'..'),code=fs.readFileSync(path.join(root,'js/ui-layers.js'),'utf8');
const props={},notice={hidden:true,style:{setProperty(k,v){props[k]=parseFloat(v);}},matches(){return false;}};
let vw=390,vh=844,ax=286,ay=13,navTop=778;
const anchor={getBoundingClientRect(){return {right:ax+40,bottom:ay+42};}},nav={getBoundingClientRect(){return {height:56,top:navTop};}};
const win={innerWidth:vw,innerHeight:vh,addEventListener(){},visualViewport:{width:vw,height:vh,offsetTop:0,offsetLeft:0,addEventListener(){}}};
vm.runInNewContext(code,{window:win,document:{body:{append(){},classList:{toggle(){}}},getElementById:id=>id==='notificationPopover'?notice:id==='notificationButton'?anchor:null,querySelectorAll:()=>[],querySelector:()=>nav},MutationObserver:class{observe(){}},requestAnimationFrame(){}});
for(const [w,h] of [[320,568],[390,844],[844,390],[768,1024],[1440,900]]){
  win.visualViewport.width=w;win.visualViewport.height=h;ax=w-104;navTop=h-66;
  notice.hidden=false;win.PrimeNotificationLayout.position();
  assert.ok(props['--notice-left']>=12);
  assert.ok(props['--notice-left']+props['--notice-width']<=w-12);
  assert.ok(props['--notice-top']>=12);
  assert.ok(props['--notice-top']+props['--notice-height']<=navTop-12);
}
win.visualViewport={width:320,height:280,offsetTop:40,offsetLeft:10};navTop=0;
win.PrimeNotificationLayout.position();assert.ok(props['--notice-top']>=52);assert.ok(props['--notice-top']+props['--notice-height']<=308);
const app=fs.readFileSync(path.join(root,'js/app-shell.js'),'utf8'),css=fs.readFileSync(path.join(root,'js/notification-layout.css'),'utf8');
assert.match(app,/closest\("\.notification-wrap,#notificationPopover"\)/);
assert.match(app,/notificationCloseButton"\)\?\.focus\(\{ preventScroll: true \}\)/);
assert.match(css,/position:fixed!important; z-index:4100!important/);
assert.match(css,/#notificationPopover > header[\s\S]*position:sticky/);
assert.match(css,/minmax\(0,1fr\)/);
const motion=fs.readFileSync(path.join(root,'js/ui-audit.css'),'utf8');
assert.match(motion,/clip-path:none!important/);
assert.match(motion,/prefers-reduced-motion:reduce/);
console.log('PASS: notification viewport portal geometry, rotation, narrow/desktop widths, visual viewport, internal clicks, sticky close and focus return.');
