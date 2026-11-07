import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { ToastProvider } from './components/ui/Toast.jsx';
import { StoreProvider } from './store/StoreContext.jsx';
import { SyncProvider } from './sync/SyncProvider.jsx';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ToastProvider>
      <StoreProvider>
        <SyncProvider>
          <App />
        </SyncProvider>
      </StoreProvider>
    </ToastProvider>
  </StrictMode>,
);
