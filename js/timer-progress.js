/* Pure visual geometry. The existing Pomodoro is the only time/session owner. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PrimeTimerProgress=api;})(typeof window==='object'?window:this,()=>{
  function remaining(left,total){const l=Number(left),t=Number(total);return Number.isFinite(l)&&Number.isFinite(t)&&t>0?Math.max(0,Math.min(1,l/t)):0;}
  function rectangle(width,height){
    const w=Number(width),h=Number(height);if(!Number.isFinite(w)||!Number.isFinite(h)||w<40||h<40)return null;
    const stroke=Math.max(8,Math.min(12,h*.045)),inset=stroke/2+4;
    const l=inset,t=inset,r=w-inset,b=h-inset,radius=Math.min(64,Math.max(28,h*.22),(Math.min(w,h)-2*inset)/2),k=radius*.35;
    const n=v=>Number(v.toFixed(3));
    // Top centre -> right -> bottom -> left is clockwise. Shortening this
    // anchored dash retreats its endpoint counterclockwise from a full frame.
    const d=`M ${n(w/2)} ${n(t)} H ${n(r-radius)} C ${n(r-k)} ${n(t)} ${n(r)} ${n(t+k)} ${n(r)} ${n(t+radius)} V ${n(b-radius)} C ${n(r)} ${n(b-k)} ${n(r-k)} ${n(b)} ${n(r-radius)} ${n(b)} H ${n(l+radius)} C ${n(l+k)} ${n(b)} ${n(l)} ${n(b-k)} ${n(l)} ${n(b-radius)} V ${n(t+radius)} C ${n(l)} ${n(t+k)} ${n(l+k)} ${n(t)} ${n(l+radius)} ${n(t)} H ${n(w/2)} Z`;
    return {width:w,height:h,stroke,inset,radius,d};
  }
  return {remaining,rectangle};
});
