import { AutomationSnapshot, AutomationTarget, InstrumentationEvent, InstrumentationGateway } from './types';

type TargetMap = Map<string, AutomationTarget>;

export class UIAutomationBridge {
  private targets: TargetMap = new Map();
  private emitEvent: (event: InstrumentationEvent) => void;
  private gateway: InstrumentationGateway;
  private exposeWindowAPI: boolean;

  constructor(options: { emitEvent: (event: InstrumentationEvent) => void; gateway: InstrumentationGateway; exposeWindowAPI?: boolean }) {
    this.emitEvent = options.emitEvent;
    this.gateway = options.gateway;
    this.exposeWindowAPI = options.exposeWindowAPI ?? true;

    if (this.exposeWindowAPI && typeof window !== 'undefined') {
      (window as typeof window & { __LLM_UI_AUTOMATION__?: UIAutomationBridge }).__LLM_UI_AUTOMATION__ = this;
    }
  }

  public register(target: AutomationTarget) {
    this.targets.set(target.id, target);
    this.emitEvent({
      id: `automation-register-${target.id}`,
      timestamp: Date.now(),
      category: 'automation:registry',
      payload: { id: target.id, description: target.description },
      severity: 'info',
    });
  }

  public unregister(id: string) {
    if (this.targets.delete(id)) {
      this.emitEvent({
        id: `automation-unregister-${id}`,
        timestamp: Date.now(),
        category: 'automation:registry',
        payload: { id },
        severity: 'debug',
      });
    }
  }

  public async perform(id: string, action: string, ...args: unknown[]): Promise<unknown> {
    const target = this.targets.get(id);
    if (!target) {
      this.emitEvent({
        id: `automation-missing-${id}`,
        timestamp: Date.now(),
        category: 'automation:error',
        payload: { id, action, reason: 'target-not-found' },
        severity: 'error',
      });
      throw new Error(`Automation target "${id}" not found.`);
    }
    const handler = target.actions[action];
    if (!handler) {
      this.emitEvent({
        id: `automation-missing-action-${id}-${action}`,
        timestamp: Date.now(),
        category: 'automation:error',
        payload: { id, action, reason: 'action-not-found' },
        severity: 'error',
      });
      throw new Error(`Automation action "${action}" not found for target "${id}".`);
    }

    this.emitEvent({
      id: `automation-perform-${id}-${action}`,
      timestamp: Date.now(),
      category: 'automation:action',
      payload: { id, action, args },
      severity: 'info',
    });

    const context = {
      element: target.element,
      instrumentation: this.gateway,
    };
    const result = await handler(context, ...args);

    this.emitEvent({
      id: `automation-complete-${id}-${action}`,
      timestamp: Date.now(),
      category: 'automation:action',
      payload: { id, action, args },
      severity: 'debug',
    });

    return result;
  }

  public snapshot(): AutomationSnapshot {
    return {
      timestamp: Date.now(),
      targets: [...this.targets.values()].map(target => ({
        ...target,
        element: undefined, // avoid leaking DOM references in snapshots
      })),
    };
  }

  public listTargets(): string[] {
    return [...this.targets.keys()];
  }

  public clear() {
    this.targets.clear();
  }
}
