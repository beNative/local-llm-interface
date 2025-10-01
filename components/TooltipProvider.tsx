
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
            // 1. Get the current zoom factor from the root element. Fallback to 1 if not set.
            // FIX: Cast style to `any` to access the non-standard `zoom` property and prevent a TypeScript error.
            const zoomFactor = parseFloat((document.documentElement.style as any).zoom || '1');
            
            const tooltipNode = tooltipRef.current;
            const offset = 10; // The desired offset in layout pixels.

            // The tooltip's own dimensions must also be un-scaled to be used in layout pixel calculations.
            const { width: scaledTooltipWidth, height: scaledTooltipHeight } = tooltipNode.getBoundingClientRect();
            const tooltipWidth = scaledTooltipWidth / zoomFactor;
            const tooltipHeight = scaledTooltipHeight / zoomFactor;

            // 2. Un-scale the targetRect coordinates to get layout coordinates.
            const layoutRect = {
                top: tooltipState.targetRect.top / zoomFactor,
                left: tooltipState.targetRect.left / zoomFactor,
                bottom: tooltipState.targetRect.bottom / zoomFactor,
                width: tooltipState.targetRect.width / zoomFactor,
                height: tooltipState.targetRect.height / zoomFactor,
            };

            // 3. Get the layout viewport dimensions.
            const layoutViewportWidth = window.innerWidth / zoomFactor;
            const layoutViewportHeight = window.innerHeight / zoomFactor;
            
            // 4. Calculate position using layout coordinates.
            // Default position: above, centered
            let top = layoutRect.top - tooltipHeight - offset;
            let left = layoutRect.left + (layoutRect.width / 2) - (tooltipWidth / 2);

            // Adjust if clipped at the top
            if (top < offset) {
                top = layoutRect.bottom + offset;
            }

            // Adjust if it would now be clipped at the bottom
            if (top + tooltipHeight > layoutViewportHeight - offset) {
                top = layoutViewportHeight - tooltipHeight - offset;
            }

            // Adjust if clipped on the left
            if (left < offset) {
                left = offset;
            }

            // Adjust if clipped on the right
            if (left + tooltipWidth > layoutViewportWidth - offset) {
                left = layoutViewportWidth - tooltipWidth - offset;
            }

            setPosition({ top, left });
        } else if (!tooltipState.visible) {
            setPosition({ top: -9999, left: -9999 });
        }
    }, [tooltipState]);

    const visibilityClass =
        tooltipState.visible && position.top > -9999
            ? 'opacity-100 translate-y-0 scale-100'
            : 'opacity-0 translate-y-1 scale-95';

    return (
        <div
            ref={tooltipRef}
            className={`fixed z-[100] max-w-xs px-3 py-2 text-sm font-medium text-white bg-slate-950/95 dark:bg-slate-900/95 border border-white/10 dark:border-white/5 rounded-lg shadow-2xl backdrop-blur-md transform-gpu transition-all duration-200 ease-out ${visibilityClass}`}
            style={{
                top: `${position.top}px`,
                left: `${position.left}px`,
                pointerEvents: 'none',
            }}
            role="tooltip"
        >
            <span className="block text-left leading-snug tracking-wide">{tooltipState.content}</span>
        </div>
    );
};

// The Provider that wraps the app
export const TooltipProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tooltipState, setTooltipState] = useState<TooltipState>(initialTooltipState);
  const hideTimeoutRef = useRef<number | undefined>();

  const show = useCallback((content: React.ReactNode, rect: DOMRect) => {
    if(hideTimeoutRef.current) {
        window.clearTimeout(hideTimeoutRef.current);
    }
    setTooltipState({ visible: true, content, targetRect: rect });
  }, []);

  const hide = useCallback(() => {
    hideTimeoutRef.current = window.setTimeout(() => {
      // Hide the tooltip by resetting its state.
      setTooltipState(initialTooltipState);
    }, 100);
  }, []);

  // Clean up any pending timeout when the provider unmounts.
  useEffect(() => {
      return () => {
        if (hideTimeoutRef.current) {
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
