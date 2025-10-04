import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { instrumentation } from '../services/instrumentation/InstrumentationManager';
import { resolveInstrumentationConfig } from '../services/instrumentation/config';
import type { InstrumentationConfig, InstrumentationEvent } from '../services/instrumentation/types';

interface InstrumentationContextValue {
  config: InstrumentationConfig;
  emit: typeof instrumentation.emit;
  subscribe: (callback: (event: InstrumentationEvent) => void) => () => void;
}

const InstrumentationContext = createContext<InstrumentationContextValue | undefined>(undefined);

export const InstrumentationProvider: React.FC<{ children: React.ReactNode; configOverride?: Partial<InstrumentationConfig> }>
= ({ children, configOverride }) => {
  const [config, setConfig] = useState<InstrumentationConfig>(instrumentation.getConfig());
  const subscribersRef = useRef(new Set<(event: InstrumentationEvent) => void>());

  useEffect(() => {
    const resolved = resolveInstrumentationConfig(configOverride);
    instrumentation.initialize(resolved);
    setConfig(instrumentation.getConfig());
  }, [configOverride]);

  useEffect(() => {
    const handler = (event: InstrumentationEvent) => {
      subscribersRef.current.forEach(cb => {
        try {
          cb(event);
        } catch (error) {
          instrumentation.log('error', 'Instrumentation subscriber error', {
            message: error instanceof Error ? error.message : String(error),
          });
        }
      });
    };
    instrumentation.onEvent(handler);
    return () => instrumentation.offEvent(handler);
  }, []);

  const value = useMemo<InstrumentationContextValue>(() => ({
    config,
    emit: instrumentation.emit,
    subscribe: callback => {
      subscribersRef.current.add(callback);
      return () => subscribersRef.current.delete(callback);
    },
  }), [config]);

  return <InstrumentationContext.Provider value={value}>{children}</InstrumentationContext.Provider>;
};

export const useInstrumentationContext = () => {
  const context = useContext(InstrumentationContext);
  if (!context) {
    throw new Error('useInstrumentationContext must be used within an InstrumentationProvider');
  }
  return context;
};
