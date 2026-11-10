import React from 'react'
import { createRoot } from 'react-dom/client'
// Poppins e Encode Sans (as mesmas do Google Fonts), empacotadas para o demo funcionar offline no telão.
import '@fontsource/poppins/400.css'
import '@fontsource/poppins/600.css'
import '@fontsource/poppins/700.css'
import '@fontsource/encode-sans/400.css'
import '@fontsource/encode-sans/500.css'
import '@fontsource/encode-sans/600.css'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
