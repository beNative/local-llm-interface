import { instrumentation } from './InstrumentationManager';

export type RecoveryStrategy = () => Promise<void> | void;

export interface RecoverableErrorOptions {
  strategy?: RecoveryStrategy;
  category?: string;
  detail?: Record<string, unknown>;
}

export const handleRecoverableError = async (error: unknown, options: RecoverableErrorOptions = {}) => {
  instrumentation.emit({
    id: `recoverable-error-${Date.now()}`,
    timestamp: Date.now(),
    category: options.category ?? 'error:recoverable',
    payload: {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      detail: options.detail,
    },
    severity: 'error',
  });

  if (options.strategy) {
    try {
      await options.strategy();
      instrumentation.emit({
        id: `recoverable-error-recovered-${Date.now()}`,
        timestamp: Date.now(),
        category: 'error:recoverable',
        payload: {
          detail: options.detail,
        },
        severity: 'info',
      });
    } catch (recoveryError) {
      instrumentation.emit({
        id: `recoverable-error-failed-${Date.now()}`,
        timestamp: Date.now(),
        category: 'error:recoverable',
        payload: {
          message: recoveryError instanceof Error ? recoveryError.message : String(recoveryError),
          stack: recoveryError instanceof Error ? recoveryError.stack : undefined,
        },
        severity: 'error',
      });
    }
  }
};
