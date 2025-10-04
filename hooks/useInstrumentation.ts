import { useEffect, useMemo } from 'react';
import { useInstrumentationContext } from '../components/InstrumentationProvider';
import { instrumentation } from '../services/instrumentation/InstrumentationManager';
import type { InstrumentationEvent, LogSeverity } from '../services/instrumentation/types';

export const useInstrumentation = () => {
  const { emit, subscribe, config } = useInstrumentationContext();

  return useMemo(() => ({
    config,
    emit,
    subscribe,
    log: (severity: LogSeverity, message: string, detail?: Record<string, unknown>) => {
      instrumentation.log(severity, message, detail);
    },
    performance: instrumentation.getPerformanceMonitor(),
    hooks: instrumentation.getHookRegistry(),
    automation: instrumentation.getAutomationBridge(),
  }), [config, emit, subscribe]);
};

export const useInstrumentationEvents = (callback: (event: InstrumentationEvent) => void) => {
  const { subscribe } = useInstrumentationContext();
  useEffect(() => subscribe(callback), [callback, subscribe]);
};
