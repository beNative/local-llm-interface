import React, { useState, useEffect } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark, coy } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { ApiRequest, ApiResponse, ApiHttpMethod, Theme, Config, Model, ChatMessage } from '../types';
import { generateTextCompletion } from '../services/llmService';
import { logger } from '../services/logger';
import ServerIcon from './icons/ServerIcon';
import SpinnerIcon from './icons/SpinnerIcon';
import SendIcon from './icons/SendIcon';
import TrashIcon from './icons/TrashIcon';

interface ApiViewProps {
    isElectron: boolean;
    theme: Theme;
    config: Config | null;
    models: Model[];
}

const ApiView: React.FC<ApiViewProps> = ({ isElectron, theme, config, models }) => {
    const [prompt, setPrompt] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [apiRequest, setApiRequest] = useState<ApiRequest | null>(null);
    const [apiResponse, setApiResponse] = useState<ApiResponse | null>(null);
    const [selectedModelId, setSelectedModelId] = useState<string>('');
    
    const syntaxTheme = theme === 'dark' ? atomDark : coy;

    useEffect(() => {
        // Pre-select the first model if available and none is selected
        if (models.length > 0 && !selectedModelId) {
            setSelectedModelId(models[0].id);
        }
    }, [models, selectedModelId]);

    if (!isElectron) {
        return (
            <div className="p-8 text-center text-[--text-muted]">
                <h2 className="text-xl font-bold">Feature Not Available</h2>
                <p>The API Client requires the desktop application to function correctly and bypass browser CORS restrictions.</p>
            </div>
        );
    }
    
    const handleGenerateRequest = async () => {
        if (!prompt || !selectedModelId || !config) {
            setError("Cannot generate request. Check prompt, model selection, and app configuration.");
            return;
        }
        setIsLoading(true);
        setError(null);
        setApiRequest(null);
        setApiResponse(null);
        
        const systemPrompt = `You are an expert API assistant. Your task is to generate a valid JSON object representing an HTTP request based on a user's description. The JSON object must conform to the following structure:
{
  "method": "string (one of GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS)",
  "url": "string (a full, valid URL)",
  "headers": [{"key": "string", "value": "string"}],
  "body": "string (this should be a minified JSON string if the content-type is JSON, otherwise it's a raw string. For GET requests, this should be an empty string.)"
}
Only output the raw JSON object. Do not include any other text, explanations, or markdown code fences. Just the JSON.`;
        
        const userPrompt = `Based on the following user description, generate the components for an HTTP API request.
Description: "${prompt}"`;

        const messages: ChatMessage[] = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ];
        
        try {
            const responseText = await generateTextCompletion(config.baseUrl, selectedModelId, messages);
            
            // The model might still wrap the JSON in markdown, so we need to extract it.
            const jsonMatch = responseText.match(/```(json)?\s*([\s\S]*?)\s*```/);
            const jsonText = jsonMatch ? jsonMatch[2] : responseText;

            const jsonResponse = JSON.parse(jsonText);
            
            const headersObject = (jsonResponse.headers || []).reduce((acc: Record<string, string>, h: {key: string, value: string}) => {
                if (h.key) acc[h.key] = h.value;
                return acc;
            }, {});

            const newRequest: ApiRequest = {
                method: jsonResponse.method || 'GET',
                url: jsonResponse.url || '',
                headers: headersObject,
                body: jsonResponse.body || null,
            };

            if (!newRequest.url || !['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'].includes(newRequest.method)) {
                throw new Error("The model returned an invalid request structure. Please try rephrasing your prompt.");
            }

            setApiRequest(newRequest);
            logger.info('Successfully generated API request from prompt using local LLM.');

        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            logger.error(`Failed to generate API request: ${msg}`);
            setError(`Failed to generate request. The model may have returned an invalid format. Details: ${msg}`);
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleSendRequest = async () => {
        if (!apiRequest) return;
        setIsLoading(true);
        setError(null);
        setApiResponse(null);

        try {
            logger.info(`Sending API request to ${apiRequest.url}`);
            const response = await window.electronAPI!.makeApiRequest(apiRequest);
            setApiResponse(response);
            logger.info(`Received API response with status ${response.status}`);
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            logger.error(`Failed to send API request: ${msg}`);
            setError(`Request failed: ${msg}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleHeaderChange = (index: number, key: string, value: string) => {
        if (!apiRequest) return;
        const headers = { ...apiRequest.headers };
        const oldKey = Object.keys(headers)[index];
        delete headers[oldKey];
        if (key) {
            headers[key] = value;
        }
        setApiRequest({ ...apiRequest, headers });
    };

    const handleAddHeader = () => {
        if (!apiRequest) return;
        setApiRequest({ ...apiRequest, headers: {...apiRequest.headers, '': '' } });
    };

    const handleRemoveHeader = (key: string) => {
        if (!apiRequest) return;
        const headers = { ...apiRequest.headers };
        delete headers[key];
        setApiRequest({ ...apiRequest, headers });
    };

    const getStatusColor = (status: number) => {
        if (status >= 200 && status < 300) return 'text-green-500';
        if (status >= 400 && status < 500) return 'text-yellow-500';
        if (status >= 500) return 'text-red-500';
        return 'text-gray-500';
    };

    const formatResponseBody = (body: string, contentType: string | string[] | undefined) => {
        contentType = Array.isArray(contentType) ? contentType[0] : contentType;
        if (contentType && contentType.includes('application/json')) {
            try {
                return JSON.stringify(JSON.parse(body), null, 2);
            } catch (e) {
                return body; // Not valid JSON, return as is
            }
        }
        return body;
    }

  return (
    <div className="p-4 sm:p-6 h-full overflow-y-auto bg-[--bg-primary]">
        <div className="max-w-4xl mx-auto">
            <h1 className="flex items-center gap-3 text-3xl font-bold text-[--text-primary] mb-8">
            <ServerIcon className="w-8 h-8"/>
            API Client
            </h1>
            
            {/* Prompt Section */}
            <div className="space-y-4 bg-[--bg-secondary]/50 p-6 rounded-lg border border-[--border-primary]">
                <label htmlFor="api-prompt" className="block text-lg font-semibold text-[--text-secondary]">Describe the request you want to make</label>
                <textarea
                    id="api-prompt"
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                    placeholder="e.g., Send a GET request to the GitHub API to fetch the repos for the user 'torvalds'"
                    className="w-full px-3 py-2 text-[--text-primary] bg-[--bg-tertiary] border border-[--border-secondary] rounded-md focus:outline-none focus:ring-2 focus:ring-[--border-focus]"
                    rows={3}
                />
                <div className="flex justify-between items-center">
                    <div className="flex-grow">
                        <label htmlFor="api-model-select" className="sr-only">Model</label>
                        <select
                            id="api-model-select"
                            value={selectedModelId}
                            onChange={e => setSelectedModelId(e.target.value)}
                            className="w-full max-w-xs px-3 py-2 text-sm text-[--text-primary] bg-[--bg-tertiary] border border-[--border-secondary] rounded-md focus:outline-none focus:ring-2 focus:ring-[--border-focus]"
                            disabled={isLoading || models.length === 0}
                        >
                            {models.length > 0 ? (
                                models.map(m => <option key={m.id} value={m.id}>{m.id}</option>)
                            ) : (
                                <option>No models available</option>
                            )}
                        </select>
                    </div>
                    <button onClick={handleGenerateRequest} disabled={!prompt || !selectedModelId || isLoading} className="flex items-center justify-center px-6 py-2.5 text-sm font-medium text-[--text-on-accent] bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[--bg-primary] focus:ring-blue-500 disabled:bg-blue-400 disabled:cursor-not-allowed">
                        {isLoading ? <SpinnerIcon className="w-5 h-5"/> : 'Generate Request'}
                    </button>
                </div>
            </div>

            {error && <div className="mt-4 text-red-500 bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">{error}</div>}

            {/* Request Editor Section */}
            {apiRequest && (
                <div className="mt-6 space-y-4 bg-[--bg-secondary]/50 p-6 rounded-lg border border-[--border-primary]">
                    <h3 className="text-lg font-semibold text-[--text-secondary]">Generated Request</h3>
                    <div className="flex gap-2">
                        <select
                            value={apiRequest.method}
                            onChange={e => setApiRequest({...apiRequest, method: e.target.value as ApiHttpMethod})}
                            className="px-3 py-2 font-mono text-[--text-primary] bg-[--bg-tertiary] border border-[--border-secondary] rounded-md focus:outline-none focus:ring-2 focus:ring-[--border-focus]"
                        >
                           {['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'].map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                         <input
                            type="text"
                            value={apiRequest.url}
                            onChange={e => setApiRequest({...apiRequest, url: e.target.value})}
                            placeholder="https://api.example.com/data"
                            className="flex-grow px-3 py-2 font-mono text-[--text-primary] bg-[--bg-tertiary] border border-[--border-secondary] rounded-md focus:outline-none focus:ring-2 focus:ring-[--border-focus]"
                        />
                         <button onClick={handleSendRequest} disabled={isLoading} className="flex items-center justify-center px-6 py-2.5 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:bg-green-400">
                            {isLoading ? <SpinnerIcon className="w-5 h-5"/> : <SendIcon className="w-5 h-5" />}
                        </button>
                    </div>

                    {/* Headers */}
                    <div className="space-y-2">
                         <h4 className="text-sm font-medium text-[--text-muted]">Headers</h4>
                        {Object.entries(apiRequest.headers).map(([key, value], index) => (
                           <div key={index} className="flex gap-2 items-center">
                               <input type="text" value={key} onChange={e => handleHeaderChange(index, e.target.value, value)} placeholder="Key" className="w-1/3 px-2 py-1 font-mono text-sm text-[--text-primary] bg-[--bg-tertiary] border border-[--border-secondary] rounded-md"/>
                               <input type="text" value={value} onChange={e => handleHeaderChange(index, key, e.target.value)} placeholder="Value" className="flex-grow px-2 py-1 font-mono text-sm text-[--text-primary] bg-[--bg-tertiary] border border-[--border-secondary] rounded-md"/>
                               <button onClick={() => handleRemoveHeader(key)} className="p-1 text-gray-400 hover:text-red-500"><TrashIcon className="w-4 h-4"/></button>
                           </div>
                        ))}
                        <button onClick={handleAddHeader} className="text-xs text-blue-600 hover:underline">+ Add Header</button>
                    </div>
                    
                    {/* Body */}
                    {apiRequest.method !== 'GET' && apiRequest.method !== 'HEAD' && (
                        <div>
                             <h4 className="text-sm font-medium text-[--text-muted]">Body</h4>
                             <textarea
                                value={apiRequest.body || ''}
                                onChange={e => setApiRequest({...apiRequest, body: e.target.value})}
                                placeholder="Request body..."
                                className="w-full h-40 p-2 font-mono text-sm bg-[--bg-tertiary] dark:bg-[--code-output-bg] rounded-md resize-y focus:outline-none border border-[--border-secondary]"
                                spellCheck="false"
                            />
                        </div>
                    )}
                </div>
            )}
            
            {/* Response Section */}
            {apiResponse && (
                 <div className="mt-6 space-y-4 bg-[--bg-secondary]/50 p-6 rounded-lg border border-[--border-primary]">
                     <h3 className="text-lg font-semibold text-[--text-secondary]">Response</h3>
                     <p className="text-sm font-semibold">Status: <span className={`${getStatusColor(apiResponse.status)} font-bold`}>{apiResponse.status} {apiResponse.statusText}</span></p>
                     <div>
                        <h4 className="text-sm font-medium text-[--text-muted] mb-1">Headers</h4>
                        <div className="p-2 bg-[--bg-tertiary] rounded-md font-mono text-xs max-h-40 overflow-y-auto">
                            {Object.entries(apiResponse.headers).map(([key, value]) => (
                                <p key={key}><span className="font-bold text-[--text-muted]">{key}:</span> {value}</p>
                            ))}
                        </div>
                     </div>
                     <div>
                        <h4 className="text-sm font-medium text-[--text-muted] mb-1">Body</h4>
                        <div className="relative bg-[--code-bg] rounded-md">
                            <SyntaxHighlighter
                                language={apiResponse.headers['content-type']?.includes('json') ? 'json' : 'text'}
                                style={syntaxTheme}
                                customStyle={{ background: 'transparent', margin: 0, maxHeight: '400px', overflowY: 'auto' }}
                                wrapLines={true}
                                PreTag="div"
                            >
                                {formatResponseBody(apiResponse.body, apiResponse.headers['content-type'])}
                            </SyntaxHighlighter>
                        </div>
                     </div>
                 </div>
            )}
        </div>
    </div>
  );
};

export default ApiView;