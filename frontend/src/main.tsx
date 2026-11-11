import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { SkyBackground } from './components/SkyBackground';
import './styles/base.css';
import './styles/app.css';
import './i18n/language.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SkyBackground />
    <App />
  </StrictMode>,
);
