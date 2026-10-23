/*
 * Jev decision server. Holds the TypeSafe key so it never reaches the browser;
 * Vite proxies /api here in development. Run: npm run server
 */
import { createServer } from 'node:http'
import { createHandler } from './http.ts'
import { jevDecider } from './jevDecider.ts'
import { jevUsage } from './jevUsage.ts'

// 8788: another local project already uses 8787
const port = Number(process.env.PORT) || 8788

if (!process.env.TYPESAFE_API_KEY?.trim()) {
  console.warn('[server] TYPESAFE_API_KEY is not set: every decision will use the rules fallback')
}

createServer(createHandler({ decider: jevDecider, usage: jevUsage.snapshot })).listen(port, () => {
  console.log(`[server] Jev decision server on http://localhost:${port}`)
})
