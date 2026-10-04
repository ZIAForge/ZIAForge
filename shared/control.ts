/** Authenticated application commands. Policy/credentials are local-owner only. */
export interface ControlRequest { method: string; args?: unknown[]; requestId?: string }
export type ControlScope = 'read' | 'operate'
export interface RemoteInstance { id: string; name: string; url: string; token?: string; hasToken?: boolean }
export interface ControlConfig {
  enabled: boolean; host: '127.0.0.1' | '0.0.0.0'; port: number;
  scope: ControlScope; nativeComputer: boolean;
  assistantPreset: string; assistantOperate: boolean;
  telegramEnabled: boolean; telegramOwner: string; telegramToken?: string;
  instances: RemoteInstance[];
}
export interface ControlStatus extends Omit<ControlConfig, 'telegramToken'> {
  endpoint?: string; accessToken?: string; telegramConfigured: boolean;
  telegramStatus: string; running: boolean; error?: string;
}
export interface AssistantEntry { id: string; role: 'user' | 'assistant' | 'command'; text: string; at: number; image?: string }
export interface AssistantState { entries: AssistantEntry[]; busy: boolean; error?: string }
export interface ControlAPI {
  status(): Promise<ControlStatus>;
  configure(config: ControlConfig): Promise<ControlStatus>;
  rotateToken(): Promise<ControlStatus>;
  execute(request: ControlRequest): Promise<unknown>;
  remote(request: { instanceId: string; request: ControlRequest }): Promise<unknown>;
  assistantState(): Promise<AssistantState>;
  assistantSend(request: { text: string; instanceId?: string }): Promise<AssistantState>;
  assistantStop(): Promise<void>;
}
export interface UpdateStatus { repository?: string; automatic?: boolean; state: 'idle' | 'checking' | 'available' | 'current' | 'downloading' | 'downloaded' | 'error'; version?: string; message?: string; progress?: number; configured: boolean; currentChannel: 'stable' | 'preview' }
export interface UpdateConfig { repository: string; channel: 'stable' | 'preview'; automatic: boolean }
export interface UpdatesAPI { status(): Promise<UpdateStatus>; configure(config: UpdateConfig): Promise<UpdateStatus>; check(): Promise<UpdateStatus>; download(): Promise<UpdateStatus>; install(): Promise<void> }
