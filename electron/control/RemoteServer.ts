import { translate, normalizeLocale, isRtlLocale } from '../../src/i18n-core'
import http, { type IncomingMessage, type ServerResponse } from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto'
import { METHOD_CHANNELS, validateControlRequest } from './ControlPolicy'
import type { ControlConfig, ControlRequest } from '../../shared/control'
const MAX_BODY=80*1024*1024
function sameToken(a:string,b:string){return timingSafeEqual(createHash('sha256').update(a).digest(),createHash('sha256').update(b).digest())}
async function body(req:IncomingMessage,limit=MAX_BODY){let size=0;const parts:Buffer[]=[];for await(const part of req){size+=part.length;if(size>limit)throw new Error('Request is too large');parts.push(part)}return JSON.parse(Buffer.concat(parts).toString('utf8'))}
const mime:Record<string,string>={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.woff2':'font/woff2','.json':'application/json'}
const EVENTS=['agent-session:update','workflow:update','work-flow:update','status-update','task-steps-update','log-stream','recovery:changed','navigate-to','open-about','control:changed']
/** Serves the actual renderer with a narrow authenticated bridge, never a debugging port. */
export class RemoteServer {
  private server?:http.Server
  private streams=new Set<ServerResponse>()
  // Reserve proxies before connecting upstream; they must never receive local events.
  private proxyStreams=new Map<ServerResponse,AbortController>()
  private sessions=new Map<string,number>()
  private closing=false
  private active=0
  private loginAttempts=new Map<string,{count:number;until:number}>()
  endpoint?:string
  constructor(private options:{config:ControlConfig;token:string;renderer:string;getLanguage?():string;execute(request:ControlRequest):Promise<unknown>;executeInstance?(id:string,request:ControlRequest):Promise<unknown>;instanceEvents?(id:string,signal:AbortSignal):Promise<ReadableStream<Uint8Array>>}){}
  async start(){
    this.closing=false
    const server=http.createServer((req,res)=>{void this.handle(req,res).catch(()=>{if(res.destroyed||res.writableEnded)return;if(!res.headersSent)this.json(res,400,{ok:false,error:'Request rejected'});else res.destroy()})})
    server.requestTimeout=30000;server.headersTimeout=15000
    await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(this.options.config.port,this.options.config.host,()=>{server.removeListener('error',reject);resolve()})})
    this.server=server;this.endpoint=`http://127.0.0.1:${this.options.config.port}`
  }
  private json(res:ServerResponse,status:number,value:unknown){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value))}
  private authenticated(req:IncomingMessage){
    const bearer=req.headers.authorization?.replace(/^Bearer /,'')
    if(bearer&&sameToken(bearer,this.options.token))return true
    const sid=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('ziaf_session='))?.slice(13)
    return !!sid&&(this.sessions.get(sid)||0)>Date.now()
  }
  private async handle(req:IncomingMessage,res:ServerResponse){
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','no-referrer')
    if(this.closing){this.json(res,503,{ok:false,error:'Application is closing'});return}
    const url=new URL(req.url||'/', 'http://localhost')
    if(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`&&req.headers.origin!==`https://${req.headers.host}`){this.json(res,403,{ok:false,error:'Origin refused'});return}
    if(url.pathname==='/api/login'&&req.method==='POST'){
      const ip=req.socket.remoteAddress||'';const rate=this.loginAttempts.get(ip)
      if(rate&&rate.until>Date.now()&&rate.count>=8){this.json(res,429,{ok:false,error:'Try again later'});return}
      if(this.loginAttempts.size>1000)this.loginAttempts.clear();const v=await body(req,1024);const valid=typeof v?.token==='string'&&v.token.length<=300&&sameToken(v.token,this.options.token)
      if(!valid){this.loginAttempts.set(ip,{count:rate&&rate.until>Date.now()?rate.count+1:1,until:Date.now()+60000});this.json(res,401,{ok:false,error:'Invalid access token'});return}
      this.loginAttempts.delete(ip);for(const [s,t]of this.sessions)if(t<Date.now())this.sessions.delete(s)
      if(this.sessions.size>=64)this.sessions.delete(this.sessions.keys().next().value!)
      const sid=randomBytes(32).toString('hex');this.sessions.set(sid,Date.now()+12*60*60*1000)
      res.setHeader('Set-Cookie',`ziaf_session=${sid}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200`)
      this.json(res,200,{ok:true});return
    }
    if(!this.authenticated(req)){
      if(req.method==='GET'&&url.pathname==='/'){res.writeHead(200,{'Content-Type':'text/html','Content-Security-Policy':"default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'",'Cache-Control':'no-store'});res.end(loginPage(this.options.getLanguage?.() ?? 'en'));return}
      this.json(res,401,{ok:false,error:'Owner access token required'});return
    }
    if(url.pathname==='/api/events'&&req.method==='GET'){
      if(this.streams.size+this.proxyStreams.size>=32){this.json(res,429,{ok:false,error:'Too many event connections'});return}
      const instance=url.searchParams.get('instance')
      if(instance){
        if(!/^[\w-]{1,80}$/.test(instance)||!this.options.instanceEvents)throw new Error('Invalid instance')
        const controller=new AbortController()
        const disconnected=()=>{controller.abort();this.proxyStreams.delete(res)}
        this.proxyStreams.set(res,controller)
        res.once('close',disconnected)
        let reader:ReadableStreamDefaultReader<Uint8Array>|undefined
        try{
          reader=(await this.options.instanceEvents(instance,controller.signal)).getReader()
          if(controller.signal.aborted||this.closing||res.destroyed)return
          res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-store'})
          while(!controller.signal.aborted){const part=await reader.read();if(part.done)break;if(res.writableLength>1024*1024)break;res.write(Buffer.from(part.value))}
        }finally{
          controller.abort()
          if(reader)await reader.cancel().catch(()=>{})
          this.proxyStreams.delete(res);res.removeListener('close',disconnected)
          if(res.headersSent&&!res.destroyed&&!res.writableEnded)res.end()
        }
        return
      }
      res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-store','Connection':'keep-alive'});res.write(': connected\n\n');this.streams.add(res)
      const beat=setInterval(()=>res.write(': heartbeat\n\n'),15000);res.on('close',()=>{clearInterval(beat);this.streams.delete(res)});return
    }
    if(url.pathname==='/api/command'&&req.method==='POST'){
      if(!req.headers.authorization&&!req.headers.origin){this.json(res,403,{ok:false,error:'Browser origin required'});return}
      if(this.active>=16){this.json(res,429,{ok:false,error:'Too many commands'});return}
      this.active++
      try{const request=await body(req);validateControlRequest(request);this.json(res,200,{ok:true,result:await (url.searchParams.get('instance')&&this.options.executeInstance?this.options.executeInstance(url.searchParams.get('instance')!,request):this.options.execute(request))})}catch(e){this.json(res,400,{ok:false,error:e instanceof Error?e.message:'Command failed'})}finally{this.active--}return
    }
    if(url.pathname==='/remote-bridge.js'&&req.method==='GET'){res.writeHead(200,{'Content-Type':'application/javascript','Cache-Control':'no-store'});res.end(browserBridge(this.options.getLanguage?.() ?? 'en'));return}
    if(req.method!=='GET'){this.json(res,405,{ok:false,error:'Method not allowed'});return}
    const rel=decodeURIComponent(url.pathname).replace(/^\/+/, '')||'index.html';const file=path.resolve(this.options.renderer,rel)
    if(!file.startsWith(path.resolve(this.options.renderer)+path.sep)||!fs.existsSync(file)||!fs.realpathSync(file).startsWith(fs.realpathSync(this.options.renderer)+path.sep)||!fs.statSync(file).isFile()){this.json(res,404,{ok:false,error:'Not found'});return}
    if(rel==='index.html'){
      let html=await fs.promises.readFile(file,'utf8')
      html=html.replace(/<meta[^>]+http-equiv="Content-Security-Policy"[^>]*>/i,'').replace('<head>',`<head><script src="/remote-bridge.js"></script>`)
      res.writeHead(200,{'Content-Type':'text/html','Cache-Control':'no-store','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self'; frame-src 'self' https: http:; frame-ancestors 'none'"});res.end(html);return
    }
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});fs.createReadStream(file).pipe(res)
  }
  publish(channel:string,data:unknown){if(!EVENTS.includes(channel)&&!/^pty-(data|exit)-[\w-]+$/.test(channel))return;const line=`data: ${JSON.stringify({channel,data})}\n\n`;for(const s of this.streams){if(s.writableLength>1024*1024){s.destroy();continue}s.write(line)}}
  async close(){this.closing=true;for(const s of this.streams)s.end();this.streams.clear();for(const [s,controller]of this.proxyStreams){controller.abort();if(s.headersSent)s.end();else s.destroy()}this.proxyStreams.clear();this.sessions.clear();const s=this.server;this.server=undefined;if(s)await new Promise<void>(r=>{s.close(()=>r());s.closeAllConnections()})}
}
function browserBridge(language: string){
  const labels = JSON.stringify({
    instance: translate(language, 'remote.instanceLabel'), thisInstance: translate(language, 'remote.thisInstance'),
    commandFailed: translate(language, 'remote.commandFailed'), localOnly: translate(language, 'remote.localOnly'),
  }).replace(/</g, '\\u003c')
  const map={...METHOD_CHANNELS,'control.status':'control:status','control.execute':'control:execute','control.assistantState':'control:assistant-state','control.assistantSend':'control:assistant-send','control.assistantStop':'control:assistant-stop','updates.status':'updates:status'}
  return `(()=>{const labels=${labels};const methods=${JSON.stringify(map)};const target=new URL(location.href).searchParams.get('instance');const suffix=target?'?instance='+encodeURIComponent(target):'';const callbacks=new Map();const api={};for(const method of Object.keys(methods)){const parts=method.split('.');let obj=api;for(const p of parts.slice(0,-1))obj=obj[p]||(obj[p]={});obj[parts.at(-1)]=async(...args)=>{const r=await fetch('/api/command'+suffix,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({method,args,requestId:crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)})});const v=await r.json();if(!v.ok)throw new Error(v.error||labels.commandFailed);return v.result}}const on=(channel,cb)=>{if(!callbacks.has(channel))callbacks.set(channel,new Set());callbacks.get(channel).add(cb);return()=>callbacks.get(channel)?.delete(cb)};api.agentSessions.onEvent=cb=>on('agent-session:update',cb);api.workflows.onEvent=cb=>on('workflow:update',cb);api.workFlows.onEvent=cb=>on('work-flow:update',cb);api.recovery.onChanged=cb=>on('recovery:changed',cb);api.onStatusUpdate=cb=>on('status-update',cb);api.onTaskStepsUpdate=cb=>on('task-steps-update',cb);api.onLogStream=cb=>on('log-stream',cb);api.onNavigate=cb=>on('navigate-to',cb);api.onOpenAbout=cb=>on('open-about',cb);api.onPtyData=(id,cb)=>on('pty-data-'+id,cb);api.onPtyExit=(id,cb)=>on('pty-exit-'+id,cb);for(const name of ['selectDirectory','workInputs.pick','workFolders.pick','control.configure','control.rotateToken','updates.configure','updates.check','updates.download','updates.install','quitApp','resetDatabase','restoreFactoryDefaults','spawnPty','writePty','resizePty','killPty','killProcessByPid','killProcessByCommand','getActiveProcesses']){const parts=name.split('.');let obj=api;for(const p of parts.slice(0,-1))obj=obj[p]||(obj[p]={});obj[parts.at(-1)]=async()=>{throw new Error(labels.localOnly)}}api.editorDirtyState=async()=>{};api.editorOnClosing=()=>()=>{};api.updateMenu=async()=>{};api.writeDebugLog=async()=>{};window.ziafAPI=api;window.ziafRemote=true;const events=new EventSource('/api/events'+suffix);events.onmessage=e=>{const v=JSON.parse(e.data);for(const cb of callbacks.get(v.channel)||[])cb(v.data)};document.addEventListener('DOMContentLoaded',async()=>{try{const r=await fetch('/api/command',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({method:'control.status'})});const v=await r.json();if(!v.ok||!v.result.instances?.length)return;const select=document.createElement('select');select.setAttribute('aria-label',labels.instance);select.style.cssText='position:fixed;bottom:12px;right:12px;z-index:9999;max-width:240px;border-radius:10px;background:#15171a;color:#eee;border:1px solid #444;padding:8px';for(const i of [{id:'',name:labels.thisInstance},...v.result.instances]){const o=document.createElement('option');o.value=i.id;o.textContent=i.name;select.append(o)}select.value=target||'';select.onchange=()=>{const u=new URL(location.href);select.value?u.searchParams.set('instance',select.value):u.searchParams.delete('instance');location.href=u.toString()};document.body.append(select)}catch{}});})();`
}
function loginPage(language: string) {
  const locale = normalizeLocale(language)
  const escape = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)
  const label = (key: string) => escape(translate(locale, key))
  const refused = JSON.stringify(translate(locale, 'remote.accessRefused')).replace(/</g, '\\u003c')
  return `<!doctype html><html lang="${escape(locale)}" dir="${isRtlLocale(locale) ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${label('remote.connectionTitle')}</title><style>body{background:#0b0c0e;color:#eee;font:16px system-ui;display:grid;place-items:center;min-height:100vh;margin:0}form{box-sizing:border-box;width:min(464px,92vw);padding:32px;background:#15171a;border:1px solid #2b2e33;border-radius:20px}input,button{box-sizing:border-box;width:100%;padding:14px;border-radius:10px;margin-top:16px}input{background:#0b0c0e;color:white;border:1px solid #454545;direction:ltr}button{background:#ff6b00;border:0;font-weight:700}p{color:#aaa}#error{color:#ff947c}</style></head><body><form><h1>ZIAForge</h1><p>${label('remote.loginHint')}</p><label for="token">${label('remote.accessToken')}</label><input id="token" name="token" type="password" autocomplete="off" required><button>${label('remote.connect')}</button><p id="error" role="alert"></p></form><script>document.querySelector('form').onsubmit=async e=>{e.preventDefault();try{const r=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:e.target.token.value})});if(!r.ok)throw Error(${refused});location.reload()}catch{document.querySelector('#error').textContent=${refused}}}</script></body></html>`
}
