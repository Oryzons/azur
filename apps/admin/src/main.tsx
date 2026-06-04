import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthHydration } from '@/components/AuthHydration';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthHydration>
        <App />
      </AuthHydration>
    </BrowserRouter>
  </StrictMode>,
);
