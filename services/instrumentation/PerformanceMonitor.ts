import { InstrumentationEvent, PerformanceMetric, PerformanceSample } from './types';

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export class PerformanceMonitor {
  private samples = new Map<string, PerformanceSample>();
  private emitEvent: (event: InstrumentationEvent) => void;
  private sampleRate: number;
  private enabled: boolean;

  constructor(options: { emitEvent: (event: InstrumentationEvent) => void; sampleRate?: number; enabled?: boolean }) {
    this.emitEvent = options.emitEvent;
    this.sampleRate = options.sampleRate ?? 1;
    this.enabled = options.enabled ?? true;
  }

  public startSample(label: string): string | null {
    if (!this.enabled || Math.random() > this.sampleRate) {
      return null;
    }
    const id = `${label}-${Date.now()}-${Math.round(Math.random() * 10000)}`;
    const sample: PerformanceSample = {
      id,
      label,
      metrics: [],
      startedAt: now(),
    };
    this.samples.set(id, sample);
    this.emitEvent({
      id: `perf-start-${id}`,
      timestamp: Date.now(),
      category: 'performance:start',
      payload: { id, label },
      severity: 'debug',
    });
    return id;
  }

  public finishSample(id: string | null, detail?: Record<string, unknown>) {
    if (!id) return;
    const sample = this.samples.get(id);
    if (!sample) return;
    sample.completedAt = now();
    if (detail) {
      sample.metrics.push({
        name: 'detail',
        duration: 0,
        entryType: 'detail',
        detail,
        timestamp: Date.now(),
      });
    }
    this.emitEvent({
      id: `perf-finish-${id}`,
      timestamp: Date.now(),
      category: 'performance:complete',
      payload: sample,
      severity: 'info',
    });
    this.samples.delete(id);
  }

  public recordMetric(id: string | null, metric: PerformanceMetric) {
    if (!id) return;
    const sample = this.samples.get(id);
    if (!sample) return;
    sample.metrics.push(metric);
    this.emitEvent({
      id: `perf-metric-${id}-${metric.name}`,
      timestamp: Date.now(),
      category: 'performance:metric',
      payload: { sampleId: id, metric },
      severity: 'debug',
    });
  }

  public collectNavigationTiming() {
    if (typeof performance === 'undefined' || !performance.getEntriesByType) return;
    const navigation = performance.getEntriesByType('navigation');
    navigation.forEach(entry => {
      this.emitEvent({
        id: `perf-navigation-${entry.startTime}`,
        timestamp: Date.now(),
        category: 'performance:navigation',
        payload: entry.toJSON ? entry.toJSON() : entry,
        severity: 'info',
      });
    });
  }
}
