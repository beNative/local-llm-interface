import { logger } from '../logger';
import { InstrumentationConfig, InstrumentationEvent, InstrumentationGateway, LogSeverity } from './types';
import { PerformanceMonitor } from './PerformanceMonitor';
import { TestHookRegistry } from './TestHookRegistry';
import { UIAutomationBridge } from './UIAutomationBridge';

const DEFAULT_CONFIG: InstrumentationConfig = {
  logging: {
    level: 'info',
    console: false,
  },
  environment: {
    name: 'production',
    variables: {},
  },
  performance: {
    enabled: false,
  },
  hooks: {
    enabled: true,
  },
  automation: {
    enabled: true,
    exposeWindowAPI: true,
  },
};

const severityOrder: Record<LogSeverity, number> = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
};

const resolveConfig = (config?: Partial<InstrumentationConfig>): InstrumentationConfig => {
  if (!config) {
    return DEFAULT_CONFIG;
  }
  return {
    ...DEFAULT_CONFIG,
    ...config,
    logging: {
      ...DEFAULT_CONFIG.logging,
      ...config.logging,
    },
    environment: {
      ...DEFAULT_CONFIG.environment,
      ...config.environment,
      variables: {
        ...DEFAULT_CONFIG.environment.variables,
        ...(config.environment?.variables ?? {}),
      },
    },
    performance: {
      ...DEFAULT_CONFIG.performance,
      ...config.performance,
    },
    hooks: {
      ...DEFAULT_CONFIG.hooks,
      ...config.hooks,
    },
    automation: {
      ...DEFAULT_CONFIG.automation,
      ...config.automation,
    },
  };
};

export class InstrumentationManager implements InstrumentationGateway {
  private static instance: InstrumentationManager;
  private config: InstrumentationConfig = DEFAULT_CONFIG;
  private performanceMonitor?: PerformanceMonitor;
  private testHookRegistry?: TestHookRegistry;
  private automationBridge?: UIAutomationBridge;
  private subscribers: ((event: InstrumentationEvent) => void)[] = [];

  public static getInstance(): InstrumentationManager {
    if (!InstrumentationManager.instance) {
      InstrumentationManager.instance = new InstrumentationManager();
    }
    return InstrumentationManager.instance;
  }

  public initialize(config?: Partial<InstrumentationConfig>) {
    this.config = resolveConfig(config);

    logger.info('[Instrumentation] Initializing manager');
    logger.debug(`[Instrumentation] Configuration: ${JSON.stringify(this.config)}`);

    if (this.config.performance?.enabled) {
      this.performanceMonitor = new PerformanceMonitor({
        emitEvent: this.emit,
        sampleRate: this.config.performance.sampleRate,
        enabled: true,
      });
      this.performanceMonitor.collectNavigationTiming();
    }

    if (this.config.hooks?.enabled) {
      this.testHookRegistry = new TestHookRegistry(this.config.environment, this.emit);
    }

    if (this.config.automation?.enabled) {
      this.automationBridge = new UIAutomationBridge({
        emitEvent: this.emit,
        gateway: this,
        exposeWindowAPI: this.config.automation.exposeWindowAPI,
      });
    }

    this.registerGlobalErrorHandlers();
  }

  public onEvent(callback: (event: InstrumentationEvent) => void) {
    this.subscribers.push(callback);
  }

  public offEvent(callback: (event: InstrumentationEvent) => void) {
    this.subscribers = this.subscribers.filter(cb => cb !== callback);
  }

  public emit = (event: InstrumentationEvent) => {
    const configuredLevel = severityOrder[this.config.logging.level];
    const incomingLevel = severityOrder[event.severity ?? 'info'];
    if (incomingLevel < configuredLevel) {
      return;
    }
    const message = `${event.category}: ${JSON.stringify(event.payload ?? {})}`;
    const prefix = this.config.logging.prefix ? `[${this.config.logging.prefix}] ` : '';
    switch (event.severity) {
      case 'error':
        logger.error(`${prefix}${message}`);
        break;
      case 'warn':
        logger.warn(`${prefix}${message}`);
        break;
      case 'debug':
        logger.debug(`${prefix}${message}`);
        break;
      case 'trace':
        logger.debug(`${prefix}${message}`);
        break;
      case 'info':
      default:
        logger.info(`${prefix}${message}`);
        break;
    }
    if (this.config.logging.console) {
      const consoleMessage = `${prefix}${event.category}`;
      // eslint-disable-next-line no-console
      console.log(consoleMessage, event.payload ?? {});
    }
    this.subscribers.forEach(cb => {
      try {
        cb(event);
      } catch (error) {
        logger.error(`[Instrumentation] Event subscriber failure: ${error instanceof Error ? error.message : String(error)}`);
      }
    });
  };

  public log(severity: LogSeverity, message: string, detail?: Record<string, unknown>) {
    this.emit({
      id: `${severity}-${Date.now()}`,
      timestamp: Date.now(),
      category: 'log',
      payload: { message, detail },
      severity,
    });
  }

  public getPerformanceMonitor() {
    return this.performanceMonitor;
  }

  public getHookRegistry() {
    return this.testHookRegistry;
  }

  public getAutomationBridge() {
    return this.automationBridge;
  }

  public getEnvironment() {
    return this.config.environment;
  }

  public getConfig() {
    return this.config;
  }

  public configure(update: Partial<InstrumentationConfig>) {
    this.initialize({ ...this.config, ...update });
  }

  private registerGlobalErrorHandlers() {
    if (typeof window === 'undefined') return;

    window.addEventListener('error', event => {
      this.emit({
        id: `window-error-${Date.now()}`,
        timestamp: Date.now(),
        category: 'error:window',
        payload: {
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        },
        severity: 'error',
      });
    });

    window.addEventListener('unhandledrejection', event => {
      this.emit({
        id: `promise-rejection-${Date.now()}`,
        timestamp: Date.now(),
        category: 'error:promise',
        payload: {
          reason: event.reason instanceof Error ? {
            message: event.reason.message,
            stack: event.reason.stack,
          } : String(event.reason),
        },
        severity: 'error',
      });
    });
  }
}

export const instrumentation = InstrumentationManager.getInstance();
