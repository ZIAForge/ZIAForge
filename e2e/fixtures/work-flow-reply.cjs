// Deterministic Work protocol data only. No network, authentication or inference.
// Real artifact publication/checks remain production engine responsibilities.
const fs = require('node:fs')
const path = require('node:path')
const { createHash } = require('node:crypto')

module.exports = async function workFlowReply(text, { record, barrier, threadId }) {
  const header = text.match(/^ZIAForge Work ([a-z-]+); phase ([a-z-]+); round (\d+); source ([^\n.]+)\./)
  if (!header || !text.includes('User request (data):\nWork flow fixture ')) return undefined
  const [, kind, phase, rawRound, source] = header
  const marker = text.match(/User request \(data\):\nWork flow fixture ([a-z-]+)/)?.[1]
  const round = Number(rawRound)
  const repair = text.includes('Repair the missing/invalid result once in this same context.')
  const reportName = text.match(/This invocation must return a nonempty artifact named exactly ([^,]+),/)?.[1]
  record({ event: 'work-flow-phase', provider: kind, stage: phase, cycle: round, text: source, threadId, cwd: process.cwd(), outcome: repair ? 'repair' : 'initial' })
  if (phase === 'intake') await barrier('work-flow-start')
  const result = patch => '```ziaforge-work\n' + JSON.stringify({ status: 'complete', summary: 'Fixture Work result.', questions: [], artifacts: [], sources: [], steps: [], ...patch }) + '\n```'
  const document = (name, content) => ({ name, content })
  const decisions = JSON.parse(text.match(/User decisions and follow-up request:\n([^\n]+)\n/)?.[1] ?? '[]')
  const hasAnswer = decisions.some(item => item.action === 'answer')
  const artifact = name => {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const matches = [...text.matchAll(new RegExp(`Artifact ${escaped}, version (\\d+), SHA256 ([a-f0-9]{64}), bytes (\\d+)\\nFile: ([^\\n]+)`, 'g'))]
    const reference = matches.sort((a, b) => Number(b[1]) - Number(a[1]))[0]
    if (!reference) throw new Error(`Work fixture lacks verified artifact ${name}`)
    const profile = fs.realpathSync(path.dirname(process.env.ZIAFORGE_E2E_CODEX_CONTROLS))
    const filename = fs.realpathSync(reference[4])
    if (!filename.startsWith(profile + path.sep) || fs.lstatSync(reference[4]).isSymbolicLink()) throw new Error('Work fixture artifact escapes its isolated profile')
    const bytes = fs.readFileSync(filename)
    if (bytes.length !== Number(reference[3]) || createHash('sha256').update(bytes).digest('hex') !== reference[2]) throw new Error('Work fixture artifact bytes do not match the receipt')
    return bytes.toString('utf8')
  }
  if (phase === 'review') {
    const names = [...text.matchAll(/Artifact ([^,\n]+), version /g)].map(match => match[1])
    for (const name of new Set(names)) artifact(name)
    record({ event: 'work-flow-review', provider: kind, cwd: process.cwd(), threadId, outcome: 'approved' })
    return result({ summary: 'Read the actual retained artifacts and approved this fixture result.', review: { outcome: 'approved', findings: [] } })
  }
  if (marker === 'auto-trivial') return result({ summary: 'A direct answer: three concise options, without a manufactured plan.', complexity: 'trivial' })
  if (marker === 'auto-medium') {
    if (phase === 'intake' || phase === 'planning') return result({ status: 'plan', summary: 'Create a two-part note and independently check each file.', complexity: 'medium', artifacts: [document('approach.md', '# Approach\nTwo independently checked deliverables.\n')], steps: ['notes', 'handoff'].map(name => ({ title: `Create ${name}`, instructions: `Return ${name}.md containing WORK_FIXTURE_${name.toUpperCase()} exactly once.`, acceptance: ['Nonempty real Markdown file', 'Exact required evidence marker'], verification: [{ executable: process.execPath, args: ['-e', `const fs=require('node:fs');const s=fs.readFileSync('${name}.md','utf8');if(s.split('WORK_FIXTURE_${name.toUpperCase()}').length!==2)process.exit(1);console.log('WORK_CHECK_${name.toUpperCase()}_OK')`], timeoutMs: 5000 }] })) })
    if (phase !== 'execution') throw new Error(`Unexpected medium Work phase ${phase}`)
    const name = text.includes('Execute ONLY this user-approved step: {"title":"Create handoff"') || /Execute ONLY this user-approved step: .*"title":"Create handoff"/.test(text) ? 'handoff' : 'notes'
    return result({ summary: `Delivered ${name} for an actual production verification command.`, artifacts: [document(`${name}.md`, `# ${name}\nWORK_FIXTURE_${name.toUpperCase()}\n`)] })
  }
  if (marker === 'brainstorm') {
    const evaluating = phase === 'convergence'
    const more = phase === 'divergence'
    if (more || evaluating) artifact('ideas.md')
    return result({ summary: evaluating ? 'Selected a balanced approach after the explicit evaluate decision.' : more ? 'Added another distinct family of ideas.' : 'Generated breadth; choose more ideas or evaluate them.', artifacts: [document('ideas.md', `# Ideas\n${evaluating ? 'Selected: small pilot, visible evaluation, reversible rollout.' : Array.from({ length: more ? 15 : 10 }, (_, i) => `- Idea ${i + 1}: ${more ? 'alternate' : 'initial'} strategy`).join('\n')}\n`)] })
  }
  if (marker === 'research') {
    if (!hasAnswer) return result({ status: 'needs_input', summary: 'Choose the audience before comparing the supplied material.', questions: [{ id: 'audience', question: 'Who will use the research?', options: ['Independent creators', 'Large teams'] }] })
    const inputs = JSON.parse(text.match(/Explicit input manifest \(relative paths are under the assigned cwd\):\n([^\n]+)\n/)?.[1] ?? '[]')
    if (!inputs.length || !inputs.every(input => typeof input.relativePath === 'string')) throw new Error('Research fixture requires registered copied inputs')
    for (const input of inputs) {
      const filename = fs.realpathSync(path.join(process.cwd(), input.relativePath))
      if (!filename.startsWith(fs.realpathSync(process.cwd()) + path.sep)) throw new Error('Input outside Work folder')
      const bytes = fs.readFileSync(filename)
      if (createHash('sha256').update(bytes).digest('hex') !== input.sha256) throw new Error('Copied research input differs')
    }
    return result({ summary: 'Compared only the supplied source; no browsing or live verification is claimed.', artifacts: [document('findings.md', '# Findings\n\nThe [provided source](https://example.invalid/fixture-source) favors small pilots. This deterministic fixture did not browse.\n\nAudience: Independent creators.\n')], sources: [{ id: 'provided-one', url: 'https://example.invalid/fixture-source', title: 'Provided fixture source', accessedAt: '2026-09-26T00:00:00.000Z', kind: 'primary', provenance: 'provided' }] })
  }
  if (marker === 'write') {
    if (phase === 'intake' || phase === 'outline') return result({ status: 'continue', nextPhase: 'draft', summary: 'A three-part outline is ready before writing.', artifacts: [document('outline.md', '# Outline\n1. Audience\n2. Main message\n3. Call to action\n')] })
    if (phase === 'draft') { artifact('outline.md'); return result({ summary: 'A complete first draft is ready for your decision.', artifacts: [document('draft.md', '# Useful message\nThe original introduction is longer than necessary.\nMain message and a concrete call to action.\n')] }) }
    if (phase === 'revision') { artifact('draft.md'); if (!decisions.some(item => item.text?.includes('Shorten'))) throw new Error('Revision lost the explicit user feedback'); return result({ summary: 'Shortened the introduction while preserving the agreed message.', artifacts: [document('draft.md', '# Useful message\nShort introduction.\nMain message and a concrete call to action.\n')] }) }
  }
  if (marker === 'deep-brainstorm') {
    if (phase === 'intake') return result({ summary: 'Use the three explicitly selected independent worker contexts.' })
    if (phase === 'worker') {
      if (source === 'worker-1' && !hasAnswer) return result({ status: 'needs_input', summary: 'One worker needs an audience constraint.', questions: [{ id: 'audience', question: 'Who should benefit from the ideas?', options: ['Independent creators', 'Large teams'] }] })
      if (source === 'worker-3' || source === 'worker-2' && !repair) return result({ summary: 'Intentionally incomplete report for bounded repair coverage.' })
      if (!reportName) throw new Error('Worker required report name is missing')
      return result({ summary: `Independent analysis from ${source}.`, artifacts: [document(reportName, `# ${source}\nRecommendation: start a small pilot.\nTradeoff: limited reach versus fast feedback.\nEvidence: the supplied question and acknowledged audience; no web access claimed.\nDistinctive idea: reversible rotating ownership.\n`)] })
    }
    if (phase === 'synthesis') {
      artifact('brainstormer_1_report.md'); artifact('brainstormer_2_report.md')
      if (!text.includes('"status":"failed"')) throw new Error('Synthesis was not told about the failed worker')
      return result({ summary: 'A partial synthesis from two valid workers; the third did not produce a valid report.', artifacts: [document('brainstorm_report.md', '# Synthesis\nTwo valid reports support a small reversible pilot. Worker 3 failed report validation, so no agreement is attributed to it.\n')] })
    }
    if (phase === 'follow-up' || phase === 'revision') { artifact('brainstorm_report.md'); return result({ summary: 'Added the requested brief clarification without repeating the worker round.', followUpSize: 'small', artifacts: [document('brainstorm_report.md', '# Synthesis\nTwo valid reports support a small reversible pilot. Worker 3 failed report validation.\nClarification: begin with one week and a reversible owner rotation.\n')] }) }
  }
  throw new Error(`Unhandled Work fixture ${marker}/${phase}`)
}
