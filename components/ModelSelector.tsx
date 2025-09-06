import React, { useState } from 'react';
import type { Model, LLMProviderConfig, Theme } from '../types';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark, coy } from 'react-syntax-highlighter/dist/esm/styles/prism';
import Icon from './Icon';
import { useTooltipTrigger } from '../hooks/useTooltipTrigger';

interface ModelDetailsModalProps {
  model: Model;
  onClose: () => void;
  theme: Theme;
}

const formatBytes = (bytes?: number, decimals = 1) => {
    if (bytes === undefined || bytes === null) return null;
    if (bytes === 0) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

const DetailItem: React.FC<{ label: string; value?: string | number | null }> = ({ label, value }) => {
    if (!value) return null;
    return (
        <div>
            <span className="font-semibold text-sm text-[--text-secondary]">{label}: </span>
            <span className="font-mono text-sm bg-[--bg-tertiary] text-[--text-muted] px-2 py-1 rounded-md">{value}</span>
        </div>
    );
};

const ModelDetailsModal: React.FC<ModelDetailsModalProps> = ({ model, onClose, theme }) => {
    const syntaxTheme = theme === 'dark' ? atomDark : coy;
    const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };
    const size = formatBytes(model.size);
    const details = model.details;

    return (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-[--bg-backdrop] backdrop-blur-sm" onClick={handleBackdropClick}>
            <div className="bg-[--bg-secondary] rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <header className="p-4 border-b border-[--border-primary] flex-shrink-0 flex justify-between items-center">
                    <h2 className="text-lg font-bold text-[--text-primary]">Model Details: {model.name}</h2>
                    <button onClick={onClose} className="p-2 rounded-full text-[--text-muted] hover:bg-[--bg-hover] leading-none text-2xl">&times;</button>
                </header>
                <main className="flex-1 overflow-y-auto p-4 space-y-4">
                    <div className="flex flex-wrap gap-x-6 gap-y-2 pb-4 border-b border-[--border-primary]">
                        <DetailItem label="Size" value={size} />
                        <DetailItem label="Family" value={details?.family} />
                        <DetailItem label="Parameters" value={details?.parameter_size} />
                    </div>

                    {model.details?.modelfile && (
                        <div>
                            <h3 className="text-md font-semibold text-[--text-secondary] mb-2">Modelfile</h3>
                            <div className="bg-[--code-bg] rounded-lg border border-[--border-primary] max-h-60 overflow-y-auto">
                                <SyntaxHighlighter language="dockerfile" style={syntaxTheme} customStyle={{ margin: 0, background: 'transparent' }}>
                                    {model.details.modelfile}
                                </SyntaxHighlighter>
                            </div>
                        </div>
                    )}
                     {model.details?.parameters && (
                        <div>
                            <h3 className="text-md font-semibold text-[--text-secondary] mb-2">Parameters</h3>
                            <pre className="text-xs font-mono p-3 bg-[--bg-tertiary] rounded-lg whitespace-pre-wrap break-all max-h-60 overflow-y-auto">{model.details.parameters}</pre>
                        </div>
                    )}
                     {model.details?.template && (
                        <div>
                            <h3 className="text-md font-semibold text-[--text-secondary] mb-2">Template</h3>
                            <pre className="text-xs font-mono p-3 bg-[--bg-tertiary] rounded-lg whitespace-pre-wrap break-all max-h-60 overflow-y-auto">{model.details.template}</pre>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};

interface ModelSelectorProps {
  models: Model[];
  onSelectModel: (modelId: string) => void;
  isLoading: boolean;
  error: string | null;
  onGoToSettings: () => void;
  provider: LLMProviderConfig | null;
  theme: Theme;
}

const ModelListItem: React.FC<{ model: Model; onSelect: () => void; onShowDetails: () => void; provider: LLMProviderConfig | null; }> = ({ model, onSelect, onShowDetails, provider }) => {
  const modelNameTooltip = useTooltipTrigger(model.id);
  const detailsTooltip = useTooltipTrigger("Show model details");

  const details = model.details;
  const size = formatBytes(model.size);

  const detailPills = [
    details?.parameter_size && { value: details.parameter_size },
    size && { value: size },
    details?.family && { value: details.family },
  ].filter(Boolean);

  return (
    <div
      onClick={onSelect}
      className="relative flex flex-col p-4 bg-[--bg-primary] border border-[--border-primary] rounded-[--border-radius] cursor-pointer hover:bg-[--bg-hover] hover:border-[--accent-chat] transition-all duration-200 shadow-sm hover:shadow-lg h-full"
    >
        {provider?.id === 'ollama' && (
            <button
                {...detailsTooltip}
                onClick={(e) => { e.stopPropagation(); onShowDetails(); }}
                className="absolute top-2 right-2 p-2 rounded-full text-[--text-muted] hover:bg-[--bg-tertiary] z-10"
            >
                <Icon name="info" className="w-5 h-5" />
            </button>
        )}
      <div className="flex items-center gap-3 mb-4">
        <Icon name="model" className="w-6 h-6 text-[--accent-chat] flex-shrink-0" />
        <h3 {...modelNameTooltip} className="text-lg font-semibold text-[--text-primary] truncate pr-8">
            {model.id}
        </h3>
      </div>
      
      <div className="flex-grow min-h-[1rem]"></div>

      <div className="flex flex-wrap gap-2 items-center">
        {detailPills.map((pill, index) => (
            <span key={index} className="text-xs font-mono bg-[--bg-tertiary] text-[--text-muted] px-2 py-1 rounded-md">
                {pill.value}
            </span>
        ))}
      </div>
    </div>
  );
};

const ModelSelector: React.FC<ModelSelectorProps> = ({ models, onSelectModel, isLoading, error, onGoToSettings, provider, theme }) => {
  const [detailsModalModel, setDetailsModalModel] = useState<Model | null>(null);

  const handleShowDetails = (modelToShow: Model) => {
      setDetailsModalModel(modelToShow);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center text-[--text-muted]">
        <Icon name="spinner" className="w-12 h-12 mb-4" />
        <p className="text-lg">Fetching available models...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center text-red-600 dark:text-red-400 p-8 bg-red-50 dark:bg-red-900/20 rounded-lg m-6">
        <h2 className="text-2xl font-bold mb-2">Connection Error</h2>
        <p className="max-w-md">{error}</p>
        <button
            onClick={onGoToSettings}
            className="mt-6 flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-[--text-on-accent] bg-[--accent-settings] rounded-lg hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[--bg-secondary] focus:ring-[--border-focus]"
        >
            <Icon name="settings" className="w-5 h-5" />
            Go to Settings
        </button>
      </div>
    );
  }

  if (models.length === 0) {
    return (
        <div className="flex flex-col items-center justify-center h-full text-center text-[--text-muted] p-8 bg-[--bg-primary] rounded-lg m-6">
            <h2 className="text-2xl font-bold mb-2 text-[--text-primary]">No Models Found</h2>
            <p className="max-w-md">The connected service reported zero available models. Make sure you have downloaded or configured models in {provider?.name || 'your provider'}.</p>
            <button
                onClick={onGoToSettings}
                className="mt-6 flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-[--text-on-accent] bg-[--accent-settings] rounded-lg hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[--bg-secondary] focus:ring-[--border-focus]"
            >
                <Icon name="settings" className="w-5 h-5" />
                Go to Settings
            </button>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 w-full">
      {detailsModalModel && <ModelDetailsModal model={detailsModalModel} onClose={() => setDetailsModalModel(null)} theme={theme} />}
      <h1 className="text-3xl font-bold text-[--text-primary] mb-6">Select a Model</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
        {models.map((model) => (
          <ModelListItem
            key={model.id}
            model={model}
            onSelect={() => onSelectModel(model.id)}
            onShowDetails={() => handleShowDetails(model)}
            provider={provider}
          />
        ))}
      </div>
    </div>
  );
};

export default ModelSelector;