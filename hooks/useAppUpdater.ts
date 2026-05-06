import { useEffect } from 'react';
import { useToast } from './useToast';

/**
 * Manages all auto-update IPC listeners for the Electron app.
 * Displays toast notifications for update availability, download progress,
 * completion, and errors.
 */
export function useAppUpdater(isElectron: boolean): void {
    const { addToast } = useToast();

    useEffect(() => {
        if (!isElectron || !window.electronAPI) return;

        const handleUpdateAvailable = (info: any) => {
            addToast({ type: 'info', message: `New version ${info.version} found.` });
        };
        const handleUpdateDownloading = () => {
            addToast({ type: 'info', message: `Downloading update...`, duration: 10000 });
        };
        const handleUpdateDownloaded = (info: any) => {
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
            addToast({ type: 'error', message: `Update failed: ${error.message}` });
        };
        const handleUpdateNotAvailable = () => {
            addToast({ type: 'success', message: 'You are on the latest version.', duration: 3000 });
        };

        window.electronAPI.onUpdateAvailable(handleUpdateAvailable);
        window.electronAPI.onUpdateDownloading(handleUpdateDownloading);
        window.electronAPI.onUpdateDownloaded(handleUpdateDownloaded);
        window.electronAPI.onUpdateError(handleUpdateError);
        window.electronAPI.onUpdateNotAvailable(handleUpdateNotAvailable);

        return () => {
            window.electronAPI!.removeUpdateAvailableListener();
            window.electronAPI!.removeUpdateDownloadingListener();
            window.electronAPI!.removeUpdateDownloadedListener();
            window.electronAPI!.removeUpdateErrorListener();
            window.electronAPI!.removeUpdateNotAvailableListener();
        };
    }, [isElectron, addToast]);
}
