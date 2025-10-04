import React from 'react';
import { handleRecoverableError } from '../services/instrumentation/errorRecovery';
import { instrumentation } from '../services/instrumentation/InstrumentationManager';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
}

export class InstrumentationErrorBoundary extends React.Component<Props, State> {
  public state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  async componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    instrumentation.emit({
      id: `react-error-${Date.now()}`,
      timestamp: Date.now(),
      category: 'error:react',
      payload: {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
      },
      severity: 'error',
    });

    await handleRecoverableError(error, {
      category: 'error:react',
      detail: { componentStack: errorInfo.componentStack },
    });
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="p-4 text-red-500">
          <h2 className="font-semibold text-lg">Something went wrong.</h2>
          <p>Please check the logs for more details.</p>
        </div>
      );
    }

    return this.props.children;
  }
}
