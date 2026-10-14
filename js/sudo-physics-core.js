(function (root) {
  'use strict';
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  function create() {
    const values = { tilt: 0, stretchX: 0, stretchY: 0, shear: 0, lagX: 0, lagY: 0, rippleX: 0, rippleY: 0,
      left: 0, right: 0, top: 0, bottom: 0, squeeze: 0, press: 0, charge: 0, lookX: 0, lookY: 0 };
    const velocity = Object.fromEntries(Object.keys(values).map(k => [k, 0]));
    const target = { ...values };
    let held = false, last = null, direction = null, leg = 0, turns = [], dizzyUntil = 0, lastMove = 0, heldSince = 0, impactUntil = 0, throwUntil = 0;
    let cursorLook = { x: 0, y: 0 };
    function look(dx,dy,strength=1) {
      const length=Math.hypot(dx,dy), amount=length ? clamp(strength,0,1)/length : 0;
      // Move the face across the body, not only one pixel in the top-right corner.
      target.lookX=-41+dx*amount*35; target.lookY=35+dy*amount*29;
    }
    function cursorGaze(){target.lookX=cursorLook.x;target.lookY=cursorLook.y;}
    function jelly(vx,vy) {
      target.tilt=clamp(vx*3,-7,7);
      target.stretchX=clamp(Math.abs(vx)*.065-Math.abs(vy)*.035,-.095,.16);
      target.stretchY=clamp(Math.abs(vy)*.065-Math.abs(vx)*.035,-.095,.16);
      target.lagX=clamp(-vx*4,-12,12); target.lagY=clamp(-vy*4,-12,12);
      target.shear=clamp(-vx*.024,-.06,.06);
      target.rippleX=clamp(vx*4.5,-9,9); target.rippleY=clamp(vy*4.5,-9,9);
      if(Math.hypot(vx,vy)>.015)look(vx,vy,clamp(Math.hypot(vx,vy)/.25,.35,1));
    }
    function relaxJelly(){for(const key of ['tilt','stretchX','stretchY','shear','lagX','lagY','rippleX','rippleY'])target[key]=0;}
    function input(e) {
      if(e.phase==='reset'){
        held=false;last=null;direction=null;turns=[];dizzyUntil=impactUntil=throwUntil=0;
        Object.keys(values).forEach(k=>{values[k]=velocity[k]=target[k]=0;});cursorGaze();return;
      }
      if(e.phase==='charge'){target.charge=clamp(Number(e.value)||0,0,1);return;}
      if (e.phase === 'cursor') {
        if(!Number.isFinite(e.x)||!Number.isFinite(e.y))return;
        const length=Math.hypot(e.x,e.y), amount=length ? Math.min(length/100,1)/length : 0;
        cursorLook={x:-41+e.x*amount*35,y:35+e.y*amount*29};
        if(!held&&e.time>=throwUntil)cursorGaze();
        return;
      }
      if (e.phase === 'poke') {
        values.press = .65; velocity.press = 0;
        return;
      }
      if (e.phase === 'impact') {
        const power = clamp((Number(e.speed) || 0) / 1100, .12, .9);
        if (['left','right','top','bottom'].includes(e.edge)) {
          values[e.edge] = Math.max(values[e.edge], power);
          velocity[e.edge] = 0;
          target[e.edge] = 0;
        }
        impactUntil = e.time + 620;
        return;
      }
      if (e.phase === 'flight') {
        const vx = (Number(e.vx) || 0) / 1000, vy = (Number(e.vy) || 0) / 1000;
        jelly(vx,vy);
        throwUntil = e.time + 140;
        return;
      }
      if (e.phase === 'start') {
        held = true; last = e; direction = null; leg = 0; turns = []; lastMove = heldSince = e.time;
        impactUntil = throwUntil = 0;
        target.press = 1;
        return;
      }
      if (e.phase !== 'move') {
        held = false; last = null; direction = null; turns = [];
        Object.keys(target).forEach(k => target[k] = 0);
        cursorGaze();
        if (e.phase === 'cancel') dizzyUntil = impactUntil = throwUntil = 0;
        return;
      }
      if (!held || !last) return;
      const dt = clamp(e.time - last.time, 8, 80);
      const dx = e.pointerX - last.pointerX, dy = e.pointerY - last.pointerY;
      const distance = Math.hypot(dx, dy), speed = distance / dt;
      const vx = dx / dt, vy = dy / dt;
      jelly(vx,vy);
      // Pointer capture keeps the same press alive while the jelly travels.
      target.press = 1;
      target.left = clamp((e.minX - e.rawX) / 36, 0, 1);
      target.right = clamp((e.rawX - e.maxX) / 36, 0, 1);
      target.top = clamp((e.minY - e.rawY) / 36, 0, 1);
      target.bottom = clamp((e.rawY - e.maxY) / 36, 0, 1);
      if (distance >= 3 && speed > .35) {
        const next = { x: dx / distance, y: dy / distance };
        if (direction && direction.x * next.x + direction.y * next.y < -.45 && leg >= 18) {
          turns = turns.filter(t => e.time - t < 1500);
          turns.push(e.time);
          if (turns.length >= 4) dizzyUntil = e.time + 2600;
          leg = distance;
        } else leg += distance;
        direction = next;
      }
      last = e; lastMove = e.time;
    }
    function step(dt, now) {
      // Quiet hands stop wobbling; a held wall remains compressed until release.
      if (held && now - lastMove > 80) {
        relaxJelly();
        // A stationary long press squashes the balloon without navigating to chat.
        target.squeeze = Math.max(target.left,target.right,target.top,target.bottom) < .05 ? clamp((now - heldSince - 430) / 300, 0, 1) : 0;
      }
      if (!held && now >= throwUntil) {relaxJelly();cursorGaze();}
      dt = clamp(dt, 0, .032);
      for (let t = dt; t > 0; t -= .008) {
        const h = Math.min(t, .008);
        for (const k of Object.keys(values)) {
          const wall = ['left','right','top','bottom'].includes(k);
          const gaze = k==='lookX'||k==='lookY', ripple=k==='rippleX'||k==='rippleY';
          const stiffness = wall ? 230 : gaze ? 240 : ripple ? 125 : 180;
          const damping = wall ? 29 : gaze ? 31 : k==='charge'?27 : ripple ? 12 : 16;
          velocity[k] += (stiffness * (target[k] - values[k]) - damping * velocity[k]) * h;
          values[k] += velocity[k] * h;
          if (wall) values[k] = clamp(values[k], 0, 1);
        }
      }
      const unsettled = Object.keys(values).some(k => Math.abs(values[k]-target[k]) > .0005 || Math.abs(velocity[k]) > .005);
      return { ...values, held, gazeMode:held||now<throwUntil?'travel':'cursor', dizzy: now < dizzyUntil, impact: now < impactUntil, flying: now < throwUntil,
        active: held || unsettled || now < dizzyUntil || now < impactUntil || now < throwUntil };
    }
    return { input, step };
  }
  // Local-only play state. Never reads chat text or stores pointer/key history.
  function createPlay({random=Math.random}={}) {
    let absent=false, pressed=false, start=0, idle=0, amount=0;
    let mode='', until=0, lastAngle=null, angleTime=0, orbit=0, petDistance=0, petLast=null;
    let keys='', keyTime=0, cooldown=0, variant=0, effectStart=0, effectDuration=1900;
    function chooseVariant() { variant=(variant+1+Math.floor(random()*12))%13; }
    function effect(name,time,duration=1900,explicit=false) {
      if(absent||pressed||(!explicit&&time<cooldown))return;
      chooseVariant();effectStart=time;effectDuration=duration;mode=name;until=time+duration;cooldown=time+duration+800;
    }
    function input(e) {
      const time=Number.isFinite(e.time)?e.time:0;
      if(e.phase==='revive') {absent=false;pressed=false;amount=0;mode='wake';chooseVariant();effectStart=time;effectDuration=1400;until=time+1400;idle=time;cooldown=until;return;}
      if(e.phase==='return-cancel'){if(absent)amount=0;return;}
      if(e.phase==='scroll') {if(absent&&e.atBottom&&Number.isFinite(e.delta))amount=clamp(amount+clamp(e.delta,-80,120),0,520);return;}
      if(absent)return;
      if(e.phase==='start'){pressed=true;chooseVariant();start=idle=time;mode='';petLast=null;orbit=0;return;}
      if(e.phase==='move'){idle=time;return;}
      if(['end','cancel','settle','busy'].includes(e.phase)){pressed=false;idle=time;if(e.phase==='busy')mode='';return;}
      if(e.phase==='celebrate'){idle=time;effect('sparkle',time,2400,true);return;}
      if(e.phase==='landing'){idle=time;effect('boing',time,1800);return;}
      if(e.phase==='pause'){idle=time;effect('breathe',time,2000,true);return;}
      if(e.phase==='peek'){idle=time;effect('peek',time,1600);return;}
      if(e.phase==='wink'){idle=time;effect('wink',time,1300,true);return;}
      if(e.phase==='key'){
        if(time-keyTime>3500)keys='';keyTime=time;
        const map={ArrowUp:'U',ArrowDown:'D',ArrowLeft:'L',ArrowRight:'R'};
        if(!map[e.key])return;
        keys=(keys+map[e.key]).slice(-4);if(keys==='UUDD'){effect('crown',time,2800,true);keys='';}
        else if(keys==='LRLR'){effect('dance',time,2400,true);keys='';}
        else if(keys==='UDUD'){effect('sparkle',time,2400,true);keys='';}return;
      }
      if(e.phase==='cursor'){
        if(!Number.isFinite(e.x)||!Number.isFinite(e.y))return;
        idle=time;
        if(mode==='sleep'){mode='wake';chooseVariant();effectStart=time;effectDuration=1100;until=time+1100;cooldown=until;}
        if(pressed)return;
        const distance=Math.hypot(e.x,e.y);
        if(e.y<-.06&&e.y>-.5&&Math.abs(e.x)<.43){
          if(petLast&&time-petLast.time<240)petDistance+=Math.min(Math.abs(e.x-petLast.x),.35);
          else petDistance=0;
          petLast={x:e.x,time};
          if(petDistance>1.5){effect('pet',time);petDistance=0;}
        }else{petLast=null;petDistance=0;}
        if(distance>.55&&distance<2.2){
          const angle=Math.atan2(e.y,e.x);
          if(lastAngle!==null&&time-angleTime<300){
            const delta=Math.atan2(Math.sin(angle-lastAngle),Math.cos(angle-lastAngle));
            if(Math.abs(delta)<.65)orbit+=delta;else orbit=0;
            if(Math.abs(orbit)>Math.PI*1.85){effect('orbit',time,2200);orbit=0;}
          }else orbit=0;
          lastAngle=angle;angleTime=time;
        }else{lastAngle=null;orbit=0;}
      }
    }
    function step(now) {
      let burst=false;
      if(!absent&&pressed&&now-start>=5300){absent=true;pressed=false;mode='';amount=0;burst=true;}
      if(mode&&mode!=='sleep'&&now>=until)mode='';
      if(!absent&&!pressed&&!mode&&now-idle>=25000)mode='sleep';
      const charge=pressed?clamp((now-start-500)/4800,0,1):0;
      return {absent,burst,charge,pressed,heldMs:pressed?Math.max(0,now-start):0,mode,variant,motionProgress:clamp((now-effectStart)/effectDuration,0,1),progress:amount/520,reviveReady:absent&&amount>=520,
        active:!absent&&(pressed||(mode&&mode!=='sleep')),sleepDue:Math.max(0,25000-(now-idle))};
    }
    return {input,step};
  }
  function placeOverlay(anchor,size,viewport,options={}) {
    const inset=options.inset??12,gap=options.gap??18,w=size.width,h=size.height;
    const a={left:anchor.left??anchor.x,top:anchor.top??anchor.y};a.right=a.left+anchor.width;a.bottom=a.top+anchor.height;
    const cx=(a.left+a.right)/2,cy=(a.top+a.bottom)/2;
    const horizontal=clamp(cx-w/2,inset,Math.max(inset,viewport.width-w-inset));
    const vertical=clamp(cy-h/2,inset,Math.max(inset,viewport.height-h-inset));
    const candidates={top:{x:horizontal,y:a.top-gap-h},bottom:{x:horizontal,y:a.bottom+gap},
      left:{x:a.left-gap-w,y:vertical},right:{x:a.right+gap,y:vertical}};
    const order=[options.prefer??'top','right','left','bottom','top'];
    for(const side of [...new Set(order)]){
      const p=candidates[side];if(!p)continue;
      const blocked=(options.obstacles||[]).some(r=>p.x<r.right+6&&p.x+w>r.left-6&&p.y<r.bottom+6&&p.y+h>r.top-6);
      if(!blocked&&p.x>=inset&&p.y>=inset&&p.x+w<=viewport.width-inset&&p.y+h<=viewport.height-inset)return {...p,side};
    }
    // An impossibly small viewport must not put a floating label on the mascot.
    return null;
  }
  // These coefficients are authored for Sudo, NOT Supercell's private game code.
  function releaseVelocity(samples, now) {
    const recent = samples.filter(s => Number.isFinite(s.time) && Number.isFinite(s.x) && Number.isFinite(s.y) && now - s.time <= 100);
    if (recent.length < 2 || now - recent.at(-1).time > 70) return { vx: 0, vy: 0 };
    const first = recent[0], last = recent.at(-1), dt = last.time - first.time;
    if (dt < 12) return { vx: 0, vy: 0 };
    let vx = (last.x - first.x) / dt * 1000, vy = (last.y - first.y) / dt * 1000;
    const speed = Math.hypot(vx, vy), scale = speed > 1400 ? 1400 / speed : 1;
    vx *= scale; vy *= scale;
    return speed < 180 ? { vx: 0, vy: 0 } : { vx, vy };
  }
  function createFlight(initial) {
    let { x, y, vx, vy } = initial, elapsed = 0, active = true;
    if (![x,y,vx,vy].every(Number.isFinite)) { x = y = vx = vy = 0; active = false; }
    return { step(dt, b) {
      const impacts = [];
      dt = clamp(Number(dt) || 0, 0, .05); elapsed += dt;
      for (let remaining = dt; remaining > 0 && active; remaining -= .008) {
        const h = Math.min(remaining, .008), attenuation = Math.exp(-3.4 * h);
        vx *= attenuation; vy *= attenuation; x += vx * h; y += vy * h;
        for (const [axis, lo, hi, negative, positive] of [['x',b.minX,b.maxX,'left','right'],['y',b.minY,b.maxY,'top','bottom']]) {
          const position = axis === 'x' ? x : y, speed = axis === 'x' ? vx : vy;
          if ((position <= lo && speed < 0) || (position >= hi && speed > 0)) {
            impacts.push({ edge: speed < 0 ? negative : positive, speed: Math.abs(speed) });
            if (axis === 'x') { x = clamp(position,lo,hi); vx *= -.46; vy *= .88; }
            else { y = clamp(position,lo,hi); vy *= -.46; vx *= .88; }
          }
        }
        x = clamp(x,b.minX,b.maxX); y = clamp(y,b.minY,b.maxY);
        if (Math.hypot(vx,vy) < 12 || elapsed > 1.8) { active = false; vx = vy = 0; }
      }
      return { x,y,vx,vy,active,impacts };
    } };
  }
  function pressScale(press,squeeze,charge,reduced=false){
    const c=clamp(Number(charge)||0,0,1);
    const compression=(clamp(Number(press)||0,0,1)*(reduced?.05:.20)+clamp(Number(squeeze)||0,0,1)*.025)*(1-c*.75);
    return (1-compression)*(1+c*(reduced?.15:1.18));
  }
  function surfaceWave(theta,now,charge){
    const c=clamp(Number(charge)||0,0,1),a=Number(theta)||0,t=Number(now)||0;
    if(c===0)return 0;
    // Smooth travelling lobes accelerate into a deliberately exaggerated wobble.
    const amplitude=22*c**1.4,phase=t*.008;
    return amplitude*(Math.sin(a*2-phase)+.42*Math.sin(a*3+phase*1.15)+.15*c*Math.sin(a*4-phase*.8));
  }
  // Closed centripetal-looking cubic contour: shared tangent at every join,
  // unlike independently jittering the old Bezier control points.
  function gelPath(outline,state,now,reduced=false) {
    const points=[]; const pressure=Math.max(state.left,state.right,state.top,state.bottom);
    for(let k=0;k<(outline.length-2)/6;k++) {
      const i=2+k*6,from=k?outline.slice(i-2,i):outline.slice(0,2);
      const c1=outline.slice(i,i+2),c2=outline.slice(i+2,i+4),to=outline.slice(i+4,i+6);
      for(let j=0;j<6;j++) {
        const u=j/6,v=1-u;
        let x=v*v*v*from[0]+3*v*v*u*c1[0]+3*v*u*u*c2[0]+u*u*u*to[0];
        let y=v*v*v*from[1]+3*v*v*u*c1[1]+3*v*u*u*c2[1]+u*u*u*to[1];
        const a=Math.atan2(y-166,x-165),wave=reduced?0:surfaceWave(a,now,state.charge)*(1-pressure);
        x+=wave*Math.cos(a)+(reduced?0:state.rippleX*Math.sin((y-166)/110*Math.PI*.72))*(1-pressure);
        y+=wave*Math.sin(a)+(reduced?0:state.rippleY*Math.sin((x-165)/110*Math.PI*.72))*(1-pressure);
        x=Math.min(state.right?273-60*state.right:Infinity,Math.max(state.left?52+60*state.left:-Infinity,x));
        y=Math.min(state.bottom?279-52*state.bottom:Infinity,Math.max(state.top?57+52*state.top:-Infinity,y));
        points.push([x,y]);
      }
    }
    const at=i=>points[(i+points.length)%points.length],fmt=p=>p.map(v=>v.toFixed(3)).join(' ');
    let d='M'+fmt(points[0]);
    for(let i=0;i<points.length;i++) {
      const p0=at(i-1),p1=at(i),p2=at(i+1),p3=at(i+2);
      d+=' C'+fmt(p1.map((v,a)=>v+(p2[a]-p0[a])/6))+' '+fmt(p2.map((v,a)=>v-(p3[a]-p1[a])/6))+' '+fmt(p2);
    }
    return d+'Z';
  }
  function timerCaption(state,tab){
    const s=Math.ceil(Number(state?.remainingSec));
    if(!state?.running||tab==='home'||!Number.isFinite(s)||s<=0)return '';
    return `${state.mode==='break'?'휴식':'집중'} ${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
  }
  const api = { create, createPlay, pressScale, surfaceWave, gelPath, timerCaption, releaseVelocity, createFlight, placeOverlay };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PrimeSudoPhysics = api;
})(typeof window === 'undefined' ? globalThis : window);
