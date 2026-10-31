import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

// Laptop pe:  npm run dev        -> http://localhost:5173 (localhost pe camera bina HTTPS chalta hai)
// Phone pe:   npm run dev:phone  -> https://<laptop-ka-IP>:5173
//   Phone ka browser camera sirf HTTPS pe deta hai, isliye self-signed certificate lagate hain
//   (phone pe "Not secure" warning aayegi -> Advanced -> Proceed).
export default defineConfig(({ mode }) => ({
  base: './', // relative paths: GitHub Pages pe /style-coach/ jaise sub-folder mein bhi chalega
  plugins: [react(), ...(mode === 'phone' ? [basicSsl()] : [])],
  server: { host: mode === 'phone', port: 5173 },
}))
