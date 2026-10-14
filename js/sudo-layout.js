/* Presentation-only clearance; the app shell still owns drag/storage/chat. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PrimeSudoLayout=api;})(typeof window==='object'?window:this,()=>{
  function overlaps(p,size,r,pad=6){return p.x<r.right+pad&&p.x+size.width>r.left-pad&&p.y<r.bottom+pad&&p.y+size.height>r.top-pad;}
  function avoidControls(point,size,bounds,controls){
    const clamp=p=>({x:Math.max(bounds.minX,Math.min(bounds.maxX,p.x)),y:Math.max(bounds.minY,Math.min(bounds.maxY,p.y))});
    const anchor=clamp(point),clear=p=>controls.every(r=>!overlaps(p,size,r));if(clear(anchor))return anchor;
    const candidates=[anchor,{x:bounds.minX,y:anchor.y},{x:bounds.maxX,y:anchor.y},{x:anchor.x,y:bounds.minY},{x:anchor.x,y:bounds.maxY}];
    // A free corner can require moving on both axes, especially around text.
    for(const x of [bounds.minX,bounds.maxX])for(const y of [bounds.minY,bounds.maxY])candidates.push({x,y});
    controls.forEach(r=>candidates.push({x:r.left-size.width-6,y:anchor.y},{x:r.right+6,y:anchor.y},{x:anchor.x,y:r.top-size.height-6},{x:anchor.x,y:r.bottom+6}));
    const seen=new Set(),unique=candidates.map(clamp).filter(p=>{const key=p.x+','+p.y;if(seen.has(key))return false;seen.add(key);return true;});
    unique.sort((a,b)=>Math.hypot(a.x-anchor.x,a.y-anchor.y)-Math.hypot(b.x-anchor.x,b.y-anchor.y));
    return unique.find(clear)||null;
  }
  function readingRects(scope,viewport){
    const doc=scope?.ownerDocument;
    if(!doc?.createTreeWalker||!doc.createRange)return [];
    const walker=doc.createTreeWalker(scope,4),range=doc.createRange(),rects=[];
    // A timeline/result is one reading surface, not gaps for a floating avatar.
    scope.querySelectorAll?.('.study-history-row,.book-recommendation-card,.book-recommendation-empty').forEach(n=>{
      if(n.closest('[hidden],[inert]')||!n.getClientRects().length)return;
      const r=n.getBoundingClientRect();if(r.bottom>viewport.top&&r.top<viewport.bottom&&r.right>0&&r.left<viewport.width)rects.push({left:r.left,right:r.right,top:r.top,bottom:r.bottom});
    });
    let node,count=0;
    while((node=walker.nextNode())&&count++<1600){
      const parent=node.parentElement;
      if(!node.textContent.trim()||!parent||parent.closest('script,style,svg,button,input,textarea,[hidden],[inert],.sr-only,[aria-hidden="true"]'))continue;
      if(!parent.getClientRects().length||doc.defaultView?.getComputedStyle(parent).visibility==='hidden')continue;
      range.selectNodeContents(node);
      for(const r of range.getClientRects())if(r.width>1&&r.height>1&&r.bottom>viewport.top&&r.top<viewport.bottom&&r.right>0&&r.left<viewport.width)rects.push({left:r.left,right:r.right,top:r.top,bottom:r.bottom});
    }
    return rects;
  }
  return {overlaps,avoidControls,readingRects};
});
