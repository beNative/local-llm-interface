import { useEffect, useRef } from 'react';
import { useToast } from './useToast';

/**
 * Manages all auto-update IPC listeners for the Electron app.
 * Displays toast notifications for update availability, download progress,
 * completion, and errors.
 */
export function useAppUpdater(isElectron: boolean): void {
    const { addToast, updateToast } = useToast();
    const progressToastIdRef = useRef<string | null>(null);

    useEffect(() => {
        if (!isElectron || !window.electronAPI) return;

        const handleUpdateAvailable = (info: any) => {
            addToast({ type: 'info', message: `New version ${info.version} found. Downloading...` });
        };
        const handleDownloadProgress = (progress: { percent: number; bytesPerSecond: number; transferred: number; total: number }) => {
            const speedMB = (progress.bytesPerSecond / 1048576).toFixed(1);
            const message = `Downloading update... ${progress.percent}% (${speedMB} MB/s)`;

            if (progressToastIdRef.current) {
                updateToast(progressToastIdRef.current, { message });
            } else {
                const id = `update-progress-${Date.now()}`;
                progressToastIdRef.current = id;
                addToast({ id, type: 'info', message, duration: 120000 });
            }
        };
        const handleUpdateDownloaded = (info: any) => {
            // Remove the progress toast
            if (progressToastIdRef.current) {
                updateToast(progressToastIdRef.current, { message: 'Download complete!', duration: 1 });
                progressToastIdRef.current = null;
            }
            addToast({
                type: 'success',
                message: `Update ${info.version} is ready to install.`,
                action: {
                    label: 'Restart & Install',
                    onClick: () => window.electronAPI!.quitAndInstallUpdate(),
                },
            });
        };
        const handleUpdateError = (error: Error) => {
            if (progressToastIdRef.current) {
                progressToastIdRef.current = null;
            }
            addToast({ type: 'error', message: `Update failed: ${error.message}` });
        };
        const handleUpdateNotAvailable = () => {
            addToast({ type: 'success', message: 'You are on the latest version.', duration: 3000 });
        };

        window.electronAPI.onUpdateAvailable(handleUpdateAvailable);
        window.electronAPI.onUpdateDownloadProgress(handleDownloadProgress);
        window.electronAPI.onUpdateDownloaded(handleUpdateDownloaded);
        window.electronAPI.onUpdateError(handleUpdateError);
        window.electronAPI.onUpdateNotAvailable(handleUpdateNotAvailable);

        return () => {
            window.electronAPI!.removeUpdateAvailableListener();
            window.electronAPI!.removeUpdateDownloadProgressListener();
            window.electronAPI!.removeUpdateDownloadedListener();
            window.electronAPI!.removeUpdateErrorListener();
            window.electronAPI!.removeUpdateNotAvailableListener();
        };
    }, [isElectron, addToast, updateToast]);
}
