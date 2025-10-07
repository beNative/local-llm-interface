import React, { useState, useMemo } from 'react';
import type { ToolCall } from '../types';
import Icon from './Icon';
import ModalContainer from './Modal';

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
        <ModalContainer
            onClose={onClose}
            title={
                <span className="flex items-center gap-[var(--space-2)]">
                    <Icon name="hammer" className="h-5 w-5 text-[--accent-chat]" />
                    Approval Required
                </span>
            }
            titleId="tool-call-approval-title"
            size="md"
            bodyClassName="space-y-[var(--space-3)]"
            footer={
                <>
                    <button
                        onClick={onClose}
                        className="rounded-[--border-radius] bg-[--bg-tertiary] px-[var(--space-4)] py-[var(--space-2)] text-[length:var(--font-size-sm)] font-medium text-[--text-secondary] hover:bg-[--bg-hover]"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleFinalize}
                        className={`rounded-[--border-radius] px-[var(--space-4)] py-[var(--space-2)] text-[length:var(--font-size-sm)] font-medium text-white ${
                            allApproved ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'
                        }`}
                    >
                        {allApproved ? 'Approve & Continue' : 'Run Approved'}
                    </button>
                </>
            }
        >
            <p className="text-[length:var(--font-size-sm)] text-[--text-muted]">
                The AI wants to perform the following actions. Please review and approve each one. Unapproved actions will not run.
            </p>
            <div className="space-y-[var(--space-3)]">
                {toolCalls.map(call => {
                    const dangerous = isDangerous(call.function.name);
                    const isApproved = callStates[call.id];
                    return (
                        <div
                            key={call.id}
                            className={`rounded-[--border-radius] border p-[var(--space-3)] ${
                                isApproved ? 'border-green-500/30 bg-green-500/10' : 'border-[--border-secondary] bg-[--bg-tertiary]'
                            }`}
                        >
                            <div className="flex flex-col gap-[var(--space-3)] sm:flex-row sm:items-start sm:justify-between">
                                <div className="flex-1 space-y-[var(--space-2)]">
                                    <div className="flex items-center gap-[var(--space-2)] font-semibold text-[--text-secondary]">
                                        <Icon
                                            name={dangerous ? 'terminal' : 'fileCode'}
                                            className={`h-4 w-4 ${dangerous ? 'text-yellow-500' : 'text-blue-500'}`}
                                        />
                                        <span>{call.function.name}</span>
                                    </div>
                                    <pre className="whitespace-pre-wrap break-all rounded-[--border-radius] bg-[--bg-primary] p-[var(--space-3)] font-mono text-xs">
                                        {JSON.stringify(JSON.parse(call.function.arguments), null, 2)}
                                    </pre>
                                </div>
                                <div className="flex items-center justify-center gap-[var(--space-2)] sm:flex-col sm:items-center sm:justify-start">
                                    {dangerous ? (
                                        <div className="flex flex-col items-center gap-[var(--space-1)]">
                                            <label className="relative inline-flex cursor-pointer items-center">
                                                <input
                                                    type="checkbox"
                                                    checked={isApproved}
                                                    onChange={() => handleToggle(call.id)}
                                                    className="peer sr-only"
                                                />
                                                <div className="relative h-6 w-11 rounded-full bg-[--bg-tertiary] transition-colors peer-checked:bg-green-600">
                                                    <span className="absolute left-[2px] top-[2px] h-5 w-5 rounded-full bg-white transition-transform peer-checked:translate-x-full" />
                                                </div>
                                            </label>
                                            <span className={`text-xs font-semibold ${isApproved ? 'text-green-600' : 'text-[--text-muted]'}`}>
                                                {isApproved ? 'Approved' : 'Pending'}
                                            </span>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center text-green-600">
                                            <Icon name="check" className="h-6 w-6" />
                                            <span className="text-xs font-semibold">Auto-Approved</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </ModalContainer>
    );
};

export default ToolCallApprovalModal;