import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // The Jev decision server (npm run server) holds the TypeSafe key; the browser only talks to /api.
  server: { proxy: { '/api': 'http://localhost:8787' } },
})
