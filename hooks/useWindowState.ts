import { useEffect, useState } from 'react';

/**
 * Tracks the Electron window's maximized/unmaximized state
 * by listening to IPC events from the main process.
 */
export function useWindowState(isElectron: boolean): boolean {
    const [isMaximized, setIsMaximized] = useState(false);

    useEffect(() => {
        if (!isElectron || !window.electronAPI) return;

        const handler = (maximized: boolean) => setIsMaximized(maximized);
        window.electronAPI.onWindowStateChange(handler);

        return () => {
            window.electronAPI?.removeWindowStateChangeListener();
        };
    }, [isElectron]);

    return isMaximized;
}
