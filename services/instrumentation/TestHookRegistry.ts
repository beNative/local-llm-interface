import { HookExecutionContext, InstrumentationEvent, RegisteredHook, TestEnvironmentConfig } from './types';

const generateId = () => `hook_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;

export class TestHookRegistry {
  private hooks: Map<string, RegisteredHook> = new Map();
  private environment: TestEnvironmentConfig;
  private emitEvent: (event: InstrumentationEvent) => void;

  constructor(environment: TestEnvironmentConfig, emitEvent: (event: InstrumentationEvent) => void) {
    this.environment = environment;
    this.emitEvent = emitEvent;
  }

  public register<TArgs = unknown, TResult = void>(hook: Omit<RegisteredHook<TArgs, TResult>, 'id'> & { id?: string }): string {
    const id = hook.id ?? generateId();
    this.hooks.set(id, { ...hook, id });
    this.emitEvent({
      id: `hook-registered-${id}`,
      timestamp: Date.now(),
      category: 'hook:registry',
      payload: { id, description: hook.description },
      severity: 'debug',
    });
    return id;
  }

  public unregister(id: string): boolean {
    const removed = this.hooks.delete(id);
    if (removed) {
      this.emitEvent({
        id: `hook-unregistered-${id}`,
        timestamp: Date.now(),
        category: 'hook:registry',
        payload: { id },
        severity: 'debug',
      });
    }
    return removed;
  }

  public async invoke<TArgs = unknown, TResult = void>(id: string, args: TArgs): Promise<TResult | undefined> {
    const hook = this.hooks.get(id) as RegisteredHook<TArgs, TResult> | undefined;
    if (!hook) {
      this.emitEvent({
        id: `hook-missing-${id}`,
        timestamp: Date.now(),
        category: 'hook:error',
        payload: { id },
        severity: 'warn',
      });
      return undefined;
    }

    const context: HookExecutionContext<TArgs> = {
      args,
      environment: this.environment,
      emit: this.emitEvent,
    };

    try {
      this.emitEvent({
        id: `hook-start-${id}`,
        timestamp: Date.now(),
        category: 'hook:execution',
        payload: { id, args },
        severity: 'info',
      });
      const result = await hook.handler(context);
      this.emitEvent({
        id: `hook-complete-${id}`,
        timestamp: Date.now(),
        category: 'hook:execution',
        payload: { id, args },
        severity: 'info',
      });
      return result;
    } catch (error) {
      this.emitEvent({
        id: `hook-error-${id}`,
        timestamp: Date.now(),
        category: 'hook:error',
        payload: {
          id,
          args,
          error: error instanceof Error ? { message: error.message, stack: error.stack } : String(error),
        },
        severity: 'error',
      });
      throw error;
    }
  }

  public list(): RegisteredHook[] {
    return [...this.hooks.values()];
  }
}
