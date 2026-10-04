import path from 'node:path'
import { randomBytes } from 'node:crypto'
import { safeStorage } from 'electron'
import { RecoveryStore } from '../runtime/RecoveryStore'
import { protectedCredentialStorage } from '../runtime/CredentialStorage'
import { validateControlConfig } from './ControlPolicy'
import type { ControlConfig } from '../../shared/control'
interface Stored { version: 1; config: ControlConfig; secrets: string }
export const defaultControlConfig = (): ControlConfig => ({ enabled:false,host:'127.0.0.1',port:43210,scope:'read',nativeComputer:false,assistantPreset:'',assistantOperate:false,telegramEnabled:false,telegramOwner:'',instances:[] })
/** Credentials are encrypted with the OS keychain, separate from normal app settings. */
export class ControlStore {
  private store:RecoveryStore<Stored>
  constructor(directory:string){this.store=new RecoveryStore({filename:path.join(directory,'owner-control.json'),maxBytes:128*1024,validate:(v):asserts v is Stored=>{const s=v as Stored;if(!s||s.version!==1||typeof s.secrets!=='string')throw new Error('Invalid owner control storage');validateControlConfig(s.config)}})}
  read():{config:ControlConfig;token:string}{
    const saved=this.store.read()
    if(!saved)return {config:defaultControlConfig(),token:''}
    if(!protectedCredentialStorage(safeStorage))throw new Error('OS credential storage is unavailable')
    const secrets=JSON.parse(safeStorage.decryptString(Buffer.from(saved.secrets,'base64'))) as {token:string;telegram?:string;instances:Record<string,string>}
    if(!/^[a-f0-9]{64}$/.test(secrets.token))throw new Error('Invalid saved access token')
    return {token:secrets.token,config:{...saved.config,telegramToken:secrets.telegram,instances:saved.config.instances.map(i=>({...i,token:secrets.instances[i.id]}))}}
  }
  save(config:ControlConfig,rotate=false){
    validateControlConfig(config)
    if(!protectedCredentialStorage(safeStorage))throw new Error('OS credential storage is unavailable; secrets were not saved')
    const previous=this.read();const token=rotate||!previous.token?randomBytes(32).toString('hex'):previous.token
    const telegram=config.telegramToken===undefined?previous.config.telegramToken:config.telegramToken
    const instances=config.instances.map(i=>({...i,token:i.token===undefined?previous.config.instances.find(p=>p.id===i.id)?.token:i.token}))
    const publicConfig={...config,telegramToken:undefined,instances:instances.map(({token:secret,hasToken,...i})=>{void secret;void hasToken;return i})}
    const secrets=safeStorage.encryptString(JSON.stringify({token,telegram,instances:Object.fromEntries(instances.filter(i=>i.token).map(i=>[i.id,i.token]))})).toString('base64')
    this.store.write({version:1,config:publicConfig,secrets})
    return this.read()
  }
}
