import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

// The temporary public AR test site is built with VITE_AR_ONLY=true; Vite
// replaces the flag at build time, so the museum app is dropped from that bundle.
const loadRoot =
  import.meta.env.VITE_AR_ONLY === 'true' ? () => import('./ARApp.jsx') : () => import('./Root.jsx')

loadRoot().then(({ default: Root }) => {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <Root />
    </StrictMode>,
  )
})
