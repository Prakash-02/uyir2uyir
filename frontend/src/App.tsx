import { BrowserRouter } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { AppRoutes } from './routes'
import { ToastProvider } from './components/Toast'
import { LangProvider } from './i18n/useT'
import { ThemeProvider } from './lib/theme'

export function App() {
  return (
    <ThemeProvider>
      <LangProvider>
        <BrowserRouter>
          <ToastProvider>
            <AppShell>
              <AppRoutes />
            </AppShell>
          </ToastProvider>
        </BrowserRouter>
      </LangProvider>
    </ThemeProvider>
  )
}

export default App
