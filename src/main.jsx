import "./polyfills";
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'


window.global = window;

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)

// Register Service Worker for PWA functionality
