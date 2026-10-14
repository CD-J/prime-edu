/* A small pointer-driven optical highlight, never a physics or data owner. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else{root.PrimeGlassDesign=api;api.install(document,window);}})(typeof window==='object'?window:this,()=>{
  const selector='.btn,.notebook-create-trigger,.prime-choice-picker button,.stored-book-cover,.sheet-btn,.desktop-primary-nav button,.bottom-nav button,.topbar-restore-dot';
  const position=(x,y,rect)=>({x:Math.max(0,Math.min(100,(x-rect.left)/Math.max(1,rect.width)*100)),y:Math.max(0,Math.min(100,(y-rect.top)/Math.max(1,rect.height)*100))});
  function rgb(value){const hex=String(value).trim().match(/^#([\da-f]{3}|[\da-f]{6})$/i);if(hex){const h=hex[1].length===3?[...hex[1]].map(c=>c+c).join(''):hex[1];return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255);}const srgb=String(value).match(/^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/i);if(srgb)return srgb.slice(1,4).map(Number);const channels=String(value).match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);return channels?channels.slice(1,4).map(v=>Number(v)/255):null;}
  const luminance=c=>c.map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
  const contrast=(a,b)=>(Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);
  function pastelAccent(value){const base=rgb(value),paper=rgb('#f4f1fb');return base?`color(srgb ${base.map((v,i)=>v*.54+paper[i]*.46).join(' ')})`:value;}
  function accentMaterial(value){const base=rgb(value);if(!base)return null;const white=[1,1,1],dark=rgb('#10131b'),ink=contrast(base,white)>=contrast(base,dark)?white:dark;let gleam=.08;if(ink===white){let low=0,high=.08;for(let i=0;i<12;i++){const mid=(low+high)/2,tint=base.map(v=>v+(1-v)*mid);if(contrast(ink,tint)>=4.5)low=mid;else high=mid;}gleam=Math.floor(low*10000)/10000;}return {ink:ink===white?'#ffffff':'#10131b',gleam,contrast:contrast(base,ink)};}
  function create(doc,win){
    const pointer=win.matchMedia('(hover: hover) and (pointer: fine)'),reduced=win.matchMedia('(prefers-reduced-motion: reduce)');
    let active=null,pending=null,frame=0,initialized=false;
    const find=target=>{const el=target?.closest?.(selector);return el&&!el.closest('#aiFabWrap,[inert],[hidden]')&&!el.disabled&&el.getAttribute('aria-disabled')!=='true'?el:null;};
    function unlight(el){el.classList.remove('is-prime-glass-lit');el.style.removeProperty('--prime-glass-x');el.style.removeProperty('--prime-glass-y');}
    function clear(){if(frame)win.cancelAnimationFrame(frame);frame=0;pending=null;if(active){unlight(active);active=null;}}
    function paint(){frame=0;if(!pending)return;const {el,x,y}=pending;pending=null;if(!el.isConnected||el.closest('[inert],[hidden]')){clear();return;}if(active!==el){if(active)unlight(active);active=el;}const p=position(x,y,el.getBoundingClientRect());el.style.setProperty('--prime-glass-x',`${p.x.toFixed(1)}%`);el.style.setProperty('--prime-glass-y',`${p.y.toFixed(1)}%`);el.classList.add('is-prime-glass-lit');}
    function init(){if(initialized)return;initialized=true;
      doc.addEventListener('pointermove',event=>{if(event.pointerType!=='mouse'||!pointer.matches||reduced.matches)return;const el=find(event.target);if(!el){clear();return;}pending={el,x:event.clientX,y:event.clientY};if(!frame)frame=win.requestAnimationFrame(paint);},{passive:true});
      doc.addEventListener('pointerout',event=>{if(active&&!active.contains(event.relatedTarget)&&active.contains(event.target))clear();},{passive:true});
      doc.addEventListener('pointerdown',event=>{if(event.pointerType!=='mouse')clear();},{passive:true});
      doc.addEventListener('pointercancel',clear,{passive:true});
      doc.addEventListener('scroll',clear,{capture:true,passive:true});
      doc.addEventListener('visibilitychange',()=>{if(doc.hidden)clear();});
      win.addEventListener('blur',clear);pointer.addEventListener?.('change',clear);reduced.addEventListener?.('change',clear);
    }
    return {init,clear};
  }
  function install(doc,win){
    create(doc,win).init();
    const html=doc.documentElement;
    const update=()=>{const material=accentMaterial(pastelAccent(win.getComputedStyle(html).getPropertyValue('--shell-blue')));if(!material)return;const gleam=material.gleam.toFixed(4);if(html.style.getPropertyValue('--glass-on-accent')!==material.ink)html.style.setProperty('--glass-on-accent',material.ink);if(html.style.getPropertyValue('--glass-safe-gleam')!==gleam)html.style.setProperty('--glass-safe-gleam',gleam);};
    update();new win.MutationObserver(update).observe(html,{attributes:true,attributeFilter:['data-theme','data-theme-palette','class','style']});
  }
  return {position,selector,create,install,rgb,contrast,accentMaterial,pastelAccent};
});
