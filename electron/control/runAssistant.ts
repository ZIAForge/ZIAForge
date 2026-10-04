import { randomUUID } from 'node:crypto'
import { AgentAdapterFactory, type CreateAdapterOptions } from '../agents/AgentAdapterFactory'
/** One bounded application-architect turn; every exit retires its owned adapter. */
export async function runAssistantTurn(options:CreateAdapterOptions,prompt:string,signal:AbortSignal):Promise<string>{
  let resolve!:(s:string)=>void,reject!:(e:Error)=>void
  const complete=new Promise<string>((ok,fail)=>{resolve=ok;reject=fail});void complete.catch(()=>{})
  const messages=new Map<string,string>()
  const adapter=AgentAdapterFactory.createAdapter({...options,runId:`architect-${randomUUID()}`,onEvent:event=>{
    if(event.type==='message.delta'&&event.deltaType==='text')messages.set(event.messageId,(messages.get(event.messageId)??'')+event.content)
    if(event.type==='message.completed'&&event.fullContent!==undefined)messages.set(event.messageId,event.fullContent??'')
    if(event.type==='agent.status.changed'){
      if(event.scope==='turn'&&event.status==='completed')resolve([...messages.values()].join('\n'))
      if(['error','stopped'].includes(event.status))reject(new Error(event.error||'Architect session ended'))
    }
    if(event.type==='permission.requested')void adapter.resolveApproval(event.approvalId,'deny').catch(()=>{})
  }})
  const abort=()=>reject(new Error('Architect stopped'));signal.addEventListener('abort',abort,{once:true})
  const timer=setTimeout(()=>reject(new Error('Architect turn timed out')),5*60*1000)
  try{signal.throwIfAborted();await adapter.start();signal.throwIfAborted();await adapter.sendPrompt({taskId:options.taskId,text:prompt});return await complete}
  finally{clearTimeout(timer);signal.removeEventListener('abort',abort);await adapter.stop()}
}
