import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTooltipTrigger } from '../hooks/useTooltipTrigger';
import { useAutomationRegistration } from '../hooks/useAutomationRegistration';
import type { AutomationTarget } from '../services/instrumentation/types';

type View = 'chat' | 'projects' | 'api' | 'settings' | 'info';

const NavButton: React.FC<{
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  ariaLabel: string;
  view: View;
  title: string;
}> = ({ active, onClick, children, ariaLabel, view, title }) => {
    const accentVar = `var(--accent-${view})`;
    const tooltipProps = useTooltipTrigger(title);
    const nodeRef = useRef<HTMLButtonElement | null>(null);
    const [automationTarget, setAutomationTarget] = useState<AutomationTarget | null>(null);

    const setButtonRef = useCallback(
        (node: HTMLButtonElement | null) => {
            nodeRef.current = node;
            if (!node) {
                setAutomationTarget(null);
                return;
            }

            setAutomationTarget({
                id: `nav-${view}`,
                description: `Navigation button for ${view} view`,
                element: node,
                metadata: { view, active },
                actions: {
                    click: ({ element }) => (element ?? node)?.click(),
                    focus: ({ element }) => (element ?? node)?.focus(),
                    isActive: () => active,
                },
            });
        },
        [view, active],
    );

    useEffect(() => {
        if (!nodeRef.current) {
            return;
        }
        setAutomationTarget({
            id: `nav-${view}`,
            description: `Navigation button for ${view} view`,
            element: nodeRef.current,
            metadata: { view, active },
            actions: {
                click: ({ element }) => (element ?? nodeRef.current)?.click(),
                focus: ({ element }) => (element ?? nodeRef.current)?.focus(),
                isActive: () => active,
            },
        });
    }, [view, active]);

    useAutomationRegistration(automationTarget);
    return (
        <button
            ref={setButtonRef}
            onClick={onClick}
            aria-label={ariaLabel}
            {...tooltipProps}
            data-automation-id={`nav-${view}`}
            className={`relative flex items-center gap-[var(--space-2)] px-[var(--space-4)] py-[var(--space-2)] text-[length:var(--font-size-sm)] font-medium rounded-lg transition-colors duration-200 ${
                active
                    ? `text-[--accent-${view}]`
                    : 'text-[--text-muted] hover:bg-[--bg-hover] hover:text-[--text-primary]'
            }`}
        >
            {children}
            {active && (
                 <span
                    className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/2 h-0.5 rounded-full"
                    style={{ backgroundColor: accentVar }}
                />
            )}
        </button>
    );
};

export default NavButton;
export type { View };
