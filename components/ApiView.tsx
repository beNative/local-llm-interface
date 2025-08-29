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
import FileTextIcon from './icons/FileTextIcon';
import LightbulbIcon from './icons/LightbulbIcon';

interface ApiViewProps {
    isElectron: boolean;
    theme: Theme;
    config: Config | null;
    models: Model[];
    onSaveApiPrompt: (prompt: string) => void;
    onClearApiPrompts: () => void;
}

const EmptyState: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode; }> = ({ icon, title, children }) => (
    <div className="flex flex-col items-center justify-center h-full text-center text-[--text-muted] p-4">
        <div className="w-12 h-12 mb-4 flex items-center justify-center bg-[--bg-tertiary] rounded-full">{icon}</div>
        <h4 className="font-semibold text-lg text-[--text-secondary] mb-1">{title}</h4>
        <p className="text-sm">{children}</p>
    </div>
);


const ApiView: React.FC<ApiViewProps> = ({ isElectron, theme, config, models, onSaveApiPrompt, onClearApiPrompts }) => {
    const [prompt, setPrompt] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [apiRequest, setApiRequest] = useState<ApiRequest | null>(null);
    const [apiResponse, setApiResponse] = useState<ApiResponse | null>(null);
    const [selectedModelId, setSelectedModelId] = useState<string>('');
    
    const syntaxTheme = theme === 'dark' ? atomDark : coy;
    const recentPrompts = config?.apiRecentPrompts || [];
    const examplePrompts = [
        "Get a random fact about cats from the catfact.ninja API",
        "Fetch the public repositories for the user 'microsoft' from the GitHub API",
        "Post a new comment on post ID 1 on JSONPlaceholder with a random body",
    ];

    useEffect(() => {
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
        onSaveApiPrompt(prompt);
        setIsLoading(true);
        setLoadingMessage(`Generating with ${selectedModelId}...`);
        setError(null);
        setApiRequest(null);
        setApiResponse(null);
        
        const systemPrompt = `You are an expert API assistant. Your task is to generate a valid JSON object representing an HTTP request based on a user's description. The JSON object must conform to the following structure:
{
  "method": "string (one of GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS)",
  "url": "string (a full, valid URL)",
  "headers": [{"key": "string", "value": "string"}],
  "body": "object | string (For JSON content-types, provide a valid JSON object. For other content-types, provide a string. For GET requests, this should be null.)"
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
            
            const jsonMatch = responseText.match(/```(json)?\s*([\s\S]*?)\s*```/);
            const jsonText = jsonMatch ? jsonMatch[2] : responseText;

            const jsonResponse = JSON.parse(jsonText);
            
            const headersObject = (jsonResponse.headers || []).reduce((acc: Record<string, string>, h: {key: string, value: string}) => {
                if (h.key) acc[h.key] = h.value;
                return acc;
            }, {});

            let bodyString: string | null = null;
            if (jsonResponse.body !== undefined && jsonResponse.body !== null) {
                if (typeof jsonResponse.body === 'object') {
                    bodyString = JSON.stringify(jsonResponse.body);
                } else {
                    bodyString = String(jsonResponse.body);
                }
            }

            const newRequest: ApiRequest = {
                method: jsonResponse.method || 'GET',
                url: jsonResponse.url || '',
                headers: headersObject,
                body: bodyString,
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
            setLoadingMessage('');
        }
    };
    
    const handleSendRequest = async () => {
        if (!apiRequest) return;
        setIsLoading(true);
        setLoadingMessage(`Sending request to ${apiRequest.url}...`);
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
            setLoadingMessage('');
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
        if (status >= 300 && status < 400) return 'text-blue-500';
        if (status >= 400 && status < 500) return 'text-yellow-500';
        if (status >= 500) return 'text-red-500';
        return 'text-gray-500';
    };

    const getLanguageFromContentType = (contentType: string | string[] | undefined): string => {
        const type = Array.isArray(contentType) ? contentType[0] : contentType;
        if (!type) return 'text';
        if (type.includes('json')) return 'json';
        if (type.includes('html')) return 'html';
        if (type.includes('xml')) return 'xml';
        if (type.includes('javascript')) return 'javascript';
        return 'text';
    };
    
    const formatResponseBody = (body: string, contentType: string | string[] | undefined) => {
        const lang = getLanguageFromContentType(contentType);
        if (lang === 'json') {
            try {
                return JSON.stringify(JSON.parse(body), null, 2);
            } catch (e) {
                return body; // Not valid JSON, return as is
            }
        }
        return body;
    }

  return (
    <div className="p-4 sm:p-6 h-full flex flex-col bg-[--bg-secondary]">
        <header className="flex-shrink-0">
             <h1 className="flex items-center gap-3 text-3xl font-bold mb-4" style={{color: 'var(--accent-api)'}}>
                <ServerIcon className="w-8 h-8"/>
                API Client
            </h1>
            {error && <div className="mb-4 text-red-500 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg text-sm">{error}</div>}
        </header>

        <div className="flex-grow grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-0">
            {/* Prompt Panel */}
            <div className="lg:col-span-4 xl:col-span-3 flex flex-col gap-4 min-h-0">
                <div className="flex flex-col gap-4 bg-[--bg-primary] p-4 rounded-xl border border-[--border-primary] shadow-sm">
                    <label htmlFor="api-prompt" className="block text-md font-semibold text-[--text-secondary]">1. Describe Request</label>
                    <textarea
                        id="api-prompt"
                        value={prompt}
                        onChange={e => setPrompt(e.target.value)}
                        placeholder="e.g., Send a GET request to the GitHub API..."
                        className="w-full h-24 px-3 py-2 text-[--text-primary] bg-[--bg-tertiary] border border-[--border-secondary] rounded-lg focus:outline-none focus:ring-2 focus:ring-[--border-focus] resize-y"
                    />
                    <div>
                        <label htmlFor="api-model-select" className="sr-only">Model</label>
                        <select
                            id="api-model-select"
                            value={selectedModelId}
                            onChange={e => setSelectedModelId(e.target.value)}
                            className="w-full px-3 py-2 text-sm text-[--text-primary] bg-[--bg-tertiary] border border-[--border-secondary] rounded-lg focus:outline-none focus:ring-2 focus:ring-[--border-focus]"
                            disabled={isLoading || models.length === 0}
                        >
                            {models.length > 0 ? (
                                models.map(m => <option key={m.id} value={m.id}>{m.id}</option>)
                            ) : (
                                <option>No models available</option>
                            )}
                        </select>
                    </div>
                    <button onClick={handleGenerateRequest} disabled={!prompt || !selectedModelId || isLoading} className="flex items-center justify-center w-full px-4 py-2 text-sm font-medium text-[--text-on-accent] bg-[--accent-api] rounded-lg hover:brightness-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[--bg-primary] focus:ring-[--border-focus] disabled:opacity-60 disabled:cursor-not-allowed">
                        {isLoading && !apiRequest ? <SpinnerIcon className="w-5 h-5"/> : 'Generate Request'}
                    </button>
                </div>

                <div className="flex-grow flex flex-col gap-2 bg-[--bg-primary] p-4 rounded-xl border border-[--border-primary] shadow-sm min-h-0">
                    <h4 className="text-sm font-semibold text-[--text-muted] flex items-center gap-2"><LightbulbIcon className="w-4 h-4" /> Examples & History</h4>
                    <div className="flex-grow overflow-y-auto space-y-3 text-xs">
                        {examplePrompts.map((p, i) => (
                            <button key={i} onClick={() => setPrompt(p)} className="w-full text-left p-2 rounded-lg bg-[--bg-tertiary] hover:bg-[--bg-hover] text-[--text-secondary] hover:text-[--text-primary]">
                                {p}
                            </button>
                        ))}
                         {recentPrompts.length > 0 && (
                            <>
                                <div className="flex justify-between items-center pt-2 border-t border-[--border-primary]">
                                    <h5 className="text-xs font-semibold text-[--text-muted]">Recent</h5>
                                    <button onClick={onClearApiPrompts} className="text-red-500 hover:underline" title="Clear history"><TrashIcon className="w-3 h-3" /></button>
                                </div>
                                {recentPrompts.map((p, i) => (
                                    <button key={`recent-${i}`} onClick={() => setPrompt(p)} className="w-full text-left p-2 rounded-lg bg-[--bg-tertiary]/50 hover:bg-[--bg-hover] text-[--text-muted] hover:text-[--text-primary] truncate" title={p}>
                                        {p}
                                    </button>
                                ))}
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Request Panel */}
            <div className="lg:col-span-8 xl:col-span-4 bg-[--bg-primary] p-4 rounded-xl border border-[--border-primary] shadow-sm flex flex-col min-h-0">
                <h3 className="text-md font-semibold text-[--text-secondary] mb-3 flex-shrink-0">2. Edit & Send Request</h3>
                {isLoading && !apiRequest && <EmptyState icon={<SpinnerIcon className="w-6 h-6"/>} title="Generating Request">{loadingMessage}</EmptyState>}
                {!isLoading && !apiRequest && <EmptyState icon={<ServerIcon className="w-6 h-6"/>} title="Request Panel">Your generated request will appear here. Start by describing it on the left.</EmptyState>}

                {apiRequest && (
                    <div className="flex-grow flex flex-col gap-3 min-h-0">
                        <div className="flex gap-2 flex-shrink-0">
                            <select value={apiRequest.method} onChange={e => setApiRequest({...apiRequest, method: e.target.value as ApiHttpMethod})} className="px-3 py-2 font-mono text-sm text-[--text-primary] bg-[--bg-tertiary] border border-[--border-secondary] rounded-lg focus:outline-none focus:ring-2 focus:ring-[--border-focus]">
                               {['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'].map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                            <input type="text" value={apiRequest.url} onChange={e => setApiRequest({...apiRequest, url: e.target.value})} placeholder="https://api.example.com/data" className="flex-grow px-3 py-2 font-mono text-sm text-[--text-primary] bg-[--bg-tertiary] border border-[--border-secondary] rounded-lg focus:outline-none focus:ring-2 focus:ring-[--border-focus]"/>
                            <button onClick={handleSendRequest} disabled={isLoading} className="flex items-center justify-center w-12 h-10 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:bg-green-400" title="Send the configured HTTP request">
                                {isLoading ? <SpinnerIcon className="w-5 h-5"/> : <SendIcon className="w-5 h-5" />}
                            </button>
                        </div>
                        
                        <div className="flex flex-col gap-2 min-h-0">
                            <h4 className="text-sm font-medium text-[--text-muted]">Headers</h4>
                            <div className="space-y-2 overflow-y-auto pr-1">
                                {Object.entries(apiRequest.headers).map(([key, value], index) => (
                                   <div key={index} className="flex gap-2 items-center">
                                       <input type="text" value={key} onChange={e => handleHeaderChange(index, e.target.value, value)} placeholder="Key" className="w-1/3 px-2 py-1 font-mono text-xs text-[--text-primary] bg-[--bg-tertiary] border border-[--border-secondary] rounded-lg"/>
                                       <input type="text" value={value} onChange={e => handleHeaderChange(index, key, e.target.value)} placeholder="Value" className="flex-grow px-2 py-1 font-mono text-xs text-[--text-primary] bg-[--bg-tertiary] border border-[--border-secondary] rounded-lg"/>
                                       <button onClick={() => handleRemoveHeader(key)} className="p-1 text-gray-400 hover:text-red-500"><TrashIcon className="w-4 h-4"/></button>
                                   </div>
                                ))}
                            </div>
                             <button onClick={handleAddHeader} className="text-xs text-[--accent-chat] hover:underline self-start">+ Add Header</button>
                        </div>

                        {apiRequest.method !== 'GET' && apiRequest.method !== 'HEAD' && (
                            <div className="flex flex-col flex-grow min-h-0">
                                 <h4 className="text-sm font-medium text-[--text-muted] mb-1">Body</h4>
                                 <textarea
                                    value={apiRequest.body || ''}
                                    onChange={e => setApiRequest({...apiRequest, body: e.target.value})}
                                    placeholder="Request body..."
                                    className="w-full flex-grow p-2 font-mono text-sm bg-[--bg-tertiary] rounded-lg resize-none focus:outline-none border border-[--border-secondary]"
                                    spellCheck="false"
                                />
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Response Panel */}
            <div className="lg:col-span-12 xl:col-span-5 bg-[--bg-primary] p-4 rounded-xl border border-[--border-primary] shadow-sm flex flex-col min-h-0">
                 <h3 className="text-md font-semibold text-[--text-secondary] mb-3 flex-shrink-0">3. View Response</h3>
                 {isLoading && apiRequest && <EmptyState icon={<SpinnerIcon className="w-6 h-6"/>} title="Sending Request">{loadingMessage}</EmptyState>}
                 {!isLoading && !apiResponse && <EmptyState icon={<FileTextIcon className="w-6 h-6"/>} title="Response Panel">The server's response will appear here after you send a request.</EmptyState>}

                 {apiResponse && (
                     <div className="flex-grow flex flex-col gap-3 min-h-0">
                         <p className="text-sm font-semibold flex-shrink-0">Status: <span className={`${getStatusColor(apiResponse.status)} font-bold font-mono`}>{apiResponse.status} {apiResponse.statusText}</span></p>
                         <div className="flex flex-col gap-1 min-h-0">
                            <h4 className="text-sm font-medium text-[--text-muted]">Headers</h4>
                            <div className="p-2 bg-[--bg-tertiary] rounded-lg font-mono text-xs max-h-32 overflow-y-auto">
                                {Object.entries(apiResponse.headers).map(([key, value]) => (
                                    <p key={key} className="truncate"><span className="font-bold text-[--text-muted]">{key}:</span> {value}</p>
                                ))}
                            </div>
                         </div>
                         <div className="flex flex-col flex-grow min-h-0">
                            <h4 className="text-sm font-medium text-[--text-muted] mb-1">Body</h4>
                            <div className="relative flex-grow bg-[--code-bg] rounded-lg">
                                 <SyntaxHighlighter
                                    language={getLanguageFromContentType(apiResponse.headers['content-type'])}
                                    style={syntaxTheme}
                                    customStyle={{ background: 'transparent', margin: 0, height: '100%', overflow: 'auto' }}
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
    </div>
  );
};

export default ApiView;