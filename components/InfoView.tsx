import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark, coy } from 'react-syntax-highlighter/dist/esm/styles/prism';
import Icon from './Icon';
import type { Theme } from '../types';

interface InfoViewProps {
  theme: Theme;
  onOpenAbout: () => void;
}

type Doc = 'README' | 'FUNCTIONAL' | 'TECHNICAL' | 'CHANGELOG';
const DOC_FILES: Record<Doc, string> = {
  README: 'README.md',
  FUNCTIONAL: 'FUNCTIONAL_MANUAL.md',
  TECHNICAL: 'TECHNICAL_MANUAL.md',
  CHANGELOG: 'CHANGELOG.md',
};

const InfoView: React.FC<InfoViewProps> = ({ theme, onOpenAbout }) => {
  const [activeDoc, setActiveDoc] = useState<Doc>('README');
  const [content, setContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const syntaxTheme = theme === 'dark' ? atomDark : coy;

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
    <div className="flex h-full overflow-hidden bg-[--bg-secondary]">
      <aside className="w-64 p-4 border-r border-[--border-primary] overflow-y-auto flex-shrink-0 bg-[--bg-primary]">
        <nav className="space-y-2">
          <h2 className="px-3 py-2 text-xs font-semibold tracking-wider text-[--text-muted] uppercase">Documents</h2>
          {(Object.keys(DOC_FILES) as Doc[]).map((docKey) => (
            <button
              key={docKey}
              onClick={() => setActiveDoc(docKey)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeDoc === docKey
                  ? 'bg-[--accent-info]/10 dark:bg-[--accent-info]/20 text-[--accent-info]'
                  : 'text-[--text-secondary] hover:bg-[--bg-hover]'
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
            <Icon name="spinner" className="w-10 h-10 text-[--text-muted]" />
          </div>
        ) : error ? (
          <div className="text-red-500 bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
            <h3 className="font-bold text-lg">Error loading document</h3>
            <p>{error}</p>
          </div>
        ) : (
          <>
            <article className="prose prose-sm md:prose-base max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ node, inline, className, children, ...props }: any) {
                    const match = /language-(\w+)/.exec(className || '');
                    return !inline && match ? (
                      <div className="not-prose bg-[--code-bg] rounded-lg my-2 border border-[--border-primary]">
                        <SyntaxHighlighter
                          style={syntaxTheme}
                          language={match[1]}
                          PreTag="div"
                          customStyle={{ background: 'transparent', margin: 0 }}
                        >
                          {String(children).replace(/\n$/, '')}
                        </SyntaxHighlighter>
                      </div>
                    ) : (
                      <code className="not-prose bg-blue-500/10 text-blue-600 dark:text-blue-400 px-1 py-0.5 rounded-sm" {...props}>
                        {children}
                      </code>
                    );
                  },
                }}
              >
                {content}
              </ReactMarkdown>
            </article>
            <footer className="mt-8 pt-4 border-t border-[--border-primary] text-center text-xs text-[--text-muted]">
              <button onClick={onOpenAbout} className="text-[--accent-info] hover:underline mb-2">
                About This App
              </button>
              <p>Designed by Tim Sinaeve</p>
            </footer>
          </>
        )}
      </main>
    </div>
  );
};

export default InfoView;
