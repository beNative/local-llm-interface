import { useEffect, RefObject } from 'react';

/**
 * Hook that calls `onClose` when a mousedown event occurs outside the
 * referenced element(s). Supports one or more refs to account for
 * trigger + popover patterns.
 *
 * @param refs     A single ref or array of refs that define the "inside" area.
 * @param onClose  Callback invoked when a click lands outside all refs.
 * @param enabled  Optional flag to temporarily disable the listener.
 */
export function useClickOutside(
    refs: RefObject<HTMLElement | null> | RefObject<HTMLElement | null>[],
    onClose: () => void,
    enabled: boolean = true,
) {
    useEffect(() => {
        if (!enabled) return;

        const refArray = Array.isArray(refs) ? refs : [refs];

        const handleMouseDown = (event: MouseEvent) => {
            const target = event.target as Node;
            const isInside = refArray.some(
                ref => ref.current && ref.current.contains(target),
            );
            if (!isInside) {
                onClose();
            }
        };

        document.addEventListener('mousedown', handleMouseDown);
        return () => {
            document.removeEventListener('mousedown', handleMouseDown);
        };
    }, [refs, onClose, enabled]);
}
