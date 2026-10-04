import { Component } from 'react'

export default class PageErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('PageErrorBoundary:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: 32,
            maxWidth: 480,
            margin: '40px auto',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 16,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
          <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, marginBottom: 8 }}>
            Something went wrong
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 20 }}>
            This page hit an unexpected error. Try again or navigate elsewhere.
          </p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false })}
            style={{
              padding: '10px 20px',
              borderRadius: 10,
              border: 'none',
              background: 'var(--accent-indigo)',
              color: '#fff',
              fontWeight: 700,
              cursor: 'pointer',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            Retry
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
