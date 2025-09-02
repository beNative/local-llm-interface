import React from 'react';
import OllamaIcon from './icons/OllamaIcon';
import LMStudioIcon from './icons/LMStudioIcon';
import OpenAIIcon from './icons/OpenAIIcon';
import GoogleGeminiIcon from './icons/GoogleGeminiIcon';
import Icon from './Icon';
import type { LLMProviderConfig } from '../types';

const ProviderIconsMap: Record<string, React.FC<{className?: string}>> = {
  ollama: OllamaIcon,
  lmstudio: LMStudioIcon,
  openai: OpenAIIcon,
  'google-gemini': GoogleGeminiIcon,
};

const ProviderIcon: React.FC<{ provider: LLMProviderConfig | null, className?: string }> = ({ provider, className }) => {
    if (!provider || !ProviderIconsMap[provider.id]) {
        return <Icon name="server" className={className} />;
    }
    const IconComponent = ProviderIconsMap[provider.id];
    return <IconComponent className={className} />;
};

export default ProviderIcon;
