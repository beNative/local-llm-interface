import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import SpinnerIcon from './icons/SpinnerIcon';

interface InfoViewProps {
  onBack: () => void;
}

type Doc = 'README' | 'FUNCTIONAL' | 'TECHNICAL' | 'CHANGELOG';
const DOC_FILES: Record<Doc, string> = {
  README: 'README.md',
  FUNCTIONAL: 'FUNCTIONAL_MANUAL.md',
  TECHNICAL: 'TECHNICAL_MANUAL.md',
  CHANGELOG: 'CHANGELOG.md',
};

const InfoView: React.FC<InfoViewProps> = ({ onBack }) => {
  const [activeDoc, setActiveDoc] = useState<Doc>('README');
  const [content, setContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDoc = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`./${DOC_FILES[activeDoc]}`);
        if (!response.ok) {
          throw new Error(`Failed to load ${DOC_FILES[activeDoc]}: ${response.statusText}`);
        }
        const text = await response.text();
        setContent(text);
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred';
        setError(errorMessage);
        setContent('');
      } finally {
        setIsLoading(false);
      }
    };

    fetchDoc();
  }, [activeDoc]);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      <header className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Application Info</h2>
        <button
          onClick={onBack}
          className="px-3 py-1 text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 focus:outline-none"
        >
          &larr; Back to Models
        </button>
      </header>
      <div className="flex-1 flex overflow-hidden">
        <aside className="w-64 p-4 border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
          <nav className="space-y-2">
            {(Object.keys(DOC_FILES) as Doc[]).map((docKey) => (
              <button
                key={docKey}
                onClick={() => setActiveDoc(docKey)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeDoc === docKey
                    ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50'
                }`}
              >
                {DOC_FILES[docKey].replace('.md', '').replace('_', ' ')}
              </button>
            ))}
          </nav>
        </aside>
        <main className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <SpinnerIcon className="w-10 h-10 text-gray-400" />
            </div>
          ) : error ? (
            <div className="text-red-500">
              <h3 className="font-bold">Error loading document</h3>
              <p>{error}</p>
            </div>
          ) : (
            <article className="prose prose-sm md:prose-base dark:prose-invert max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ node, inline, className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || '');
                    return !inline && match ? (
                      <SyntaxHighlighter
                        style={atomDark}
                        language={match[1]}
                        PreTag="div"
                      >
                        {String(children).replace(/\n$/, '')}
                      </SyntaxHighlighter>
                    ) : (
                      <code className={className} {...props}>
                        {children}
                      </code>
                    );
                  },
                }}
              >
                {content}
              </ReactMarkdown>
            </article>
          )}
        </main>
      </div>
    </div>
  );
};

export default InfoView;
