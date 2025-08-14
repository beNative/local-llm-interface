
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
      className="flex flex-col justify-between p-4 bg-gray-800 border border-gray-700 rounded-lg cursor-pointer hover:bg-gray-700 hover:border-blue-500 transition-all duration-200"
    >
      <div>
        <div className="flex items-center gap-3 mb-2">
            <ModelIcon className="w-6 h-6 text-blue-400" />
            <h3 className="text-lg font-semibold text-white truncate">{model.id}</h3>
        </div>
        <p className="text-sm text-gray-400">
          Last updated: {new Date(model.created * 1000).toLocaleDateString()}
        </p>
      </div>
      <button className="mt-4 w-full text-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500">
        Chat with this model
      </button>
    </div>
  );
};

const ModelSelector: React.FC<ModelSelectorProps> = ({ models, onSelectModel, isLoading, error }) => {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center text-gray-400">
        <SpinnerIcon className="w-12 h-12 mb-4" />
        <p className="text-lg">Fetching available models...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center text-red-400 p-8 bg-red-900/20 rounded-lg">
        <h2 className="text-2xl font-bold mb-2">Connection Error</h2>
        <p className="max-w-md">{error}</p>
        <p className="mt-4 text-sm text-gray-400">Please check your settings and try again.</p>
      </div>
    );
  }

  if (models.length === 0) {
    return (
        <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 p-8 bg-gray-800/50 rounded-lg">
            <h2 className="text-2xl font-bold mb-2">No Models Found</h2>
            <p className="max-w-md">The connected service reported zero available models. Make sure you have downloaded or configured models in Ollama or LMStudio.</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <h1 className="text-3xl font-bold text-white mb-6">Select a Model</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {models.map((model) => (
          <ModelCard key={model.id} model={model} onSelect={() => onSelectModel(model.id)} />
        ))}
      </div>
    </div>
  );
};

export default ModelSelector;