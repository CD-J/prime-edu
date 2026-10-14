const assert=require('node:assert/strict'),fs=require('node:fs'),D=require('../js/personal-mindmap-design.js');
const root={key:'person:self',target:'identity'},groups=['school','goals','traits','habits','interests','activity'].map(kind=>({key:'branch:'+kind,target:'branch',kind}));
const data={nodes:[root,...groups],edges:groups.map(g=>({source:root.key,target:g.key,hierarchy:true}))};
for(const w of [296,370,800,1180]){
 const positions=D.layout(data,w,560),boxes=positions.map(p=>{const s=D.size(data.nodes.find(n=>n.key===p.key),w);return {key:p.key,l:p.x-s.w/2,r:p.x+s.w/2,t:p.y-s.h/2,b:p.y+s.h/2};});
 for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++)assert(!(boxes[i].l<boxes[j].r&&boxes[i].r>boxes[j].l&&boxes[i].t<boxes[j].b&&boxes[i].b>boxes[j].t),'cards must not overlap');
 assert.equal(positions[0].x,0);assert.equal(positions[0].y,0);assert(positions.slice(1).every(p=>Math.abs(Math.hypot(p.x,p.y)-175)<.01));
 const path=D.link(positions[0],positions[1],root,groups[0],w);assert(!path.includes('NaN'));assert(path.startsWith('M '));assert(path.includes(' Q '));
}
const facts=Array.from({length:4},(_,i)=>({key:'fact:'+i,target:'fact',kind:'habits'})),selected={nodes:[root,groups[3],...facts],edges:[{source:root.key,target:groups[3].key,hierarchy:true},...facts.map(n=>({source:groups[3].key,target:n.key,hierarchy:true}))]};
const narrow=D.layout(selected,296,500,'habits'),normal=D.layout(selected,370,600,'habits');assert.deepEqual(narrow,normal);assert.equal(narrow.length,6);assert.equal(new Set(narrow.filter(p=>p.key.startsWith('fact:')).map(p=>p.x)).size,4);
const js=fs.readFileSync('js/personal-graph.js','utf8'),css=fs.readFileSync('js/personal-mindmap.css','utf8'),html=fs.readFileSync('index.html','utf8');
assert.match(js,/window.PrimeUI.svg\(n.icon/);assert.match(js,/manualViewport=true/);assert.match(js,/options.autoFit/);assert.match(js,/n.recordCount/);
assert.match(css,/var\(--glass-sheet/);assert.match(css,/var\(--glass-on-accent,#10131b\)/);assert.match(css,/personal-mind-link.is-highlighted/);assert.match(css,/prefers-reduced-motion:reduce/);
assert(html.indexOf('personal-mindmap-design.js')<html.indexOf('personal-graph.js'));assert.match(html,/personal-mindmap.css\?v=20261014-87/);
console.log('PASS mindmap design: shared theme tokens, centered radial categories, every leaf visible on mobile, endpoint-aware curves, auto-fit and manual zoom preservation.');
