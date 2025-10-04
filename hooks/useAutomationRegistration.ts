import { useEffect, useRef } from 'react';
import { useInstrumentation } from './useInstrumentation';
import type { AutomationTarget } from '../services/instrumentation/types';

export const useAutomationRegistration = (target: AutomationTarget | null) => {
  const { automation } = useInstrumentation();
  const previousIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!automation || !target) {
      if (previousIdRef.current && automation) {
        automation.unregister(previousIdRef.current);
        previousIdRef.current = null;
      }
      return;
    }

    if (previousIdRef.current && previousIdRef.current !== target.id) {
      automation.unregister(previousIdRef.current);
    }

    previousIdRef.current = target.id;
    automation.register(target);

    return () => {
      if (previousIdRef.current) {
        automation.unregister(previousIdRef.current);
        previousIdRef.current = null;
      }
    };
  }, [automation, target]);
};
