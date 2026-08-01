import { Component } from 'react'

/** Captura erros de subtree (ex.: GLB) sem derrubar o canvas inteiro. */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error) {
    console.warn('[ErrorBoundary]', this.props.name || 'scene', error)
  }

  render() {
    if (this.state.error) return this.props.fallback ?? null
    return this.props.children
  }
}
