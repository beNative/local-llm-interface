import React from 'react';
import ModalContainer from './Modal';

interface RunOutputModalProps {
    runOutput: { title: string; stdout: string; stderr: string };
    onClose: () => void;
}

const RunOutputModal: React.FC<RunOutputModalProps> = ({ runOutput, onClose }) => {
    return (
        <ModalContainer
            onClose={onClose}
            title={runOutput.title}
            titleId="run-output-modal-title"
            descriptionId="run-output-modal-content"
            size="lg"
            bodyClassName="font-mono text-xs space-y-[var(--space-4)]"
            footer={
                <button
                    onClick={onClose}
                    className="px-[var(--space-4)] py-[var(--space-2)] text-[length:var(--font-size-sm)] font-medium text-[--text-secondary] bg-[--bg-tertiary] rounded-[--border-radius] hover:bg-[--bg-hover] focus:outline-none focus-visible:ring-2 focus-visible:ring-[--border-focus]"
                >
                    Close
                </button>
            }
        >
            {runOutput.stdout && (
                <section className="space-y-[var(--space-2)] font-sans text-[length:var(--font-size-sm)]">
                    <h3 className="text-[--text-muted] font-semibold uppercase">Output (stdout)</h3>
                    <pre className="whitespace-pre-wrap rounded-[--border-radius] bg-[--bg-tertiary] p-[var(--space-3)] font-mono text-[--text-secondary]">
                        {runOutput.stdout}
                    </pre>
                </section>
            )}
            {runOutput.stderr && (
                <section className="space-y-[var(--space-2)] font-sans text-[length:var(--font-size-sm)]">
                    <h3 className="font-semibold uppercase text-red-500">Error (stderr)</h3>
                    <pre className="whitespace-pre-wrap rounded-[--border-radius] bg-red-900/20 p-[var(--space-3)] font-mono text-red-500">
                        {runOutput.stderr}
                    </pre>
                </section>
            )}
            {!runOutput.stdout && !runOutput.stderr && (
                <p className="font-sans text-[--text-muted]">The script produced no output.</p>
            )}
        </ModalContainer>
    );
};

export default RunOutputModal;
