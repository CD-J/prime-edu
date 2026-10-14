const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const listeners={};let observer;
function button(text,attrs={},send=false){const classes=new Set();const b={tagName:'BUTTON',id:'',textContent:text,dataset:{},matches:()=>send,classList:{add:c=>classes.add(c),remove:c=>classes.delete(c),contains:c=>classes.has(c)},getAttribute:k=>attrs[k]??null,setAttribute:(k,v)=>attrs[k]=v,removeAttribute:k=>delete attrs[k],hasAttribute:k=>Object.hasOwn(attrs,k),querySelector:()=>b.innerHTML?.includes('prime-icon')?{}:null};return b;}
const next=button('다음 ›'),close=button('닫기'),header=button('홈 설정');
const send=button('전송',{},true),elements=[next,close,header,send];
vm.runInNewContext(fs.readFileSync(require.resolve('../js/ui-icons.js'),'utf8'),{window:{},document:{readyState:'complete',body:{},querySelectorAll:s=>s==='button'?elements:[],addEventListener:(k,f)=>listeners[k]=f},MutationObserver:class{constructor(f){observer=f;}observe(){}},requestAnimationFrame:f=>{f();return 0;}});
assert.equal(next.dataset.primeIcon,'arrow');assert.equal(next.getAttribute('aria-label'),'다음');
assert.equal(close.getAttribute('aria-label'),'닫기');assert(close.classList.contains('prime-icon-button'));
assert.equal(send.dataset.primeIcon,'send');assert.equal(send.getAttribute('aria-label'),'스도에게 질문하기');
send.textContent='답변 만드는 중';observer([{target:{nodeType:1,closest:()=>send},addedNodes:[]}]);assert(!send.classList.contains('prime-icon-button'));assert.equal(send.getAttribute('aria-label'),null);
send.textContent='전송';observer([{target:{nodeType:1,closest:()=>send},addedNodes:[]}]);assert.equal(send.dataset.primeIcon,'send');
// Browser textContent becomes empty when innerHTML is an SVG.
next.textContent='';observer([{target:{nodeType:1,closest:()=>next},addedNodes:[]}]);assert.equal(next.getAttribute('aria-label'),'다음');assert(next.classList.contains('prime-icon-button'));
next.textContent='시작하기';observer([{target:{nodeType:1,closest:()=>next},addedNodes:[]}]);assert(!next.classList.contains('prime-icon-button'));assert.equal(next.getAttribute('aria-label'),null);
next.textContent='다음 ›';observer([{target:{nodeType:1,closest:()=>next},addedNodes:[]}]);assert(next.classList.contains('prime-icon-button'));assert.equal(next.getAttribute('aria-label'),'다음');
console.log('PASS real icon renderer: self-mutations retain accessible names, stateful CTA restores text/sizing, and later utility state becomes an icon again.');
