import React, { useEffect, useId, useRef } from 'react';

const focusableModalSelectors =
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([type="hidden"]):not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

const sizeClasses: Record<'sm' | 'md' | 'lg' | 'xl', string> = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-3xl',
    xl: 'max-w-4xl',
};

interface ModalContainerProps {
    onClose: () => void;
    children: React.ReactNode;
    title?: React.ReactNode;
    titleId?: string;
    descriptionId?: string;
    footer?: React.ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    panelClassName?: string;
    bodyClassName?: string;
    headerClassName?: string;
    showCloseButton?: boolean;
    closeButtonAriaLabel?: string;
    role?: 'dialog' | 'alertdialog';
}

const ModalContainer: React.FC<ModalContainerProps> = ({
    onClose,
    children,
    title,
    titleId,
    descriptionId,
    footer,
    size = 'md',
    panelClassName = '',
    bodyClassName = '',
    headerClassName = '',
    showCloseButton = true,
    closeButtonAriaLabel = 'Close modal',
    role = 'dialog',
}) => {
    const panelRef = useRef<HTMLDivElement | null>(null);
    const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);
    const generatedTitleId = useId();
    const generatedDescriptionId = useId();

    const resolvedTitleId = title ? titleId ?? generatedTitleId : titleId;
    const resolvedDescriptionId = descriptionId ?? generatedDescriptionId;

    useEffect(() => {
        previouslyFocusedElementRef.current = document.activeElement as HTMLElement | null;
        const firstFocusable = panelRef.current?.querySelector<HTMLElement>(focusableModalSelectors);
        (firstFocusable ?? panelRef.current)?.focus({ preventScroll: true });

        return () => {
            const previous = previouslyFocusedElementRef.current;
            if (previous && typeof previous.focus === 'function') {
                previous.focus({ preventScroll: true });
            }
        };
    }, []);

    const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
        if (event.target === event.currentTarget) {
            onClose();
        }
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            onClose();
            return;
        }

        if (event.key !== 'Tab' || !panelRef.current) {
            return;
        }

        const focusable = Array.from(
            panelRef.current.querySelectorAll<HTMLElement>(focusableModalSelectors),
        ).filter(element => !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true');

        if (focusable.length === 0) {
            event.preventDefault();
            panelRef.current.focus({ preventScroll: true });
            return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const activeElement = document.activeElement as HTMLElement | null;

        if (event.shiftKey) {
            if (!activeElement || activeElement === first || !panelRef.current.contains(activeElement)) {
                event.preventDefault();
                last.focus();
            }
            return;
        }

        if (!activeElement || activeElement === last || !panelRef.current.contains(activeElement)) {
            event.preventDefault();
            first.focus();
        }
    };

    const widthClass = sizeClasses[size];

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-[--bg-backdrop] backdrop-blur-sm px-[var(--space-4)]"
            onClick={handleBackdropClick}
            role="presentation"
        >
            <div
                ref={panelRef}
                className={`w-full ${widthClass} max-h-[80vh] bg-[--bg-secondary] rounded-[--border-radius] shadow-xl flex flex-col focus:outline-none ${panelClassName}`.trim()}
                onClick={event => event.stopPropagation()}
                role={role}
                aria-modal="true"
                aria-labelledby={resolvedTitleId}
                aria-describedby={children ? resolvedDescriptionId : undefined}
                tabIndex={-1}
                onKeyDown={handleKeyDown}
            >
                {(title || showCloseButton) && (
                    <header
                        className={`flex items-start justify-between gap-[var(--space-3)] border-b border-[--border-primary] px-[var(--space-6)] py-[var(--space-4)] ${headerClassName}`.trim()}
                    >
                        {title && (
                            <div id={resolvedTitleId} className="min-w-0 text-[length:var(--font-size-lg)] font-semibold text-[--text-primary]">
                                {typeof title === 'string' ? <h2 className="truncate">{title}</h2> : title}
                            </div>
                        )}
                        {showCloseButton && (
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex h-9 w-9 items-center justify-center rounded-full text-[--text-muted] hover:bg-[--bg-hover] focus:outline-none focus-visible:ring-2 focus-visible:ring-[--border-focus]"
                                aria-label={closeButtonAriaLabel}
                            >
                                &times;
                            </button>
                        )}
                    </header>
                )}
                <div
                    id={resolvedDescriptionId}
                    className={`flex-1 overflow-y-auto px-[var(--space-6)] py-[var(--space-4)] ${bodyClassName}`.trim()}
                >
                    {children}
                </div>
                {footer && (
                    <footer className="flex flex-shrink-0 items-center justify-end gap-[var(--space-3)] border-t border-[--border-primary] px-[var(--space-6)] py-[var(--space-4)]">
                        {footer}
                    </footer>
                )}
            </div>
        </div>
    );
};

export default ModalContainer;
