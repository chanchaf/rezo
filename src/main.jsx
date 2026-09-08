import React from 'react';
import ReactDOM from 'react-dom/client';
import { installStoragePolyfill } from './lib/storagePolyfill.js';
import App from './App.jsx';
import './index.css';

installStoragePolyfill();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
