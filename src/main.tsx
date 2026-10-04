import { uiText } from './uiText'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Global Uncaught Exception Listeners
window.addEventListener('error', (event) => {
  const errMessage = `Global Window Error: ${event.message} at ${event.filename}:${event.lineno}:${event.colno}\nStack: ${event.error?.stack || 'No Stack'}`
  console.error(errMessage)
  
  // Log critical error unconditionally
  window.ziafAPI.writeDebugLog({ message: errMessage, critical: true }).catch(() => {})
  
  // Attempt self-healing reload
  handleRecoveryReload()
})

window.addEventListener('unhandledrejection', (event) => {
  const errMessage = `Global Unhandled Promise Rejection: ${event.reason?.message || event.reason}\nStack: ${event.reason?.stack || 'No Stack'}`
  console.error(errMessage)
  
  // Log critical error unconditionally
  window.ziafAPI.writeDebugLog({ message: errMessage, critical: true }).catch(() => {})
  
  // Attempt self-healing reload
  handleRecoveryReload()
})

function handleRecoveryReload() {
  const now = Date.now()
  const lastCrash = sessionStorage.getItem('last_react_crash_time')
  const lastCrashTime = lastCrash ? parseInt(lastCrash, 10) : 0
  
  if (now - lastCrashTime > 6000) {
    sessionStorage.setItem('last_react_crash_time', now.toString())
    window.location.reload()
  }
}

// React Error Boundary with premium recovery screen
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const errorStack = `React Rendering Crash: ${error.message}\nStack: ${error.stack}\nComponent Stack: ${errorInfo.componentStack}`
    console.error(errorStack)
    
    // Log to app debug log unconditionally
    window.ziafAPI.writeDebugLog({ message: errorStack, critical: true }).catch(() => {})
    
    // Attempt recovery reload
    handleRecoveryReload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-[#0b0c0e] text-zinc-300 font-sans p-6">
          <div className="max-w-md w-full bg-[#121316] border border-[#1e2024] rounded-2xl p-8 shadow-2xl text-center space-y-6 animate-fade-in">
            {/* Warning Icon */}
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#ff4a4a]/10 border border-[#ff4a4a]/20 text-[#ff4a4a]">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            
            <div className="space-y-2">
              <h1 className="text-xl font-bold text-white tracking-tight">{uiText("ZIAForge interface recovery")}</h1>
              <p className="text-xs text-zinc-400 leading-relaxed">
                {uiText("The interface could not be rendered. An error report was saved in the application log. Use the button below to reload the interface.")}</p>
            </div>

            {/* Error Detail */}
            <div className="text-[10px] text-left font-mono bg-[#08090a] p-3 rounded-lg border border-[#1e2024]/40 max-h-36 overflow-auto text-zinc-500 select-all leading-normal">
              {this.state.error?.message || uiText("Unknown rendering error")}
            </div>

            {/* Reload Button */}
            <button
              onClick={() => {
                sessionStorage.removeItem('last_react_crash_time')
                window.location.reload()
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-[#ff6b00] hover:bg-[#ff8c3a] active:bg-[#e05e00] text-white text-xs font-bold shadow-lg hover:shadow-orange-500/10 transition-all cursor-pointer"
            >
              {uiText("Reload interface")}</button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
