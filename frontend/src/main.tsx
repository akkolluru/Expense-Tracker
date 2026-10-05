import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { queryClient, queryPersister } from './services/queryClient';
import { registerServiceWorker } from './registerServiceWorker';
import App from './App';
import './index.css';

// Register PWA service worker for app shell offline caching
registerServiceWorker();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister: queryPersister }}
    >
      <App />
    </PersistQueryClientProvider>
  </StrictMode>
);
