import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import AIQuestionScan from './AIQuestionScan.jsx';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
    <AIQuestionScan />
  </React.StrictMode>,
);
