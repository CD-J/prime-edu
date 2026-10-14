// Explicitly authorized BrowserStack WebDriver API client.
// Authentication is passed in memory; never saved or included in capabilities.
const HUB='https://hub.browserstack.com/wd/hub';
const ELEMENT='element-6066-11e4-a52e-4f735466cecf';
export async function create(authHeader,{deviceName,osVersion,sessionName,orientation='portrait',buildName='Prime Edu real iPhone UI'}) {
  async function request(path,method='GET',body) {
    const response=await fetch(HUB+path,{method,headers:{Authorization:authHeader,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(60000)});
    const result=await response.json();
    if(!response.ok||result.value?.error)throw new Error(`${result.value?.error||'HTTP '+response.status}: ${result.value?.message||'WebDriver request failed'}`);
    return result.value;
  }
  const value=await request('/session','POST',{capabilities:{alwaysMatch:{browserName:'safari','bstack:options':{deviceName,osVersion,realMobile:true,deviceOrientation:orientation,projectName:'Prime Edu UI verification',buildName,sessionName,local:false,debug:true,video:true,networkLogs:false,idleTimeout:300}},firstMatch:[{}]}});
  const id=value.sessionId;
  if(!id)throw new Error('WebDriver did not return a session ID.');
  return attach(authHeader,id,value.capabilities);
}
export function attach(authHeader,id,capabilities={}) {
  async function request(path,method='GET',body) {
    const response=await fetch(HUB+path,{method,headers:{Authorization:authHeader,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(60000)});
    const result=await response.json();
    if(!response.ok||result.value?.error)throw new Error(`${result.value?.error||'HTTP '+response.status}: ${result.value?.message||'WebDriver request failed'}`);
    return result.value;
  }
  const command=(path,method='GET',body)=>request(`/session/${id}${path}`,method,body);
  return {
    id,capabilities:{browserName:capabilities.browserName,browserVersion:capabilities.browserVersion,platformName:capabilities.platformName,platformVersion:capabilities.platformVersion,deviceName:capabilities.deviceName},
    command,
    go:url=>command('/url','POST',{url}),
    script:(fn,...args)=>command('/execute/sync','POST',{script:typeof fn==='function'?`return (${fn.toString()}).apply(null,arguments);`:fn,args}),
    async element(selector){return (await command('/element','POST',{using:'css selector',value:selector}))[ELEMENT];},
    async click(selector){const element=await this.element(selector);return command(`/element/${element}/click`,'POST',{});},
    async type(selector,text){const element=await this.element(selector);await command(`/element/${element}/clear`,'POST',{});return command(`/element/${element}/value`,'POST',{text,value:[...text]});},
    async screenshot(){return Buffer.from(await command('/screenshot'),'base64');},
    async touch(from,to,duration=700){return command('/actions','POST',{actions:[{type:'pointer',id:'finger',parameters:{pointerType:'touch'},actions:[{type:'pointerMove',duration:0,origin:'viewport',x:Math.round(from[0]),y:Math.round(from[1])},{type:'pointerDown',button:0},{type:'pause',duration:100},{type:'pointerMove',duration,origin:'viewport',x:Math.round(to[0]),y:Math.round(to[1])},{type:'pointerUp',button:0}]}]});},
    close:()=>command('','DELETE'),
  };
}
