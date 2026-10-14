(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;else root.PrimeSudoNoticeMotion=api;
})(typeof window==='object'?window:this,()=>{
  // Placement is not animated: the caption follows its anchor during dragging.
  function create(node,{reduced=()=>false,readStyle=()=>getComputedStyle(node)}={}){
    let wanted=false,animation=null,sequence=0;
    function setVisible(visible,{immediate=false}={}){
      visible=Boolean(visible);
      if(visible===wanted&&!immediate)return;
      const before=node.hidden?null:readStyle();
      const from=before?{opacity:before.opacity,transform:before.transform,filter:before.filter}:null;
      wanted=visible;const id=++sequence;animation?.cancel();animation=null;
      node.setAttribute('aria-hidden',String(!visible));
      if(immediate||reduced()||typeof node.animate!=='function'){
        node.hidden=!visible;return;
      }
      if(!visible&&node.hidden)return;
      node.hidden=false;
      animation=node.animate([
        from||(visible?{opacity:0,transform:'translateY(4px) scale(.98)',filter:'blur(2px)'}:{opacity:1,transform:'none',filter:'none'}),
        visible?{opacity:1,transform:'none',filter:'none'}:{opacity:0,transform:'translateY(-2px) scale(.99)',filter:'blur(2px)'}
      ],{duration:visible?200:160,easing:'cubic-bezier(.22,1,.36,1)',fill:'both'});
      const current=animation;
      current.finished.then(()=>{
        if(id!==sequence)return;
        node.hidden=!wanted;current.cancel();animation=null;
      }).catch(()=>{});
    }
    return {setVisible,finish:()=>setVisible(wanted,{immediate:true})};
  }
  return {create};
});
