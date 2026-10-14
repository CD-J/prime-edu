// API-profile diagnostic, NOT an iPhone/Safari browser or real-device test.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const start=html.indexOf('    function loadData()'),end=html.indexOf('    function hasBrokenKorean',start);
if(start<0||end<0)throw new Error('Could not locate original loadData owner.');
const source=html.slice(start,end),results=[];
for(const cloneAvailable of [false,true]){
  const context={window:{structuredClone:cloneAvailable?structuredClone:undefined},STORAGE_KEY:'synthetic-only',defaultData:{schedule:[['수학']],events:[]},localStorage:{getItem(){return null}},hasBrokenKorean(){return false}};
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/browser-compat.js'),'utf8'),context);
  vm.runInContext(source,context);
  try{const data=context.loadData();results.push({profile:cloneAvailable?'structuredClone available':'Safari 14 API profile',startup:'passed this function only',subjects:data.schedule[0]});}
  catch(error){results.push({profile:'Safari 14 API profile',startup:'FAILED',error:`${error.name}: ${error.message}`});}
}
console.log(JSON.stringify({kind:'API-profile diagnostic only, not real Safari',results},null,2));
