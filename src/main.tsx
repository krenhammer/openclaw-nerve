/**
 * main.tsx — Nerve application entry point.
 *
 * Mounts the React root and wraps the app in ErrorBoundary → StrictMode.
 * Routes:
 *   /vowel-logo — Vowel logo preview (no auth)
 *   * — Main app (AuthGate → App)
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { AuthGate } from '@/features/auth'
import { NerveLogoPreview, VowelLogoPreview } from '@/pages/VowelLogoPreview'

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <StrictMode>
      <BrowserRouter>
        <Routes>
          <Route path="/vowel-logo" element={<VowelLogoPreview />} />
          <Route path="/nerve-logo" element={<NerveLogoPreview />} />
          <Route path="*" element={<AuthGate />} />
        </Routes>
      </BrowserRouter>
    </StrictMode>
  </ErrorBoundary>,
)
