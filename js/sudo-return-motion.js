/* Presentation geometry only. Drag, storage and chat docking stay in app-shell. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PrimeSudoReturnMotion=api;})(typeof window==='object'?window:this,()=>{
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  // Sonnet's ease-out curve (.22,1,.36,1), solved without an animation library.
  function ease(t){
    t=clamp(t,0,1);let lo=0,hi=1,s=t;
    for(let i=0;i<16;i++){s=(lo+hi)/2;const x=3*(1-s)**2*s*.22+3*(1-s)*s*s*.36+s**3;if(x<t)lo=s;else hi=s;}
    return t===0?0:t===1?1:1-(1-s)**3;
  }
  function duration(from,to){return clamp(300+Math.hypot(to.left-from.left,to.top-from.top)*.45,360,520);}
  function viewportChanged(before,after,editing=false){
    return Math.abs(before.width-after.width)>2||Math.abs(before.scale-after.scale)>.01||(editing&&before.height-after.height>120);
  }
  // Time-based following feels the same on 60/120Hz screens, without overshoot.
  function follow(value,target,dt){return value+(target-value)*(1-Math.exp(-clamp(dt,0,128)/85));}
  function wheelPixels(delta,mode,height){return delta*(mode===1?16:mode===2?height:1);}
  function pose(from,to,time,travel,limits){
    const t=clamp(time/travel,0,1),q=ease(t),land=clamp((time-travel)/140,0,1);
    const squash=time>travel?.045*Math.sin(Math.PI*land)**2:0;
    const width=(from.width+(to.width-from.width)*q)*(1+squash);
    const height=(from.height+(to.height-from.height)*q)/(1+squash);
    const lift=Math.min(20,Math.max(0,(limits.bottom-limits.top)*.07))*Math.sin(Math.PI*q)**2;
    const cx=from.left+from.width/2+(to.left+to.width/2-from.left-from.width/2)*q;
    const cy=from.top+from.height/2+(to.top+to.height/2-from.top-from.height/2)*q-lift;
    return {x:clamp(cx-width/2,limits.left,Math.max(limits.left,limits.right-width)),y:clamp(cy-height/2,limits.top,Math.max(limits.top,limits.bottom-height)),width,height,done:time>=travel+140};
  }
  return {ease,duration,pose,viewportChanged,follow,wheelPixels};
});
