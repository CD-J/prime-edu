(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PrimePersonalMindmapDesign=api;})(typeof window==='object'?window:this,()=>{
  const radius=n=>n.target==='identity'?30:n.target==='branch'?12:n.mapRole==='topic'?9:n.mapRole==='summary'?8:5;
  function size(n){const r=radius(n);return {w:n.target==='identity'?120:150,h:r*2+46,r};}
  function layout(data,w,h,branch='all'){
    // Every item receives a radial position. Cross-links do not replace the tree.
    const by=new Map(data.nodes.map(n=>[n.key,n])),root=data.nodes.find(n=>n.target==='identity');if(!root)return [];
    const children=new Map(data.nodes.map(n=>[n.key,[]])),parent=new Map();
    for(const e of data.edges){if(!e.hierarchy||!by.has(e.source)||!by.has(e.target)||e.target===root.key||parent.has(e.target))continue;
      let p=e.source,cycle=false;const visited=new Set([e.target]);while(p){if(visited.has(p)){cycle=true;break;}visited.add(p);p=parent.get(p);}if(cycle)continue;
      parent.set(e.target,e.source);children.get(e.source).push(e.target);
    }
    for(const n of data.nodes)if(n!==root&&!parent.has(n.key)){parent.set(n.key,root.key);children.get(root.key).push(n.key);}
    const weight=new Map(),depth=new Map([[root.key,0]]),order=[],walk=[root.key];
    while(walk.length){const k=walk.pop();order.push(k);for(const c of children.get(k)){depth.set(c,depth.get(k)+1);walk.push(c);}}
    for(const k of order.reverse())weight.set(k,Math.max(1,children.get(k).reduce((sum,c)=>sum+weight.get(c),0)));
    const total=weight.get(root.key),positions=[{key:root.key,x:0,y:0}],queue=[{key:root.key,start:-Math.PI/2,end:Math.PI*1.5}];
    for(let i=0;i<queue.length;i++){const item=queue[i],list=children.get(item.key);let cursor=item.start;const sum=list.reduce((s,k)=>s+Math.sqrt(weight.get(k)),0);
      for(const k of list){const span=(item.end-item.start)*Math.sqrt(weight.get(k))/sum,start=cursor,end=cursor+span;cursor=end;
        const d=depth.get(k),angle=(start+end)/2,spacing=d===1?175:Math.max(175+(d-1)*125,Math.min(total*26/(Math.PI*2),1800)+(d-2)*125),r=Math.max(spacing,d>1?Math.min(36/Math.max(.02,span),6000):0);
        positions.push({key:k,x:Math.cos(angle)*r,y:Math.sin(angle)*r});queue.push({key:k,start:start+span*.04,end:end-span*.04});
      }
    }
    return positions;
  }
  function link(a,b,source,target,width){
    const dx=b.x-a.x,dy=b.y-a.y,d=Math.max(1,Math.hypot(dx,dy)),sx=a.x+dx/d*radius(source),sy=a.y+dy/d*radius(source),tx=b.x-dx/d*radius(target),ty=b.y-dy/d*radius(target),bend=Math.min(26,d*.08);
    return `M ${sx.toFixed(2)} ${sy.toFixed(2)} Q ${((sx+tx)/2-dy/d*bend).toFixed(2)} ${((sy+ty)/2+dx/d*bend).toFixed(2)} ${tx.toFixed(2)} ${ty.toFixed(2)}`;
  }
  const categories=['goals','learning','school','habits','interests','traits'];
  function essential(data,branch='all'){
    const rows=data.nodes.filter(n=>n.target==='fact'&&categories.includes(n.category||n.kind)&&n.source!=='미설정'&&n.mapRole!=='record'&&n.work?.type!=='tab');
    const unique=new Map();for(const n of rows){const id=(n.category||n.kind)+':'+n.title;if(!unique.has(id))unique.set(id,n);}
    const facts=[...unique.values()].sort((a,b)=>categories.indexOf(a.category||a.kind)-categories.indexOf(b.category||b.kind));
    const groups=data.nodes.filter(n=>n.target==='branch'&&categories.includes(n.kind)&&facts.some(f=>(f.category||f.kind)===n.kind));
    return {groups,facts:branch==='all'?facts:facts.filter(n=>(n.category||n.kind)===branch)};
  }
  function overview(data,branch='all'){
    const {groups}=essential(data),root=data.nodes.find(n=>n.target==='identity'),nodes=[root,...groups.filter(n=>branch==='all'||n.kind===branch)].filter(Boolean),ids=new Set(nodes.map(n=>n.key));
    return {nodes,edges:data.edges.filter(e=>ids.has(e.source)&&ids.has(e.target))};
  }
  return {size,radius,layout,link,essential,overview};
});
