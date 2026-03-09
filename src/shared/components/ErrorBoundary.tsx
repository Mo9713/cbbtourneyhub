// src/shared/components/ErrorBoundary.tsx
import { Component, type ReactNode, type ErrorInfo } from 'react'
import { RefreshCw, AlertTriangle } from 'lucide-react'

interface Props {
  children: ReactNode
  /** Optional custom fallback. Defaults to the built-in dark UI. */
  fallback?: ReactNode
}

interface State {
  hasError:  boolean
  message:   string
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  reset = () => this.setState({ hasError: false, message: '' })

  render() {
    if (!this.state.hasError) return this.props.children

    if (this.props.fallback) return this.props.fallback

    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center shadow-2xl">

          <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-5">
            <AlertTriangle size={26} className="text-red-400" />
          </div>

          <h1 className="font-display text-2xl font-extrabold text-white uppercase tracking-wide mb-2">
            Something went wrong
          </h1>
          <p className="text-sm text-slate-400 mb-6 leading-relaxed">
            An unexpected error occurred. Your picks are safe — refreshing the page will restore the app.
          </p>

          {this.state.message && (
            <p className="text-xs text-slate-600 font-mono bg-slate-800/60 rounded-lg px-3 py-2 mb-6 text-left break-all">
              {this.state.message}
            </p>
          )}

          <div className="flex gap-3 justify-center">
            <button
              onClick={() => window.location.reload()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-sm font-bold transition-colors shadow-lg shadow-orange-600/25"
            >
              <RefreshCw size={14} />
              Refresh Page
            </button>
            <button
              onClick={this.reset}
              className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold transition-colors"
            >
              Try Again
            </button>
          </div>

        </div>
      </div>
    )
  }
}

