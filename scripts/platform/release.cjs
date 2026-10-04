// Reserve once on the owner's machine; materialize immutable native job inputs.
// No build, test, tag, upload or publication is performed by this coordinator.
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { project, identity } = require('../qa/common.cjs')
const { parseVersion, reserveReleaseVersion, acquirePackagingLock } = require('../mac/build-version.cjs')
const sourceManifest = require('./source-manifest.cjs')
const targets = Object.freeze(['darwin-x64', 'darwin-arm64', 'win32-x64', 'win32-arm64', 'linux-x64', 'linux-arm64'])
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex')
const encoded = value => JSON.stringify(value, null, 2) + '\n'
function options(argv) {
  const [command, ...args] = argv, out = { command }
  for (let i = 0; i < args.length; i++) {
    if (!['--version', '--output', '--plan', '--target', '--attempt', '--reason'].includes(args[i]) || !args[i + 1] || args[i + 1].startsWith('--')) throw new Error(`Unknown or incomplete option: ${args[i]}`)
    const key = args[i].slice(2)
    if (key in out) throw new Error(`Duplicate option: ${key}`)
    out[key] = args[++i]
  }
  return out
}
function write(filename, value) {
  const fd = fs.openSync(filename, 'wx', 0o600)
  try { fs.writeFileSync(fd, encoded(value)); fs.fsyncSync(fd) } finally { fs.closeSync(fd) }
  if (process.platform !== 'win32') {
    const parent = fs.openSync(path.dirname(filename), 'r')
    try { fs.fsyncSync(parent) } finally { fs.closeSync(parent) }
  }
}
function validatePlan(plan, source) {
  parseVersion(plan.version)
  if (plan.schemaVersion !== 1 || plan.kind !== 'stable-release-family' || plan.mode !== 'release' || plan.distribution !== 'stable-release'
    || !/^[a-f0-9-]{36}$/.test(plan.releaseId) || !/^[a-f0-9-]{36}$/.test(plan.reservationId)
    || plan.source?.dirty !== false || plan.source?.commit !== source.commit || plan.sourcePortableSha256 !== source.digest
    || JSON.stringify(plan.targets) !== JSON.stringify(targets)) throw new Error('Release plan does not match this frozen source or the six-target contract')
  if (plan.revision && (!/^[a-f0-9]{40}-[a-f0-9-]{36}$/.test(plan.revision.id) || !Number.isSafeInteger(plan.revision.number) || plan.revision.number < 1
    || !/^[a-f0-9]{64}$/.test(plan.revision.previousPlanSha256) || !/^[a-f0-9]{40}$/.test(plan.revision.previousSourceCommit))) throw new Error('Invalid release revision chain metadata')
  if (JSON.parse(fs.readFileSync(path.join(project, 'package.json'))).version !== plan.version) throw new Error('Source package version differs from release plan')
  if (process.env.GITHUB_ACTIONS === 'true' && process.env.GITHUB_SHA !== plan.source.commit) throw new Error('Dispatch commit differs from reserved release source; dispatch the exact frozen main commit')
  return plan
}
function prepare(input) {
  if (!input.version || !input.output || input.plan || input.target || input.attempt || input.reason) throw new Error('prepare requires only --version and --output')
  parseVersion(input.version)
  const source = sourceManifest.snapshot(project), local = identity()
  if (JSON.parse(fs.readFileSync(path.join(project, 'package.json'))).version !== input.version) throw new Error('Commit package.json and lockfile at the requested release version first')
  const locked = JSON.parse(fs.readFileSync(path.join(project, 'package-lock.json')))
  if (locked.version !== input.version || locked.packages?.['']?.version !== input.version) throw new Error('Lockfile version differs from release version')
  const directory = path.resolve(input.output)
  // Allocate the output before the ledger. Neither failed outputs nor partially
  // written reservation directories may be reused by a later invocation.
  fs.mkdirSync(directory, { mode: 0o700 })
  const releaseLock = acquirePackagingLock(path.join(project, 'release', 'macos'))
  try {
    const reserved = reserveReleaseVersion(path.join(project, 'release', 'macos'), input.version, {
      releaseId: crypto.randomUUID(), source: local, sourcePortableSha256: source.digest, targets,
    })
    const { filename } = reserved
    // The local ledger can retain owner-machine provenance. The transferable
    // plan deliberately contains no filename, branch, cwd or personal paths.
    const plan = { schemaVersion: 1, kind: 'stable-release-family', version: reserved.version,
      releaseId: reserved.releaseId, reservationId: reserved.reservationId, createdAt: reserved.createdAt,
      source: { commit: source.commit, dirty: false }, sourcePortableSha256: source.digest, targets,
      mode: 'release', distribution: 'stable-release', signing: 'unsigned', notarization: false,
      verification: 'build-only: compile and package integrity; runtime, GUI and provider checks not requested' }
    write(path.join(path.dirname(filename), 'initial-plan.json'), plan)
    write(path.join(directory, 'release-plan.json'), plan)
    write(path.join(directory, 'source-manifest.json'), source)
    write(path.join(directory, 'reservation-receipt.json'), { reservation: filename, releaseId: plan.releaseId, version: plan.version, sourceCommit: source.commit })
    console.log(JSON.stringify({ directory, plan: path.join(directory, 'release-plan.json'), version: plan.version, releaseId: plan.releaseId, sourceCommit: source.commit }))
  } finally { releaseLock() }
}
function readLedgerJson(filename) {
  const stat = fs.lstatSync(filename)
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Expected an immutable regular ledger record')
  const bytes = fs.readFileSync(filename)
  return { value: JSON.parse(bytes), sha256: digest(bytes) }
}
function revise(input) {
  if (!input.plan || !input.output || !input.reason?.trim() || input.reason.length > 2000 || input.version || input.target || input.attempt) throw new Error('revise requires only --plan, --output and a nonempty --reason (up to 2000 characters)')
  if (process.env.GITHUB_ACTIONS === 'true') throw new Error('Candidate revisions are owner-ledger operations; hosted jobs cannot allocate them')
  const previous = readLedgerJson(path.resolve(input.plan)), old = previous.value
  parseVersion(old.version)
  // Validate the old plan structure against its old commit, then bind it to the
  // owner ledger below. The current checkout is intentionally a newer commit.
  validatePlan(old, { commit: old.source?.commit, digest: old.sourcePortableSha256 })
  const source = sourceManifest.snapshot(project)
  if (source.commit === old.source.commit) throw new Error('Same-source retries need a new attempt ID, not a release revision')
  const locked = JSON.parse(fs.readFileSync(path.join(project, 'package-lock.json')))
  if (locked.version !== old.version || locked.packages?.['']?.version !== old.version) throw new Error('Candidate revision must retain the same committed release version in both package and lockfile')
  const base = path.join(project, 'release', 'macos'), location = path.join(base, '.versions', old.version)
  const releaseLock = acquirePackagingLock(base)
  try {
    const ledgerStat = fs.lstatSync(path.join(base, '.versions'))
    if (!ledgerStat.isDirectory() || ledgerStat.isSymbolicLink()) throw new Error('Retained version ledger must be a real directory')
    const locationStat = fs.lstatSync(location)
    if (!locationStat.isDirectory() || locationStat.isSymbolicLink()) throw new Error('Retained release reservation must be a real directory')
    const reservation = readLedgerJson(path.join(location, 'reservation.json')).value
    if (reservation.kind !== 'stable-release-family' || reservation.version !== old.version || reservation.releaseId !== old.releaseId || reservation.reservationId !== old.reservationId) throw new Error('Plan does not belong to this retained owner reservation')
    if (fs.existsSync(path.join(location, 'published.json'))) throw new Error('Published versions cannot receive candidate revisions; reserve a new version')
    const initial = readLedgerJson(path.join(location, 'initial-plan.json'))
    if (initial.value.source?.commit !== reservation.source?.commit || initial.value.sourcePortableSha256 !== reservation.sourcePortableSha256
      || initial.value.releaseId !== reservation.releaseId || initial.value.reservationId !== reservation.reservationId) throw new Error('Initial plan does not match immutable base reservation')
    const revisions = path.join(location, 'revisions')
    fs.mkdirSync(revisions, { recursive: true, mode: 0o700 })
    const revisionsStat = fs.lstatSync(revisions)
    if (!revisionsStat.isDirectory() || revisionsStat.isSymbolicLink()) throw new Error('Revision ledger must be a real directory')
    const records = fs.readdirSync(revisions).map(name => {
      if (!/^[a-f0-9]{40}-[a-f0-9-]{36}\.json$/.test(name)) throw new Error('Unexpected revision ledger entry; inspect without deleting it')
      const record = readLedgerJson(path.join(revisions, name)).value
      if (name !== record.id + '.json') throw new Error('Revision filename differs from its immutable identity')
      return record
    }).sort((a, b) => a.number - b.number)
    let latest = { value: initial.value, sha256: initial.sha256 }
    for (const [index, record] of records.entries()) {
      if (record.number !== index + 1 || record.releaseId !== old.releaseId || record.reservationId !== old.reservationId || record.version !== old.version
        || record.previousPlanSha256 !== latest.sha256 || record.previousSourceCommit !== latest.value.source.commit
        || record.newPlanSha256 !== digest(encoded(record.plan)) || record.newSourceCommit !== record.plan?.source?.commit
        || record.sourcePortableSha256 !== record.plan.sourcePortableSha256 || record.id !== record.plan.revision?.id
        || record.number !== record.plan.revision?.number || record.plan.releaseId !== old.releaseId || record.plan.reservationId !== old.reservationId
        || record.plan.revision.previousPlanSha256 !== record.previousPlanSha256 || record.plan.revision.previousSourceCommit !== record.previousSourceCommit) throw new Error('Revision chain is incomplete or changed; refusing another append')
      latest = { value: record.plan, sha256: record.newPlanSha256 }
    }
    if (previous.sha256 !== latest.sha256) throw new Error('Revise the exact latest retained release plan; branching from an older candidate is forbidden')
    const directory = path.resolve(input.output)
    fs.mkdirSync(directory, { mode: 0o700 })
    const id = `${source.commit}-${crypto.randomUUID()}`, number = records.length + 1
    const revision = { id, number, previousPlanSha256: previous.sha256, previousSourceCommit: old.source.commit }
    const plan = { ...old, createdAt: new Date().toISOString(), source: { commit: source.commit, dirty: false }, sourcePortableSha256: source.digest, revision }
    const record = { schemaVersion: 1, kind: 'stable-release-candidate-revision', id, number, version: old.version, releaseId: old.releaseId, reservationId: old.reservationId,
      createdAt: plan.createdAt, previousPlanSha256: previous.sha256, previousSourceCommit: old.source.commit,
      newSourceCommit: source.commit, sourcePortableSha256: source.digest, reason: input.reason.trim(), newPlanSha256: digest(encoded(plan)), plan }
    const filename = path.join(revisions, id + '.json')
    // Commit the complete new plan to the append-only ledger first. A crash
    // before output retention is recoverable from this exact stored plan.
    write(filename, record)
    write(path.join(directory, 'release-plan.json'), plan)
    write(path.join(directory, 'source-manifest.json'), source)
    write(path.join(directory, 'revision-receipt.json'), { revision: filename, revisionId: id, previousPlanSha256: previous.sha256, newPlanSha256: record.newPlanSha256, sourceCommit: source.commit })
    console.log(JSON.stringify({ directory, plan: path.join(directory, 'release-plan.json'), version: plan.version, releaseId: plan.releaseId, revisionId: id, sourceCommit: source.commit }))
  } finally { releaseLock() }
}
function materialize(input) {
  if (!input.plan || !input.output || !targets.includes(input.target) || !input.attempt || input.version || input.reason) throw new Error('materialize requires --plan, --target, --attempt and --output')
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/.test(input.attempt)) throw new Error('Unsafe attempt identity')
  const source = sourceManifest.snapshot(project), plan = validatePlan(JSON.parse(fs.readFileSync(path.resolve(input.plan), 'utf8')), source)
  const [platform, arch] = input.target.split('-'), directory = path.resolve(input.output)
  fs.mkdirSync(directory, { mode: 0o700 })
  const build = { schemaVersion: 1, version: plan.version, mode: 'release', distribution: 'stable-release',
    releaseId: plan.releaseId, reservationId: plan.reservationId, revision: plan.revision, attemptId: input.attempt,
    buildId: `${plan.version}.release.${plan.releaseId}.r${plan.revision?.number || 0}.${input.target}.${input.attempt}`,
    createdAt: new Date().toISOString(), platform, arch,
    source: { commit: source.commit, dirty: false, workingTreeSha256: source.digest, description: 'Portable committed path/mode/content digest; independent of owner-machine paths and filesystem modes.' },
    sourcePortableSha256: source.digest,
    signing: 'unsigned', notarization: false,
    workflow: process.env.GITHUB_ACTIONS === 'true' ? { repository: process.env.GITHUB_REPOSITORY, runId: process.env.GITHUB_RUN_ID, runAttempt: process.env.GITHUB_RUN_ATTEMPT, sha: process.env.GITHUB_SHA } : undefined,
  }
  write(path.join(directory, 'build-identity.json'), build)
  write(path.join(directory, 'release-plan.json'), plan)
  write(path.join(directory, 'source-manifest.json'), source)
  console.log(JSON.stringify({ directory, identity: path.join(directory, 'build-identity.json'), version: build.version, buildId: build.buildId }))
}
function main(argv) {
  if (!argv.length || argv.includes('--help')) {
    console.log('Usage:\n  node scripts/platform/release.cjs prepare --version 1.0.1 --output NEW_DIRECTORY\n  node scripts/platform/release.cjs revise --plan PREVIOUS_PLAN.json --output NEW_DIRECTORY --reason "Unpublished candidate correction"\n  node scripts/platform/release.cjs materialize --plan RELEASE_PLAN.json --target darwin-x64|darwin-arm64|win32-x64|win32-arm64|linux-x64|linux-arm64 --attempt UNIQUE_ID --output NEW_DIRECTORY\nprepare permanently reserves one stable version in release/macos/.versions. revise appends an unpublished candidate revision in that same owner ledger; base reservation and old plans remain immutable. materialize does not mutate the ledger. All require clean committed source. No build, test, signing or publication.')
    return
  }
  const input = options(argv)
  if (input.command === 'prepare') prepare(input)
  else if (input.command === 'revise') revise(input)
  else if (input.command === 'materialize') materialize(input)
  else throw new Error('Expected prepare, revise or materialize')
}
if (require.main === module) try { main(process.argv.slice(2)) } catch (error) { console.error(error.stack); process.exitCode = 1 }
module.exports = { targets, options, validatePlan }
