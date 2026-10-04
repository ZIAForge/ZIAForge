import { gt, valid, rcompare, prerelease } from 'semver'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs'
import { app } from 'electron'
import { autoUpdater } from 'electron-updater'
import { RecoveryStore } from '../runtime/RecoveryStore'
import type { UpdateConfig, UpdateStatus } from '../../shared/control'
function validate(v:unknown):asserts v is UpdateConfig{const c=v as UpdateConfig;if(!c||Object.keys(c).some(k=>!['repository','channel','automatic'].includes(k))||typeof c.repository!=='string'||c.repository!==''&&!/^[\w.-]+\/[\w.-]+$/.test(c.repository)||!['stable','preview'].includes(c.channel)||typeof c.automatic!=='boolean')throw new Error('Use a GitHub owner/repository and stable or preview channel')}
export class UpdateService {
  private store:RecoveryStore<UpdateConfig>
  private config:UpdateConfig
  private current:UpdateStatus
  private checking?:Promise<UpdateStatus>
  private timer?:ReturnType<typeof setInterval>
  private shutdown=new AbortController()
  private downloadCancellation?:NonNullable<Awaited<ReturnType<typeof autoUpdater.checkForUpdates>>>['cancellationToken']
  constructor(directory:string){
    this.store=new RecoveryStore({filename:path.join(directory,'updates.json'),validate});this.config=this.store.read()??{repository:'',channel:'stable',automatic:false}
    this.current={state:'idle',configured:!!this.config.repository,currentChannel:this.config.channel}
    autoUpdater.autoDownload=false;autoUpdater.autoInstallOnAppQuit=false
    autoUpdater.on('error',()=>{this.current={...this.current,state:'error',message:'Update download failed. Current installation is retained.'}})
    autoUpdater.on('download-progress',p=>{this.current={...this.current,state:'downloading',progress:p.percent}})
    autoUpdater.on('update-downloaded',info=>{this.current={...this.current,state:'downloaded',version:info.version,message:'Update verified and ready to install'};if(this.config.automatic)autoUpdater.autoInstallOnAppQuit=true})
  }
  status(){return {...this.current,repository:this.config.repository,automatic:this.config.automatic}}
  configure(config:UpdateConfig){validate(config);if(this.checking||this.current.state==='downloading'||this.current.state==='downloaded')throw new Error('Finish or restart the pending update before changing channels');this.store.write(config);this.config=config;this.current={state:'idle',configured:!!config.repository,currentChannel:config.channel};this.start();return this.status()}
  private downloadable(){if(!app.isPackaged||!fs.existsSync(path.join(process.resourcesPath,'app-update.yml')))return false;if(process.platform!=='darwin')return true;try{const appPath=path.resolve(path.dirname(process.execPath),'../..');const signature=spawnSync('/usr/bin/codesign',['-dv','--verbose=2',appPath],{timeout:5000,encoding:'utf8'});return signature.status===0&&/Authority=Developer ID Application:/.test(signature.stderr)}catch{return false}}
  check():Promise<UpdateStatus>{
    if(this.checking)return this.checking
    const operation=this.checkInternal();this.checking=operation;void operation.finally(()=>{if(this.checking===operation)this.checking=undefined}).catch(()=>{});return operation
  }
  private async checkInternal(){
    if(!this.config.repository)throw new Error('Configure the GitHub release repository first')
    this.current={...this.current,state:'checking',message:undefined}
    try {
      const response=await fetch(`https://api.github.com/repos/${this.config.repository}/releases?per_page=30`,{headers:{Accept:'application/vnd.github+json'},signal:AbortSignal.any([this.shutdown.signal,AbortSignal.timeout(20000)]),redirect:'error'})
      if(!response.ok)throw new Error('GitHub releases are unavailable')
      const releases=await response.json() as {draft:boolean;prerelease:boolean;tag_name:string}[]
      const release=releases.filter(r=>!r.draft&&valid(r.tag_name.replace(/^v/,''))&&(this.config.channel==='preview'||!r.prerelease&&!prerelease(r.tag_name.replace(/^v/,'')))).sort((a,b)=>rcompare(a.tag_name.replace(/^v/,''),b.tag_name.replace(/^v/,''))).find(r=>gt(r.tag_name.replace(/^v/,''),app.getVersion()))
      const version=(s:string)=>s.replace(/^v/,'')
      this.current={...this.current,state:release?'available':'current',version:release?version(release.tag_name):app.getVersion(),message:release&&!this.downloadable()?'Release found. Automatic installation requires a signed packaged build and published updater metadata.':undefined}
      this.shutdown.signal.throwIfAborted()
      if(release&&this.config.automatic&&this.downloadable())await this.download()
    }catch(e){this.current={...this.current,state:'error',message:e instanceof Error?e.message:'Update check failed'}}
    return this.status()
  }
  async download(){
    if(this.current.state!=='available')throw new Error('Check for an available update first')
    if(!this.downloadable())throw new Error('This build has no signed updater feed. Install the published build manually.')
    const [owner,repo]=this.config.repository.split('/');autoUpdater.allowPrerelease=this.config.channel==='preview';autoUpdater.allowDowngrade=false;autoUpdater.setFeedURL({provider:'github',owner,repo,releaseType:this.config.channel==='preview'?'prerelease':'release'})
    this.current={...this.current,state:'downloading',progress:0}
    try{const check=await autoUpdater.checkForUpdates();this.downloadCancellation=check?.cancellationToken;this.shutdown.signal.throwIfAborted();await autoUpdater.downloadUpdate(this.downloadCancellation);return this.status()}
    catch(e){this.current={...this.current,state:'error',message:'Update download failed. Current installation is retained.'};throw e}
    finally{this.downloadCancellation=undefined}
  }
  install(){if(this.current.state!=='downloaded')throw new Error('No verified update is ready');autoUpdater.quitAndInstall(false,true)}
  start(){if(this.timer)clearInterval(this.timer);this.timer=undefined;if(!this.shutdown.signal.aborted&&this.config.automatic&&this.config.repository){void this.check();this.timer=setInterval(()=>{if(!['downloading','downloaded'].includes(this.current.state))void this.check()},6*60*60*1000);this.timer.unref()}}
  async close(){if(this.timer)clearInterval(this.timer);this.timer=undefined;this.shutdown.abort();this.downloadCancellation?.cancel();await this.checking}
}
