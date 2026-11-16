import { Component, type ErrorInfo, type ReactNode } from 'react'
import { LoadErrorScreen } from './LoadErrorScreen'

type Props = { resetKey: string; children: ReactNode }
type State = { error: unknown; key: string }

/**
 * Si falla una sección del panel, el menú sigue disponible. Se reinicia al
 * cambiar de ruta (`resetKey`). Origen: core-base (Realt-In).
 */
export class SectionErrorBoundary extends Component<Props, State> {
  override state: State = { error: null, key: this.props.resetKey }

  static getDerivedStateFromError(error: unknown): Partial<State> {
    return { error }
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    return props.resetKey !== state.key ? { error: null, key: props.resetKey } : null
  }

  override componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error(error, info.componentStack)
  }

  override render() {
    if (this.state.error) return <LoadErrorScreen error={this.state.error} compact />
    return this.props.children
  }
}
