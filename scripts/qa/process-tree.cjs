const { spawnSync } = require('node:child_process')

function processes() {
  // Read process identity, never command lines or environment containing secrets.
  // Terminal Ctrl+C belongs to the supervisor, not this bounded identity read.
  const result = spawnSync('/bin/ps', ['-axo', 'pid=,ppid=,stat=,lstart='], {
    encoding: 'utf8', timeout: 5000, detached: true, stdio: ['ignore', 'pipe', 'pipe'],
  })
  if (result.status !== 0) {
    const reason = result.error?.code || `exit=${result.status}, signal=${result.signal}`
    throw new Error(`Cannot inspect owned process identities for cleanup (${reason})`)
  }
  return new Map(result.stdout.trim().split('\n').flatMap(line => {
    const match = line.match(/^\s*(\d+)\s+(\d+)\s+(\S+)\s+(.+?)\s*$/)
    return match ? [[Number(match[1]), { pid: Number(match[1]), parent: Number(match[2]), state: match[3], started: match[4] }]] : []
  }))
}

function ownedProcesses(rootPid) {
  const owned = new Map()
  const rootBirth = processes().get(rootPid)?.started
  function observe() {
    const all = processes()
    const parents = new Set(all.get(rootPid)?.started === rootBirth && rootBirth ? [rootPid] : [])
    // Preserve previously observed descendants after their parent exits/reparents.
    for (const [pid, record] of owned) if (all.get(pid)?.started === record.started) parents.add(pid)
    let changed = true
    while (changed) {
      changed = false
      for (const [pid, record] of all) {
        if (parents.has(record.parent) && !parents.has(pid)) {
          parents.add(pid); owned.set(pid, record); changed = true
        }
      }
    }
  }
  async function cleanup() {
    observe()
    const terminated = []
    const signal = name => {
      const all = processes()
      for (const [pid, record] of owned) {
        if (all.get(pid)?.started !== record.started || pid === process.pid) continue
        try { process.kill(pid, name); terminated.push({ pid, signal: name }) }
        catch (error) { if (error.code !== 'ESRCH') throw error }
      }
    }
    signal('SIGTERM')
    await new Promise(resolve => setTimeout(resolve, 750))
    signal('SIGKILL')
    await new Promise(resolve => setTimeout(resolve, 250))
    const remaining = processes()
    const survivors = [...owned.values()].filter(record => {
      const current = remaining.get(record.pid)
      return current?.started === record.started && !current.state.startsWith('Z')
    }).map(record => ({ pid: record.pid, started: record.started }))
    return { signals: terminated, aliveCount: survivors.length, survivors, verified: survivors.length === 0 }
  }
  return { observe, cleanup }
}

module.exports = { ownedProcesses }
