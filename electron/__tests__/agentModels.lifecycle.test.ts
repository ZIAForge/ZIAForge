import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { AgentModelDiscovery, modelCatalogDirectory } from '../agentModels'

const directories: string[] = []
const registries: AgentModelDiscovery[] = []
afterEach(async () => {
  await Promise.all(registries.splice(0).map(item => item.shutdown()))
  await Promise.all(directories.splice(0).map(directory => fs.rm(directory, { force: true, recursive: true })))
})
const alive = (pid: number) => { try { process.kill(pid, 0); return true } catch { return false } }
async function fixture(source: string) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ziaforge-models-'))
  directories.push(root)
  const script = path.join(root, 'models.cjs')
  const pids = path.join(root, 'pids.json')
  await fs.writeFile(script, source)
  const quote = (value: string) => `'${value.replace(/'/g, `'"'"'`)}'`
  await fs.writeFile(path.join(root, 'agy'), `#!/bin/sh\nexec ${quote(process.execPath)} ${quote(script)} "$@"\n`, { mode: 0o755 })
  const discovery = new AgentModelDiscovery()
  registries.push(discovery)
  return { discovery, root, pids, env: { ...process.env, PATH: `${root}:/usr/bin:/bin`, FIXTURE_MODEL_PIDS: pids } }
}

describe.skipIf(process.platform === 'win32')('model discovery owned process lifecycle', () => {
  it('uses a real private profile directory when the packaged application is an ASAR file', async () => {
    const { discovery, root, env, pids } = await fixture(`
      require('node:fs').writeFileSync(process.env.FIXTURE_MODEL_PIDS,JSON.stringify({pid:process.pid,cwd:process.cwd()}));
      require('node:readline').createInterface({input:process.stdin}).on('line',line=>{
        const m=JSON.parse(line);
        if(m.method==='initialize')console.log(JSON.stringify({id:m.id,result:{}}));
        else if(m.method==='model/list')console.log(JSON.stringify({id:m.id,result:{data:[{model:'catalog-fixture',displayName:'Fixture'}],nextCursor:null}}));
        else if(m.method!=='initialized')process.exit(2);
      });
    `)
    const applicationPath = path.join(root, 'app.asar')
    await fs.writeFile(applicationPath, 'A packaged archive is a file to the operating system')
    const userData = path.join(root, 'User Data')
    await fs.mkdir(userData, { mode: 0o700 })
    expect(await discovery.catalog({ agent: 'Codex', executable: path.join(root, 'agy'), env, cwd: applicationPath })).toMatchObject({ status: 'unavailable', models: [] })
    await expect(fs.readFile(pids, 'utf8')).rejects.toHaveProperty('code', 'ENOENT')
    const cwd = modelCatalogDirectory(userData)
    expect(cwd).toBe(path.join(await fs.realpath(userData), 'model-catalog'))
    expect((await fs.stat(cwd)).mode & 0o777).toBe(0o700)
    expect(await discovery.catalog({ agent: 'Codex', executable: path.join(root, 'agy'), env, cwd })).toMatchObject({ status: 'ready', models: [{ id: 'catalog-fixture', label: 'Fixture' }] })
    const observed = JSON.parse(await fs.readFile(pids, 'utf8')) as { pid: number; cwd: string }
    expect(observed.cwd).toBe(cwd)
    expect(alive(observed.pid)).toBe(false)
  })

  it('refuses a symlink or file in the private catalog directory instead of using another workspace', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ziaforge-catalog-path-'))
    directories.push(root)
    const other = path.join(root, 'other-workspace')
    const directory = path.join(root, 'model-catalog')
    await fs.mkdir(other)
    await fs.symlink(other, directory)
    expect(() => modelCatalogDirectory(root)).toThrow('Unsafe session storage directory')
    await fs.unlink(directory)
    await fs.writeFile(directory, 'not a directory')
    expect(() => modelCatalogDirectory(root)).toThrow('Unsafe session storage directory')
    expect(await fs.readdir(other)).toEqual([])
  })

  it('enumerates every Codex page including hidden models without starting a turn and closes the client', async () => {
    const { discovery, root, env, pids } = await fixture(`
      require('node:fs').writeFileSync(process.env.FIXTURE_MODEL_PIDS,JSON.stringify([process.pid]));
      require('node:readline').createInterface({input:process.stdin}).on('line',line=>{
        const m=JSON.parse(line); const respond=result=>console.log(JSON.stringify({id:m.id,result}));
        if(m.method==='initialize')respond({userAgent:'fixture'});
        else if(m.method==='initialized'){}
        else if(m.method==='model/list'&&m.params.includeHidden===true)respond(m.params.cursor?{data:[{model:'provider/future-model',displayName:'Future 🌍'}],nextCursor:null}:{data:[{model:'hidden-model',displayName:'Hidden',hidden:true}],nextCursor:'page2'});
        else process.exit(2);
      });
    `)
    const result = await discovery.catalog({ agent: 'Codex', executable: path.join(root, 'agy'), env, cwd: root })
    expect(result).toMatchObject({ status: 'ready', source: 'cli', command: 'codex app-server: model/list', models: [{ id: 'hidden-model', label: 'Hidden' }, { id: 'provider/future-model', label: 'Future 🌍' }] })
    expect(alive((JSON.parse(await fs.readFile(pids, 'utf8')) as number[])[0])).toBe(false)
  })

  it('uses the Claude initialize catalog rather than hard-coded aliases, without sending a user prompt', async () => {
    const { discovery, root, env, pids } = await fixture(`
      require('node:fs').writeFileSync(process.env.FIXTURE_MODEL_PIDS,JSON.stringify([process.pid]));
      require('node:readline').createInterface({input:process.stdin}).on('line',line=>{
        const m=JSON.parse(line);if(m.type!=='control_request'||m.request.subtype!=='initialize')process.exit(2);
        console.log(JSON.stringify({type:'control_response',response:{subtype:'success',request_id:m.request_id,response:{models:[{value:'custom-claude',displayName:'Account model'}]}}}));
      });
    `)
    const result = await discovery.catalog({ agent: 'Claude Code', executable: path.join(root, 'agy'), env, cwd: root })
    expect(result).toMatchObject({ status: 'ready', models: [{ id: 'custom-claude', label: 'Account model' }] })
    expect(alive((JSON.parse(await fs.readFile(pids, 'utf8')) as number[])[0])).toBe(false)
  })

  it('rejects a repeated cursor and never exposes protocol errors as a fabricated catalog or stderr', async () => {
    const { discovery, root, env } = await fixture(`
      require('node:readline').createInterface({input:process.stdin}).on('line',line=>{
        const m=JSON.parse(line); if(m.id)console.log(JSON.stringify({id:m.id,result:m.method==='initialize'?{}:{data:[{model:'x',displayName:'X'}],nextCursor:'same'}}));
      });
    `)
    expect(await discovery.catalog({ agent: 'Codex', executable: path.join(root, 'agy'), env, cwd: root })).toMatchObject({ status: 'unavailable', models: [], error: expect.stringContaining('invalid') })
  })
  it('normal completion drains output and leaves no registered process', async () => {
    const { discovery, root, env, pids } = await fixture(`require('node:fs').writeFileSync(process.env.FIXTURE_MODEL_PIDS, JSON.stringify([process.pid])); console.log('model-fixture\\tFixture');`)
    expect(await discovery.query(env, root)).toEqual(['model-fixture'])
    const [pid] = JSON.parse(await fs.readFile(pids, 'utf8')) as number[]
    expect(alive(pid)).toBe(false)
    await discovery.shutdown()
    await expect(discovery.query(env, root)).rejects.toThrow('shutting down')
  })

  it('shutdown awaits the owned catalog and child, rejects the pending query and blocks later launches', async () => {
    const { discovery, root, env, pids } = await fixture(`
      const {spawn}=require('node:child_process');
      const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});
      require('node:fs').writeFileSync(process.env.FIXTURE_MODEL_PIDS,JSON.stringify([process.pid,child.pid]));
      setInterval(()=>{},1000);
    `)
    const pending = discovery.query(env, root).then(value => ({ value }), error => ({ error }))
    await expect.poll(() => fs.readFile(pids, 'utf8').catch(() => ''), { timeout: 5000 }).not.toBe('')
    const owned = JSON.parse(await fs.readFile(pids, 'utf8')) as number[]
    expect(owned.every(alive)).toBe(true)
    await discovery.shutdown()
    expect(await pending).toHaveProperty('error')
    expect(owned.filter(alive)).toEqual([])
    await expect(discovery.query(env, root)).rejects.toThrow('shutting down')
  }, 10_000)
})
