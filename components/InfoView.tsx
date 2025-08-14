import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import SpinnerIcon from './icons/SpinnerIcon';

type Doc = 'README' | 'FUNCTIONAL' | 'TECHNICAL' | 'CHANGELOG';
const DOC_FILES: Record<Doc, string> = {
  README: 'README.md',
  FUNCTIONAL: 'FUNCTIONAL_MANUAL.md',
  TECHNICAL: 'TECHNICAL_MANUAL.md',
  CHANGELOG: 'CHANGELOG.md',
};

const InfoView: React.FC = () => {
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
    <div className="flex h-full overflow-hidden bg-white dark:bg-gray-900">
      <aside className="w-64 p-4 border-r border-gray-200 dark:border-gray-700 overflow-y-auto flex-shrink-0">
        <nav className="space-y-2">
          <h2 className="px-3 py-2 text-xs font-semibold tracking-wider text-gray-500 dark:text-gray-400 uppercase">Documents</h2>
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
              {DOC_FILES[docKey].replace('.md', '').replace(/_/g, ' ')}
            </button>
          ))}
        </nav>
      </aside>
      <main className="flex-1 overflow-y-auto p-6 md:p-8">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <SpinnerIcon className="w-10 h-10 text-gray-400" />
          </div>
        ) : error ? (
          <div className="text-red-500 bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
            <h3 className="font-bold text-lg">Error loading document</h3>
            <p>{error}</p>
          </div>
        ) : (
          <article className="prose prose-sm md:prose-base dark:prose-invert max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ node, inline, className, children, ...props }: any) {
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
  );
};

export default InfoView;