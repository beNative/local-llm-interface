import { InstrumentationManager } from '../services/instrumentation/InstrumentationManager';
import type { AutomationTarget, LogSeverity, PerformanceMetric } from '../services/instrumentation/types';

const manager = InstrumentationManager.getInstance();

manager.onEvent(event => {
  const { id, category, severity = 'info', payload } = event;
  const serializedPayload = payload ? JSON.stringify(payload, null, 2) : undefined;
  const message = [`[event]`, severity.toUpperCase(), category, `(${id})`].join(' ');
  if (serializedPayload) {
    // eslint-disable-next-line no-console
    console.log(`${message}\n${serializedPayload}`);
  } else {
    // eslint-disable-next-line no-console
    console.log(message);
  }
});

const initialize = () => {
  manager.initialize({
    logging: { level: 'debug', console: false, prefix: 'demo' },
    environment: {
      name: 'ci-demo',
      variables: {
        DATASET: 'smoke',
        RUN_ID: `demo-${Date.now()}`,
      },
    },
    performance: { enabled: true, sampleRate: 1 },
    hooks: { enabled: true },
    automation: { enabled: true, exposeWindowAPI: false },
  });

  const environment = manager.getEnvironment();
  manager.log('info', 'Initialized instrumentation demo environment', environment.variables);
};

const demonstrateLogging = () => {
  const severities: LogSeverity[] = ['trace', 'debug', 'info', 'warn', 'error'];
  severities.forEach(severity => {
    manager.log(severity, 'Log emitted from demonstration block', {
      severity,
      timestamp: new Date().toISOString(),
    });
  });
};

const demonstrateHooks = async () => {
  const registry = manager.getHookRegistry();
  if (!registry) {
    throw new Error('Hook registry was not initialized');
  }

  const hookId = registry.register({
    description: 'Validates that generated content matches expectations',
    async handler(context) {
      context.emit({
        id: 'hook-custom-log',
        timestamp: Date.now(),
        category: 'hook:custom-log',
        payload: { message: 'Custom telemetry emitted from hook handler' },
        severity: 'info',
      });

      const { prompt, expectedSubstring } = context.args as {
        prompt: string;
        expectedSubstring: string;
      };

      if (!prompt.includes(expectedSubstring)) {
        throw new Error(`Prompt did not include expected substring: ${expectedSubstring}`);
      }

      return {
        promptLength: prompt.length,
        expectedSubstring,
      };
    },
  });

  try {
    const result = await registry.invoke(hookId, {
      prompt: 'Summarize instrumentation coverage for the demo environment',
      expectedSubstring: 'instrumentation',
    });

    manager.log('info', 'Hook invocation completed successfully', result as Record<string, unknown>);

    await registry.invoke(hookId, {
      prompt: 'This string will trigger an error path',
      expectedSubstring: 'missing-token',
    });
  } catch (error) {
    manager.log('warn', 'Hook invocation raised an expected error', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

const demonstrateAutomation = async () => {
  const bridge = manager.getAutomationBridge();
  if (!bridge) {
    throw new Error('Automation bridge was not initialized');
  }

  const automationTarget: AutomationTarget = {
    id: 'nav-chat',
    description: 'Simulated navigation button for the Chat view',
    metadata: { view: 'chat', index: 0 },
    actions: {
      async click() {
        manager.log('info', 'Automation performed navigation click', { target: 'chat' });
        return true;
      },
      async isActive() {
        return true;
      },
    },
  };

  bridge.register(automationTarget);
  await bridge.perform(automationTarget.id, 'click');

  try {
    await bridge.perform(automationTarget.id, 'focus');
  } catch (error) {
    manager.log('warn', 'Automation action failed as expected', {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const snapshot = bridge.snapshot();
  manager.log('debug', 'Automation snapshot', snapshot as unknown as Record<string, unknown>);
};

const demonstratePerformance = async () => {
  const monitor = manager.getPerformanceMonitor();
  if (!monitor) {
    throw new Error('Performance monitor was not initialized');
  }

  const sampleId = monitor.startSample('model-load');
  await new Promise(resolve => setTimeout(resolve, 50));
  const metric: PerformanceMetric = {
    name: 'initial-response',
    duration: 42,
    entryType: 'custom',
    detail: { tokensPerSecond: 12.4 },
    timestamp: Date.now(),
  };
  monitor.recordMetric(sampleId, metric);
  monitor.finishSample(sampleId, { status: 'success' });
};

const runDemo = async () => {
  initialize();
  demonstrateLogging();
  await demonstrateHooks();
  await demonstrateAutomation();
  await demonstratePerformance();
  manager.log('info', 'Instrumentation demo completed');
};

runDemo().catch(error => {
  manager.log('error', 'Instrumentation demo failed', {
    error: error instanceof Error ? { message: error.message, stack: error.stack } : String(error),
  });
  process.exitCode = 1;
});
