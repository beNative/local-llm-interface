import React, { useCallback } from 'react';
import { useTooltip } from '../components/TooltipProvider';

interface TooltipTriggerProps {
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) => void;
    onMouseLeave: () => void;
    onFocus: (e: React.FocusEvent<HTMLElement>) => void;
    onBlur: () => void;
    'aria-label'?: string;
}

export const useTooltipTrigger = (content: React.ReactNode): Partial<TooltipTriggerProps> => {
    const { show, hide } = useTooltip();

    const onMouseEnter = useCallback((e: React.MouseEvent<HTMLElement>) => {
        if (content) {
            show(content, e.currentTarget.getBoundingClientRect());
        }
    }, [show, content]);

    const onMouseLeave = useCallback(() => {
        hide();
    }, [hide]);

    const onFocus = useCallback((e: React.FocusEvent<HTMLElement>) => {
        if (content) {
            show(content, e.currentTarget.getBoundingClientRect());
        }
    }, [show, content]);

    const onBlur = useCallback(() => {
        hide();
    }, [hide]);

    if (!content) {
        return {};
    }

    // Provide an aria-label for accessibility if the content is a simple string.
    const ariaLabel = typeof content === 'string' ? content : undefined;

    return {
        onMouseEnter,
        onMouseLeave,
        onFocus,
        onBlur,
        'aria-label': ariaLabel,
    };
};
