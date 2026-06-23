import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
  info: ErrorInfo | null;
}

/**
 * Catches render-time errors anywhere in the tree and shows them instead of a blank
 * screen. Commercial-grade apps must never white-screen; this also makes diagnosis easy.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.setState({ info });
    console.error('Render error caught by ErrorBoundary:', error, info);
  }

  render(): ReactNode {
    const { error, info } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="errboundary">
        <h2>Something crashed</h2>
        <p className="errboundary__msg">{error.message}</p>
        <details>
          <summary>Stack</summary>
          <pre>{error.stack}</pre>
          {info && <pre>{info.componentStack}</pre>}
        </details>
        <button onClick={() => this.setState({ error: null, info: null })}>Try to recover</button>
      </div>
    );
  }
}
