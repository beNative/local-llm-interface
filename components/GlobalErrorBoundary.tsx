import React, { Component, ErrorInfo } from 'react';

interface Props {
    children: React.ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

/**
 * Global error boundary that catches rendering crashes anywhere in the
 * component tree. Provides a recovery UI with reload and log-export options.
 */
class GlobalErrorBoundary extends Component<Props, State> {
    state: State = { hasError: false, error: null, errorInfo: null };

    static getDerivedStateFromError(error: Error): Partial<State> {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        this.setState({ errorInfo });
        console.error('[GlobalErrorBoundary] Caught rendering error:', error, errorInfo);
    }

    handleReload = () => {
        window.location.reload();
    };

    handleCopyError = async () => {
        const { error, errorInfo } = this.state;
        const report = [
            `=== Local LLM Interface — Crash Report ===`,
            `Date: ${new Date().toISOString()}`,
            ``,
            `Error: ${error?.message || 'Unknown error'}`,
            `Stack: ${error?.stack || 'No stack trace'}`,
            ``,
            `Component Stack:`,
            errorInfo?.componentStack || 'No component stack',
        ].join('\n');

        try {
            await navigator.clipboard.writeText(report);
        } catch {
            // Fallback: log to console if clipboard isn't available
            console.log(report);
        }
    };

    render() {
        if (this.state.hasError) {
            return (
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '100vh',
                        padding: '2rem',
                        backgroundColor: 'var(--bg-primary, #1e1e1e)',
                        color: 'var(--text-primary, #cccccc)',
                        fontFamily: "'Segoe UI Variable Text', 'Segoe UI', system-ui, sans-serif",
                    }}
                >
                    <div
                        style={{
                            maxWidth: '560px',
                            width: '100%',
                            textAlign: 'center',
                        }}
                    >
                        <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.6 }}>⚠️</div>
                        <h1
                            style={{
                                fontSize: '22px',
                                fontWeight: 600,
                                marginBottom: '8px',
                                color: 'var(--text-primary, #f8fafc)',
                            }}
                        >
                            Something went wrong
                        </h1>
                        <p
                            style={{
                                fontSize: '14px',
                                color: 'var(--text-muted, #717171)',
                                marginBottom: '24px',
                                lineHeight: 1.6,
                            }}
                        >
                            The application encountered an unexpected error. Your settings and chat
                            history are safe — try reloading.
                        </p>

                        {this.state.error && (
                            <pre
                                style={{
                                    textAlign: 'left',
                                    fontSize: '12px',
                                    fontFamily: 'monospace',
                                    backgroundColor: 'var(--bg-tertiary, #2d2d2d)',
                                    border: '1px solid var(--border-primary, #333)',
                                    borderRadius: '8px',
                                    padding: '16px',
                                    marginBottom: '24px',
                                    maxHeight: '200px',
                                    overflow: 'auto',
                                    color: '#ef4444',
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-word',
                                }}
                            >
                                {this.state.error.message}
                                {this.state.error.stack && (
                                    <>
                                        {'\n\n'}
                                        {this.state.error.stack
                                            .split('\n')
                                            .slice(1, 6)
                                            .join('\n')}
                                    </>
                                )}
                            </pre>
                        )}

                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                            <button
                                onClick={this.handleReload}
                                style={{
                                    padding: '10px 24px',
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    backgroundColor: 'var(--accent-chat, #007acc)',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                }}
                            >
                                Reload Application
                            </button>
                            <button
                                onClick={this.handleCopyError}
                                style={{
                                    padding: '10px 24px',
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    backgroundColor: 'var(--bg-tertiary, #2d2d2d)',
                                    color: 'var(--text-secondary, #999999)',
                                    border: '1px solid var(--border-primary, #333)',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                }}
                            >
                                Copy Error Log
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default GlobalErrorBoundary;
