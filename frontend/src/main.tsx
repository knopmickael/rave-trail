import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { version } from '../../package.json';
import { App } from './App';
import { SkyBackground } from './components/SkyBackground';
import './styles/base.css';
import './styles/app.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SkyBackground />
    <App />
    <span className="app-version" aria-label={`Versão do aplicativo ${version}`}>v{version}</span>
  </StrictMode>,
);
