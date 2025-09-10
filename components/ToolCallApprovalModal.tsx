import React, { useState, useMemo } from 'react';
import type { ToolCall } from '../types';
import Icon from './Icon';

interface ToolCallApprovalModalProps {
    toolCalls: ToolCall[];
    onFinalize: (approvedCalls: ToolCall[]) => void;
    onClose: () => void;
}

const isDangerous = (toolName: string) => ['writeFile', 'runTerminalCommand', 'executePython'].includes(toolName);

const ToolCallApprovalModal: React.FC<ToolCallApprovalModalProps> = ({ toolCalls, onFinalize, onClose }) => {
    const [callStates, setCallStates] = useState<Record<string, boolean>>(() =>
        toolCalls.reduce((acc, call) => {
            acc[call.id] = !isDangerous(call.function.name); // Auto-approve safe calls
            return acc;
        }, {} as Record<string, boolean>)
    );

    const handleToggle = (callId: string) => {
        setCallStates(prev => ({ ...prev, [callId]: !prev[callId] }));
    };

    const handleFinalize = () => {
        const finalizedCalls = toolCalls.map(call => ({
            ...call,
            approved: callStates[call.id],
        }));
        onFinalize(finalizedCalls);
    };

    const allApproved = useMemo(() => Object.values(callStates).every(Boolean), [callStates]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[--bg-backdrop] backdrop-blur-sm">
            <div className="bg-[--bg-secondary] rounded-lg shadow-xl w-full max-w-2xl" onClick={e => e.stopPropagation()}>
                <header className="p-4 border-b border-[--border-primary] flex-shrink-0 flex justify-between items-center">
                    <h2 className="text-lg font-bold text-[--text-primary] flex items-center gap-2">
                       <Icon name="hammer" className="w-5 h-5 text-[--accent-chat]" /> Approval Required
                    </h2>
                    <button onClick={onClose} className="p-2 rounded-full text-[--text-muted] hover:bg-[--bg-hover] leading-none text-2xl">&times;</button>
                </header>
                <main className="p-4 max-h-[60vh] overflow-y-auto space-y-3">
                    <p className="text-sm text-[--text-muted] mb-4">The AI wants to perform the following actions. Please review and approve each one. Unapproved actions will not run.</p>
                    {toolCalls.map(call => {
                        const dangerous = isDangerous(call.function.name);
                        const isApproved = callStates[call.id];
                        return (
                            <div key={call.id} className={`p-3 rounded-lg border ${isApproved ? 'bg-green-500/10 border-green-500/30' : 'bg-gray-500/10 border-[--border-secondary]'}`}>
                                <div className="flex items-start justify-between">
                                    <div className="flex-grow">
                                        <div className="flex items-center gap-2 font-semibold text-[--text-secondary]">
                                            <Icon name={dangerous ? 'terminal' : 'fileCode'} className={`w-4 h-4 ${dangerous ? 'text-yellow-500' : 'text-blue-500'}`} />
                                            <span>{call.function.name}</span>
                                        </div>
                                        <pre className="mt-1 text-xs font-mono bg-[--bg-primary] p-2 rounded-md whitespace-pre-wrap break-all">{JSON.stringify(JSON.parse(call.function.arguments), null, 2)}</pre>
                                    </div>
                                    <div className="flex flex-col items-center ml-4">
                                        {dangerous ? (
                                            <>
                                                <label className="relative inline-flex items-center cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={isApproved}
                                                        onChange={() => handleToggle(call.id)}
                                                        className="sr-only peer"
                                                    />
                                                    <div className="w-11 h-6 bg-[--bg-tertiary] rounded-full peer peer-checked:bg-green-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-green-300 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
                                                </label>
                                                <span className={`text-xs font-semibold mt-1 ${isApproved ? 'text-green-600' : 'text-[--text-muted]'}`}>
                                                    {isApproved ? 'Approved' : 'Pending'}
                                                </span>
                                            </>
                                        ) : (
                                             <div className="flex flex-col items-center text-green-600">
                                                <Icon name="check" className="w-6 h-6"/>
                                                <span className="text-xs font-semibold mt-1">Auto-Approved</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </main>
                <footer className="p-3 border-t border-[--border-primary] flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-[--text-secondary] bg-[--bg-tertiary] rounded-md hover:bg-[--bg-hover]">Cancel</button>
                    <button onClick={handleFinalize} className={`px-5 py-2 text-sm font-medium text-white rounded-md ${allApproved ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
                        {allApproved ? 'Approve & Continue' : 'Run Approved'}
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default ToolCallApprovalModal;