import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { ApiErrorDisplay } from './components/ApiErrorDisplay';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

// Critical check for API key presence to provide a better developer experience.
const apiKey = process.env.API_KEY;

root.render(
  <React.StrictMode>
    {apiKey ? <App /> : <ApiErrorDisplay />}
  </React.StrictMode>
);