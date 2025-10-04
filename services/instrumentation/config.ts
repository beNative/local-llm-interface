import { InstrumentationConfig } from './types';

declare global {
  interface Window {
    __LLM_TEST_CONFIG__?: Partial<InstrumentationConfig>;
  }
}

const readEnvConfig = (): Partial<InstrumentationConfig> | undefined => {
  if (typeof window === 'undefined') {
    return undefined;
  }

  const env = window.__LLM_TEST_CONFIG__;
  if (env) {
    return env;
  }

  try {
    const stored = localStorage.getItem('llm-instrumentation-config');
    if (stored) {
      return JSON.parse(stored) as Partial<InstrumentationConfig>;
    }
  } catch (error) {
    console.warn('[Instrumentation] Unable to read stored configuration', error);
  }

  return undefined;
};

export const resolveInstrumentationConfig = (override?: Partial<InstrumentationConfig>): Partial<InstrumentationConfig> | undefined => {
  const envConfig = readEnvConfig();
  if (!envConfig && !override) {
    return undefined;
  }
  return {
    ...(envConfig ?? {}),
    ...(override ?? {}),
  };
};

export const persistInstrumentationConfig = (config: Partial<InstrumentationConfig>) => {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    localStorage.setItem('llm-instrumentation-config', JSON.stringify(config));
  } catch (error) {
    console.warn('[Instrumentation] Unable to persist configuration', error);
  }
};
