import React, { createContext, useState, useContext, useLayoutEffect, useRef, useCallback, useEffect } from 'react';

// State and Context Types
interface TooltipState {
  visible: boolean;
  content: React.ReactNode;
  targetRect: DOMRect | null;
}

interface TooltipContextType {
  show: (content: React.ReactNode, rect: DOMRect) => void;
  hide: () => void;
}

const initialTooltipState: TooltipState = {
  visible: false,
  content: null,
  targetRect: null,
};

// Create Context for consumers
const TooltipContext = createContext<TooltipContextType | undefined>(undefined);

// Hook for consumers to get show/hide functions
export const useTooltip = () => {
    const context = useContext(TooltipContext);
    if (!context) {
        throw new Error('useTooltip must be used within a TooltipProvider');
    }
    return context;
};

// The actual Tooltip component that gets rendered once globally
const TooltipComponent: React.FC<{ tooltipState: TooltipState }> = ({ tooltipState }) => {
    const [position, setPosition] = useState({ top: -9999, left: -9999 });
    const tooltipRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        if (tooltipState.visible && tooltipState.targetRect && tooltipRef.current) {
            const tooltipNode = tooltipRef.current;
            const { innerWidth, innerHeight } = window;
            const offset = 10;

            const { width: tooltipWidth, height: tooltipHeight } = tooltipNode.getBoundingClientRect();
            
            // Default position: above, centered
            let top = tooltipState.targetRect.top - tooltipHeight - offset;
            let left = tooltipState.targetRect.left + (tooltipState.targetRect.width / 2) - (tooltipWidth / 2);

            // Adjust if clipped at the top
            if (top < offset) {
                top = tooltipState.targetRect.bottom + offset;
            }

            // Adjust if it would now be clipped at the bottom
            if (top + tooltipHeight > innerHeight - offset) {
                top = innerHeight - tooltipHeight - offset;
            }

            // Adjust if clipped on the left
            if (left < offset) {
                left = offset;
            }

            // Adjust if clipped on the right
            if (left + tooltipWidth > innerWidth - offset) {
                left = innerWidth - tooltipWidth - offset;
            }

            setPosition({ top, left });
        } else if (!tooltipState.visible) {
            // Reset position when hidden to trigger remeasurement on next show
            setPosition({ top: -9999, left: -9999 });
        }
    }, [tooltipState]);

    return (
        <div
            ref={tooltipRef}
            className={`fixed z-[100] max-w-xs px-3 py-1.5 text-sm font-medium text-white bg-gray-900 rounded-md shadow-lg dark:bg-slate-900/90 dark:border dark:border-slate-700 backdrop-blur-sm transition-opacity duration-200 ${
                tooltipState.visible && position.top > -9999 ? 'opacity-100' : 'opacity-0'
            }`}
            style={{ 
                top: `${position.top}px`, 
                left: `${position.left}px`,
                pointerEvents: 'none',
            }}
            role="tooltip"
        >
            {tooltipState.content}
        </div>
    );
};

// The Provider that wraps the app
export const TooltipProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tooltipState, setTooltipState] = useState<TooltipState>(initialTooltipState);
  // FIX: Explicitly type the timeout ref as a number, which is the return type of `window.setTimeout`.
  const hideTimeoutRef = useRef<number | undefined>();

  const show = useCallback((content: React.ReactNode, rect: DOMRect) => {
    if(hideTimeoutRef.current) {
        // FIX: Use `window.clearTimeout` to match `window.setTimeout` and resolve type ambiguity with Node.js's `clearTimeout`.
        window.clearTimeout(hideTimeoutRef.current);
    }
    setTooltipState({ visible: true, content, targetRect: rect });
  }, []);

  const hide = useCallback(() => {
    // FIX: Explicitly use `window.setTimeout` to resolve type conflicts between DOM and Node.js environments.
    hideTimeoutRef.current = window.setTimeout(() => {
      // Hide the tooltip by resetting its state.
      setTooltipState(initialTooltipState);
    }, 100);
  }, []);

  // Clean up any pending timeout when the provider unmounts.
  useEffect(() => {
      return () => {
        if (hideTimeoutRef.current) {
          // FIX: Use `window.clearTimeout` to ensure the correct timer function is called.
          window.clearTimeout(hideTimeoutRef.current);
        }
      };
  }, []);

  return (
    <TooltipContext.Provider value={{ show, hide }}>
      {children}
      <TooltipComponent tooltipState={tooltipState} />
    </TooltipContext.Provider>
  );
};
