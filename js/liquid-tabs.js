/* A presentation-only lens. Existing click handlers remain the state owners. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else{root.PrimeLiquidTabs=api;api.start(document,window);}})(typeof window==='object'?window:this,()=>{
  const configs=[['.desktop-primary-nav','button[data-tab]'],['.bottom-nav','button[data-tab]'],['.segmented-control','button[data-theme-choice],button[data-standby-frame],button[data-standby-cycle]'],['.ai-category-grid','button[data-ai-category-target]'],['.plan-mode-tabs','button[data-plan-mode]'],['.prime-choice-picker','button[role=radio]'],['.standby-template-grid','button[data-standby-style]'],['.standby-settings-tabs','button[data-standby-category]'],['#personalLibraryCollections,#personalMindCategories,.study-history-filters','button'],['[role=tablist]','button[role=tab]']];
  const selected=b=>b.getAttribute('aria-selected')==='true'||b.getAttribute('aria-pressed')==='true'||b.getAttribute('aria-checked')==='true'||['page','true'].includes(b.getAttribute('aria-current'))||b.classList.contains('is-active');
  function intent(dx,dy){if(Math.max(Math.abs(dx),Math.abs(dy))<8)return 'pending';return Math.abs(dx)>Math.abs(dy)*1.2?'horizontal':'vertical';}
  function nearest(items,x,y){const distance=item=>Math.hypot(item.center-x,y===undefined?0:(item.y??y)-y);return items.reduce((best,item)=>distance(item)<distance(best)?item:best,items[0]);}
  function dragCenter(x,grabOffset,items){const centers=items.map(item=>item.center);return Math.max(Math.min(...centers),Math.min(Math.max(...centers),x-grabOffset));}
  // Enlarge only the visual lens, not the buttons or their hit areas. Leave an
  // inset even on the first/last item and compact mobile selectors.
  function lensGeometry(left,top,width,height,barWidth,barHeight,held){
    const sx=held?Math.max(1,Math.min(1.14,1+12/width,(barWidth-2)/width)):1;
    const sy=held?Math.max(1,Math.min(1.18,1+10/height,(barHeight-2)/height)):1;
    const dx=width*(sx-1)/2,dy=height*(sy-1)/2;
    const ix=Math.min(1,Math.max(0,(barWidth-width)/2)),iy=Math.min(1,Math.max(0,(barHeight-height)/2));
    return {left:held?Math.max(ix+dx,Math.min(barWidth-width-ix-dx,left)):left,top:held?Math.max(iy+dy,Math.min(barHeight-height-iy-dy,top)):top,width,height,sx,sy};
  }
  function create(bar,selector,win){
    const lens=bar.ownerDocument.createElement('span');lens.className='prime-tab-lens';lens.setAttribute('aria-hidden','true');bar.append(lens);bar.classList.add('prime-slide-bar');
    const motion=win.matchMedia?.('(prefers-reduced-motion: reduce)');
    let drag=null,keyHeld=null,suppressUntil=0,frame=0,last='',lastSize='',destroyed=false;
    const buttons=()=>[...bar.querySelectorAll(selector)].filter(b=>!b.disabled&&b.getAttribute('aria-disabled')!=='true'&&!b.closest('[hidden],[inert]')&&b.getClientRects().length);
    const active=()=>buttons().find(selected)||buttons()[0];
    function paint(target=active(),x=null){
      if(bar.contains&&!bar.contains(lens))bar.append(lens);
      if(!target||!bar.getClientRects().length){lens.hidden=true;return;}const size=`${bar.clientWidth},${bar.clientHeight}`,fresh=last===''||lens.hidden||size!==lastSize;lastSize=size;if(fresh)lens.style.setProperty('transition','none');lens.hidden=false;
      const p=bar.getBoundingClientRect(),r=target.getBoundingClientRect(),borderX=bar.clientLeft||0,borderY=bar.clientTop||0;
      // Absolute children start at the padding edge, not the outer border.
      // Translation is painted independently of scale (see tab-touch.css).
      const left=x===null?r.left-p.left-borderX:x-p.left-borderX-r.width/2;
      const g=lensGeometry(left,r.top-p.top-borderY,r.width,r.height,bar.clientWidth,bar.clientHeight,!!(drag||keyHeld)&&!motion?.matches);
      const key=[g.left,g.top,g.width,g.height,g.sx,g.sy].join(',');if(key===last){if(fresh)lens.style.removeProperty('transition');return;}last=key;
      lens.style.setProperty('--tab-x',`${g.left+bar.scrollLeft}px`);lens.style.setProperty('--tab-y',`${g.top+bar.scrollTop}px`);lens.style.setProperty('--tab-width',`${g.width}px`);lens.style.setProperty('--tab-height',`${g.height}px`);
      lens.style.setProperty('--tab-scale-x',String(g.sx));lens.style.setProperty('--tab-scale-y',String(g.sy));
      if(fresh){void lens.offsetWidth;lens.style.removeProperty('transition');}
    }
    function sync(){if(destroyed||drag||keyHeld||frame)return;frame=win.requestAnimationFrame(()=>{frame=0;if(!destroyed&&!drag&&!keyHeld)paint();});}
    function down(e){if(destroyed||e.button!==0||drag||bar.closest('[inert]'))return;const b=e.target.closest(selector);if(!b||!buttons().includes(b))return;const r=b.getBoundingClientRect();keyHeld=null;drag={id:e.pointerId,x:e.clientX,y:e.clientY,grabOffset:e.clientX-(r.left+r.right)/2,target:b,intent:'pending'};bar.classList.add('is-tab-held');paint(b);try{bar.setPointerCapture?.(e.pointerId);}catch{}}
    function move(e){if(!drag||drag.id!==e.pointerId)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(drag.intent==='pending'){drag.intent=intent(dx,dy);if(drag.intent==='vertical'){end(e,true);return;}if(drag.intent==='horizontal'){bar.setPointerCapture?.(e.pointerId);bar.classList.add('is-tab-dragging');}}
      if(drag?.intent!=='horizontal')return;e.preventDefault();const items=buttons().map(b=>{const r=b.getBoundingClientRect();return {button:b,center:(r.left+r.right)/2,y:(r.top+r.bottom)/2};});if(!items.length){end(e,true);return;}const x=dragCenter(e.clientX,drag.grabOffset,items),hit=nearest(items,x,e.clientY);drag.target=hit.button;
      // Do not let the capsule travel into the trailing padding after the last
      // choice. Multi-row template grids use the endpoints of the hit row.
      const row=items.filter(item=>Math.abs(item.y-hit.y)<1);paint(hit.button,dragCenter(x,0,row));
    }
    function end(e,cancel=false){if(!drag||e.pointerId!==drag.id)return;const d=drag;drag=null;bar.classList.remove('is-tab-dragging');bar.classList.remove('is-tab-held');if(bar.hasPointerCapture?.(e.pointerId))bar.releasePointerCapture(e.pointerId);
      if(cancel||d.intent==='vertical')suppressUntil=win.performance.now()+500;
      if(d.intent==='horizontal'){suppressUntil=win.performance.now()+500;e.preventDefault?.();if(!cancel&&Math.abs(e.clientY-d.y)<72&&buttons().includes(d.target)){d.target.focus({preventScroll:true});d.target.click();}}
      else if(d.intent==='pending'&&!cancel&&buttons().includes(d.target)){suppressUntil=win.performance.now()+500;e.preventDefault?.();d.target.click();}
      paint();sync();
    }
    bar.addEventListener('pointerdown',down);bar.addEventListener('pointermove',move,{passive:false});bar.addEventListener('pointerup',e=>end(e));bar.addEventListener('pointercancel',e=>end(e,true));bar.addEventListener('lostpointercapture',e=>end(e,true));
    bar.addEventListener('click',e=>{if(e.detail>0&&win.performance.now()<suppressUntil){e.preventDefault();e.stopImmediatePropagation();return;}sync();},true);
    bar.addEventListener('keydown',e=>{if(destroyed||drag||!e.target.matches(selector))return;
      if([' ','Enter'].includes(e.key)){if(e.repeat||!buttons().includes(e.target))return;keyHeld=e.key;bar.classList.add('is-tab-held');paint(e.target);return;}
      if(bar.matches('.prime-choice-picker,.ai-category-grid')||!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;const list=buttons(),i=list.indexOf(e.target);if(i<0)return;e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?list.length-1:Math.max(0,Math.min(list.length-1,i+(e.key==='ArrowRight'?1:-1)));if(next===i)return;list[next].focus({preventScroll:true});list[next].click();sync();});
    function releaseKey(){if(!keyHeld)return;keyHeld=null;bar.classList.remove('is-tab-held');paint();sync();}
    bar.addEventListener('keyup',e=>{if(e.key===keyHeld)releaseKey();});bar.addEventListener('focusout',releaseKey);
    const onBlur=()=>{if(drag)end({pointerId:drag.id},true);releaseKey();};win.addEventListener('blur',onBlur);
    const onVisibility=()=>{if(bar.ownerDocument.hidden)onBlur();};bar.ownerDocument.addEventListener?.('visibilitychange',onVisibility);
    const onMotion=()=>{last='';onBlur();sync();};motion?.addEventListener?.('change',onMotion);
    const observer=new win.MutationObserver(sync);observer.observe(bar,{subtree:true,childList:true,attributes:true,attributeFilter:['class','aria-selected','aria-pressed','aria-checked','aria-current','hidden','disabled']});
    const sizeObserver=new win.ResizeObserver(()=>{onBlur();last='';sync();});sizeObserver.observe(bar);const onResize=()=>{last='';onBlur();sync();};win.addEventListener('resize',onResize);bar.addEventListener('scroll',sync,{passive:true});paint();
    function destroy(){if(destroyed)return;onBlur();destroyed=true;win.cancelAnimationFrame?.(frame);frame=0;observer.disconnect?.();sizeObserver.disconnect?.();win.removeEventListener?.('blur',onBlur);win.removeEventListener?.('resize',onResize);bar.ownerDocument.removeEventListener?.('visibilitychange',onVisibility);motion?.removeEventListener?.('change',onMotion);lens.remove?.();bar.classList.remove('prime-slide-bar');}
    return {sync,down,move,end,paint,destroy};
  }
  function start(doc,win){
    const controllers=new Map();let pending=0;
    const run=()=>{pending=0;controllers.forEach((c,bar)=>{if(!bar.isConnected){c.destroy();controllers.delete(bar);}});configs.forEach(([group,button])=>doc.querySelectorAll(group).forEach(bar=>{if(!bar.classList.contains('prime-slide-bar')&&bar.querySelector(button))controllers.set(bar,create(bar,button,win));}));};
    const begin=()=>{run();if(win.MutationObserver&&doc.body){const discovery=new win.MutationObserver(records=>{if(pending||!records.some(r=>r.addedNodes.length||r.removedNodes.length))return;pending=win.requestAnimationFrame(run);});discovery.observe(doc.body,{childList:true,subtree:true});}};
    if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',begin,{once:true});else begin();
  }
  return {configs,selected,intent,nearest,dragCenter,lensGeometry,create,start};
});
