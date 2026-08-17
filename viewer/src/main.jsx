import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import App from './app/App.jsx'
import { bootDemo } from './demo'
import { startUpdateWatch } from './app/appUpdate'

startUpdateWatch()

bootDemo().then(() => {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
