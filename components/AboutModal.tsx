import React from 'react';
import Icon from './Icon';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
  version: string;
}

const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose, version }) => {
  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[--bg-backdrop] backdrop-blur-sm"
      onClick={handleBackdropClick}
      aria-modal="true"
      role="dialog"
    >
      <div
        className="bg-[--bg-secondary] rounded-[--border-radius] shadow-xl w-full max-w-md p-6 text-center border border-[--border-primary]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col items-center">
            <div className="p-3 bg-[--accent-chat]/10 rounded-full mb-4">
                 <Icon name="brainCircuit" className="w-12 h-12 text-[--accent-chat]" />
            </div>
            <h2 className="text-2xl font-bold text-[--text-primary]">Local LLM Interface</h2>
            <p className="text-sm text-[--text-muted] font-mono mt-1">Version {version}</p>

            <div className="text-sm text-[--text-secondary] my-6 space-y-2">
                <p className="text-base font-semibold text-[--text-primary]">Tim Sinaeve</p>
                <p>Design and concept: Tim Sinaeve</p>
                <p>Implementation: Gemini 2.5 Pro &amp; gpt-5-codex</p>
            </div>

            <p className="text-xs text-[--text-muted]">© 2025 Tim Sinaeve. All rights reserved.</p>
        </div>

        <div className="mt-8 flex justify-center">
          <button
            onClick={onClose}
            className="px-6 py-2 text-sm font-medium text-white bg-[--accent-chat] rounded-lg hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[--bg-secondary] focus:ring-[--border-focus]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default AboutModal;
