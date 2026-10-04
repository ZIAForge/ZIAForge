export interface HelpAssistantEntry {
  id: string; role: 'user' | 'assistant'; text: string; at: number;
  sections: string[]; sourceSha256: string;
}
export interface HelpAssistantState {
  entries: HelpAssistantEntry[]; busy: boolean; error?: string;
  sourceSha256: string; defaultPreset: string; nativeEnabled: boolean;
}
export interface HelpAssistantRequest { text: string; presetName: string; language: string }
export interface HelpAssistantAPI {
  state(): Promise<HelpAssistantState>;
  send(request: HelpAssistantRequest): Promise<HelpAssistantState>;
  stop(): Promise<void>;
  clear(): Promise<HelpAssistantState>;
}
