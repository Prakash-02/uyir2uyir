import { BrowserRouter } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { AppRoutes } from './routes'
import { ToastProvider } from './components/Toast'

export function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AppShell>
          <AppRoutes />
        </AppShell>
      </ToastProvider>
    </BrowserRouter>
  )
}

export default App
