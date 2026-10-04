import { test, expect } from './fixtures'
import { _electron } from '@playwright/test'
import fs from 'node:fs/promises'
import path from 'node:path'
import net from 'node:net'
import { spawn, spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { fixtureEnvironment } = require('../scripts/qa/fixture-environment.cjs')
const { ownedProcesses } = require('../scripts/qa/process-tree.cjs')
async function port() { const server=net.createServer();await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const p=(server.address() as net.AddressInfo).port;await new Promise<void>(r=>server.close(()=>r()));return p }
test('authenticated control, two actual instances, MCP and cancelled Quit preserve owner boundaries', async ({ app }, testInfo) => {
  test.setTimeout(120000)
  const first=app.window
  const p1=await port(),p2=await port()
  const local=await first.evaluate(p=>window.ziafAPI.control.configure({enabled:true,host:'127.0.0.1',port:p,scope:'operate',nativeComputer:false,assistantPreset:'',assistantOperate:false,telegramEnabled:false,telegramOwner:'',instances:[]}),p1)
  expect(local.running).toBe(true)
  const origin=local.endpoint!,token=local.accessToken!
  const call=async(method:string,args:unknown[]=[],target='')=>{const r=await fetch(origin+'/api/command'+target,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({method,args})});return {status:r.status,body:await r.json()} }
  expect((await fetch(origin+'/api/command',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"method":"system.summary"}'})).status).toBe(401)
  const summary=await call('system.summary');expect(summary.body.ok).toBe(true);expect(summary.body.result.nativeComputer).toBe(false)
  const catalog=await call('system.commands');expect(catalog.body.result.commands['workflows.start'].args).toContain('revision:number')
  const status=await call('control.status');expect(JSON.stringify(status.body)).not.toContain(token)
  expect((await call('control.configure',[{nativeComputer:true}])).body.ok).toBe(false)
  expect((await call('computer.run',[{command:'whoami'}])).body.ok).toBe(false)
  const picture=await call('system.screenshot');expect(picture.body.result.dataUrl).toMatch(/^data:image\/png;base64,/)
  await fs.writeFile(testInfo.outputPath('control-screenshot.png'),Buffer.from(picture.body.result.dataUrl.split(',')[1],'base64'))
  // A cancelled Quit must not shut down services needed to save unsaved files.
  await app.electronApp.evaluate(({dialog})=>{dialog.showMessageBoxSync=()=>0})
  await first.evaluate(()=>window.ziafAPI.editorDirtyState({dirty:true}))
  await app.electronApp.evaluate(({app:electron})=>electron.quit())
  expect((await call('getAppVersion')).body.ok).toBe(true)
  await first.evaluate(()=>window.ziafAPI.editorDirtyState({dirty:false}))
  const root=testInfo.outputPath('second-instance'),userData=path.join(root,'user-data'),workspace=path.join(root,'workspace')
  await fs.mkdir(userData,{recursive:true});await fs.mkdir(workspace,{recursive:true})
  await fs.writeFile(path.join(userData,'settings.json'),JSON.stringify({useMockData:false,globalWorkspacePath:workspace,uiLanguage:'en',debugLogging:false}))
  const second=await _electron.launch({args:[path.resolve('e2e/bootstrap.cjs'),'--user-data-dir='+userData],cwd:process.cwd(),env:fixtureEnvironment({ZIAFORGE_E2E:'1',ZIAFORGE_E2E_USER_DATA:userData,PATH:'/usr/bin:/bin',SHELL:'/bin/bash',LANG:'en_US.UTF-8'}),timeout:30000})
  const owned=ownedProcesses(second.process().pid);owned.observe()
  try {
    const page=await second.firstWindow();await page.waitForFunction(()=>!!window.ziafAPI)
    const remote=await page.evaluate(p=>window.ziafAPI.control.configure({enabled:true,host:'127.0.0.1',port:p,scope:'read',nativeComputer:false,assistantPreset:'',assistantOperate:false,telegramEnabled:false,telegramOwner:'',instances:[]}),p2)
    expect(remote.running).toBe(true)
    await first.evaluate(config=>window.ziafAPI.control.configure(config),{enabled:true,host:'127.0.0.1' as const,port:p1,scope:'operate' as const,nativeComputer:false,assistantPreset:'',assistantOperate:false,telegramEnabled:false,telegramOwner:'',instances:[{id:'second',name:'Second fixture ZIAForge',url:remote.endpoint!,token:remote.accessToken!}]})
    const routed=await call('system.summary',[],'?instance=second');expect(routed.body.ok).toBe(true);expect(routed.body.result.tasks).toEqual([])
    expect(summary.body.result.tasks.length).toBeGreaterThan(0)
    const denied=await call('createWorkspaceFolder',['forbidden'],'?instance=second');expect(denied.body.ok).toBe(false)
    const safe=await call('control.status');expect(safe.body.result.instances[0].hasToken).toBe(true);expect(JSON.stringify(safe.body)).not.toContain(remote.accessToken!)
    // Actual stdio client transport, not a mocked HTTP response.
    const child=spawn(process.execPath,[path.resolve('scripts/ziaforge-mcp.cjs')],{env:{PATH:process.env.PATH,HOME:process.env.HOME,ZIAFORGE_URL:origin,ZIAFORGE_TOKEN:token},stdio:['pipe','pipe','pipe']})
    let output='';child.stdout.on('data',part=>{output+=part.toString()});let stderr='';child.stderr.on('data',part=>{stderr+=part.toString()})
    child.stdin.end([JSON.stringify({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2024-11-05',capabilities:{},clientInfo:{name:'ZIAForge fixture',version:'1'}}}),JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'}),JSON.stringify({jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'ziaforge_status',arguments:{}}})].join('\n')+'\n')
    const code=await new Promise<number|null>((resolve,reject)=>{const timer=setTimeout(()=>{child.kill('SIGTERM');reject(new Error('MCP fixture timed out'))},15000);child.once('error',reject);child.once('exit',c=>{clearTimeout(timer);resolve(c)})})
    expect(code).toBe(0);expect(stderr).toBe('');expect(output).not.toContain(token)
    const response=output.trim().split('\n').map(line=>JSON.parse(line)).find(r=>r.id===2);expect(response.result.isError).not.toBe(true);expect(JSON.parse(response.result.content[0].text).version.version).toBe(summary.body.result.version.version)
    await fs.writeFile(testInfo.outputPath('control-receipt.json'),JSON.stringify({mode:'actual Electron with isolated fixtures; no live model/Telegram/updater',version:summary.body.result.version,unauthenticatedDenied:true,ownerGrantDenied:true,readDestinationDenied:true,twoDistinctInstances:true,mcp:true,cancelledQuitLeavesServicesAlive:true},null,2))
  } finally {
    owned.observe();await second.close();const cleanup=await owned.cleanup();expect(cleanup.verified).toBe(true)
  }
})

test('owner native command and its descendant are stopped by actual Electron Quit', async ({ app }, testInfo) => {
  const page = app.window
  const p = await port()
  const status = await page.evaluate(port => window.ziafAPI.control.configure({ enabled: true, host: '127.0.0.1', port, scope: 'operate', nativeComputer: true, assistantPreset: '', assistantOperate: false, telegramEnabled: false, telegramOwner: '', instances: [] }), p)
  const marker = testInfo.outputPath('native-pids.json')
  const userData = await app.electronApp.evaluate(({ app: electron }) => electron.getPath('userData'))
  const code = `const fs=require('node:fs'),{spawn}=require('node:child_process');const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});fs.writeFileSync(${JSON.stringify(marker)},JSON.stringify({parent:process.pid,child:child.pid,cwd:process.cwd(),home:process.env.HOME}));setInterval(()=>{},1000)`
  const pending = fetch(status.endpoint! + '/api/command', { method: 'POST', headers: { Authorization: 'Bearer ' + status.accessToken!, 'Content-Type': 'application/json' }, body: JSON.stringify({ method: 'computer.run', args: [{ command: process.execPath, args: ['-e', code] }] }) }).then(r => r.json()).catch(() => null)
  await expect.poll(async () => fs.access(marker).then(() => true, () => false), { timeout: 15000 }).toBe(true)
  const processes = JSON.parse(await fs.readFile(marker, 'utf8')) as { parent: number; child: number; cwd: string; home: string }
  expect(processes.home).toBe(process.env.HOME)
  expect(await fs.realpath(processes.cwd)).toBe(await fs.realpath(userData))
  await app.restart()
  await pending
  for (const pid of [processes.parent, processes.child]) expect(spawnSync('/bin/ps', ['-p', String(pid), '-o', 'pid=']).stdout.toString().trim()).toBe('')
  const directories = await fs.readdir(path.join(userData, 'native-control'))
  const receipts = await Promise.all(directories.map(async directory => JSON.parse(await fs.readFile(path.join(userData, 'native-control', directory, 'receipt.json'), 'utf8'))))
  expect(receipts).toHaveLength(1)
  expect(receipts[0]).toMatchObject({ status: 'cancelled', cleanupVerified: true })
  await fs.writeFile(testInfo.outputPath('native-quit-receipt.json'), JSON.stringify({ mode: 'actual Electron; explicit owner grant in isolated fixture', processes, receipt: receipts[0] }, null, 2))
})
