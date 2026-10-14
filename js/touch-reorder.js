/* Pointer-based sorting works without HTML DragEvent/DataTransfer (mobile Safari).
   A grip owns the gesture; the rest of the row keeps normal page scrolling. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PrimeReorder=api;})(typeof window==='object'?window:this,()=>{
  function insert(order,id,index){if(!order.includes(id))return [...order];const next=order.filter(x=>x!==id),i=Math.max(0,Math.min(next.length,Math.round(Number(index)||0)));next.splice(i,0,id);return next;}
  function attach(list,onCommit){
    let drag=null,frame=0;
    const rows=()=>[...list.querySelectorAll('[data-sort-key]')];
    function finish(cancel=false){if(!drag)return;const d=drag;drag=null;cancelAnimationFrame(frame);frame=0;d.ghost.remove();d.row.classList.remove('is-sort-source');d.handle.setAttribute('aria-grabbed','false');
      if(list.hasPointerCapture?.(d.id))list.releasePointerCapture(d.id);if(cancel)d.order.forEach(id=>{const row=rows().find(x=>x.dataset.sortKey===id);if(row)list.append(row);});
      const order=rows().map(x=>x.dataset.sortKey);if(!cancel&&order.join('|')!==d.order.join('|'))onCommit(order);list.querySelector(`[data-sort-key="${d.key}"] [data-sort-handle]`)?.focus({preventScroll:true});
    }
    list.addEventListener('pointerdown',e=>{const handle=e.target.closest('[data-sort-handle]'),row=handle?.closest('[data-sort-key]');if(!row||drag||e.button!==0)return;e.preventDefault();const r=row.getBoundingClientRect(),ghost=row.cloneNode(true);ghost.classList.add('sort-ghost');ghost.setAttribute('aria-hidden','true');ghost.querySelectorAll('[id]').forEach(n=>n.removeAttribute('id'));ghost.querySelectorAll('button').forEach(n=>n.tabIndex=-1);ghost.style.cssText=`position:fixed;left:${r.left}px;top:${r.top}px;width:${r.width}px;pointer-events:none;z-index:10000`;document.body.append(ghost);drag={id:e.pointerId,key:row.dataset.sortKey,row,handle,ghost,startY:e.clientY,y:e.clientY,top:r.top,order:rows().map(x=>x.dataset.sortKey)};row.classList.add('is-sort-source');handle.setAttribute('aria-grabbed','true');try{list.setPointerCapture(e.pointerId);}catch{} });
    list.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;e.preventDefault();drag.y=e.clientY;drag.ghost.style.transform=`translateY(${e.clientY-drag.startY}px) scale(1.025)`;const candidates=rows().filter(x=>x!==drag.row);const next=candidates.find(x=>e.clientY<x.getBoundingClientRect().top+x.getBoundingClientRect().height/2);if(next)list.insertBefore(drag.row,next);else list.append(drag.row);
      if(!frame){const tick=()=>{frame=0;if(!drag)return;if(drag.y<72)window.scrollBy(0,-6);else if(drag.y>innerHeight-72)window.scrollBy(0,6);frame=requestAnimationFrame(tick);};frame=requestAnimationFrame(tick);}
    },{passive:false});
    list.addEventListener('pointerup',e=>{if(drag?.id===e.pointerId)finish();});list.addEventListener('pointercancel',()=>finish(true));list.addEventListener('lostpointercapture',()=>finish(true));window.addEventListener('blur',()=>finish(true));window.addEventListener('resize',()=>finish(true));document.addEventListener('visibilitychange',()=>{if(document.hidden)finish(true);});
    list.addEventListener('keydown',e=>{const handle=e.target.closest('[data-sort-handle]'),row=handle?.closest('[data-sort-key]');if(!row||!['ArrowUp','ArrowDown','Home','End'].includes(e.key))return;e.preventDefault();const order=rows().map(x=>x.dataset.sortKey),i=order.indexOf(row.dataset.sortKey),j=e.key==='Home'?0:e.key==='End'?order.length-1:i+(e.key==='ArrowDown'?1:-1);onCommit(insert(order,row.dataset.sortKey,j));list.querySelector(`[data-sort-key="${row.dataset.sortKey}"] [data-sort-handle]`)?.focus({preventScroll:true});});
    return {cancel:()=>finish(true)};
  }
  return {insert,attach};
});
