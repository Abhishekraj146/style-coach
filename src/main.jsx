import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

createRoot(document.getElementById('root')).render(<App />)

// Offline helper sirf final (built) app mein. Dev mein cache se purana code dikh ke confuse karta hai.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('SW register fail', e))
}

// Browser se kaho ki photos/data apne aap delete na kare (storage full hone pe bhi)
navigator.storage?.persist?.()
