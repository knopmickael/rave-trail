import { StrictMode } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { AboutApp } from './components/AboutPage';
import './styles/about.css';
import './i18n/language.css';

hydrateRoot(document.getElementById('about-root')!, <StrictMode><AboutApp /></StrictMode>);
