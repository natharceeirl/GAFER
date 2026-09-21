import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './app/App';
import './shared/ui/tokens.css';
import './shared/ui/patterns.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
