
import React from 'react';
import type { Model } from '../types';
import ModelIcon from './icons/ModelIcon';
import SpinnerIcon from './icons/SpinnerIcon';

interface ModelSelectorProps {
  models: Model[];
  onSelectModel: (modelId: string) => void;
  isLoading: boolean;
  error: string | null;
}

const ModelCard: React.FC<{ model: Model; onSelect: () => void }> = ({ model, onSelect }) => {
  return (
    <div
      onClick={onSelect}
      className="flex flex-col justify-between p-4 bg-[--bg-secondary] border border-[--border-primary] rounded-lg cursor-pointer hover:bg-[--bg-hover] hover:border-[--text-accent] transition-all duration-200"
    >
      <div>
        <div className="flex items-center gap-3 mb-2">
            <ModelIcon className="w-6 h-6 text-blue-500 dark:text-blue-400" />
            <h3 className="text-lg font-semibold text-[--text-primary] truncate">{model.id}</h3>
        </div>
        <p className="text-sm text-[--text-muted]">
          Last updated: {new Date(model.created * 1000).toLocaleDateString()}
        </p>
      </div>
      <button className="mt-4 w-full text-center px-4 py-2 text-sm font-medium text-[--text-on-accent] bg-[--bg-accent] rounded-md hover:bg-[--bg-accent-hover] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[--bg-secondary] focus:ring-[--border-focus]">
        Chat with this model
      </button>
    </div>
  );
};

const ModelSelector: React.FC<ModelSelectorProps> = ({ models, onSelectModel, isLoading, error }) => {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center text-[--text-muted]">
        <SpinnerIcon className="w-12 h-12 mb-4" />
        <p className="text-lg">Fetching available models...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center text-red-600 dark:text-red-400 p-8 bg-red-50 dark:bg-red-900/20 rounded-lg">
        <h2 className="text-2xl font-bold mb-2">Connection Error</h2>
        <p className="max-w-md">{error}</p>
        <p className="mt-4 text-sm text-[--text-muted]">Please check your settings and try again.</p>
      </div>
    );
  }

  if (models.length === 0) {
    return (
        <div className="flex flex-col items-center justify-center h-full text-center text-[--text-muted] p-8 bg-[--bg-secondary]/50 rounded-lg">
            <h2 className="text-2xl font-bold mb-2 text-[--text-primary]">No Models Found</h2>
            <p className="max-w-md">The connected service reported zero available models. Make sure you have downloaded or configured models in Ollama or LMStudio.</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <h1 className="text-3xl font-bold text-[--text-primary] mb-6">Select a Model</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {models.map((model) => (
          <ModelCard key={model.id} model={model} onSelect={() => onSelectModel(model.id)} />
        ))}
      </div>
    </div>
  );
};

export default ModelSelector;