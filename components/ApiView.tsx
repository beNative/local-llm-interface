
import React, { useState } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark, coy } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { ApiRequest, ApiResponse, ApiHttpMethod, Theme } from '../types';
import { logger } from '../services/logger';
import ServerIcon from './icons/ServerIcon';
import SpinnerIcon from './icons/SpinnerIcon';
import SendIcon from './icons/SendIcon';
import TrashIcon from './icons/TrashIcon';

const API_REQUEST_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    method: { type: Type.STRING, enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'], description: 'The HTTP method for the request.' },
    url: { type: Type.STRING, description: 'The full URL to send the request to, including protocol and any query parameters.' },
    headers: {
      type: Type.ARRAY,
      description: 'An array of header objects, each with a key and value.',
      items: {
        type: Type.OBJECT,
        properties: {
          key: { type: Type.STRING, description: 'The header name.' },
          value: { type: Type.STRING, description: 'The header value.' }
        },
        required: ['key', 'value'],
      }
    },
    body: { type: Type.STRING, description: 'The request body as a string. If the body is JSON, it should be a valid, stringified JSON. For GET requests, this should be an empty string.' }
  },
  required: ['method', 'url']
};

interface ApiViewProps {
    isElectron: boolean;
    theme: Theme;
}

const ApiView: React.FC<ApiViewProps> = ({ isElectron, theme }) => {
    const [prompt, setPrompt] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [apiRequest, setApiRequest] = useState<ApiRequest | null>(null);
    const [apiResponse, setApiResponse] = useState<ApiResponse | null>(null);
    
    const syntaxTheme = theme === 'dark' ? atomDark : coy;

    if (!isElectron) {
        return (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                <h2 className="text-xl font-bold">Feature Not Available</h2>
                <p>The API Client requires the desktop application to function correctly and bypass browser CORS restrictions.</p>
            </div>
        );
    }
    
    const handleGenerateRequest = async () => {
        if (!prompt) return;
        setIsLoading(true);
        setError(null);
        setApiRequest(null);
        setApiResponse(null);
        
        const fullPrompt = `Based on the following user description, generate the components for an HTTP API request. Ensure the URL is complete and valid. If the user mentions JSON, format the body as a minified JSON string.\n\nDescription: "${prompt}"`;
        
        try {
            const ai = new GoogleGenAI({apiKey: process.env.API_KEY!});
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: fullPrompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: API_REQUEST_SCHEMA,
                },
            });

            const jsonResponse = JSON.parse(response.text);
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
            setApiRequest(newRequest);
            logger.info('Successfully generated API request from prompt.');

        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            logger.error(`Failed to generate API request: ${msg}`);
            setError(`Failed to generate request: ${msg}`);
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
    <div className="p-4 sm:p-6 h-full overflow-y-auto bg-white dark:bg-gray-900">
        <div className="max-w-4xl mx-auto">
            <h1 className="flex items-center gap-3 text-3xl font-bold text-gray-900 dark:text-white mb-8">
            <ServerIcon className="w-8 h-8"/>
            API Client
            </h1>
            
            {/* Prompt Section */}
            <div className="space-y-4 bg-gray-50 dark:bg-gray-800/50 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
                <label htmlFor="api-prompt" className="block text-lg font-semibold text-gray-700 dark:text-gray-300">Describe the request you want to make</label>
                <textarea
                    id="api-prompt"
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                    placeholder="e.g., Send a GET request to the GitHub API to fetch the repos for the user 'torvalds'"
                    className="w-full px-3 py-2 text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                />
                <div className="flex justify-end">
                    <button onClick={handleGenerateRequest} disabled={!prompt || isLoading} className="flex items-center justify-center px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-blue-500 disabled:bg-blue-400 disabled:cursor-not-allowed">
                        {isLoading ? <SpinnerIcon className="w-5 h-5"/> : 'Generate Request'}
                    </button>
                </div>
            </div>

            {error && <div className="mt-4 text-red-500 bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">{error}</div>}

            {/* Request Editor Section */}
            {apiRequest && (
                <div className="mt-6 space-y-4 bg-gray-50 dark:bg-gray-800/50 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">Generated Request</h3>
                    <div className="flex gap-2">
                        <select
                            value={apiRequest.method}
                            onChange={e => setApiRequest({...apiRequest, method: e.target.value as ApiHttpMethod})}
                            className="px-3 py-2 font-mono text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                           {['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'].map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                         <input
                            type="text"
                            value={apiRequest.url}
                            onChange={e => setApiRequest({...apiRequest, url: e.target.value})}
                            placeholder="https://api.example.com/data"
                            className="flex-grow px-3 py-2 font-mono text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                         <button onClick={handleSendRequest} disabled={isLoading} className="flex items-center justify-center px-6 py-2.5 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:bg-green-400">
                            {isLoading ? <SpinnerIcon className="w-5 h-5"/> : <SendIcon className="w-5 h-5" />}
                        </button>
                    </div>

                    {/* Headers */}
                    <div className="space-y-2">
                         <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400">Headers</h4>
                        {Object.entries(apiRequest.headers).map(([key, value], index) => (
                           <div key={index} className="flex gap-2 items-center">
                               <input type="text" value={key} onChange={e => handleHeaderChange(index, e.target.value, value)} placeholder="Key" className="w-1/3 px-2 py-1 font-mono text-sm text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md"/>
                               <input type="text" value={value} onChange={e => handleHeaderChange(index, key, e.target.value)} placeholder="Value" className="flex-grow px-2 py-1 font-mono text-sm text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md"/>
                               <button onClick={() => handleRemoveHeader(key)} className="p-1 text-gray-400 hover:text-red-500"><TrashIcon className="w-4 h-4"/></button>
                           </div>
                        ))}
                        <button onClick={handleAddHeader} className="text-xs text-blue-600 hover:underline">+ Add Header</button>
                    </div>
                    
                    {/* Body */}
                    {apiRequest.method !== 'GET' && apiRequest.method !== 'HEAD' && (
                        <div>
                             <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400">Body</h4>
                             <textarea
                                value={apiRequest.body || ''}
                                onChange={e => setApiRequest({...apiRequest, body: e.target.value})}
                                placeholder="Request body..."
                                className="w-full h-40 p-2 font-mono text-sm bg-gray-100 dark:bg-gray-900 rounded-md resize-y focus:outline-none border border-gray-300 dark:border-gray-600"
                                spellCheck="false"
                            />
                        </div>
                    )}
                </div>
            )}
            
            {/* Response Section */}
            {apiResponse && (
                 <div className="mt-6 space-y-4 bg-gray-50 dark:bg-gray-800/50 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
                     <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">Response</h3>
                     <p className="text-sm font-semibold">Status: <span className={`${getStatusColor(apiResponse.status)} font-bold`}>{apiResponse.status} {apiResponse.statusText}</span></p>
                     <div>
                        <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Headers</h4>
                        <div className="p-2 bg-gray-100 dark:bg-gray-900 rounded-md font-mono text-xs max-h-40 overflow-y-auto">
                            {Object.entries(apiResponse.headers).map(([key, value]) => (
                                <p key={key}><span className="font-bold text-gray-500">{key}:</span> {value}</p>
                            ))}
                        </div>
                     </div>
                     <div>
                        <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Body</h4>
                        <div className="relative">
                            <SyntaxHighlighter
                                language={apiResponse.headers['content-type']?.includes('json') ? 'json' : 'text'}
                                style={syntaxTheme}
                                customStyle={{ margin: 0, maxHeight: '400px', overflowY: 'auto' }}
                                wrapLines={true}
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
