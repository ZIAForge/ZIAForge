import type { ControlConfig, ControlRequest, ControlScope } from '../../shared/control'
export const METHOD_CHANNELS: Record<string, string> = {
  'updates.status':'updates:status',
  'control.status':'control:status','control.assistantState':'control:assistant-state','control.assistantSend':'control:assistant-send','control.assistantStop':'control:assistant-stop','control.execute':'control:execute','control.remote':'control:remote',
  getRepositories:'get-repositories',saveRepositories:'save-repositories',getTasks:'get-tasks',createTask:'create-task',startTask:'start-task',lookupCodeStart:'lookup-code-start',lookupWorkStart:'lookup-work-start',
  getSettings:'get-settings',saveSettings:'save-settings',getAppVersion:'get-app-version',getPresets:'get-presets',savePresets:'save-presets',getChatHistory:'get-chat-history',saveChatHistory:'save-chat-history',
  registerProject:'register-project',getProjectBranches:'get-project-branches',listProjectFiles:'list-project-files',readFile:'read-file',writeFile:'write-file',createDirectory:'create-directory',
  getAgentModels:'get-agent-models',getAgentModelCatalog:'get-agent-model-catalog',listWorkspaceFolders:'list-workspace-folders',createWorkspaceFolder:'create-workspace-folder',deleteProjectFiles:'delete-project-files',openExternal:'open-external',
  'apiConnections.list':'api-connections:list','apiConnections.save':'api-connections:save','apiConnections.remove':'api-connections:remove',
  'git.prepare':'git:prepare','git.status':'git:status','git.diff':'git:diff','git.commit':'git:commit','git.push':'git:push','git.merge':'git:merge','git.removeWorktree':'git:remove-worktree',
  'workflows.get':'workflow:get','workflows.save':'workflow:save','workflows.start':'workflow:start','workflows.pause':'workflow:pause','workflows.discuss':'workflow:discuss','workflows.respond':'workflow:respond','workflows.readArtifact':'workflow:read-artifact',
  'workFlows.get':'work-flow:get','workFlows.save':'work-flow:save','workFlows.start':'work-flow:start','workFlows.pause':'work-flow:pause','workFlows.respond':'work-flow:respond','workFlows.followUp':'work-flow:follow-up','workFlows.readArtifact':'work-flow:read-artifact','workFlows.openArtifact':'work-flow:open-artifact',
  'agentSessions.create':'agent-session:create','agentSessions.resume':'agent-session:resume','agentSessions.reconfigure':'agent-session:reconfigure','agentSessions.attach':'agent-session:attach','agentSessions.snapshot':'agent-session:snapshot','agentSessions.send':'agent-session:send','agentSessions.interrupt':'agent-session:interrupt','agentSessions.terminate':'agent-session:terminate','agentSessions.resolveApproval':'agent-session:resolve-approval','agentSessions.queue':'agent-session:queue','agentSessions.setQueuePaused':'agent-session:set-queue-paused','agentSessions.cancelQueued':'agent-session:cancel-queued',
  'reviewTeams.list':'review-teams:list','reviewTeams.save':'review-teams:save','reviewTeams.remove':'review-teams:remove',
  'recovery.list':'recovery:list','recovery.inspect':'recovery:inspect','recovery.restore':'recovery:restore',
  'workInputs.list':'work-inputs:list','workFolders.assign':'work-folders:assign',
  editorCreate:'editor:create',editorOpen:'editor:open',editorRead:'editor:read',editorSave:'editor:save',editorSearch:'editor:search',editorClose:'editor:close',editorLoadDraft:'editor:load-draft',editorStoreDraft:'editor:store-draft',editorReveal:'editor:reveal',
}
const READ = new Set(['updates.status','control.status','control.assistantState','getRepositories','getTasks','getSettings','getAppVersion','getPresets','getChatHistory','lookupCodeStart','lookupWorkStart','getProjectBranches','listProjectFiles','readFile','getAgentModels','getAgentModelCatalog','listWorkspaceFolders','apiConnections.list','git.status','git.diff','workflows.get','workflows.readArtifact','workFlows.get','workFlows.readArtifact','agentSessions.attach','agentSessions.snapshot','reviewTeams.list','recovery.list','recovery.inspect','workInputs.list','editorOpen','editorRead','editorSearch','editorClose','editorLoadDraft','system.summary','system.screenshot','system.windows','system.commands','system.context'])
export function validateControlRequest(value: unknown): asserts value is ControlRequest {
  if (!value || typeof value!=='object' || Array.isArray(value)) throw new Error('Invalid command')
  const v=value as Record<string,unknown>
  if(Object.keys(v).some(k=>!['method','args','requestId'].includes(k)) || typeof v.method!=='string' || v.method.length>100 || v.args!==undefined&&!Array.isArray(v.args) || v.requestId!==undefined&&(typeof v.requestId!=='string'||!/^[\w-]{1,160}$/.test(v.requestId))) throw new Error('Invalid command envelope')
  if(v.args && (v.args as unknown[]).length>4) throw new Error('Too many arguments')
}
export function assertCommandScope(method:string, scope:ControlScope) {
  if(!(Object.hasOwn(METHOD_CHANNELS,method)) && !['system.summary','system.screenshot','system.windows','system.commands','system.context','computer.run'].includes(method)) throw new Error('Unknown or owner-only command')
  if(scope==='read'&&!READ.has(method)) throw new Error('This connection has read-only access')
}
export function validateControlConfig(v:unknown): asserts v is ControlConfig {
  if(!v||typeof v!=='object'||Array.isArray(v))throw new Error('Invalid owner configuration')
  const c=v as ControlConfig
  if(Object.keys(c).some(k=>!['enabled','host','port','scope','nativeComputer','assistantPreset','assistantOperate','telegramEnabled','telegramOwner','telegramToken','instances'].includes(k)) || !['127.0.0.1','0.0.0.0'].includes(c.host) || !Number.isInteger(c.port) || c.port<1024||c.port>65535 || !['read','operate'].includes(c.scope))throw new Error('Invalid server settings')
  for(const k of ['enabled','nativeComputer','assistantOperate','telegramEnabled'] as const)if(typeof c[k]!=='boolean')throw new Error('Invalid owner permission')
  if(typeof c.assistantPreset!=='string'||c.assistantPreset.length>300||typeof c.telegramOwner!=='string'||c.telegramOwner!==''&&!/^\d{1,20}$/.test(c.telegramOwner))throw new Error('Invalid assistant/owner')
  if(c.telegramToken!==undefined&&(typeof c.telegramToken!=='string'||c.telegramToken.length>200||c.telegramToken!==''&&!/^\d+:[A-Za-z0-9_-]+$/.test(c.telegramToken)))throw new Error('Invalid bot token')
  if(!Array.isArray(c.instances)||c.instances.length>20)throw new Error('Invalid instance list')
  const ids=new Set<string>()
  for(const i of c.instances){if(!i||typeof i!=='object'||Object.keys(i).some(k=>!['id','name','url','token','hasToken'].includes(k))||!/^[\w-]{1,80}$/.test(i.id)||ids.has(i.id)||typeof i.name!=='string'||!i.name||i.name.length>120)throw new Error('Invalid instance');ids.add(i.id);const u=new URL(i.url);if(!['http:','https:'].includes(u.protocol)||u.username||u.password||u.search||u.hash||u.pathname!=='/'&&u.pathname!=='')throw new Error('Instance requires a plain http(s) origin');if(i.token!==undefined&&(typeof i.token!=='string'||i.token.length>300))throw new Error('Invalid instance credential')}
}
