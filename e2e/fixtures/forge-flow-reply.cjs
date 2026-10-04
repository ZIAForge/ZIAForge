// Opt-in full dialogue fixture. Runs inside codex.cjs's isolated E2E guard;
// it neither authenticates with nor invokes a real provider.
const fs = require('node:fs')
const path = require('node:path')
const { createHash } = require('node:crypto')

const marker = 'Forge Full SDD fixture'
const audience = 'Audience: local developers'
const contract = 'Contract: ASCII letters, digits, and underscores; reject a leading digit'
const amendment = 'Manual copy fallback must work without clipboard permission.'
const stack = 'Choose HTML and vanilla JavaScript; support Safari and Chrome; use a manual copy fallback.'
const phaseOutput = result => '```ziaforge-phase\n' + JSON.stringify({ questions: [], artifacts: [], steps: [], ...result }) + '\n```'

module.exports = async function forgeFlowReply(text, { record, barrier, codeArtifact }) {
  if (!text.includes(marker)) return undefined
  const source = path.join(process.cwd(), 'identifier.cjs')
  const sourceSha256 = () => createHash('sha256').update(fs.readFileSync(source)).digest('hex')
  const event = (stage, extra = {}) => record({ event: 'forge-fixture', stage, cwd: process.cwd(), sourceSha256: sourceSha256(), ...extra })
  if (text.startsWith('You are carrying out one preparation phase of a ZIAForge Code task.')) {
    await barrier('code-flow-preparation')
    const phase = text.match(/\nPhase: ([a-z-]+)\n/)?.[1]
    const encoded = text.match(/Complete saved stage conversation[^\n]*\n([^\n]+)/)?.[1]
    if (!encoded) throw new Error('Forge fixture received no retained conversation')
    const conversation = JSON.parse(encoded)
    const users = conversation.filter(entry => entry.role === 'user').map(entry => entry.text)
    const has = decision => users.some(value => value.includes(decision))
    const artifact = (name, content) => ({ name, content: `# Forge fixture ${name}\n\n${content}\n` })
    if (phase === 'requirements') {
      if (!has(audience)) {
        event('requirements-audience')
        return phaseOutput({ status: 'needs_input', summary: 'First decide who uses this offline identifier utility.', questions: [{ id: 'forge-audience', question: 'Who will use the offline identifier utility?', options: ['Local developers', 'Public visitors'] }], artifacts: [artifact('requirements.md', 'Incomplete draft: audience and identifier rules are unresolved.')] })
      }
      if (!conversation.some(entry => entry.questions?.some(question => question.id === 'forge-audience' && question.options?.includes('Local developers')))) throw new Error('Earlier exact question/options were dropped from Forge context')
      if (!has(contract)) {
        event('requirements-contract')
        return phaseOutput({ status: 'needs_input', summary: 'The audience is settled; define valid identifier input next.', questions: [{ id: 'forge-contract', question: 'Which characters and leading characters are valid?', options: ['ASCII letters, digits, underscores; no leading digit', 'Letters only'] }], artifacts: [artifact('requirements.md', `${audience}\nIncomplete draft: identifier rules remain unresolved.`)] })
      }
      const revised = /Artifact requirements\.md, version/.test(text) && codeArtifact(text, 'requirements.md').includes(amendment)
      event(revised ? 'requirements-amended' : 'requirements-ready')
      return phaseOutput({ status: 'ready', summary: revised ? 'The amended PRD retains the audience and rules and requires a manual copy fallback.' : 'The PRD defines the audience and identifier rules; interface/stack remain a separate decision.', artifacts: [artifact('requirements.md', `${audience}\n${contract}\n${revised ? amendment : 'Technical interface is undecided; discuss it before choosing a stack.'}`)] })
    }
    if (phase === 'specification') {
      const requirements = codeArtifact(text, 'requirements.md')
      if (!requirements.includes(audience) || !requirements.includes(contract)) throw new Error('Specification lost the accepted product decisions')
      if (!has(stack)) {
        const explaining = users.at(-1)?.includes('Explain HTML versus CLI before I choose')
        event(explaining ? 'specification-counterquestion' : 'specification-question')
        return phaseOutput({ status: 'needs_input', summary: explaining ? 'HTML provides a visible browser UI; CLI fits terminal automation. No stack has been chosen by this counterquestion, and no specification is ready.' : 'Choose the interface and runtime before the technical specification.', questions: [{ id: 'forge-stack', question: 'Should this use HTML and vanilla JavaScript or a CLI?', options: ['HTML and vanilla JavaScript', 'Node CLI'] }] })
      }
      if (!requirements.includes(amendment)) throw new Error('Specification received the superseded PRD instead of its accepted amendment')
      event('specification-ready')
      return phaseOutput({ status: 'ready', summary: 'The specification follows the explicit HTML/vanilla-JS/browser decision and amended PRD.', artifacts: [artifact('spec.md', `${stack}\n${amendment}\nUse identifier.cjs for the reusable predicate and index.html for the browser UI. Keep handoff.md with manual-copy instructions. Verify the existing immutable Node checks.`)] })
    }
    if (phase === 'planning') {
      if (!codeArtifact(text, 'requirements.md').includes(amendment) || !codeArtifact(text, 'spec.md').includes(stack)) throw new Error('Planning did not receive the current accepted foundations')
      event('planning-ready')
      return phaseOutput({ status: 'ready', summary: 'The implementation proposal uses the accepted PRD/spec and actual immutable check.', artifacts: [artifact('planning.md', 'Implement identifier.cjs and index.html from the accepted spec. Keep the manual copy fallback and preserve all immutable checks.')], steps: [{ title: 'Implement the agreed browser identifier', instructions: 'FORGE_BROWSER_STEP: Implement identifier.cjs and index.html with the agreed manual copy fallback. Preserve the immutable checks.', acceptance: ['Identifier rules match the accepted PRD', amendment], verification: [{ executable: process.execPath, args: ['check-identifier.cjs'], timeoutMs: 15000 }] }] })
    }
    if (phase === 'delivery') {
      if (!text.includes('Actual completed implementation receipts:') || !fs.readFileSync(path.join(process.cwd(), 'handoff.md'), 'utf8').includes(amendment)) throw new Error('Delivery lacks actual human-added scope and verification evidence')
      event('delivery-ready')
      return phaseOutput({ status: 'ready', summary: 'Both human-ordered implementation steps have actual checks and independent reviews. The browser utility and manual-copy handoff are delivered.', artifacts: [artifact('report.md', `Implemented identifier.cjs, index.html, and handoff.md.\n${stack}\n${amendment}\nThe host provided successful actual verification receipts and independent review results.`)] })
    }
    throw new Error(`Unexpected Forge fixture phase: ${phase}`)
  }
  if (text.startsWith('Execute this approved ZIAForge Code implementation')) {
    if (!text.includes(stack) || !text.includes(amendment)) throw new Error('Implementation lacks current agreed specification and requirement')
    // Classify the current approved instructions, not the complete retained
    // plan: the latter deliberately contains both human-edited steps.
    const instructions = text.split('\nInstructions: ')[1]?.split('\nAcceptance criteria:')[0]
    if (instructions?.includes('FORGE_HANDOFF_STEP:')) {
      fs.writeFileSync(path.join(process.cwd(), 'handoff.md'), `# Manual copy\n${amendment}\nSelect the visible result and copy it manually when clipboard access is unavailable.\n`)
      event('implementation-handoff')
      return 'Created handoff.md for the explicitly added manual-copy documentation step. The host owns its check and review.'
    }
    if (!instructions?.includes('FORGE_BROWSER_STEP:')) throw new Error('Unexpected human-edited implementation scope')
    fs.writeFileSync(source, "'use strict'\nmodule.exports = value => typeof value === 'string' && /^[A-Za-z_][A-Za-z0-9_]*$/.test(value)\n")
    fs.writeFileSync(path.join(process.cwd(), 'index.html'), '<!doctype html>\n<html lang="en"><meta charset="utf-8"><title>Identifier utility</title><label>Identifier <input id="identifier"></label><button id="validate">Validate</button><output id="result"></output><label>Manual copy fallback <input id="manual-copy" readonly></label><script>document.querySelector("#validate").onclick=()=>{const valid=/^[A-Za-z_][A-Za-z0-9_]*$/.test(document.querySelector("#identifier").value);document.querySelector("#result").textContent=valid?"Valid":"Invalid";document.querySelector("#manual-copy").value=valid?"Valid":"Invalid"}</script></html>\n')
    event('implementation-browser')
    return 'Implemented identifier.cjs and index.html, retaining the selected browser stack and manual-copy fallback. The host must verify the actual files.'
  }
  if (text.startsWith('Independently review only this plan step')) {
    const handoff = text.match(/\nStep: ([^\n]+)\n/)?.[1] === 'Document manual fallback'
    if (handoff) {
      if (!fs.readFileSync(path.join(process.cwd(), 'handoff.md'), 'utf8').includes(amendment)) throw new Error('Reviewer found missing handoff bytes')
    } else if (!fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8').includes('id="manual-copy"')) throw new Error('Reviewer found missing browser fallback')
    event(handoff ? 'review-handoff' : 'review-browser')
    return JSON.stringify({ outcome: 'approved', summary: 'The actual files satisfy this human-accepted step and preserve the agreed manual fallback.', findings: [] })
  }
  throw new Error('Unhandled Forge fixture request; do not silently fall back to an ordinary chat response')
}
