import fs from 'node:fs'
import path from 'node:path'
import { randomUUID, createHash } from 'node:crypto'
import { execFile, execFileSync, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { ensurePrivateDirectory } from '../runtime/privateStorage'
import { fileSha256 } from './UpdateDownload'
import { validateMacUpdateZip } from './UpdateArchive'
import type { UpdateCandidate } from './UpdateRelease'

const execute = promisify(execFile)
export type UpdateInstallKind = 'mac-zip' | 'nsis' | 'appimage' | 'deb' | 'rpm' | 'manual' | 'signed'
export interface UpdateEnvironment {
  platform: NodeJS.Platform; arch: string; isPackaged: boolean; version: string
  executable: string; resources: string; appImage?: string
}
export interface UpdateInstallTarget {
  kind: UpdateInstallKind; extension: string; canInstall: boolean; messageCode?: string
  destination?: string; identityPath?: string; identitySha256?: string; device?: number; inode?: number
  manager?: string; executable?: string
}
export interface PreparedUpdate {
  directory: string; helper: string; target: UpdateInstallTarget; candidate: UpdateCandidate
  source: string; backup?: string; parentPid: number; parentStart: string; receipt: string
  verificationPath: string; verificationHash: string
}

function writable(filename: string) { try { fs.accessSync(filename, fs.constants.W_OK); return true } catch { return false } }
function exists(filename: string) { try { return fs.statSync(filename).isFile() } catch { return false } }
function absoluteFile(filename: string) {
  if (!path.isAbsolute(filename) || filename.includes('\0')) throw new Error('Invalid application installation path')
  const stat = fs.lstatSync(filename)
  if (stat.isSymbolicLink() || !stat.isFile() || fs.realpathSync(filename) !== path.resolve(filename)) throw new Error('Application installation path is not canonical')
  return stat
}
function installedIdentity(env: UpdateEnvironment): { identityPath: string; identitySha256: string } {
  const identityPath = path.join(env.resources, 'build-identity.json')
  absoluteFile(identityPath)
  const bytes = fs.readFileSync(identityPath)
  if (bytes.length > 128 * 1024) throw new Error('Invalid installed build identity')
  const identity = JSON.parse(bytes.toString('utf8')) as Record<string, unknown>
  if (identity.version !== env.version || identity.platform !== env.platform || identity.arch !== env.arch || identity.mode !== 'release') throw new Error('Installed build identity does not match the running release')
  return { identityPath, identitySha256: createHash('sha256').update(bytes).digest('hex') }
}

/** Detect the actual running installation, never a renderer-provided path. */
export function detectUpdateTarget(env: UpdateEnvironment): UpdateInstallTarget {
  const fallback: UpdateInstallTarget = { kind: 'manual', extension: env.platform === 'darwin' ? 'dmg' : env.platform === 'win32' ? 'exe' : 'AppImage', canInstall: false, messageCode: 'updates.manualInstall' }
  if (!env.isPackaged) return { ...fallback, messageCode: 'updates.notPackaged' }
  if (!['darwin', 'win32', 'linux'].includes(env.platform) || !['x64', 'arm64'].includes(env.arch)) return { ...fallback, messageCode: 'updates.unsupportedTarget' }
  try {
    const identity = installedIdentity(env)
    absoluteFile(env.executable)
    if (env.platform === 'darwin') {
      const destination = path.resolve(path.dirname(env.executable), '../..')
      if (!destination.endsWith('.app') || env.executable !== path.join(destination, 'Contents/MacOS/ZIAForge') || env.resources !== path.join(destination, 'Contents/Resources') || destination.startsWith('/Volumes/') || destination.includes('/AppTranslocation/') || fs.realpathSync(destination) !== destination || fs.lstatSync(destination).isSymbolicLink() || !writable(destination) || !writable(path.dirname(destination))) return fallback
      const stat = fs.statSync(destination)
      return { ...identity, kind: 'mac-zip', extension: 'zip', canInstall: true, destination, device: stat.dev, inode: stat.ino }
    }
    if (env.platform === 'win32') {
      const destination = path.dirname(env.executable)
      // A portable ZIP is not silently converted into a registered installation.
      if (env.resources !== path.join(destination, 'resources') || !exists(path.join(destination, 'Uninstall ZIAForge.exe')) || /[<>"|]/.test(destination)) return fallback
      return { ...identity, kind: 'nsis', extension: 'exe', canInstall: true, destination }
    }
    if (env.appImage) {
      const destination = fs.realpathSync(env.appImage), stat = absoluteFile(env.appImage)
      if (!writable(destination) || !writable(path.dirname(destination))) return fallback
      return { ...identity, kind: 'appimage', extension: 'AppImage', canInstall: true, destination, device: stat.dev, inode: stat.ino }
    }
    // Package ownership, not the distribution name, determines the format.
    if (!exists('/usr/bin/pkexec')) return fallback
    const executable = fs.realpathSync(env.executable)
    if (exists('/usr/bin/dpkg-query') && exists('/usr/bin/apt-get')) {
      try {
        const owner = execFileSync('/usr/bin/dpkg-query', ['-S', executable], { encoding: 'utf8', timeout: 5000, maxBuffer: 65536 }).trim()
        if (/^ziaforge(?::(?:amd64|arm64))?: /.test(owner)) return { ...identity, kind: 'deb', extension: 'deb', canInstall: true, manager: '/usr/bin/apt-get', executable }
      } catch { /* Not owned by dpkg. */ }
    }
    if (exists('/usr/bin/rpm')) {
      try {
        const owner = execFileSync('/usr/bin/rpm', ['-qf', '--queryformat', '%{NAME}', executable], { encoding: 'utf8', timeout: 5000, maxBuffer: 65536 }).trim()
        const manager = ['/usr/bin/dnf', '/usr/bin/zypper', '/usr/bin/yum'].find(exists)
        if (owner === 'ziaforge' && manager) return { ...identity, kind: 'rpm', extension: 'rpm', canInstall: true, manager, executable }
      } catch { /* Not owned by rpm. */ }
    }
  } catch { return fallback }
  return fallback
}

function assertTargetUnchanged(target: UpdateInstallTarget) {
  if (!target.canInstall || !target.identityPath || !target.identitySha256) throw new Error('This installation requires a manual update')
  absoluteFile(target.identityPath)
  if (createHash('sha256').update(fs.readFileSync(target.identityPath)).digest('hex') !== target.identitySha256) throw new Error('The running installation changed during update preparation')
  if (target.destination) {
    const stat = fs.lstatSync(target.destination)
    if (stat.isSymbolicLink() || fs.realpathSync(target.destination) !== target.destination || target.device !== undefined && (stat.dev !== target.device || stat.ino !== target.inode)) throw new Error('The update installation target changed')
  }
}
function unixParentStart() { return execFileSync('/bin/ps', ['-p', String(process.pid), '-o', 'lstart='], { encoding: 'utf8', timeout: 5000 }).trim() }

// Static helpers receive backend-owned paths as arguments; no shell expression,
// downloaded command, PATH executable, profile or renderer value is evaluated.
const UNIX_HELPER = String.raw`#!/bin/sh
set -eu
parent="$1"; parent_start="$2"; kind="$3"; source="$4"; destination="$5"; backup="$6"; receipt="$7"; ready="$8"; expected="$9"
shift 9
identity="$1"; identity_hash="$2"; manager="$3"; executable="$4"; relaunch="$5"; source_hash="$6"
record() { printf '{"status":"%s"}\n' "$1" > "$receipt"; }
fail() { record failed; exit 1; }
finished=no
trap '[ "$finished" = yes ] || record failed' EXIT
trap 'exit 1' HUP INT TERM
printf ready > "$ready"
count=0
while /bin/kill -0 "$parent" 2>/dev/null; do
  current=$(/bin/ps -p "$parent" -o lstart= 2>/dev/null | /usr/bin/sed 's/^ *//;s/ *$//')
  [ "$current" = "$parent_start" ] || break
  count=$((count + 1)); [ "$count" -lt 6000 ] || fail
  /bin/sleep 0.1
done
[ ! -L "$identity" ] || fail
if [ "$kind" = mac-zip ]; then hash=$(/usr/bin/shasum -a 256 "$identity"); else hash=$(/usr/bin/sha256sum "$identity"); fi
hash=$(printf '%s' "$hash" | /usr/bin/cut -d ' ' -f 1)
[ "$hash" = "$identity_hash" ] || fail
record applying
case "$kind" in
  mac-zip|appimage)
    [ ! -L "$destination" ] && [ ! -e "$backup" ] || fail
    if [ "$kind" = mac-zip ]; then actual=$(/usr/bin/stat -f '%d:%i' "$destination"); else actual=$(/usr/bin/stat -c '%d:%i' "$destination"); fi
    [ "$actual" = "$expected" ] || fail
    if [ "$kind" = appimage ]; then staged_hash=$(/usr/bin/sha256sum "$source"); staged_hash=$(printf '%s' "$staged_hash" | /usr/bin/cut -d ' ' -f 1); [ "$staged_hash" = "$source_hash" ] || fail; fi
    /bin/mv "$destination" "$backup" || fail
    if ! /bin/mv "$source" "$destination"; then /bin/mv "$backup" "$destination"; fail; fi
    if [ "$relaunch" = yes ]; then
      if [ "$kind" = mac-zip ]; then
        if ! /usr/bin/open -n "$destination"; then /bin/mv "$destination" "$source"; /bin/mv "$backup" "$destination"; fail; fi
      else
        "$destination" >/dev/null 2>&1 &
      fi
    fi
    record applied
    ;;
  deb)
    staged_hash=$(/usr/bin/sha256sum "$source"); staged_hash=$(printf '%s' "$staged_hash" | /usr/bin/cut -d ' ' -f 1); [ "$staged_hash" = "$source_hash" ] || fail
    /usr/bin/pkexec "$manager" install -y -- "$source" || fail
    record installer-completed
    if [ "$relaunch" = yes ]; then "$executable" >/dev/null 2>&1 & fi
    ;;
  rpm)
    staged_hash=$(/usr/bin/sha256sum "$source"); staged_hash=$(printf '%s' "$staged_hash" | /usr/bin/cut -d ' ' -f 1); [ "$staged_hash" = "$source_hash" ] || fail
    case "$manager" in
      /usr/bin/zypper) /usr/bin/pkexec "$manager" --non-interactive install -- "$source" || fail ;;
      /usr/bin/dnf|/usr/bin/yum) /usr/bin/pkexec "$manager" install -y -- "$source" || fail ;;
      *) fail ;;
    esac
    record installer-completed
    if [ "$relaunch" = yes ]; then "$executable" >/dev/null 2>&1 & fi
    ;;
  *) fail ;;
esac
finished=yes
`

const WINDOWS_HELPER = String.raw`$ParentId = [int][Environment]::GetEnvironmentVariable('ZIAFORGE_UPDATE_PARENT')
$Source = [Environment]::GetEnvironmentVariable('ZIAFORGE_UPDATE_SOURCE')
$Destination = [Environment]::GetEnvironmentVariable('ZIAFORGE_UPDATE_DESTINATION')
$Receipt = [Environment]::GetEnvironmentVariable('ZIAFORGE_UPDATE_RECEIPT')
$Ready = [Environment]::GetEnvironmentVariable('ZIAFORGE_UPDATE_READY')
$Identity = [Environment]::GetEnvironmentVariable('ZIAFORGE_UPDATE_IDENTITY')
$IdentityHash = [Environment]::GetEnvironmentVariable('ZIAFORGE_UPDATE_IDENTITY_HASH')
$SourceHash = [Environment]::GetEnvironmentVariable('ZIAFORGE_UPDATE_SOURCE_HASH')
$ErrorActionPreference = 'Stop'
function Record([string]$State) { [IO.File]::WriteAllText($Receipt, ('{"status":"' + $State + '"}'), [Text.UTF8Encoding]::new($false)) }
try {
  $parent = Get-Process -Id $ParentId -ErrorAction Stop
  $started = $parent.StartTime.ToUniversalTime().Ticks
  [IO.File]::WriteAllText($Ready, 'ready')
  $deadline = [DateTime]::UtcNow.AddMinutes(10)
  while ($true) {
    $current = Get-Process -Id $ParentId -ErrorAction SilentlyContinue
    if (!$current -or $current.StartTime.ToUniversalTime().Ticks -ne $started) { break }
    if ([DateTime]::UtcNow -gt $deadline) { throw 'Application did not quit' }
    Start-Sleep -Milliseconds 100
  }
  if ((Get-FileHash -LiteralPath $Identity -Algorithm SHA256).Hash.ToLowerInvariant() -ne $IdentityHash) { throw 'Installation changed' }
  if ((Get-FileHash -LiteralPath $Source -Algorithm SHA256).Hash.ToLowerInvariant() -ne $SourceHash) { throw 'Downloaded installer changed' }
  if ((Get-Item -LiteralPath $Destination).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Installation is a link' }
  Record 'applying'
  $info = [Diagnostics.ProcessStartInfo]::new()
  $info.FileName = $Source
  $info.UseShellExecute = $true
  $info.Arguments = '--updated /S --force-run /D=' + $Destination
  $installer = [Diagnostics.Process]::Start($info)
  $installer.WaitForExit()
  if ($installer.ExitCode -ne 0) { throw 'Installer failed or was cancelled' }
  Record 'installer-completed'
} catch { Record 'failed'; exit 1 }
`

export async function prepareUpdate(candidate: UpdateCandidate, filename: string, target: UpdateInstallTarget, directory: string, signal: AbortSignal): Promise<PreparedUpdate> {
  assertTargetUnchanged(target)
  if (await fileSha256(filename) !== candidate.asset.sha256 || fs.statSync(filename).size !== candidate.asset.bytes) throw new Error('Downloaded update changed before installation')
  ensurePrivateDirectory(directory)
  const job = fs.mkdtempSync(path.join(directory, 'install-')), receipt = path.join(job, 'result.json')
  let source = filename, backup: string | undefined, sibling: string | undefined
  try {
    if (target.kind === 'mac-zip') {
      await validateMacUpdateZip(filename)
      sibling = fs.mkdtempSync(path.join(path.dirname(target.destination!), '.ziaforge-update-'))
      await execute('/usr/bin/ditto', ['-x', '-k', filename, sibling], { timeout: 300000, maxBuffer: 1024 * 1024, signal })
      source = path.join(sibling, 'ZIAForge.app')
      const stagedIdentity = path.join(source, 'Contents/Resources/build-identity.json')
      absoluteFile(stagedIdentity)
      const identity = JSON.parse(fs.readFileSync(stagedIdentity, 'utf8')) as Record<string, unknown>
      if (identity.version !== candidate.release.version || identity.releaseId !== candidate.releaseId || identity.buildId !== candidate.buildId || identity.platform !== 'darwin' || identity.arch !== candidate.asset.arch || !identity.source || (identity.source as Record<string, unknown>).commit !== candidate.sourceCommit) throw new Error('Extracted application does not match the verified release')
      const plist = path.join(source, 'Contents/Info.plist')
      const bundleId = await execute('/usr/libexec/PlistBuddy', ['-c', 'Print :CFBundleIdentifier', plist], { timeout: 10000, signal })
      const bundleVersion = await execute('/usr/libexec/PlistBuddy', ['-c', 'Print :CFBundleShortVersionString', plist], { timeout: 10000, signal })
      if (bundleId.stdout.trim() !== 'org.ziaforge.desktop' || bundleVersion.stdout.trim() !== candidate.release.version) throw new Error('Extracted application bundle identity differs')
      const executable = path.join(source, 'Contents/MacOS/ZIAForge')
      absoluteFile(executable)
      const header = Buffer.alloc(8), descriptor = fs.openSync(executable, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW)
      try { fs.readSync(descriptor, header, 0, header.length, 0) } finally { fs.closeSync(descriptor) }
      if (header.readUInt32LE(0) !== 0xfeedfacf || header.readUInt32LE(4) !== (candidate.asset.arch === 'arm64' ? 0x100000c : 0x1000007)) throw new Error('Extracted application executable has the wrong architecture')
      // Preserve the OS trust decision for downloaded unsigned applications.
      // Never remove quarantine or change Gatekeeper settings.
      await execute('/usr/bin/xattr', ['-w', 'com.apple.quarantine', `0083;${Math.floor(Date.now() / 1000).toString(16)};ZIAForge;`, source], { timeout: 10000, signal })
      backup = path.join(path.dirname(target.destination!), `.ziaforge-backup-${randomUUID()}.app`)
    } else if (target.kind === 'appimage') {
      const magic = Buffer.alloc(20), file = fs.openSync(filename, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW)
      try { fs.readSync(file, magic, 0, magic.length, 0) } finally { fs.closeSync(file) }
      if (!magic.subarray(0, 4).equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46])) || magic[4] !== 2 || magic[5] !== 1 || magic.readUInt16LE(18) !== (candidate.asset.arch === 'arm64' ? 183 : 62)) throw new Error('Downloaded AppImage has the wrong executable architecture')
      sibling = fs.mkdtempSync(path.join(path.dirname(target.destination!), '.ziaforge-update-'))
      source = path.join(sibling, 'ZIAForge.AppImage')
      fs.copyFileSync(filename, source, fs.constants.COPYFILE_EXCL)
      fs.chmodSync(source, 0o755)
      if (await fileSha256(source) !== candidate.asset.sha256) throw new Error('Staged AppImage failed verification')
      backup = path.join(path.dirname(target.destination!), `.ziaforge-backup-${randomUUID()}.AppImage`)
    } else if (target.kind === 'deb' || target.kind === 'rpm') {
      const command = target.kind === 'deb' ? '/usr/bin/dpkg-deb' : '/usr/bin/rpm'
      const args = target.kind === 'deb' ? ['--field', filename, 'Package', 'Version', 'Architecture'] : ['-qp', '--queryformat', '%{NAME}\n%{VERSION}\n%{ARCH}', filename]
      const metadata = await execute(command, args, { timeout: 15000, maxBuffer: 65536, signal })
      const values = metadata.stdout.trim().split('\n').map(value => value.replace(/^(?:Package|Version|Architecture):\s*/, '').trim())
      const expectedArch = target.kind === 'deb' ? (candidate.asset.arch === 'arm64' ? 'arm64' : 'amd64') : (candidate.asset.arch === 'arm64' ? 'aarch64' : 'x86_64')
      if (values.length !== 3 || values[0] !== 'ziaforge' || values[1] !== candidate.release.version || values[2] !== expectedArch) throw new Error('Downloaded system package identity differs from the release')
    }
    signal.throwIfAborted()
    assertTargetUnchanged(target)
    const helper = path.join(job, target.kind === 'nsis' ? 'install.ps1' : 'install.sh')
    fs.writeFileSync(helper, target.kind === 'nsis' ? WINDOWS_HELPER : UNIX_HELPER, { flag: 'wx', mode: 0o600 })
    const verificationPath = target.kind === 'appimage' ? target.destination! : target.identityPath!
    const verificationHash = target.kind === 'appimage' ? await fileSha256(verificationPath) : target.identitySha256!
    const prepared: PreparedUpdate = { directory: job, helper, target, candidate, source, backup, parentPid: process.pid, parentStart: target.kind === 'nsis' ? '' : unixParentStart(), receipt, verificationPath, verificationHash }
    fs.writeFileSync(path.join(job, 'prepared.json'), JSON.stringify({ version: candidate.release.version, sourceCommit: candidate.sourceCommit, destination: target.destination, backup, sibling, receipt, kind: target.kind }), { flag: 'wx', mode: 0o600 })
    return prepared
  } catch (error) {
    if (sibling) fs.rmSync(sibling, { recursive: true, force: true })
    fs.writeFileSync(receipt, JSON.stringify({ status: 'preparation-failed' }), { flag: 'wx', mode: 0o600 })
    throw error
  }
}

/** Called only after every app-owned service and child completes normal Quit. */
export async function armPreparedUpdate(prepared: PreparedUpdate, options: { relaunch?: boolean } = {}): Promise<number> {
  assertTargetUnchanged(prepared.target)
  const ready = path.join(prepared.directory, 'ready'), log = fs.openSync(path.join(prepared.directory, 'helper.log'), 'wx', 0o600)
  const target = prepared.target
  let command: string, args: string[]
  const env = { ...process.env }
  if (target.kind === 'nsis') {
    const systemRoot = process.env.SystemRoot || 'C:\\Windows'
    command = path.join(systemRoot, 'System32/WindowsPowerShell/v1.0/powershell.exe')
    // A constant command (all values supplied through the environment) works
    // without changing execution policy for downloaded .ps1 files. Constrained
    // Language Mode and system application-control policy remain authoritative.
    args = ['-NoProfile', '-NonInteractive', '-Command', WINDOWS_HELPER]
    Object.assign(env, { ZIAFORGE_UPDATE_PARENT: String(prepared.parentPid), ZIAFORGE_UPDATE_SOURCE: prepared.source, ZIAFORGE_UPDATE_DESTINATION: target.destination!, ZIAFORGE_UPDATE_RECEIPT: prepared.receipt, ZIAFORGE_UPDATE_READY: ready, ZIAFORGE_UPDATE_IDENTITY: prepared.verificationPath, ZIAFORGE_UPDATE_IDENTITY_HASH: prepared.verificationHash, ZIAFORGE_UPDATE_SOURCE_HASH: prepared.candidate.asset.sha256 })
  } else {
    command = '/bin/sh'
    args = [prepared.helper, String(prepared.parentPid), prepared.parentStart, target.kind, prepared.source, target.destination ?? '', prepared.backup ?? '', prepared.receipt, ready, `${target.device}:${target.inode}`, prepared.verificationPath, prepared.verificationHash, target.manager ?? '', target.executable ?? '', options.relaunch === false ? 'no' : 'yes', prepared.candidate.asset.sha256]
  }
  try {
    const child = spawn(command, args, { detached: true, stdio: ['ignore', log, log], windowsHide: true, env })
    await new Promise<void>((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject) })
    child.unref()
    for (let attempts = 0; attempts < 60; attempts++) {
      if (fs.existsSync(ready)) return child.pid!
      if (child.exitCode !== null) throw new Error('Update installer could not prepare to run after Quit')
      await new Promise(resolve => setTimeout(resolve, 50))
    }
    // This is our exact newly-created helper, never another CLI or application.
    child.kill()
    await new Promise<void>(resolve => {
      const timer = setTimeout(() => { child.kill('SIGKILL'); resolve() }, 2000)
      child.once('close', () => { clearTimeout(timer); resolve() })
    })
    throw new Error('Update installer readiness timed out')
  } finally { fs.closeSync(log) }
}

export function discardPreparedUpdate(prepared: PreparedUpdate): void {
  // Disarming only removes the owned stage, never an installation or backup.
  if (['mac-zip', 'appimage'].includes(prepared.target.kind)) {
    const sibling = path.dirname(prepared.source)
    if (path.dirname(sibling) === path.dirname(prepared.target.destination!) && path.basename(sibling).startsWith('.ziaforge-update-')) fs.rmSync(sibling, { recursive: true, force: true })
  }
  fs.writeFileSync(prepared.receipt, JSON.stringify({ status: 'disarmed' }), { mode: 0o600 })
}
