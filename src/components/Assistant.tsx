import { uiText } from '../uiText'
import React, { useState, useRef, useEffect } from 'react'
import { useStore } from '../store'
import { useTranslation } from '../i18n'
import { Send, Paperclip, Cpu, Sparkles } from 'lucide-react'
import { MarkdownMessage } from './MarkdownMessage'

export const Assistant: React.FC = () => {
  const { t } = useTranslation()
  const { assistantMessages, sendAssistantMessage } = useStore()
  const [text, setText] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    sendAssistantMessage(text.trim())
    setText('')
  }

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [assistantMessages])

  const suggestedPrompts = [
    t('prompt_audit_blocklist'),
    t('prompt_active_connections'),
    t('prompt_ollama_gateway'),
    t('prompt_task_deepaudit')
  ]

  return (
    <div className="flex flex-col h-full bg-[#0b0c0e] text-zinc-300 overflow-hidden">
      
      {/* Header bar */}
      <div className="h-12 border-b border-[#1e2024] bg-[#0f1012] flex items-center px-6 gap-3 shrink-0 select-none drag-region">
        <Sparkles className="h-5 w-5 text-purple-400" />
        <span className="text-sm font-semibold text-white">{t('ziaf_assistant')}</span>
        <span className="text-[10px] bg-purple-500/10 border border-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded-full font-medium font-mono uppercase tracking-wider">{uiText("AI Loop")}</span>
      </div>

      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {assistantMessages.map((msg) => {
          const isAI = msg.sender === 'assistant'
          return (
            <div 
              key={msg.id} 
              className={`flex gap-3 text-sm items-start max-w-2xl animate-fade-in ${
                isAI ? '' : 'ml-auto flex-row-reverse'
              }`}
            >
              {/* Profile Avatar */}
              <div 
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg shadow-md ${
                  isAI 
                    ? 'bg-gradient-to-br from-purple-600 to-indigo-600 text-white' 
                    : 'bg-[#1e2024] text-zinc-400 font-bold border border-[#2b2e33]'
                }`}
              >
                {isAI ? <Cpu className="h-4 w-4" /> : 'U'}
              </div>

              {/* Message bubble */}
              <div className="space-y-1 min-w-0 flex-1">
                <div className={`flex items-center gap-2 text-[10px] text-zinc-500 ${
                  isAI ? '' : 'justify-end'
                }`}>
                  <span className="font-bold">{isAI ? 'ZIAForge' : t('user')}</span>
                  <span>•</span>
                  <span>{msg.timestamp}</span>
                </div>
                
                <div 
                  className={`rounded-xl border p-3 text-xs leading-relaxed shadow-sm select-text ${
                    isAI 
                      ? 'bg-[#15171a] border-[#1e2024] text-zinc-200' 
                      : 'bg-[#ff6b00]/10 border-[#ff6b00]/25 text-white whitespace-pre-wrap'
                  }`}
                >
                  {isAI ? <MarkdownMessage text={msg.text} /> : msg.text}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Prompts footer bar */}
      {assistantMessages.length === 1 && (
        <div className="px-6 py-2 flex flex-wrap gap-2 select-none border-t border-[#1e2024]/40 bg-[#0f1012]/30 shrink-0">
          {suggestedPrompts.map((p, idx) => (
            <button
              key={idx}
              onClick={() => sendAssistantMessage(p)}
              className="text-[10.5px] bg-[#15171a] hover:bg-[#1e2024] hover:text-white border border-[#2b2e33] rounded-full px-3 py-1 text-zinc-400 font-medium transition-all"
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Input container */}
      <div className="p-4 border-t border-[#1e2024] bg-[#0c0d0e] shrink-0">
        <form onSubmit={handleSend} className="relative border border-[#2b2e33] rounded-lg bg-[#0f1012] focus-within:border-[#ff6b00] transition-colors">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t('assistant_placeholder')}
            className="w-full bg-transparent border-none p-3.5 pr-20 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none"
          />
          
          <div className="absolute right-2 top-2.5 flex gap-1.5">
            <button 
              type="button" 
              className="p-1.5 rounded-lg bg-[#1e2024] text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <Paperclip className="h-4 w-4" />
            </button>
            <button 
              type="submit" 
              disabled={!text.trim()}
              className={`p-1.5 rounded-lg text-white transition-all ${
                text.trim() 
                  ? 'bg-purple-600 hover:bg-purple-700 shadow-md cursor-pointer' 
                  : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
              }`}
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </form>
      </div>

    </div>
  )
}
