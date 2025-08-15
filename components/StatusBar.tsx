import React from 'react';
import RamIcon from './icons/RamIcon';
import CpuIcon from './icons/CpuIcon';

interface StatusBarProps {
    stats: {
        cpu: number;
        memory: {
            used: number;
            total: number;
        };
    } | null;
}

const formatBytes = (bytes: number, decimals = 1) => {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};


const StatusBar: React.FC<StatusBarProps> = ({ stats }) => {
    if (!stats) {
        return (
            <footer className="flex items-center justify-end gap-6 px-4 py-1 bg-[--bg-primary] border-t border-[--border-primary] text-xs text-[--text-muted] font-mono">
                <div className="flex items-center gap-2" title="Application RAM Usage">
                    <RamIcon className="w-4 h-4" />
                    <span>-- MB / -- GB</span>
                </div>
                <div className="flex items-center gap-2" title="Application CPU Usage">
                    <CpuIcon className="w-4 h-4" />
                    <span>--%</span>
                </div>
            </footer>
        );
    }

    const memUsagePercent = stats.memory.total > 0 ? (stats.memory.used / stats.memory.total) * 100 : 0;
    const cpuUsagePercent = stats.cpu;

    return (
        <footer className="flex items-center justify-end gap-6 px-4 py-1 bg-[--bg-primary] border-t border-[--border-primary] text-xs text-[--text-muted] font-mono flex-shrink-0">
            <div className="flex items-center gap-2" title="Application RAM Usage (vs. System Total)">
                <RamIcon className="w-4 h-4" />
                <div className="w-20 h-2 bg-[--bg-tertiary] rounded-full overflow-hidden">
                    <div className="h-full bg-[--accent-info]" style={{ width: `${memUsagePercent}%` }}></div>
                </div>
                <span>{formatBytes(stats.memory.used)} / {formatBytes(stats.memory.total)}</span>
            </div>
            <div className="flex items-center gap-2" title="Application CPU Usage">
                <CpuIcon className="w-4 h-4" />
                <div className="w-20 h-2 bg-[--bg-tertiary] rounded-full overflow-hidden">
                    <div className="h-full bg-[--accent-projects]" style={{ width: `${cpuUsagePercent}%` }}></div>
                </div>
                <span>{cpuUsagePercent.toFixed(0)}%</span>
            </div>
        </footer>
    );
};

export default StatusBar;