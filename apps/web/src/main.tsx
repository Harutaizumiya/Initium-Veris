import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { AuthProvider } from './providers/AuthProvider.tsx';
import { NotificationProvider } from './providers/NotificationProvider.tsx';
import { QueryProvider } from './providers/QueryProvider.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryProvider>
      <NotificationProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </NotificationProvider>
    </QueryProvider>
  </StrictMode>,
);
