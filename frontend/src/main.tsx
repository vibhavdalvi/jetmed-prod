import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App';
import { store } from './features/store';
import { waitForApiReady } from './services/waitForApiReady';
import './styles/index.css';

function AppRoot() {
  const [phase, setPhase] = useState<'connecting' | 'ready' | 'unreachable'>('connecting');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    waitForApiReady().then(
      () => setPhase('ready'),
      (err: unknown) => {
        setErrorMessage(err instanceof Error ? err.message : 'Unknown error');
        setPhase('unreachable');
      }
    );
  }, []);

  if (phase === 'connecting') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">
        <p className="text-sm font-medium">Connecting to services…</p>
      </div>
    );
  }

  if (phase === 'unreachable') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 px-6 text-center text-slate-700">
        <p className="text-lg font-semibold">Cannot reach the API</p>
        <p className="max-w-md text-sm text-slate-600">{errorMessage}</p>
      </div>
    );
  }

  return (
    <>
      <App />
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#1f2937',
            color: '#fff',
            borderRadius: '12px',
          },
          success: {
            iconTheme: { primary: '#22C55E', secondary: '#fff' },
          },
          error: {
            iconTheme: { primary: '#EF4444', secondary: '#fff' },
          },
        }}
      />
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <AppRoot />
      </BrowserRouter>
    </Provider>
  </React.StrictMode>
);
