import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './app/App';
import { aplicarTemaGuardado } from './shared/lib/tema';
import './shared/ui/tokens.css';
import './shared/ui/patterns.css';

aplicarTemaGuardado();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
