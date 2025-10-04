import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { InstrumentationProvider } from './components/InstrumentationProvider';
import { InstrumentationErrorBoundary } from './components/InstrumentationErrorBoundary';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <InstrumentationProvider>
      <InstrumentationErrorBoundary>
        <App />
      </InstrumentationErrorBoundary>
    </InstrumentationProvider>
  </React.StrictMode>
);
