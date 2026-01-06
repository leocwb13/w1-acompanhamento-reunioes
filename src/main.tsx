import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App.tsx';
import ClientPortalPage from './pages/ClientPortalPage.tsx';
import { ToastProvider } from './lib/toast';
import { AuthProvider } from './contexts/AuthContext';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <Routes>
          <Route path="/portal/:token" element={<ClientPortalPage />} />
          <Route path="/*" element={
            <AuthProvider>
              <App />
            </AuthProvider>
          } />
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>
);
