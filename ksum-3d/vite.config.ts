import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // The Jev decision server (npm run server) holds the TypeSafe key; the browser only talks to /api.
  // /game is the multiplayer socket (npm run game), proxied so the page connects on its own origin.
  // fs.allow lets the dev server serve the pitch film from ../docs/demo on the How it works page.
  server: {
    proxy: { '/api': 'http://localhost:8788', '/game': { target: 'ws://localhost:8790', ws: true } },
    fs: { allow: ['..'] },
  },
})
