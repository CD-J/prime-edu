// Readable local-only proof of actual browser input phases; no user record writes.
(() => {
  const log=document.createElement('output');log.id='buttonMotionProof';log.hidden=true;document.body.append(log);
  const samples=[];
  document.addEventListener('pointerdown',e=>{const button=e.target.closest('button');if(!button)return;samples.push({phase:'down',id:button.id||button.className,held:button.classList.contains('is-button-held')});log.textContent=JSON.stringify(samples.slice(-12));});
  document.addEventListener('pointerup',e=>{const button=e.target.closest('button');if(!button)return;samples.push({phase:'up',id:button.id||button.className,held:button.classList.contains('is-button-held'),release:button.classList.contains('is-button-release')});log.textContent=JSON.stringify(samples.slice(-12));});
})();
