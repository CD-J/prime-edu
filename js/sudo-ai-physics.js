(function () {
  'use strict';
  const button = document.getElementById('aiFabButton');
  const holder = button?.querySelector('.sudo-ai-character');
  if (!holder || !window.PrimeSudoPhysics) return;
  const model = window.PrimeSudoPhysics.create();
  const play = window.PrimeSudoPhysics.createPlay();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const ns = 'http://www.w3.org/2000/svg';
  let svg, gel, body, eyes, gazeFollow, decorations, eyelids=[], frame = 0, lastTime = 0, dizzy = false, message = '', cursor = null;
  let sleepTimer=0, powderFrame=0, powder=null, touchY=null, wasAbsent=false, lastHaptic=0, burstHapticUntil=0;
  let speechKey='',speechUntil=0,speechTimer=0,speech='';
  let noticeObstacles=[],noticeObstacleAt=-Infinity;
  let returnFrame=0,returnFlight=null,returnVisual=0,returnTarget=0,returnVisualAt=0,returnGestureUntil=0;
  let returnBottom=false,returnPositionAt=-Infinity,scrollFrame=0,returnLineLength=0;
  const returnBlocked=()=>['journey-open','standby-open','sudo-chat-docked','sudo-guide-open','has-blocking-overlay','mobile-keyboard-open'].some(c=>document.body.classList.contains(c));
  const readReturnViewport=()=>({width:window.visualViewport?.width||innerWidth,height:window.visualViewport?.height||innerHeight,scale:window.visualViewport?.scale||1});
  let returnViewport=readReturnViewport();
  const pickLine=window.PrimeSudoDialogue?.createPicker()||(()=> '');
  let timerState=null;
  function vibrate(pattern){if((pattern===0||!reduced.matches)&&typeof navigator.vibrate==='function'){try{navigator.vibrate(pattern);}catch{}}}
  const returnButton=document.createElement('button');
  returnButton.type='button';returnButton.className='sudo-return';returnButton.hidden=true;
  returnButton.setAttribute('aria-label','스도 다시 부르기');returnButton.title='스도 다시 부르기';
  const seed=document.createElement('span');seed.className='sudo-return-seed';seed.setAttribute('aria-hidden','true');
  const returnText=document.createElement('span');returnText.className='sudo-return-text';returnText.textContent='스도';
  const returnTrack=document.createElementNS(ns,'svg');returnTrack.setAttribute('viewBox','0 0 128 64');returnTrack.setAttribute('aria-hidden','true');returnTrack.classList.add('sudo-return-track');
  const returnLine=document.createElementNS(ns,'path');returnLine.setAttribute('d','M64 62 H32 A30 30 0 0 1 2 32 A30 30 0 0 1 32 2 H96 A30 30 0 0 1 126 32 A30 30 0 0 1 96 62 Z');returnTrack.append(returnLine);
  const returnArrow=document.createElementNS(ns,'svg');returnArrow.classList.add('sudo-return-arrow');returnArrow.setAttribute('viewBox','0 0 16 16');returnArrow.setAttribute('aria-hidden','true');const arrowPath=document.createElementNS(ns,'path');arrowPath.setAttribute('d','M4 9.5 8 5.5 12 9.5');returnArrow.append(arrowPath);
  returnButton.append(returnTrack,seed,returnText,returnArrow);document.body.append(returnButton);
  const returnLive=document.createElement('span');returnLive.className='sudo-return-live';returnLive.setAttribute('aria-live','polite');returnLive.setAttribute('role','status');document.body.append(returnLive);
  const original = [166,58,219,57,257,87,264,140,273,195,249,246,198,263,149,279,99,260,77,218,52,174,63,123,94,87,112,67,138,58,166,58];
  const notice = document.createElement('span');
  notice.className = 'sudo-dizzy-notice'; notice.setAttribute('aria-live','polite');
  notice.hidden=true;document.body.append(notice);
  const noticeMotion=window.PrimeSudoNoticeMotion?.create(notice,{reduced:()=>reduced.matches});
  const showNotice=(visible,immediate=false)=>noticeMotion?noticeMotion.setVisible(visible,{immediate}):notice.hidden=!visible;
  function element(name, attrs) {
    const node = document.createElementNS(ns, name);
    Object.entries(attrs).forEach(([k,v]) => node.setAttribute(k,v)); return node;
  }
  function spiral() {
    let d='';
    for (let i=0;i<=64;i++) {
      const a=i/64*Math.PI*4.2, r=1+i/64*15;
      d+=`${i?'L':'M'}${(Math.cos(a)*r).toFixed(2)} ${(Math.sin(a)*r).toFixed(2)} `;
    }
    return d;
  }
  function attach() {
    const next=holder.querySelector('svg'); if (!next || next===svg) return;
    svg=next; gel=element('g',{'data-sudo-gel':'true'});
    while(svg.firstChild) gel.append(svg.firstChild);
    svg.append(gel);
    body=svg.querySelector('[data-body-motion] path');
    const gaze=svg.querySelector('[data-gaze]');
    if (!gaze) return;
    // Cursor/travel gaze has one owner; remove the conflicting preset gaze sway.
    Array.from(gaze.children).filter(n=>n.tagName==='animateTransform').forEach(n=>n.remove());
    gazeFollow=element('g',{'data-sudo-gaze-follow':'true'});
    gaze.parentElement.insertBefore(gazeFollow,gaze);gazeFollow.append(gaze);
    eyelids=[];
    gaze.querySelectorAll('[data-eye]').forEach(eye => {
      const anchor=eye.parentElement;anchor.classList.add('sudo-normal-eye');
      const lid=element('g',{'data-sudo-eyelid':'true'}),size=element('g',{transform:'scale(1.14)'});
      anchor.insertBefore(lid,eye);size.append(eye);lid.append(size);eyelids.push(lid);
    });
    eyes=element('g',{'class':'sudo-spiral-eyes'});
    for(const [x,y,sign] of [[-13.5,1,1],[12.5,-5,-1]]) {
      const anchor=element('g',{transform:`translate(${x} ${y})`});
      const spin=element('g',{'class':'sudo-eye-spin',style:`--spin-direction:${sign===1?'normal':'reverse'}`});
      spin.append(element('path',{d:spiral(),fill:'none',stroke:'var(--sudo-ink,#111)','stroke-width':'3.5','stroke-linecap':'round','stroke-linejoin':'round'}));
      anchor.append(spin);eyes.append(anchor);
    }
    gaze.append(eyes);
    decorations=element('g',{'class':'sudo-play-decoration','stroke':'var(--sudo-ink,#111)','stroke-width':'3','stroke-linecap':'round','stroke-linejoin':'round','fill':'var(--sudo-fill,#fff)'});
    const marks={pet:['M140 49 C120 29 141 13 151 28 C166 8 182 29 151 50Z'],
      orbit:['M64 100 L68 111 80 112 70 120 73 132 63 125 53 132 55 120 46 112 58 110Z','M272 211 L277 224 291 225 280 234 283 246 272 239 261 246 264 233 253 225 267 223Z'],
      crown:['M120 58 L115 30 137 42 152 20 168 42 192 30 185 58Z'],
      dance:['M238 52 V28 L259 23 V46 M238 52 C223 43 219 62 235 61 C241 60 241 53 238 52 M259 46 C245 38 241 56 255 55 C261 54 262 47 259 46'],
      sparkle:['M73 63 L78 78 93 83 78 88 73 103 68 88 53 83 68 78Z','M265 180 L270 195 285 200 270 205 265 220 260 205 245 200 260 195Z'],
      boing:['M73 267 Q165 292 259 267','M65 253 L56 244 M267 253 L278 244'],
      breathe:['M250 90 Q277 75 269 59 M252 111 Q287 107 280 86'],
      peek:['M268 99 L280 102 274 113','M67 109 L55 114 64 123'],
      sleep:['M220 62 H239 L220 82 H240','M247 36 H260 L247 50 H262']};
    Object.entries(marks).forEach(([name,paths])=>{
      const group=element('g',{'data-play-mark':name,'display':'none'});
      paths.forEach(d=>group.append(element('path',{d,fill:name==='sleep'?'none':'var(--sudo-fill,#fff)'})));decorations.append(group);
    });
    gel.append(decorations);
    // State changes (idle -> thinking) retain the current physical gesture.
    wake();
  }
  function draw(s,now=0,fun={charge:0,mode:''}) {
    if (!gel || !body) return;
    const l=s.left,r=s.right,t=s.top,b=s.bottom;
    const pressure=Math.max(l,r,t,b);
    // Flatten only the contacted side, then keep that plane at the wall.
    const liquid = reduced.matches ? 0 : 1-pressure;
    body.setAttribute('d',window.PrimeSudoPhysics.gelPath(original,s,now,reduced.matches));
    const swell=window.PrimeSudoPhysics.pressScale(s.press,s.squeeze,s.charge,reduced.matches);
    const tremble=reduced.matches?0:Math.sin(now*.045)*s.charge**2*1.1;
    const chargingWobble=reduced.matches?0:Math.sin(now*.009)*s.charge**1.5*.025;
    const envelope=Math.sin(Math.PI*(fun.motionProgress||0));
    const stretch=reduced.matches?0:fun.mode==='wake'?envelope*.035:fun.mode==='boing'?Math.sin((fun.motionProgress||0)*Math.PI*2)*envelope*.045:fun.mode==='breathe'?Math.sin((fun.motionProgress||0)*Math.PI*2)*.025:0;
    const area=Math.sqrt((1+s.stretchX*liquid)*(1+s.stretchY*liquid));
    const sx=((1+s.stretchX*liquid)/area-stretch+chargingWobble)*swell;
    const sy=((1+s.stretchY*liquid)/area+stretch-chargingWobble)*swell;
    const playTilt = reduced.matches || !fun.mode ? 0
      : envelope*Math.sin(now*.005 + (fun.variant||0)*1.7) * (fun.mode==='dance'?7:fun.mode==='pet'?3:1.5);
    const playBob = reduced.matches || !['dance','sparkle'].includes(fun.mode) ? 0 : envelope*Math.sin(now*.008)*4;
    const tilt=((reduced.matches?0:s.tilt)+playTilt)*(1-pressure);
    gel.setAttribute('transform',`translate(${(165+44*(r-l)+s.lagX*liquid+tremble).toFixed(3)} ${(166+38*(b-t)+s.lagY*liquid+playBob).toFixed(3)}) rotate(${tilt.toFixed(3)}) matrix(${sx.toFixed(4)} 0 ${(s.shear*liquid).toFixed(4)} ${sy.toFixed(4)} 0 0) translate(-165 -166)`);
    if (gazeFollow) gazeFollow.setAttribute('transform', `translate(${s.lookX.toFixed(2)} ${s.lookY.toFixed(2)})`);
    button.dataset.sudoGazeMode=s.gazeMode;
    // Both eyelids shrink around their own unchanged centers: no sideways slide.
    const phase=now%2600, blink=(s.held||s.flying)&&phase<170&&!reduced.matches ? 1-.94*Math.sin(phase/170*Math.PI)**2 : 1;
    eyelids.forEach((lid,i)=>{
      const happy=fun.mode==='pet'||fun.mode==='dance'||fun.mode==='sleep', wink=fun.mode==='wink'&&i===1;
      const height=fun.mode==='sleep'?.12:happy?1-.88*envelope:wink?1-.92*envelope:s.impact?Math.min(.65,blink):blink;
      lid.setAttribute('transform',`scale(1 ${height.toFixed(4)})`);
    });
    decorations?.querySelectorAll('[data-play-mark]').forEach(mark=>mark.setAttribute('display',mark.getAttribute('data-play-mark')===fun.mode?'inline':'none'));
    button.dataset.sudoPlay=fun.mode;button.dataset.sudoCharge=fun.charge.toFixed(3);
    button.dataset.sudoWall = pressure>.08 ? [['left',l],['right',r],['top',t],['bottom',b]].sort((a,b)=>b[1]-a[1])[0][0] : '';
    if (s.dizzy!==dizzy) {
      dizzy=s.dizzy;button.classList.toggle('is-sudo-dizzy',dizzy);
    }
    const category=fun.pressed?(fun.heldMs>=3000?'hold':''):s.dizzy?'dizzy':s.impact?'impact':fun.mode||(['thinking','answering','complete','checking'].includes(button.dataset.sudoState)?button.dataset.sudoState:'');
    const key=category?category+':'+fun.variant:'';
    if(key&&key!==speechKey){
      speech=pickLine(category);speechUntil=now+2600;clearTimeout(speechTimer);
      speechTimer=setTimeout(()=>{message='';speech='';positionNotice();},2600);
    }
    if(speechKey.startsWith('hold:')&&category!=='hold'){speech='';clearTimeout(speechTimer);}
    speechKey=key;message=now<speechUntil?speech:'';
    positionNotice();
  }
  function positionNotice() {
    const timeText=window.PrimeSudoPhysics.timerCaption(timerState,document.body.dataset.activeTab);
    const clock=Boolean(timeText);
    const content=message||timeText;
    // Preserve the departing caption until its fade completes.
    if(content&&notice.textContent!==content)notice.textContent=content;
    notice.classList.toggle('is-timer',Boolean(clock&&!message));
    notice.setAttribute('aria-live',clock&&!message?'off':'polite');
    const allowed=!returnFlight&&!button.disabled&&!document.hidden&&getComputedStyle(button.parentElement).display!=='none'&&getComputedStyle(button.parentElement).visibility!=='hidden'&&!returnBlocked()&&!document.body.classList.contains('personal-mind-open')&&!document.body.classList.contains('is-activity-open')&&!document.body.classList.contains('is-review-open');
    if(!allowed){showNotice(false,true);return;}
    if(!content){showNotice(false);return;}
    // Measure while unhidden, but start the entrance only once placement fits.
    // A cramped viewport must not repeatedly create/cancel an unseen animation.
    const measuring=notice.hidden;if(measuring)notice.hidden=false;
    const measured=notice.getBoundingClientRect(),size={width:notice.offsetWidth||measured.width,height:notice.offsetHeight||measured.height},hit=button.getBoundingClientRect(),drawing=gel?.getBoundingClientRect();
    if(measuring)notice.hidden=true;
    // The body can grow beyond its hit area during a hold. The bubble must clear
    // the actual SVG drawing, not just the unchanging button rectangle.
    const left=Math.min(hit.left,drawing?.left??hit.left),top=Math.min(hit.top,drawing?.top??hit.top);
    const right=Math.max(hit.right,drawing?.right??hit.right),bottom=Math.max(hit.bottom,drawing?.bottom??hit.bottom);
    const mobile=innerWidth<1000;
    const safeTop=mobile?Math.max(8,document.querySelector('.topbar')?.getBoundingClientRect().bottom||8)+8:0;
    const safeBottom=mobile?Math.min(innerHeight,document.querySelector('.bottom-nav')?.getBoundingClientRect().top||innerHeight)-8:innerHeight;
    if(mobile&&performance.now()-noticeObstacleAt>160){
      noticeObstacles=[];noticeObstacleAt=performance.now();
      document.querySelectorAll?.('.panel.is-active').forEach(scope=>{
        const text=window.PrimeSudoLayout?.readingRects?.(scope,{top:safeTop,bottom:safeBottom,width:innerWidth})||[];
        const controls=[...(scope.querySelectorAll?.('button,input,textarea')||[])].filter(n=>!n.closest('[hidden],[inert]')&&n.getClientRects().length).map(n=>n.getBoundingClientRect());
        [...text,...controls].forEach(r=>noticeObstacles.push({left:r.left,right:r.right,top:r.top-safeTop,bottom:r.bottom-safeTop}));
      });
    }
    const obstacles=mobile?noticeObstacles:[];
    const position=window.PrimeSudoPhysics.placeOverlay({left,top:top-safeTop,right,bottom:bottom-safeTop,width:right-left,height:bottom-top},size,{width:innerWidth,height:Math.max(0,safeBottom-safeTop)},{gap:16,prefer:'top',obstacles});
    if(!position){showNotice(false,true);return;}
    notice.style.left=`${position.x}px`;notice.style.top=`${position.y+safeTop}px`;notice.dataset.side=position.side;
    showNotice(true);
  }
  function tick(now) {
    frame=0;
    if(getComputedStyle(button.parentElement).display==='none'){vibrate(0);model.input({phase:'cancel'});play.input({phase:'cancel',time:now});showNotice(false,true);lastTime=0;clearTimeout(sleepTimer);return;}
    if(!button.disabled&&!model.step(0,now).held&&(!document.getElementById('aiFabPanel')?.hidden||button.dataset.sudoState!=='idle'))play.input({phase:'busy',time:now});
    const fun=play.step(now);
    // Separated taps, never overlapping motor renewals. The burst owns its
    // final three-tap pattern; browsers without vibration safely do nothing.
    if(fun.burst)burst();
    else if(fun.pressed&&now-lastHaptic>=(230-100*fun.charge)){lastHaptic=now;vibrate(fun.charge>.6?10:6);}
    if(fun.absent){lastTime=0;showNotice(false,true);return;}
    if(cursor){const rect=button.getBoundingClientRect();model.input({phase:'cursor',time:now,x:cursor.x-rect.left-rect.width/2,y:cursor.y-rect.top-rect.height/2});}
    model.input({phase:'charge',value:fun.charge});
    const state=model.step(lastTime?(now-lastTime)/1000:.016,now);lastTime=now;
    draw(state,now,fun);
    clearTimeout(sleepTimer);
    if((state.active||fun.active)&&!document.hidden)frame=requestAnimationFrame(tick);
    else {lastTime=0;if(fun.mode!=='sleep')sleepTimer=setTimeout(wake,fun.sleepDue+20);}
  }
  function wake(){if(!frame&&!document.hidden)frame=requestAnimationFrame(tick);}
  window.addEventListener('prime:sudo-drag',event=>{
    if(returnFlight||performance.now()<returnGestureUntil)return;
    model.input(event.detail);play.input(event.detail);
    if(event.detail.phase==='start'){vibrate(8);lastHaptic=performance.now();speechKey='';speech='';clearTimeout(speechTimer);}
    if(['end','cancel','settle'].includes(event.detail.phase)){if(event.detail.phase==='cancel'||performance.now()>=burstHapticUntil)vibrate(0);lastHaptic=0;}
    if(event.detail.phase==='impact'&&event.detail.edge==='bottom')play.input({phase:'landing',time:event.detail.time});
    wake();
  });
  window.addEventListener('pointermove',event=>{
    if(event.pointerType==='touch'||document.hidden)return;
    cursor={x:event.clientX,y:event.clientY};
    if(getComputedStyle(button.parentElement).display!=='none'){
      const rect=button.getBoundingClientRect();
      play.input({phase:'cursor',time:performance.now(),x:(cursor.x-rect.left-rect.width/2)/rect.width,y:(cursor.y-rect.top-rect.height/2)/rect.height});wake();
    }
  },{passive:true});
  window.addEventListener('resize',wake);
  window.addEventListener('prime:pomodoro-state',event=>{
    const completed = timerState?.running && timerState.mode==='focus' && !event.detail.running && event.detail.mode==='break';
    const paused=timerState?.running&&!event.detail.running&&!completed;
    timerState=event.detail;
    if(completed){play.input({phase:'celebrate',time:performance.now()});wake();}
    else if(paused&&event.detail.remainingSec>0){play.input({phase:'pause',time:performance.now()});wake();}
    positionNotice();
  });
  function queueScrollPaint(){
    if(scrollFrame||document.hidden)return;
    scrollFrame=requestAnimationFrame(()=>{scrollFrame=0;noticeObstacleAt=-Infinity;positionNotice();if(wasAbsent)updateReturn(play.step(performance.now()));});
  }
  window.addEventListener('scroll',queueScrollPaint,{passive:true});
    window.addEventListener('prime:notebook-content-change',()=>{noticeObstacleAt=-Infinity;positionNotice();});
  button.addEventListener('click',()=>{if(!reduced.matches){model.input({phase:'poke',time:performance.now()});wake();}});
  button.addEventListener('dblclick',()=>{play.input({phase:'wink',time:performance.now()});wake();});
  button.addEventListener('keydown',event=>{play.input({phase:'key',key:event.key,time:performance.now()});wake();});
  function clearPowder(){cancelAnimationFrame(powderFrame);powderFrame=0;powder?.remove();powder=null;}
  function burst(){
    returnBottom=false;returnViewport=readReturnViewport();
    const rect=button.getBoundingClientRect();wasAbsent=true;button.disabled=true;button.classList.add('is-sudo-absent');
    document.getElementById('aiFabClose')?.click();showNotice(false,true);clearTimeout(sleepTimer);
    window.dispatchEvent(new CustomEvent('prime:sudo-burst'));
    model.input({phase:'reset'});
    burstHapticUntil=performance.now()+108;vibrate([10,32,12,38,16]);
    clearPowder();
    if(!reduced.matches){
      powder=document.createElement('canvas');const density=Math.min(devicePixelRatio||1,2);powder.width=320*density;powder.height=320*density;powder.className='sudo-powder';powder.setAttribute('aria-hidden','true');
      const cx=rect.left+rect.width/2,cy=rect.top+rect.height/2;
      const px=Math.max(0,Math.min(innerWidth-320,cx-160)),py=Math.max(0,Math.min(innerHeight-320,cy-160));
      powder.style.left=`${px}px`;powder.style.top=`${py}px`;document.body.append(powder);
      const ctx=powder.getContext('2d'),begin=performance.now();
      const theme=getComputedStyle(button),ink=theme.getPropertyValue('--shell-ink').trim()||'#333',accent=theme.getPropertyValue('--shell-blue').trim()||'#aaa';
      if(ctx){ctx.scale(density,density);const animate=now=>{
        const t=Math.min((now-begin)/1250,1);ctx.clearRect(0,0,320,320);
        const ox=cx-px,oy=cy-py;
        for(let ring=0;ring<2;ring++){
          const q=Math.max(0,Math.min(1,t*2-ring*.15));ctx.globalAlpha=(1-q)*.45;ctx.strokeStyle=accent;ctx.lineWidth=2-ring*.6;ctx.beginPath();ctx.arc(ox,oy,12+q*125,0,Math.PI*2);ctx.stroke();
        }
        for(let i=0;i<112;i++){
          const age=Math.max(0,t-(i%7)*.011),a=i*2.39996,dist=12+(1-Math.exp(-age*4))*(45+i%13*6);
          const x=ox+Math.cos(a)*dist,y=oy+Math.sin(a)*dist+age*age*(i%4+1)*20;
          ctx.globalAlpha=Math.max(0,(1-age)**1.8)*(i%4?.85:1);ctx.fillStyle=i%4?ink:accent;
          ctx.save();ctx.translate(x,y);ctx.rotate(a+age*3);ctx.beginPath();
          if(i<20){ctx.ellipse(0,0,Math.max(.2,(4+i%3)*(1-age)),Math.max(.2,(1.5+i%2)*(1-age)),0,0,Math.PI*2);}
          else if(i%9===0){const z=(3+i%3)*(1-age);ctx.moveTo(-z,0);ctx.lineTo(0,-z*1.8);ctx.lineTo(z,0);ctx.lineTo(0,z*1.8);ctx.closePath();}
          else ctx.arc(0,0,Math.max(.2,(1+i%4*.5)*(1-age*.7)),0,Math.PI*2);
          ctx.fill();ctx.restore();
        }
        if(t<1&&!document.hidden)powderFrame=requestAnimationFrame(animate);else clearPowder();
      };powderFrame=requestAnimationFrame(animate);}else clearPowder();
    }
    // An accessible recovery control remains even if overscroll is unavailable.
    updateReturn(play.step(performance.now()));
  }
  function revive(event){
    if(!wasAbsent||returnFlight)return;
    const view=window.visualViewport,header=document.querySelector?.('.topbar')?.getBoundingClientRect(),nav=document.querySelector?.('.bottom-nav')?.getBoundingClientRect();
    const limits={left:8,right:innerWidth-8,top:Math.max(view?.offsetTop||0,header?.bottom||8)+8,bottom:Math.min((view?.offsetTop||0)+(view?.height||innerHeight),nav?.height>0?nav.top:innerHeight)-8};
    const copy=seed.querySelector('svg')?.cloneNode(true),from=seed.querySelector('svg')?.getBoundingClientRect();
    const click=Boolean(event),keyboard=event?.detail===0,motion=window.PrimeSudoReturnMotion;
    const flight={frame:0,bridge:null,keyboard,start:performance.now(),phase:'prepare',limits,from,copy};returnFlight=flight;
    returnButton.disabled=true;returnButton.setAttribute('aria-busy','true');showNotice(false,true);returnLive.textContent='';clearPowder();
    function commit(){
      if(returnFlight!==flight)return;
      const source=seed.querySelector('svg')?.getBoundingClientRect()||from;
      wasAbsent=false;button.classList.add('is-sudo-returning');button.classList.remove('is-sudo-absent');
      // app-shell still owns the target and its persisted coordinates.
      window.dispatchEvent(new CustomEvent('prime:sudo-revive',{detail:{safeBottom:limits.bottom}}));
      returnButton.classList.add('is-departing');
      const target=holder.getBoundingClientRect(),wrap=button.parentElement;
      if(reduced.matches||!motion||!copy||!source?.width||!target.width||limits.bottom-limits.top<target.height||getComputedStyle(wrap).visibility==='hidden'||getComputedStyle(wrap).display==='none'){finishReturn();return;}
      const bridge=document.createElement('span');bridge.className='sudo-return-bridge';bridge.setAttribute('aria-hidden','true');
      const theme=getComputedStyle(seed);for(const token of ['--sudo-fill','--sudo-ink'])bridge.style.setProperty(token,theme.getPropertyValue(token));
      copy.style.transform='none';copy.style.opacity='1';copy.style.width='100%';copy.style.height='100%';
      bridge.style.width=`${target.width}px`;bridge.style.height=`${target.height}px`;bridge.append(copy);document.body.append(bridge);flight.bridge=bridge;
      flight.from=source;flight.to=target;flight.travel=motion.duration(source,target);flight.start=performance.now();flight.phase='travel';
      const animate=now=>{
        if(returnFlight!==flight)return;
        // Safari's toolbar can change height during a pull. Follow the owner's
        // current rect instead of cancelling a valid gesture or using a stale end.
        flight.to=holder.getBoundingClientRect();
        const liveNav=document.querySelector?.('.bottom-nav')?.getBoundingClientRect(),liveView=window.visualViewport;
        limits.bottom=Math.min((liveView?.offsetTop||0)+(liveView?.height||innerHeight),liveNav?.height>0?liveNav.top:innerHeight)-8;
        const pose=motion.pose(flight.from,flight.to,now-flight.start,flight.travel,limits);
        bridge.style.transform=`translate3d(${pose.x}px,${pose.y}px,0) scale(${pose.width/target.width},${pose.height/target.height})`;
        if(pose.done){finishReturn();return;}flight.frame=requestAnimationFrame(animate);
      };animate(flight.start);
    }
    if(!reduced.matches&&click&&returnVisual<.99){
      const initial=returnVisual,prepare=now=>{if(returnFlight!==flight)return;const p=Math.min(1,(now-flight.start)/160);paintReturn(initial+(1-initial)*p);if(p<1)flight.frame=requestAnimationFrame(prepare);else commit();};
      cancelAnimationFrame(returnFrame);returnFrame=0;flight.frame=requestAnimationFrame(prepare);
    }else {paintReturn(1);commit();}
  }
  function finishReturn(){
    const flight=returnFlight;if(!flight)return;
    cancelAnimationFrame(flight.frame);returnFlight=null;
    if(wasAbsent){wasAbsent=false;window.dispatchEvent(new CustomEvent('prime:sudo-revive',{detail:{safeBottom:flight.limits.bottom}}));}
    model.input({phase:'reset'});draw(model.step(0,performance.now()),performance.now(),{charge:0,mode:''});
    button.classList.remove('is-sudo-absent','is-sudo-returning');button.disabled=false;
    if(flight.bridge){const from=flight.bridge.getBoundingClientRect(),to=holder.getBoundingClientRect();window.dispatchEvent(new CustomEvent('prime:sudo-return-handoff',{detail:{dx:from.left-to.left,dy:from.top-to.top,dw:from.width-to.width,dh:from.height-to.height,interrupted:performance.now()-flight.start<(flight.travel||0)+140}}));flight.bridge.remove();}
    returnButton.hidden=true;returnButton.disabled=false;returnButton.classList.remove('is-departing');returnButton.removeAttribute('aria-busy');
    play.input({phase:'revive',time:performance.now()});returnGestureUntil=performance.now()+400;
    cancelAnimationFrame(returnFrame);returnFrame=0;returnVisual=returnTarget=0;seed.replaceChildren();speech='';speechKey='';message='';
    returnLive.textContent='스도가 돌아왔어요';vibrate([8,30,12]);wake();
    window.dispatchEvent(new CustomEvent('prime:sudo-return-complete'));
    if(flight.keyboard&&!document.hidden&&getComputedStyle(button.parentElement).visibility!=='hidden'&&getComputedStyle(button.parentElement).display!=='none')button.focus({preventScroll:true});
  }
  function paintReturn(p){
    returnVisual=Math.max(0,Math.min(1,p));returnButton.style.setProperty('--return-progress',returnVisual.toFixed(3));
    const copy=seed.querySelector('svg'),face=Math.max(0,Math.min(1,(returnVisual-.12)/.28));
    if(copy){copy.style.transform=`translateY(${-6*returnVisual}px) scale(${.24+.76*returnVisual})`;copy.style.opacity=String(face);}
    const dot=seed.querySelector('.sudo-return-dot');if(dot)dot.style.opacity=String(Math.max(0,1-returnVisual/.22));
    if(!returnLineLength)returnLineLength=returnLine.getTotalLength?.()||317;
    returnLine.style.strokeDasharray=String(returnLineLength);returnLine.style.strokeDashoffset=String(returnLineLength*(1-returnVisual));
    returnArrow.style.transform=`translateY(${-3*returnVisual}px)`;
  }
  function animateReturnProgress(now){
    returnFrame=0;if(returnButton.hidden||returnFlight){returnVisualAt=0;return;}
    const dt=returnVisualAt?now-returnVisualAt:16;returnVisualAt=now;
    paintReturn(reduced.matches?returnTarget:window.PrimeSudoReturnMotion.follow(returnVisual,returnTarget,dt));
    // Let the visible seed finish following the finger before handing it to
    // the shared element. Raw wheel/touch progress must not cause a size jump.
    if(returnTarget>=1&&returnVisual>=.995){paintReturn(1);returnVisualAt=0;revive();return;}
    if(Math.abs(returnVisual-returnTarget)>.001)returnFrame=requestAnimationFrame(animateReturnProgress);else {paintReturn(returnTarget);returnVisualAt=0;}
  }
  function positionReturn(){
    returnPositionAt=performance.now();
    const view=window.visualViewport,header=document.querySelector?.('.topbar')?.getBoundingClientRect(),nav=document.querySelector?.('.bottom-nav')?.getBoundingClientRect();
    const floor=Math.min((view?.offsetTop||0)+(view?.height||innerHeight),nav?.height>0?nav.top:innerHeight)-12;
    const limits={minX:12,maxX:innerWidth-140,minY:Math.max(view?.offsetTop||0,header?.bottom||8)+12,maxY:floor-64};
    const point={x:(innerWidth-128)/2,y:floor-64},controls=[];
    document.querySelectorAll?.('.panel.is-active').forEach(scope=>{
      controls.push(...(window.PrimeSudoLayout?.readingRects?.(scope,{top:limits.minY,bottom:floor,width:innerWidth})||[]));
      [...(scope.querySelectorAll?.('button,input,textarea')||[])].filter(n=>!n.closest('[hidden],[inert]')&&n.getClientRects().length).forEach(n=>controls.push(n.getBoundingClientRect()));
    });
    const clear=window.PrimeSudoLayout?.avoidControls(point,{width:128,height:64},limits,controls)||point;
    returnButton.style.left=`${clear.x}px`;returnButton.style.top=`${clear.y}px`;returnButton.style.bottom='auto';
  }
  function updateReturn(s){
    if(returnFlight)return;
    const blocked=returnBlocked();
    if(!s.absent||document.hidden||blocked){returnButton.hidden=true;resetReturnProgress();return;}
    const page=document.scrollingElement||document.documentElement;
    returnBottom=page.scrollHeight-page.clientHeight-page.scrollTop<(returnBottom?24:5);
    if(!returnBottom){returnButton.hidden=true;resetReturnProgress();return;}
    const showing=returnButton.hidden;returnButton.hidden=false;
    if(showing||performance.now()-returnPositionAt>160)positionReturn();returnTarget=s.progress;
    if(!seed.firstChild){
      const copy=holder.querySelector('svg')?.cloneNode(true);if(copy){
        copy.querySelectorAll('animate,animateTransform,.sudo-play-decoration').forEach(n=>n.remove());
        copy.querySelector('[data-sudo-gel]')?.removeAttribute('transform');
        copy.querySelector('[data-sudo-gaze-follow]')?.setAttribute('transform','translate(0 0)');
        copy.querySelector('[data-body-motion] path')?.setAttribute('d',window.PrimeSudoPhysics.gelPath(original,{left:0,right:0,top:0,bottom:0,charge:0,rippleX:0,rippleY:0},0,true));
        copy.querySelectorAll('[data-sudo-eyelid]').forEach(lid=>lid.setAttribute('transform','scale(1 1)'));const dot=document.createElement('span');dot.className='sudo-return-dot';seed.append(dot,copy);paintReturn(returnVisual);
      }
    }
    if(s.reviveReady&&reduced.matches){paintReturn(1);revive();}else if(!returnFrame)returnFrame=requestAnimationFrame(animateReturnProgress);
  }
  function resetReturnProgress(){
    cancelAnimationFrame(returnFrame);returnFrame=0;returnVisualAt=0;
    if(wasAbsent){play.input({phase:'return-cancel'});returnVisual=returnTarget=0;paintReturn(0);}
  }
  function scrollReturn(delta){
    if(!wasAbsent||document.hidden||returnBlocked()||!Number.isFinite(delta))return;
    const page=document.scrollingElement||document.documentElement;
    const atBottom=page.scrollHeight-page.clientHeight-page.scrollTop<(returnBottom?24:5);returnBottom=atBottom;
    play.input({phase:'scroll',delta,atBottom,time:performance.now()});queueScrollPaint();
  }
  window.addEventListener('wheel',e=>scrollReturn(window.PrimeSudoReturnMotion?.wheelPixels(e.deltaY,e.deltaMode,innerHeight)??e.deltaY),{passive:true});
  window.addEventListener('touchstart',e=>{touchY=e.touches.length===1?e.touches[0].clientY:null;},{passive:true});
  window.addEventListener('touchmove',e=>{if(touchY!==null&&e.touches.length===1){const y=e.touches[0].clientY;scrollReturn(touchY-y);touchY=y;}},{passive:true});
  window.addEventListener('touchend',()=>{touchY=null;},{passive:true});
  window.addEventListener('touchcancel',()=>{touchY=null;finishReturn();resetReturnProgress();},{passive:true});
  returnButton.addEventListener('click',revive);
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){finishReturn();resetReturnProgress();vibrate(0);cancelAnimationFrame(scrollFrame);scrollFrame=0;model.input({phase:'cancel'});play.input({phase:'cancel',time:performance.now()});clearTimeout(sleepTimer);clearTimeout(speechTimer);speech='';speechKey='';message='';clearPowder();cancelAnimationFrame(frame);frame=0;lastTime=0;draw(model.step(.032,Infinity));showNotice(false,true);returnButton.hidden=true;}
    else {updateReturn(play.step(performance.now()));wake();}
  });
  function returnViewportChange(){
    returnPositionAt=-Infinity;
    const next=readReturnViewport(),active=document.activeElement,editing=Boolean(active&&(['INPUT','TEXTAREA','SELECT'].includes(active.tagName)||active.isContentEditable));
    const changed=window.PrimeSudoReturnMotion?.viewportChanged(returnViewport,next,editing);
    if(changed||document.body.classList.contains('mobile-keyboard-open')){finishReturn();resetReturnProgress();returnBottom=false;}
    returnViewport=next;if(wasAbsent)updateReturn(play.step(performance.now()));
  }
  window.addEventListener('resize',returnViewportChange);
  window.visualViewport?.addEventListener('resize',returnViewportChange);
  window.visualViewport?.addEventListener('scroll',returnViewportChange);
  reduced.addEventListener('change',()=>{noticeMotion?.finish();if(reduced.matches){finishReturn();vibrate(0);}wake();});
  new MutationObserver(attach).observe(holder,{childList:true});
  let activePage=document.body.dataset.activeTab;
  new MutationObserver(()=>{if(activePage!==document.body.dataset.activeTab){finishReturn();resetReturnProgress();activePage=document.body.dataset.activeTab;speech='';speechKey='';message='';clearTimeout(speechTimer);showNotice(false,true);}if(returnBlocked())finishReturn();if(wasAbsent)updateReturn(play.step(performance.now()));wake();}).observe(document.body,{attributes:true,attributeFilter:['class','data-active-tab']});
  attach();
})();
