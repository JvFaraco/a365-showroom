import React from 'react'
import { createRoot } from 'react-dom/client'
// Poppins e Encode Sans (as mesmas do Google Fonts), empacotadas para o demo funcionar offline no telão.
// Só os subconjuntos latin e latin-ext: os demais (devanágari, cirílico, vietnamita) não são usados.
import '@fontsource/poppins/latin-400.css'
import '@fontsource/poppins/latin-ext-400.css'
import '@fontsource/poppins/latin-600.css'
import '@fontsource/poppins/latin-ext-600.css'
import '@fontsource/poppins/latin-700.css'
import '@fontsource/poppins/latin-ext-700.css'
import '@fontsource/encode-sans/latin-400.css'
import '@fontsource/encode-sans/latin-ext-400.css'
import '@fontsource/encode-sans/latin-500.css'
import '@fontsource/encode-sans/latin-ext-500.css'
import '@fontsource/encode-sans/latin-600.css'
import '@fontsource/encode-sans/latin-ext-600.css'
import './index.css'
import App from './App'
import { boot } from './boot'

boot.set(0.15, 'Montando a cena')

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
