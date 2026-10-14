/* Native SVG graph with touch pan/pinch, node drag and keyboard navigation. */
(() => {
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function mount(stage,onOpen,options={}) {
    const svg=stage.querySelector('svg'),scene=svg.querySelector('.personal-graph-scene');
    let data={nodes:[],edges:[]},positions=new Map(),width=960,height=540,scale=1,pan={x:0,y:0},drag=null,pointers=new Map(),pinch=null,filter=new Set(),lastPointerAction=0,manualViewport=false,stamp='',fitted=false;
    const minScale=options.network?.08:.55;
    const point=e=>({x:e.clientX,y:e.clientY});
    function transform(){scene.setAttribute('transform',`translate(${pan.x} ${pan.y}) scale(${scale})`);stage.querySelector('[data-graph-scale]').textContent=`${Math.round(scale*100)}%`;if(options.network){const items=[...scene.querySelectorAll('.personal-network-node')];items.forEach(el=>{const root=el.dataset.target==='identity',branch=el.dataset.target==='branch',r=root?Math.max(30,22/scale):branch?12:5;el.classList.toggle('is-overview',scale<.8&&el.dataset.mapRole==='record');el.querySelector('.personal-node-hit').setAttribute('r',Math.max(22,(options.staticViewport?24:12)/scale,r+8));if(root){el.querySelector('.personal-node-dot').setAttribute('r',r);el.querySelector('.personal-node-halo').setAttribute('r',r+7);const caption=el.querySelector('.personal-network-caption');caption.setAttribute('y',r+21/scale);caption.style.fontSize=`${11/scale}px`;}const text=el.querySelector('.personal-network-title');text.style.fontSize=`${Math.max(root?15:branch?15:13,(root?14:branch?12:10)/scale)}px`;text.setAttribute('y',root?5/scale:r+16/scale);});declutter(items);}}
    function declutter(items){const grid=new Map(),priority=el=>el.dataset.target==='identity'?0:el.dataset.target==='branch'?1:el.dataset.mapRole==='topic'?2:el.dataset.mapRole==='summary'?3:4;items.sort((a,b)=>priority(a)-priority(b));for(const el of items){el.classList.remove('is-label-collided');if(el.classList.contains('is-overview'))continue;const p=positions.get(el.dataset.personalOpen);if(!p)continue;const text=el.querySelector('.personal-network-title'),font=parseFloat(text.style.fontSize)*scale,w=Array.from(text.textContent).length*font*.8,x=p.x*scale,y=(p.y+Number(text.getAttribute('y')))*scale,box={l:x-w/2-3,r:x+w/2+3,t:y-font-3,b:y+4},keys=[];for(let gx=Math.floor(box.l/80);gx<=Math.floor(box.r/80);gx++)for(let gy=Math.floor(box.t/40);gy<=Math.floor(box.b/40);gy++)keys.push(`${gx}:${gy}`);const clash=keys.some(k=>(grid.get(k)||[]).some(b=>box.l<b.r&&box.r>b.l&&box.t<b.b&&box.b>b.t));if(clash&&priority(el)>0)el.classList.add('is-label-collided');else for(const k of keys){if(!grid.has(k))grid.set(k,[]);grid.get(k).push(box);}}}
    function lines(){scene.querySelectorAll('line,path.personal-mind-link').forEach(e=>{const a=positions.get(e.dataset.source),b=positions.get(e.dataset.target);if(a&&b){if(e.classList.contains('personal-mind-link'))e.setAttribute('d',window.PrimePersonalMindmapDesign.link(a,b,data.nodes.find(n=>n.key===e.dataset.source),data.nodes.find(n=>n.key===e.dataset.target),width));else{e.setAttribute('x1',a.x);e.setAttribute('y1',a.y);e.setAttribute('x2',b.x);e.setAttribute('y2',b.y);}}});scene.querySelectorAll('[data-personal-open]').forEach(e=>{const p=positions.get(e.dataset.personalOpen);if(p)e.setAttribute('transform',`translate(${p.x} ${p.y})`);});}
    function highlight(key=''){
      const nearby=new Set([key]);data.edges.forEach(e=>{if(e.source===key)nearby.add(e.target);if(e.target===key)nearby.add(e.source);});
      scene.querySelectorAll('[data-personal-open]').forEach(e=>{const id=e.dataset.personalOpen;e.classList.toggle('is-hovered',id===key);e.classList.toggle('is-nearby',nearby.has(id));e.classList.toggle('is-dimmed',key?!nearby.has(id):filter.size>0&&!filter.has(id));});
      scene.querySelectorAll('line,path.personal-mind-link').forEach(e=>{const linked=key&&(e.dataset.source===key||e.dataset.target===key);e.classList.toggle('is-highlighted',Boolean(linked));e.classList.toggle('is-dimmed',Boolean(key&&!linked));});
    }
    function draw(next,matching){
      data=next;filter=new Set(matching||[]);const w=stage.clientWidth,h=svg.clientHeight;if(w<10||h<10)return;
      const resized=width!==w||height!==h;width=w;height=h;svg.setAttribute('viewBox',`${-width/2} ${-height/2} ${width} ${height}`);
      const nextStamp=JSON.stringify([w,h,data.nodes.map(n=>[n.key,n.title,n.recordCount]),data.edges.map(e=>[e.source,e.target])]);if(nextStamp===stamp)return;stamp=nextStamp;
      const prior=positions,focused=document.activeElement?.dataset?.personalOpen;
      positions=new Map((options.layout?options.layout(data,width,height):window.PrimePersonalLibraryCore.layout(data.nodes,data.edges,width,height)).map(p=>[p.key,p]));
      if(options.network&&manualViewport&&!resized)for(const [key,p]of prior)if(positions.has(key))positions.set(key,p);
      const degree=new Map();data.edges.forEach(e=>{degree.set(e.source,(degree.get(e.source)||0)+1);degree.set(e.target,(degree.get(e.target)||0)+1);});
      const tag=options.mindmap?'path':'line';
      scene.innerHTML=`${options.mindmap?'<defs><linearGradient id="personalMindSurface" x2="0" y2="1"><stop class="personal-mind-sheen"/><stop class="personal-mind-base" offset="1"/></linearGradient></defs>':''}<g class="personal-graph-links">${data.edges.map(e=>`<${tag} ${options.mindmap?`class="personal-mind-link ${e.hierarchy?'is-tree':'is-reference'}"`:''} data-source="${esc(e.source)}" data-target="${esc(e.target)}"><title>${esc(e.label)}</title></${tag}>`).join('')}</g><g class="personal-graph-nodes">${data.nodes.map(n=>{
        if(options.network){const r=window.PrimePersonalMindmapDesign.radius(n),identity=n.target==='identity',text=Array.from(n.title),max=identity?8:n.target==='branch'?12:13;return `<g class="personal-graph-node personal-network-node" data-kind="${esc(n.category||n.kind)}" data-target="${esc(n.target)}" data-map-role="${esc(n.mapRole||'fact')}" data-personal-open="${esc(n.key)}" tabindex="0" role="button" aria-label="${esc(n.title)} ${esc(n.label)} 보기"><title>${esc(n.title)} · ${esc(n.label)}</title><circle class="personal-node-hit" r="${Math.max(22,r+8)}"/><circle class="personal-node-halo" r="${r+7}"/><circle class="personal-node-dot" r="${r}"/><text class="personal-network-title" text-anchor="middle" y="${identity?5:r+21}">${esc(text.length>max?text.slice(0,max).join('')+'…':n.title)}</text>${identity?'<text class="personal-network-caption" text-anchor="middle" y="55">나의 데이터</text>':''}</g>`;}
        if(options.mindmap){const label=Array.from(n.title),{w,h}=window.PrimePersonalMindmapDesign.size(n,width),identity=n.target==='identity',max=identity?7:n.target==='branch'?7:Math.floor((w-66)/12)-1,x=identity?0:-w/2+48;
          const glyph=window.PrimeUI.svg(n.icon||'user').replace('<svg','<svg x="-10" y="-10" width="20" height="20"');
          const caption=identity?'내 데이터':n.target==='branch'?`기록 ${n.recordCount??Math.max(0,(degree.get(n.key)||1)-1)}개`:n.source;
          const twoLines=n.target!=='branch'&&label.length>max,titleMarkup=twoLines?`<tspan x="${x}" y="${identity?9:-10}">${esc(label.slice(0,max).join(''))}</tspan><tspan x="${x}" y="${identity?27:5}">${esc(label.slice(max,max*2).join('')+(label.length>max*2?'…':''))}</tspan>`:esc(label.length>max?label.slice(0,max).join('')+'…':n.title);
          return `<g class="personal-graph-node personal-mind-node" data-kind="${n.kind}" data-target="${n.target}" data-personal-open="${esc(n.key)}" tabindex="0" role="button" aria-label="${esc(n.title)} ${esc(n.label)} 보기"><title>${esc(n.title)} · ${esc(n.label)}</title><rect class="personal-mind-shape" x="${-w/2}" y="${-h/2}" width="${w}" height="${h}" rx="22"/><g class="personal-mind-glyph" transform="translate(${identity?0:-w/2+26} ${identity?-27:0})"><rect x="${identity?-20:-15}" y="${identity?-20:-15}" width="${identity?40:30}" height="${identity?40:30}" rx="${identity?15:11}"/>${glyph}</g><text class="personal-mind-title" text-anchor="${identity?'middle':'start'}" x="${x}" y="${identity?15:-4}">${titleMarkup}</text><text class="personal-mind-caption" text-anchor="${identity?'middle':'start'}" x="${x}" y="${twoLines?(identity?43:25):identity?34:16}">${esc(caption)}</text></g>`;
        }
        const radius=n.kind==='subjects'?13:Math.min(12,5+(degree.get(n.key)||0)*1.3),text=Array.from(n.title),max=width<500?9:19;
        return `<g class="personal-graph-node ${n.kind==='records'?'is-record':''}" data-kind="${n.kind}" data-personal-open="${esc(n.key)}" tabindex="0" role="button" aria-label="${esc(n.title)} ${esc(n.label)} 보기"><title>${esc(n.title)} · ${esc(n.label)}</title><circle class="personal-node-hit" r="22"/><circle class="personal-node-halo" r="${radius+6}"/><circle class="personal-node-dot" r="${radius}"/><text y="${radius+20}" text-anchor="middle">${esc(text.length>max?text.slice(0,max).join('')+'…':n.title)}</text></g>`;
      }).join('')}</g>`;
      if(options.autoFit&&(!fitted||resized)&&data.nodes.length){const bounds=data.nodes.map(n=>{const p=positions.get(n.key),s=window.PrimePersonalMindmapDesign.size(n,width);return p?{left:p.x-s.w/2,right:p.x+s.w/2,top:p.y-s.h/2,bottom:p.y+s.h/2}:null;}).filter(Boolean);if(bounds.length){const l=Math.min(...bounds.map(b=>b.left)),r=Math.max(...bounds.map(b=>b.right)),t=Math.min(...bounds.map(b=>b.top)),b=Math.max(...bounds.map(b=>b.bottom));scale=Math.max(minScale,Math.min(1,options.network?(width-32)/(2*Math.max(Math.abs(l),Math.abs(r))):(width-28)/(r-l),options.network?(height-72)/(2*Math.max(Math.abs(t),Math.abs(b))):(height-72)/(b-t)));pan=options.network?{x:0,y:0}:{x:-(l+r)/2*scale,y:-(t+b)/2*scale-12};fitted=true;}}
      lines();highlight();transform();
      if(focused)scene.querySelector(`[data-personal-open="${CSS.escape(focused)}"]`)?.focus({preventScroll:true});
    }
    function zoom(factor){manualViewport=true;scale=Math.max(minScale,Math.min(4,scale*factor));transform();}
    function reset(defer=false){manualViewport=false;fitted=false;stamp='';scale=1;pan={x:0,y:0};if(!defer&&options.autoFit)draw(data,[...filter]);else transform();}
    svg.addEventListener('pointerdown',e=>{
      if(options.staticViewport||e.button!==0)return;pointers.set(e.pointerId,point(e));svg.setPointerCapture(e.pointerId);
      if(pointers.size===2){const[a,b]=[...pointers.values()];pinch={distance:Math.hypot(a.x-b.x,a.y-b.y),scale};drag=null;return;}
      const node=e.target.closest('[data-personal-open]');drag={id:e.pointerId,key:node?.dataset.personalOpen,start:point(e),last:point(e),moved:false};
    });
    svg.addEventListener('pointermove',e=>{
      if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,point(e));
      if(pointers.size===2&&pinch){manualViewport=true;const[a,b]=[...pointers.values()];scale=Math.max(minScale,Math.min(4,pinch.scale*Math.hypot(a.x-b.x,a.y-b.y)/Math.max(1,pinch.distance)));transform();return;}
      if(!drag||drag.id!==e.pointerId)return;const dx=e.clientX-drag.last.x,dy=e.clientY-drag.last.y;
      if(Math.hypot(e.clientX-drag.start.x,e.clientY-drag.start.y)>6)drag.moved=true;
      if(drag.moved){manualViewport=true;if(drag.key){const p=positions.get(drag.key);if(p){p.x+=dx/scale;p.y+=dy/scale;lines();}}else{pan.x+=dx;pan.y+=dy;transform();}}
      drag.last=point(e);
    });
    function end(e){const current=drag;pointers.delete(e.pointerId);if(pointers.size<2)pinch=null;if(svg.hasPointerCapture(e.pointerId))svg.releasePointerCapture(e.pointerId);drag=null;lastPointerAction=performance.now();if(e.type==='pointerup'&&current?.id===e.pointerId&&!current.moved&&current.key)onOpen(current.key,scene.querySelector(`[data-personal-open="${CSS.escape(current.key)}"]`));}
    svg.addEventListener('pointerup',end);svg.addEventListener('pointercancel',end);
    svg.addEventListener('click',e=>{const n=e.target.closest('[data-personal-open]');if(n&&performance.now()-lastPointerAction>350)onOpen(n.dataset.personalOpen,n);});
    svg.addEventListener('wheel',e=>{if(options.staticViewport)return;e.preventDefault();zoom(e.deltaY<0?1.1:1/1.1);},{passive:false});
    svg.addEventListener('pointerover',e=>{if(!drag){const node=e.target.closest('[data-personal-open]');if(node)highlight(node.dataset.personalOpen);}});
    svg.addEventListener('pointerleave',()=>{if(!drag)highlight();});
    svg.addEventListener('focusin',e=>{const node=e.target.closest('[data-personal-open]');if(node)highlight(node.dataset.personalOpen);});
    svg.addEventListener('focusout',()=>highlight());
    svg.addEventListener('keydown',e=>{
      const node=e.target.closest('[data-personal-open]');
      if(node&&['Enter',' '].includes(e.key)){e.preventDefault();onOpen(node.dataset.personalOpen,node);return;}
      if(options.staticViewport)return;
      if(e.key==='+'||e.key==='='){e.preventDefault();zoom(1.2);}else if(e.key==='-'){e.preventDefault();zoom(1/1.2);}else if(e.key==='0'){e.preventDefault();reset();}else if(e.key.startsWith('Arrow')){e.preventDefault();manualViewport=true;const d=e.shiftKey?60:24;pan.x+=e.key==='ArrowLeft'?d:e.key==='ArrowRight'?-d:0;pan.y+=e.key==='ArrowUp'?d:e.key==='ArrowDown'?-d:0;transform();}
    });
    stage.addEventListener('click',e=>{const b=e.target.closest('[data-graph-action]');if(!b)return;if(b.dataset.graphAction==='reset')reset();else zoom(b.dataset.graphAction==='in'?1.2:1/1.2);});
    new ResizeObserver(()=>draw(data,[...filter])).observe(stage);
    return {draw,reset};
  }
  window.PrimePersonalGraph={mount};
})();
