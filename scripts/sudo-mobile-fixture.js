// Developer-only controls, appended by ui-qa-server only with motionqa=1.
// Drives the actual rendered mascot; never shipped or activated on production.
(function(){
 const dock=document.createElement('aside');dock.dataset.sudoQaTools='true';dock.style.cssText='position:fixed;top:76px;left:8px;z-index:500;display:flex;gap:4px;max-width:calc(100vw - 16px);flex-wrap:wrap';
 for(const [label,age] of [['1초',1000],['3초',3100],['5초',5000],['폭발',5250]]){
  const b=document.createElement('button');b.textContent=label;b.style.cssText='padding:6px 10px;border:1px solid #999;border-radius:10px;background:white;color:#111';
  b.onclick=()=>{const button=document.getElementById('aiFabButton');if(button.disabled)document.querySelector('.sudo-return')?.click();const r=button.getBoundingClientRect();window.dispatchEvent(new CustomEvent('prime:sudo-drag',{detail:{phase:'start',time:performance.now()-age,pointerX:r.left+r.width/2,pointerY:r.top+r.height/2}}));};dock.append(b);
 }
 const cancel=document.createElement('button');cancel.textContent='취소';cancel.onclick=()=>window.dispatchEvent(new CustomEvent('prime:sudo-drag',{detail:{phase:'cancel',time:performance.now()}}));dock.append(cancel);
 const down=document.createElement('button');down.textContent='맨 아래';down.onclick=()=>window.scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'});dock.append(down);
 document.body.append(dock);
})();
