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

const StatusBar: React.FC<StatusBarProps> = ({ stats }) => {
    if (!stats) {
        return (
            <footer className="flex items-center justify-end gap-6 px-4 py-1 bg-[--bg-primary] border-t border-[--border-primary] text-xs text-[--text-muted] font-mono">
                <div className="flex items-center gap-2" title="RAM Usage">
                    <RamIcon className="w-4 h-4" />
                    <span>--/-- GB</span>
                </div>
                <div className="flex items-center gap-2" title="CPU Usage">
                    <CpuIcon className="w-4 h-4" />
                    <span>--%</span>
                </div>
            </footer>
        );
    }

    const usedMemGb = (stats.memory.used / (1024 ** 3)).toFixed(1);
    const totalMemGb = (stats.memory.total / (1024 ** 3)).toFixed(1);
    const memUsagePercent = (stats.memory.used / stats.memory.total) * 100;
    const cpuUsagePercent = stats.cpu;

    return (
        <footer className="flex items-center justify-end gap-6 px-4 py-1 bg-[--bg-primary] border-t border-[--border-primary] text-xs text-[--text-muted] font-mono flex-shrink-0">
            <div className="flex items-center gap-2" title="RAM Usage">
                <RamIcon className="w-4 h-4" />
                <div className="w-20 h-2 bg-[--bg-tertiary] rounded-full overflow-hidden">
                    <div className="h-full bg-[--accent-info]" style={{ width: `${memUsagePercent}%` }}></div>
                </div>
                <span>{usedMemGb}/{totalMemGb} GB</span>
            </div>
            <div className="flex items-center gap-2" title="CPU Usage">
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
