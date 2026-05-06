import { useEffect, useState } from 'react';
import type { SystemStats } from '../types';

/**
 * Subscribes to system-level CPU, RAM, GPU, and VRAM statistics
 * pushed from the Electron main process via IPC.
 */
export function useSystemStats(isElectron: boolean): SystemStats | null {
    const [systemStats, setSystemStats] = useState<SystemStats | null>(null);

    useEffect(() => {
        if (!isElectron || !window.electronAPI) return;

        const statsHandler = (stats: SystemStats) => setSystemStats(stats);
        window.electronAPI.onSystemStatsUpdate(statsHandler);

        return () => {
            window.electronAPI?.removeSystemStatsUpdateListener();
        };
    }, [isElectron]);

    return systemStats;
}
