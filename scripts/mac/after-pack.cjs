const fs = require('node:fs')
const path = require('node:path')
const { repairHelpers } = require('../fix-node-pty-helper.cjs')
const { assertBundleIdentity } = require('./bundle-identity.cjs')
const { sha256 } = require('./package-utils.cjs')

module.exports = async context => {
  if (context.electronPlatformName !== 'darwin') throw new Error('This packaging hook is macOS-only')
  const arch = require('builder-util').Arch[context.arch]
  const app = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`)
  const resources = path.join(app, 'Contents', 'Resources')
  // Repair staged native helpers before signing/DMG creation, never after install.
  const inspected = repairHelpers(path.join(resources, 'app.asar.unpacked'), { platform: 'darwin', arch })
  fs.writeFileSync(path.join(resources, 'native-pty-packaging.json'), JSON.stringify(inspected, null, 2) + '\n')
  const metadata = context.packager.platformSpecificBuildOptions.extendInfo
  const identity = assertBundleIdentity(app, {
    productName: context.packager.appInfo.productName, appId: context.packager.appInfo.id,
    version: context.packager.appInfo.version, buildId: metadata.ZIAForgeBuildId,
    source: { commit: metadata.ZIAForgeSourceCommit, workingTreeSha256: metadata.ZIAForgeSourceSHA256 },
    iconSha256: sha256(path.join(context.packager.projectDir, 'build/icon.icns')),
  })
  fs.writeFileSync(path.join(context.appOutDir, 'after-pack-identity.json'), JSON.stringify(identity, null, 2) + '\n', { flag: 'wx' })
}
