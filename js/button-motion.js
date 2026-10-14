/* Delegated press/release feedback. No click interception or pointer capture. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PrimeButtonMotion=api;})(typeof window==='object'?window:this,()=>{
  const selector='button,[role="button"],summary,input[type="button"],input[type="submit"],input[type="reset"]';
  function create(doc,win){
    const pointers=new Map(),keys=new Map(),timers=new Map();
    let initialized=false;
    const find=target=>{const el=target?.closest?.(selector);return el&&!el.disabled&&el.getAttribute('aria-disabled')!=='true'&&!el.closest('[inert]')&&el.id!=='aiFabButton'?el:null;};
    const held=el=>[...pointers.values(),...keys.values()].some(s=>s.el===el);
    function press(el){win.clearTimeout(timers.get(el));timers.delete(el);el.style.removeProperty('--prime-release-from');el.classList.remove('is-button-release');el.classList.add('is-button-held');}
    function release(el,cancel=false){
      if(held(el))return;
      const from=win.getComputedStyle(el).scale;
      el.classList.remove('is-button-held');
      if(cancel||!el.isConnected){el.classList.remove('is-button-release');el.style.removeProperty('--prime-release-from');return;}
      el.style.setProperty('--prime-release-from',from==='none'?'1':from);
      el.classList.add('is-button-release');
      timers.set(el,win.setTimeout(()=>{el.classList.remove('is-button-release');el.style.removeProperty('--prime-release-from');timers.delete(el);},250));
    }
    function pointerEnd(e,cancel=false){const s=pointers.get(e.pointerId);if(!s)return;pointers.delete(e.pointerId);release(s.el,cancel);}
    function clear(){const els=new Set([...pointers.values(),...keys.values()].map(s=>s.el));pointers.clear();keys.clear();for(const el of els)release(el,true);for(const [el,t] of timers){win.clearTimeout(t);el.classList.remove('is-button-release');el.style.removeProperty('--prime-release-from');}timers.clear();}
    function init(){if(initialized)return;initialized=true;
      doc.addEventListener('pointerdown',e=>{if(e.button!==0)return;pointerEnd(e,true);const el=find(e.target);if(!el)return;pointers.set(e.pointerId,{el,x:e.clientX,y:e.clientY,type:e.pointerType});press(el);},{capture:true,passive:true});
      doc.addEventListener('pointermove',e=>{const s=pointers.get(e.pointerId);if(!s)return;const r=s.el.getBoundingClientRect();if((s.type==='touch'&&Math.hypot(e.clientX-s.x,e.clientY-s.y)>12)||e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)pointerEnd(e,true);},{capture:true,passive:true});
      doc.addEventListener('pointerup',e=>pointerEnd(e),{capture:true,passive:true});
      doc.addEventListener('pointercancel',e=>pointerEnd(e,true),{capture:true,passive:true});
      doc.addEventListener('keydown',e=>{if(e.repeat||!['Enter',' '].includes(e.key))return;const el=find(e.target);if(!el)return;keys.set(e.key,{el});press(el);},true);
      doc.addEventListener('keyup',e=>{const s=keys.get(e.key);if(!s)return;keys.delete(e.key);release(s.el);},true);
      doc.addEventListener('focusout',e=>{for(const [key,s] of keys)if(s.el===e.target){keys.delete(key);release(s.el,true);}},true);
      doc.addEventListener('visibilitychange',()=>{if(doc.hidden)clear();});
      win.addEventListener('blur',clear);
      doc.addEventListener('scroll',()=>{for(const [id,s] of pointers)if(s.type==='touch')pointerEnd({pointerId:id},true);},{capture:true,passive:true});
    }
    return {init,clear};
  }
  let singleton;
  return {selector,create,init(){if(typeof document!=='object')return;singleton??=create(document,window);singleton.init();}};
});
