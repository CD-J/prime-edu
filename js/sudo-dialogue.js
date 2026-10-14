(function(root){
  'use strict';
  // Physical reactions stay visual. Speech is reserved for useful study context.
  // Local captions never replace an AI response or claim a result succeeded.
  const lines={
    hold:[],pet:[],wink:[],orbit:[],crown:[],dance:[],sleep:[],dizzy:[],impact:[],boing:[],peek:[],wake:[],
    sparkle:['공부한 내용을 짧게 정리해 보세요.'],
    breathe:['잠깐 쉬고 다시 시작해요.'],
    thinking:['질문을 살펴보고 있어요.'],
    answering:['답변을 확인해 보세요.'],
    complete:['내용을 확인해 보세요.'],
    checking:['내용을 다시 확인하고 있어요.']
  };
  function createPicker(random=Math.random){
    const last={};
    return key=>{
      const pool=lines[key];if(!pool?.length)return '';
      let i=Math.min(pool.length-1,Math.floor(random()*pool.length));
      if(i===last[key])i=(i+1)%pool.length;last[key]=i;return pool[i];
    };
  }
  const api={lines,createPicker};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PrimeSudoDialogue=api;
})(typeof window==='undefined'?globalThis:window);
