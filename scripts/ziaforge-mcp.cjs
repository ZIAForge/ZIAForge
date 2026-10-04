#!/usr/bin/env node
/* Standard MCP stdio bridge. Credentials stay in environment, never tool output. */
const readline=require('node:readline');const {randomUUID}=require('node:crypto')
const tools=[
  {name:'ziaforge_status',description:'Inspect current projects, tasks and ZIAForge version.',inputSchema:{type:'object',properties:{},additionalProperties:false}},
  {name:'ziaforge_commands',description:'Read the current application command catalog and Forge constraints.',inputSchema:{type:'object',properties:{},additionalProperties:false}},
  {name:'ziaforge_command',description:'Execute a typed ZIAForge command. Read fresh workflow/session revision first. Never bypass requirements/specification/planning gates or approve/push/merge without explicit human intent.',inputSchema:{type:'object',properties:{method:{type:'string'},args:{type:'array'},requestId:{type:'string'}},required:['method'],additionalProperties:false}},
  {name:'ziaforge_screenshot',description:'Capture a current ZIAForge window.',inputSchema:{type:'object',properties:{windowId:{type:'integer'}},additionalProperties:false}},
]
async function command(request){
  const origin=new URL(process.env.ZIAFORGE_URL||'http://127.0.0.1:43210');if(!['http:','https:'].includes(origin.protocol)||origin.username||origin.password)throw Error('Invalid ZIAFORGE_URL')
  const token=process.env.ZIAFORGE_TOKEN;if(!token)throw Error('Set ZIAFORGE_TOKEN from local owner settings')
  const response=await fetch(new URL('/api/command',origin),{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({...request,requestId:request.requestId||randomUUID()}),redirect:'error',signal:AbortSignal.timeout(180000)})
  const envelope=await response.json();if(!response.ok||!envelope.ok)throw Error(envelope.error||'Application command failed');return envelope.result
}
async function dispatch(r){
  if(r.method==='initialize')return {protocolVersion:'2024-11-05',capabilities:{tools:{}},serverInfo:{name:'ziaforge',version:'1.0.0'}}
  if(r.method==='ping')return {}
  if(r.method==='tools/list')return {tools}
  if(r.method==='tools/call'){
    const {name,arguments:a={}}=r.params||{}
    const request=name==='ziaforge_status'?{method:'system.summary'}:name==='ziaforge_commands'?{method:'system.commands'}:name==='ziaforge_screenshot'?{method:'system.screenshot',args:[a]}:name==='ziaforge_command'?a:undefined
    if(!request)throw Error('Unknown tool')
    try{const result=await command(request);if(name==='ziaforge_screenshot'){const match=/^data:image\/(png|jpeg);base64,(.+)$/.exec(result.dataUrl);if(!match)throw Error('Invalid screenshot');return {content:[{type:'image',mimeType:`image/${match[1]}`,data:match[2]}]}}return {content:[{type:'text',text:JSON.stringify(result??null)}]}}
    catch(e){return {isError:true,content:[{type:'text',text:e.message||'Command failed'}]}}
  }
  throw Error('Method not found')
}
const lines=readline.createInterface({input:process.stdin,crlfDelay:Infinity})
lines.on('line',line=>{if(Buffer.byteLength(line)>1024*1024)return;let r;try{r=JSON.parse(line)}catch{return}if(r.id===undefined)return;void dispatch(r).then(result=>process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:r.id,result})+'\n'),e=>process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:r.id,error:{code:-32601,message:e.message}})+'\n'))})
