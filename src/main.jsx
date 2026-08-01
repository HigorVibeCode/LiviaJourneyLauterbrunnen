import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Sem StrictMode: double-mount do Canvas/WebGL no dev deixava o framebuffer
// limpo sem draw (tela azul/branca) em vários browsers.
createRoot(document.getElementById('root')).render(<App />)
