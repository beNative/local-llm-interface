import React, { createContext, useState, useCallback, ReactNode, useContext } from 'react';
import Icon from './Icon';
import { useTooltipTrigger } from '../hooks/useTooltipTrigger';

type ToastType = 'info' | 'success' | 'error';

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface Toast {
  id: number;
  message: ReactNode;
  type: ToastType;
  duration?: number;
  action?: ToastAction;
}

interface ToastContextType {
  addToast: (toast: Omit<Toast, 'id'>) => void;
  toasts: Toast[];
  removeToast: (id: number) => void;
}

export const ToastContext = createContext<ToastContextType | undefined>(undefined);

const ToastComponent: React.FC<{ toast: Toast; onDismiss: (id: number) => void }> = ({ toast, onDismiss }) => {
  const [isExiting, setIsExiting] = useState(false);
  const dismissTooltip = useTooltipTrigger('Dismiss');

  React.useEffect(() => {
    if (toast.duration) {
      const timer = setTimeout(() => {
        setIsExiting(true);
        setTimeout(() => onDismiss(toast.id), 300);
      }, toast.duration);
      return () => clearTimeout(timer);
    }
  }, [toast.id, toast.duration, onDismiss]);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => onDismiss(toast.id), 300);
  };

  const typeStyles = {
    info: {
      icon: <Icon name="info" className="w-5 h-5 text-blue-500" />,
      bg: 'bg-blue-50 dark:bg-blue-900/50',
      border: 'border-blue-300 dark:border-blue-700'
    },
    success: {
      icon: <Icon name="checkCircle" className="w-5 h-5 text-green-500" />,
      bg: 'bg-green-50 dark:bg-green-900/50',
      border: 'border-green-300 dark:border-green-700'
    },
    error: {
      icon: <Icon name="alertCircle" className="w-5 h-5 text-red-500" />,
      bg: 'bg-red-50 dark:bg-red-900/50',
      border: 'border-red-300 dark:border-red-700'
    }
  };

  return (
    <div
      className={`relative flex items-start gap-3 w-full max-w-sm p-4 rounded-lg shadow-lg border transition-all duration-300 transform ${typeStyles[toast.type].bg} ${typeStyles[toast.type].border} ${isExiting ? 'opacity-0 translate-x-full' : 'opacity-100 translate-x-0'}`}
      role="alert"
    >
      <div className="flex-shrink-0 mt-0.5">{typeStyles[toast.type].icon}</div>
      <div className="flex-grow">
        <p className="text-sm font-medium text-[--text-primary]">{toast.message}</p>
        {toast.action && (
          <button
            onClick={toast.action.onClick}
            className="mt-2 px-3 py-1 text-xs font-semibold text-white bg-[--accent-chat] rounded-md hover:brightness-95"
          >
            {toast.action.label}
          </button>
        )}
      </div>
      <button {...dismissTooltip} onClick={handleDismiss} className="absolute top-1 right-1 p-1 rounded-full text-[--text-muted] hover:bg-black/10 dark:hover:bg-white/10">
        <Icon name="x" className="w-4 h-4" />
      </button>
    </div>
  );
};

export const ToastContainer: React.FC = () => {
  const context = useContext(ToastContext);
  if (!context) {
    return null;
  }
  const { toasts, removeToast } = context;

  return (
    <div className="fixed bottom-4 right-4 z-[100] w-full max-w-sm space-y-3">
      {toasts.map(toast => (
        <ToastComponent key={toast.id} toast={toast} onDismiss={removeToast} />
      ))}
    </div>
  );
};

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Date.now();
    setToasts(prevToasts => [...prevToasts, { ...toast, id }]);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts(prevToasts => prevToasts.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, toasts, removeToast }}>
      {children}
    </ToastContext.Provider>
  );
};
