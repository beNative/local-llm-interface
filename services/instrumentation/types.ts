export type LogSeverity = 'trace' | 'debug' | 'info' | 'warn' | 'error';

export interface LoggingConfig {
  /** Minimum severity that will be recorded */
  level: LogSeverity;
  /** When true, logs are mirrored to the developer console */
  console?: boolean;
  /** Optional prefix applied to every log record */
  prefix?: string;
}

export interface TestEnvironmentConfig {
  name: string;
  variables: Record<string, string>;
  allowNetwork?: boolean;
}

export interface InstrumentationConfig {
  logging: LoggingConfig;
  environment: TestEnvironmentConfig;
  performance?: {
    enabled: boolean;
    sampleRate?: number;
  };
  hooks?: {
    enabled: boolean;
  };
  automation?: {
    enabled: boolean;
    exposeWindowAPI?: boolean;
  };
}

export interface InstrumentationEvent<TPayload = unknown> {
  id: string;
  timestamp: number;
  category: string;
  payload?: TPayload;
  severity?: LogSeverity;
}

export interface HookExecutionContext<TArgs = unknown> {
  args: TArgs;
  environment: TestEnvironmentConfig;
  emit: (event: InstrumentationEvent) => void;
}

export type HookHandler<TArgs = unknown, TResult = void> = (
  context: HookExecutionContext<TArgs>
) => Promise<TResult> | TResult;

export interface RegisteredHook<TArgs = unknown, TResult = void> {
  id: string;
  description?: string;
  handler: HookHandler<TArgs, TResult>;
}

export interface PerformanceMetric {
  name: string;
  duration: number;
  entryType: string;
  detail?: Record<string, unknown>;
  timestamp: number;
}

export interface PerformanceSample {
  id: string;
  label: string;
  metrics: PerformanceMetric[];
  startedAt: number;
  completedAt?: number;
}

export interface AutomationActionContext {
  element?: HTMLElement | null;
  instrumentation: InstrumentationGateway;
}

export type AutomationAction = (
  context: AutomationActionContext,
  ...args: unknown[]
) => Promise<unknown> | unknown;

export interface AutomationTarget {
  id: string;
  description?: string;
  element?: HTMLElement | null;
  actions: Record<string, AutomationAction>;
  metadata?: Record<string, unknown>;
}

export interface AutomationSnapshot {
  timestamp: number;
  targets: AutomationTarget[];
}

export interface InstrumentationGateway {
  emit: (event: InstrumentationEvent) => void;
  log: (severity: LogSeverity, message: string, detail?: Record<string, unknown>) => void;
  getEnvironment: () => TestEnvironmentConfig;
}
