import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { Buffer } from 'buffer';
import process from 'process';

// Polyfills for simple-peer and other node-based libs
window.global = window;
window.Buffer = Buffer;
window.process = process;

import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
