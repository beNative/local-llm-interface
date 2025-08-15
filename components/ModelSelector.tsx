import React from 'react';
import type { Model } from '../types';
import ModelIcon from './icons/ModelIcon';
import SpinnerIcon from './icons/SpinnerIcon';
import SettingsIcon from './icons/SettingsIcon';

interface ModelSelectorProps {
  models: Model[];
  onSelectModel: (modelId: string) => void;
  isLoading: boolean;
  error: string | null;
  onGoToSettings: () => void;
}

const ModelCard: React.FC<{ model: Model; onSelect: () => void }> = ({ model, onSelect }) => {
  const formatBytes = (bytes?: number, decimals = 2) => {
    if (bytes === undefined || bytes === null) return 'N/A';
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const details = model.details;
  const hasAnyDetails = details || model.size || model.created > 0;

  return (
    <div
      onClick={onSelect}
      className="flex flex-col justify-between p-4 bg-[--bg-primary] border border-[--border-primary] rounded-xl cursor-pointer hover:bg-[--bg-hover] hover:border-[--accent-chat] transition-all duration-200 shadow-sm hover:shadow-lg"
    >
      <div>
        <div className="flex items-center gap-3 mb-3">
          <ModelIcon className="w-6 h-6 text-[--accent-chat] flex-shrink-0" />
          <h3 className="text-lg font-semibold text-[--text-primary] truncate" title={model.id}>{model.id}</h3>
        </div>

        {hasAnyDetails ? (
          <div className="space-y-1.5 text-xs text-[--text-muted] border-t border-[--border-primary] pt-3">
            {details?.family && (
              <div className="flex justify-between items-center gap-2">
                <span className="font-medium text-[--text-secondary]">Family</span>
                <span className="font-mono bg-[--bg-tertiary] px-1.5 py-0.5 rounded truncate">{details.family}</span>
              </div>
            )}
            {details?.parameter_size && (
              <div className="flex justify-between items-center gap-2">
                <span className="font-medium text-[--text-secondary]">Parameters</span>
                <span className="font-mono bg-[--bg-tertiary] px-1.5 py-0.5 rounded">{details.parameter_size}</span>
              </div>
            )}
            {details?.quantization_level && (
              <div className="flex justify-between items-center gap-2">
                <span className="font-medium text-[--text-secondary]">Quantization</span>
                <span className="font-mono bg-[--bg-tertiary] px-1.5 py-0.5 rounded">{details.quantization_level}</span>
              </div>
            )}
            {model.size !== undefined && (
              <div className="flex justify-between items-center gap-2">
                <span className="font-medium text-[--text-secondary]">Size</span>
                <span className="font-mono bg-[--bg-tertiary] px-1.5 py-0.5 rounded">{formatBytes(model.size)}</span>
              </div>
            )}
            {model.created > 0 && (
              <div className="flex justify-between items-center gap-2">
                <span className="font-medium text-[--text-secondary]">Updated</span>
                <span className="font-mono">{new Date(model.created * 1000).toLocaleDateString()}</span>
              </div>
            )}
          </div>
        ) : (
           <div className="border-t border-[--border-primary] pt-3">
             <p className="text-xs text-[--text-muted] italic">No details available.</p>
           </div>
        )}
      </div>
      <button className="mt-4 w-full text-center px-4 py-2 text-sm font-medium text-[--text-on-accent] bg-[--accent-chat] rounded-lg hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[--bg-primary] focus:ring-[--border-focus]">
        Chat with this model
      </button>
    </div>
  );
};

const ModelSelector: React.FC<ModelSelectorProps> = ({ models, onSelectModel, isLoading, error, onGoToSettings }) => {
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
      <div className="flex flex-col items-center justify-center h-full text-center text-red-600 dark:text-red-400 p-8 bg-red-50 dark:bg-red-900/20 rounded-lg m-6">
        <h2 className="text-2xl font-bold mb-2">Connection Error</h2>
        <p className="max-w-md">{error}</p>
        <button
            onClick={onGoToSettings}
            className="mt-6 flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-[--text-on-accent] bg-[--accent-settings] rounded-lg hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[--bg-secondary] focus:ring-[--border-focus]"
        >
            <SettingsIcon className="w-5 h-5" />
            Go to Settings
        </button>
      </div>
    );
  }

  if (models.length === 0) {
    return (
        <div className="flex flex-col items-center justify-center h-full text-center text-[--text-muted] p-8 bg-[--bg-primary] rounded-lg m-6">
            <h2 className="text-2xl font-bold mb-2 text-[--text-primary]">No Models Found</h2>
            <p className="max-w-md">The connected service reported zero available models. Make sure you have downloaded or configured models in Ollama or LMStudio.</p>
            <button
                onClick={onGoToSettings}
                className="mt-6 flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-[--text-on-accent] bg-[--accent-settings] rounded-lg hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[--bg-secondary] focus:ring-[--border-focus]"
            >
                <SettingsIcon className="w-5 h-5" />
                Go to Settings
            </button>
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