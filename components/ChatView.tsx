
import React, { useState, useRef, useEffect } from 'react';
import type { ChatMessage } from '../types';
import SendIcon from './icons/SendIcon';
import SpinnerIcon from './icons/SpinnerIcon';
import ModelIcon from './icons/ModelIcon';

interface ChatViewProps {
  modelId: string;
  onSendMessage: (message: string) => Promise<void>;
  messages: ChatMessage[];
  isResponding: boolean;
  onBack: () => void;
}

const ChatView: React.FC<ChatViewProps> = ({ modelId, onSendMessage, messages, isResponding, onBack }) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = () => {
    if (input.trim() && !isResponding) {
      onSendMessage(input.trim());
      setInput('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-900">
      <header className="flex items-center justify-between p-4 bg-gray-800 border-b border-gray-700">
         <div className="flex items-center gap-3">
            <ModelIcon className="w-6 h-6 text-blue-400"/>
            <h2 className="text-lg font-semibold text-white">{modelId}</h2>
         </div>
        <button
          onClick={onBack}
          className="px-3 py-1 text-sm font-medium text-gray-300 bg-gray-700 rounded-md hover:bg-gray-600 focus:outline-none"
        >
          &larr; Change Model
        </button>
      </header>
      <main className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.map((msg, index) => (
          <div key={index} className={`flex items-start gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
            {msg.role === 'assistant' && <div className="w-8 h-8 flex-shrink-0 rounded-full bg-gray-700 flex items-center justify-center"><ModelIcon className="w-5 h-5 text-blue-400" /></div>}
            <div
              className={`max-w-xl p-4 rounded-xl whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-none'
                  : 'bg-gray-700 text-gray-200 rounded-bl-none'
              }`}
            >
              {msg.role === 'assistant' && msg.content === '' && isResponding
                ? <SpinnerIcon className="w-5 h-5 text-gray-400"/>
                : msg.content
              }
            </div>
             {msg.role === 'user' && <div className="w-8 h-8 flex-shrink-0 rounded-full bg-gray-700 flex items-center justify-center font-bold">U</div>}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </main>
      <footer className="p-4 bg-gray-800 border-t border-gray-700">
        <div className="relative">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message..."
            rows={1}
            disabled={isResponding}
            className="w-full pl-4 pr-12 py-3 bg-gray-700 text-white rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed"
          />
          <button
            onClick={handleSend}
            disabled={isResponding || !input.trim()}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
          >
            <SendIcon className="w-5 h-5" />
          </button>
        </div>
      </footer>
    </div>
  );
};

export default ChatView;