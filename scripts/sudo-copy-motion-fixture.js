/* Isolated QA controls. No storage, AI calls, timer or account mutations. */
(function(){
  const box=document.createElement('aside');box.setAttribute('aria-label','스도 모션 검수');
  box.style.cssText='position:fixed;left:8px;top:90px;z-index:1500;padding:8px;background:#fff;color:#111;border:1px solid #ddd;border-radius:12px;max-width:220px;font:12px system-ui';
  const output=document.createElement('output');output.id='sudoMotionQaResult';output.style.cssText='display:block;white-space:normal;max-height:100px;overflow:auto';
  let sequence=0;
  const state=detail=>window.dispatchEvent(new CustomEvent('prime:pomodoro-state',{detail}));
  function record(){
    const id=++sequence,start=performance.now(),frames=[];
    const sample=now=>{
      if(id!==sequence)return;
      const n=document.querySelector('.sudo-dizzy-notice'),s=getComputedStyle(n),r=n.getBoundingClientRect();
      frames.push({t:Math.round(now-start),hidden:n.hidden,text:n.textContent,opacity:Number(s.opacity),filter:s.filter,animations:n.getAnimations().length,left:r.left,top:r.top,right:r.right,bottom:r.bottom});
      if(now-start<3100)requestAnimationFrame(sample);
      else output.textContent=JSON.stringify({visibleFrames:frames.filter(f=>!f.hidden&&f.opacity>.05).length,entrance:frames.find(f=>f.opacity>0&&f.opacity<1),exit:frames.find(f=>f.t>2200&&f.opacity>0&&f.opacity<1),final:frames.at(-1),maxAnimations:Math.max(...frames.map(f=>f.animations))});
    };
    requestAnimationFrame(sample);
  }
  function pause(){state({running:true,mode:'focus',remainingSec:1500});state({running:false,mode:'focus',remainingSec:1499});record();}
  for(const [label,act] of [
    ['휴식 안내 검수',pause],
    ['집중 완료 안내 검수',()=>{state({running:true,mode:'focus',remainingSec:1});state({running:false,mode:'break',remainingSec:300});record();}],
    ['연속 전환 검수',()=>{pause();setTimeout(()=>{state({running:true,mode:'focus',remainingSec:1});state({running:false,mode:'break',remainingSec:300});},2700);}],
    ['검수 도구 닫기',()=>box.remove()]
  ]){
    const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=act;b.style.cssText='display:block;min-height:32px;margin:4px;border:1px solid #aaa;border-radius:8px;background:white;color:#111';box.append(b);
  }
  box.append(output);document.body.append(box);
})();
