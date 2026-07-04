import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

/**
 * App-level error boundary. A render error anywhere below would otherwise unmount the whole
 * tree and leave a blank screen; this catches it and shows a recoverable fallback instead.
 * React still needs a class component for getDerivedStateFromError / componentDidCatch.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Unhandled UI error:', error, info.componentStack)
  }

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children

    return (
      <div
        className="min-h-screen flex items-center justify-center px-6"
        style={{ background: 'var(--color-surface-1)' }}
      >
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold text-white mb-2">Something went wrong</h1>
          <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.5)' }}>
            An unexpected error occurred. Reloading the page usually fixes it.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95"
            style={{ background: 'linear-gradient(135deg, var(--color-brand-600), #3b82f6)' }}
          >
            Reload
          </button>
        </div>
      </div>
    )
  }
}
