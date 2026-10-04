import { createHash } from 'node:crypto'
import { ControlStore } from './ControlStore'
import { RemoteServer } from './RemoteServer'
import { AssistantEngine } from './AssistantEngine'
import { createCommandCatalog } from './CommandCatalog'
import { METHOD_CHANNELS, assertCommandScope, validateControlRequest } from './ControlPolicy'
import type { ControlConfig, ControlRequest, ControlScope, ControlStatus } from '../../shared/control'
export interface BotLifecycle { start():Promise<void>;close():Promise<void>;status():string }
export interface ControlServiceOptions {
  directory:string;renderer:string
  getLanguage?():string
  invoke(channel:string,args:unknown[]):Promise<unknown>
  system(method:string,args:unknown[]):Promise<unknown>
  runAssistant(prompt:string,signal:AbortSignal):Promise<string>
  makeBot?(config:ControlConfig,service:ControlService):BotLifecycle
}
export class ControlService {
  private store:ControlStore
  private config:ControlConfig
  private token:string
  private server?:RemoteServer
  private bot?:BotLifecycle
  private error?:string
  private closing=false
  private shutdown=new AbortController()
  private changes:Promise<void>=Promise.resolve()
  private receipts=new Map<string,{fingerprint:string;promise:Promise<unknown>}>()
  readonly assistant:AssistantEngine
  constructor(private options:ControlServiceOptions){
    this.store=new ControlStore(options.directory);const saved=this.store.read();this.config=saved.config;this.token=saved.token
    this.assistant=new AssistantEngine({directory:options.directory,run:options.runAssistant,commands:()=>this.commands(),context:id=>id?this.remote({instanceId:id,request:{method:'system.summary'}}):options.system('system.summary',[]),execute:(r,id)=>id?this.remote({instanceId:id,request:r},this.config.assistantOperate?'operate':'read'):this.execute(r,this.config.assistantOperate?'operate':'read')})
  }
  commands(){return {...createCommandCatalog(),policy:{scope:this.config.assistantOperate?'operate':'read',nativeComputer:this.config.nativeComputer,ownerSettings:'Settings > Remote control'}}}
  status(owner=false):ControlStatus{return {...this.config,telegramToken:undefined,instances:this.config.instances.map(({token,...i})=>({...i,hasToken:!!token})),accessToken:owner?this.token:undefined,endpoint:this.server?.endpoint,telegramConfigured:!!this.config.telegramToken&&!!this.config.telegramOwner,telegramStatus:this.bot?.status()??'disabled',running:!!this.server,error:this.error} as ControlStatus}
  ownerConfig(){return structuredClone(this.config)}
  async start(){await this.restart()}
  private async restart(){
    await this.server?.close();this.server=undefined;await this.bot?.close();this.bot=undefined;this.error=undefined
    if(this.closing)return
    try{
      if(this.config.enabled){if(!this.token){const saved=this.store.save(this.config);this.config=saved.config;this.token=saved.token}const server=new RemoteServer({config:this.config,token:this.token,renderer:this.options.renderer,getLanguage:this.options.getLanguage,execute:r=>this.remoteCommand(r),executeInstance:(id,r)=>this.remote({instanceId:id,request:r},this.config.scope),instanceEvents:(id,signal)=>this.instanceEvents(id,signal)});await server.start();this.server=server}
      if(this.config.telegramEnabled){if(!this.config.telegramToken||!this.config.telegramOwner)throw new Error('Telegram needs a bot token and numeric owner ID');this.bot=this.options.makeBot?.(this.config,this);await this.bot?.start()}
    }catch(e){this.error=e instanceof Error?e.message:'Control service failed'}
  }
  private async remoteCommand(r:ControlRequest){
    if(r.method==='control.status')return this.status()
    if(r.method==='control.assistantState')return this.assistant.state()
    if(['control.assistantSend','control.assistantStop'].includes(r.method)&&this.config.scope!=='operate')throw new Error('Read-only access')
    if(r.method==='control.assistantSend')return this.assistant.send(r.args?.[0] as {text:string;instanceId?:string})
    if(r.method==='control.assistantStop'){this.assistant.stop();return}
    if(r.method==='control.remote'){if(this.config.scope!=='operate')throw new Error('Read-only access');return this.remote(r.args?.[0] as {instanceId:string;request:ControlRequest},this.config.scope)}
    if(r.method==='control.execute')return this.execute(r.args?.[0] as ControlRequest,this.config.scope)
    return this.execute(r,this.config.scope)
  }
  configure(config:ControlConfig,rotate=false):Promise<ControlStatus>{
    let result!:ControlStatus
    const work=this.changes.then(async()=>{if(this.closing)throw new Error('Application is closing');if(this.assistant.state().busy)throw new Error('Stop the architect before changing owner permissions');const saved=this.store.save(config,rotate);this.config=saved.config;this.token=saved.token;await this.restart();result=this.status(true)})
    this.changes=work.catch(()=>{});return work.then(()=>result)
  }
  rotateToken(){return this.configure(this.config,true)}
  async execute(request:ControlRequest,scope:ControlScope=this.config.scope):Promise<unknown>{
    if(this.closing)throw new Error('Application is closing')
    validateControlRequest(request);assertCommandScope(request.method,scope)
    if(request.method==='computer.run'&&!this.config.nativeComputer)throw new Error('The owner must enable Settings > Remote control > Native computer access locally')
    if(request.method.startsWith('control.')){if(['control.execute','control.assistantSend'].includes(request.method))throw new Error('Nested architect/command dispatch is not permitted');return this.remoteCommand(request)}
    const fingerprint=createHash('sha256').update(JSON.stringify({method:request.method,args:request.args??[]})).digest('hex')
    const prior=request.requestId?this.receipts.get(request.requestId):undefined
    if(prior){if(prior.fingerprint!==fingerprint)throw new Error('Request ID was reused with different arguments');return prior.promise}
    const promise=Promise.resolve().then(()=>request.method.startsWith('system.')||request.method==='computer.run'?this.options.system(request.method,request.args??[]):this.options.invoke(METHOD_CHANNELS[request.method],request.args??[]))
    if(request.requestId){if(this.receipts.size>=256)this.receipts.delete(this.receipts.keys().next().value!);this.receipts.set(request.requestId,{fingerprint,promise})}
    return promise
  }
  private instance(id:string){const i=this.config.instances.find(i=>i.id===id);if(!i?.token)throw new Error('Select a configured instance with an access token');return i}
  async remote(v:{instanceId:string;request:ControlRequest},scope:ControlScope='operate'){
    if(!v||typeof v.instanceId!=='string')throw new Error('Invalid remote instance')
    validateControlRequest(v.request);if(!['control.status','control.assistantState','updates.status'].includes(v.request.method))assertCommandScope(v.request.method,scope)
    const i=this.instance(v.instanceId)
    const response=await fetch(new URL('/api/command',i.url),{method:'POST',headers:{Authorization:`Bearer ${i.token}`,'Content-Type':'application/json'},body:JSON.stringify(v.request),signal:AbortSignal.any([this.shutdown.signal,AbortSignal.timeout(180000)]),redirect:'error'})
    if(Number(response.headers.get('content-length'))>80*1024*1024)throw new Error('Remote response too large')
    const text=await response.text();if(text.length>80*1024*1024)throw new Error('Remote response too large')
    const envelope=JSON.parse(text);if(!response.ok||!envelope.ok)throw new Error(envelope.error||'Remote command failed');return envelope.result
  }
  async instanceEvents(id:string,signal:AbortSignal){const i=this.instance(id);const r=await fetch(new URL('/api/events',i.url),{headers:{Authorization:`Bearer ${i.token}`},signal,redirect:'error'});if(!r.ok||!r.body)throw new Error('Remote events unavailable');return r.body}
  publish(channel:string,data:unknown){this.server?.publish(channel,data)}
  async close(){this.closing=true;this.shutdown.abort();this.assistant.stop();await this.assistant.close();await this.changes;await this.server?.close();await this.bot?.close()}
}
