import React, { useState, useEffect } from 'react';
import type { Model, LLMProviderConfig, Theme } from '../types';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark, coy } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { fetchOllamaModelDetails, LLMServiceError } from '../services/llmService';
import Icon from './Icon';

interface ModelDetailsModalProps {
  model: Model;
  onClose: () => void;
  theme: Theme;
}

const ModelDetailsModal: React.FC<ModelDetailsModalProps> = ({ model, onClose, theme }) => {
    const syntaxTheme = theme === 'dark' ? atomDark : coy;
    const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };
    return (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-[--bg-backdrop] backdrop-blur-sm" onClick={handleBackdropClick}>
            <div className="bg-[--bg-secondary] rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <header className="p-4 border-b border-[--border-primary] flex-shrink-0 flex justify-between items-center">
                    <h2 className="text-lg font-bold text-[--text-primary]">Model Details: {model.name}</h2>
                    <button onClick={onClose} className="p-2 rounded-full text-[--text-muted] hover:bg-[--bg-hover] leading-none text-2xl">&times;</button>
                </header>
                <main className="flex-1 overflow-y-auto p-4 space-y-4">
                    {model.details?.modelfile && (
                        <div>
                            <h3 className="text-md font-semibold text-[--text-secondary] mb-2">Modelfile</h3>
                            <div className="bg-[--code-bg] rounded-lg border border-[--border-primary]">
                                <SyntaxHighlighter language="dockerfile" style={syntaxTheme} customStyle={{ margin: 0, background: 'transparent' }}>
                                    {model.details.modelfile}
                                </SyntaxHighlighter>
                            </div>
                        </div>
                    )}
                     {model.details?.parameters && (
                        <div>
                            <h3 className="text-md font-semibold text-[--text-secondary] mb-2">Parameters</h3>
                            <pre className="text-xs font-mono p-3 bg-[--bg-tertiary] rounded-lg whitespace-pre-wrap break-all">{model.details.parameters}</pre>
                        </div>
                    )}
                     {model.details?.template && (
                        <div>
                            <h3 className="text-md font-semibold text-[--text-secondary] mb-2">Template</h3>
                            <pre className="text-xs font-mono p-3 bg-[--bg-tertiary] rounded-lg whitespace-pre-wrap break-all">{model.details.template}</pre>
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

const ModelListItem: React.FC<{ model: Model; onSelect: () => void; onShowDetails: () => void; provider: LLMProviderConfig | null; isFetchingDetails: boolean; }> = ({ model, onSelect, onShowDetails, provider, isFetchingDetails }) => {
  const formatBytes = (bytes?: number, decimals = 1) => {
    if (bytes === undefined || bytes === null) return null;
    if (bytes === 0) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

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
      className="flex items-center p-3 bg-[--bg-primary] border border-[--border-primary] rounded-[--border-radius] cursor-pointer hover:bg-[--bg-hover] hover:border-[--accent-chat] transition-all duration-200 shadow-sm hover:shadow-md"
    >
        <div className="flex items-center gap-3 min-w-0 flex-grow">
          <Icon name="model" className="w-5 h-5 text-[--accent-chat] flex-shrink-0" />
          <h3 className="text-md font-semibold text-[--text-primary] truncate" title={model.id}>{model.id}</h3>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 ml-4">
            {detailPills.map((pill, index) => (
                <span key={index} className="hidden md:inline-block text-xs font-mono bg-[--bg-tertiary] text-[--text-muted] px-2 py-1 rounded-md">
                    {pill.value}
                </span>
            ))}
        </div>
        
        {provider?.id === 'ollama' && (
            <button
                onClick={(e) => { e.stopPropagation(); onShowDetails(); }}
                className="p-2 rounded-full text-[--text-muted] hover:bg-[--bg-hover] disabled:opacity-50 disabled:cursor-wait ml-3"
                title="Show model details"
                disabled={isFetchingDetails}
            >
                {isFetchingDetails ? <Icon name="spinner" className="w-5 h-5"/> : <Icon name="info" className="w-5 h-5" />}
            </button>
        )}
    </div>
  );
};

const ModelSelector: React.FC<ModelSelectorProps> = ({ models, onSelectModel, isLoading, error, onGoToSettings, provider, theme }) => {
  const [detailsModalModel, setDetailsModalModel] = useState<Model | null>(null);
  const [fetchingDetailsFor, setFetchingDetailsFor] = useState<string | null>(null);
  const [localModels, setLocalModels] = useState<Model[]>(models);

  useEffect(() => {
    setLocalModels(models);
  }, [models]);

  const handleShowDetails = async (modelToShow: Model) => {
      if (!provider) return;
      setFetchingDetailsFor(modelToShow.id);
      try {
          const details = await fetchOllamaModelDetails(provider.baseUrl, modelToShow.name);
          const updatedModel = { ...modelToShow, details: { ...modelToShow.details, ...details } };
          
          setLocalModels(prev => prev.map(m => m.id === updatedModel.id ? updatedModel : m));
          setDetailsModalModel(updatedModel);

      } catch (e) {
          const msg = e instanceof LLMServiceError ? e.message : 'An unexpected error occurred while fetching model details.';
          alert(msg);
      } finally {
          setFetchingDetailsFor(null);
      }
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
    <div className="p-4 sm:p-6 max-w-3xl mx-auto w-full">
      {detailsModalModel && <ModelDetailsModal model={detailsModalModel} onClose={() => setDetailsModalModel(null)} theme={theme} />}
      <h1 className="text-3xl font-bold text-[--text-primary] mb-6">Select a Model</h1>
      <div className="space-y-3">
        {localModels.map((model) => (
          <ModelListItem
            key={model.id}
            model={model}
            onSelect={() => onSelectModel(model.id)}
            onShowDetails={() => handleShowDetails(model)}
            provider={provider}
            isFetchingDetails={fetchingDetailsFor === model.id}
          />
        ))}
      </div>
    </div>
  );
};

export default ModelSelector;
