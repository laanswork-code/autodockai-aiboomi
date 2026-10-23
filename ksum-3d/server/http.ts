/*
 * HTTP handler for the decision server, kept apart from index.ts so tests can
 * drive it without opening a port. Routes:
 *   POST /api/decide   DecideRequest -> DecideResponse (audited)
 *   GET  /api/health   model name, whether the key is set (never the key), Jev usage totals
 *   GET  /api/audit    last N audit entries (?limit=50)
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Arrival, AuditEntry, DecideRequest, DecideResponse, Decider, JevUsage, SiteState } from '../src/control/types.ts'
import { appendAudit, readAudit } from './audit.ts'
import { JEV_MODEL, lastJevModel } from './jevDecider.ts'

/** Bodies above this are refused; a real request is a few KB. */
const MAX_BODY_BYTES = 256 * 1024
const MAX_AUDIT_LIMIT = 500

export interface HandlerDeps {
  decider: Decider
  appendAudit?: (entry: AuditEntry) => Promise<void>
  readAudit?: (limit: number) => Promise<AuditEntry[]>
  /** Jev call and cost totals, sent with /api/health and every decision. */
  usage?: () => JevUsage
}

type Check = (v: unknown) => boolean
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const num: Check = (v) => typeof v === 'number' && Number.isFinite(v)
const str: Check = (v) => typeof v === 'string'
const bool: Check = (v) => typeof v === 'boolean'
const range = (lo: number, hi: number): Check => (v) => num(v) && (v as number) >= lo && (v as number) <= hi
const oneOf = (...xs: unknown[]): Check => (v) => xs.includes(v)
const orNull = (c: Check): Check => (v) => v === null || c(v)

/** Returns the first field that fails, as a dotted path, or null when the shape is valid. */
function firstBad(v: unknown, shape: Record<string, Check | Record<string, Check>>, at: string): string | null {
  if (!isObj(v)) return at
  for (const [k, c] of Object.entries(shape)) {
    const bad = typeof c === 'function' ? (c(v[k]) ? null : `${at}.${k}`) : firstBad(v[k], c, `${at}.${k}`)
    if (bad) return bad
  }
  return null
}

const ARRIVAL = {
  id: (v: unknown) => typeof v === 'string' && v.length > 0,
  t: num,
  bookedPlate: str,
  plateRead: { text: str, ocrConfidence: range(0, 1) },
  vehicle: { model: str, ev: bool, batteryKwh: range(0, 500), socPct: range(0, 100), fleet: orNull(oneOf('robotaxi')) },
  plannedStayMin: orNull(range(0, 7 * 1440)),
  note: str,
  payment: { method: oneOf('upi', 'card', 'fastag'), status: oneOf('ok', 'pending', 'mismatch') },
}
const STATE = {
  t: num,
  gridPriceInr: num,
  offPeak: { priceInr: num, from: num },
  solarKw: num,
  gridLimitKw: num,
  loadKw: num,
  queue: range(0, 10_000),
  scenario: oneOf('normal', 'rush_hour', 'power_cut', 'robotaxi_fleet'),
}
const PALLET = { index: range(0, 1000), occupiedBy: orNull(str), expectedOut: orNull(num), charging: bool }

/** Validates a POST /api/decide body. Returns the request or a message naming the bad field. */
export function parseDecideRequest(body: unknown): DecideRequest | string {
  if (!isObj(body)) return 'body must be a JSON object with arrival and state'
  const bad = firstBad(body.arrival, ARRIVAL, 'arrival') ?? firstBad(body.state, STATE, 'state')
  if (bad) return `invalid field: ${bad}`
  const towers = (body.state as Record<string, unknown>).towers
  if (!Array.isArray(towers) || towers.length !== 2) return 'invalid field: state.towers (need two towers)'
  for (const [i, tower] of towers.entries()) {
    const tb = firstBad(tower, { id: oneOf(i), palletAtDoor: range(0, 1000) }, `state.towers[${i}]`)
    if (tb) return `invalid field: ${tb}`
    const pallets = (tower as Record<string, unknown>).pallets
    if (!Array.isArray(pallets) || pallets.length === 0) return `invalid field: state.towers[${i}].pallets`
    for (const [j, p] of pallets.entries()) {
      const pb = firstBad(p, PALLET, `state.towers[${i}].pallets[${j}]`)
      if (pb) return `invalid field: ${pb}`
    }
  }
  return { arrival: body.arrival as unknown as Arrival, state: body.state as unknown as SiteState }
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' })
  res.end(JSON.stringify(body))
}

async function readBody(req: IncomingMessage): Promise<string> {
  let size = 0
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    size += (chunk as Buffer).length
    if (size > MAX_BODY_BYTES) throw new Error('too large')
    chunks.push(chunk as Buffer)
  }
  return Buffer.concat(chunks).toString('utf8')
}

export function createHandler(deps: HandlerDeps) {
  const append = deps.appendAudit ?? ((e: AuditEntry) => appendAudit(e))
  const read = deps.readAudit ?? ((n: number) => readAudit(n))

  return async function handle(req: IncomingMessage, res: ServerResponse) {
    const url = new URL(req.url ?? '/', 'http://localhost')
    try {
      if (url.pathname === '/api/health' && req.method === 'GET') {
        return send(res, 200, {
          ok: true,
          decider: deps.decider.name,
          model: JEV_MODEL,
          lastModel: lastJevModel,
          keySet: Boolean(process.env.TYPESAFE_API_KEY?.trim()),
          jev: deps.usage?.(),
        })
      }
      if (url.pathname === '/api/audit' && req.method === 'GET') {
        const raw = Number(url.searchParams.get('limit') ?? 50)
        const limit = Number.isFinite(raw) ? Math.min(MAX_AUDIT_LIMIT, Math.max(0, Math.floor(raw))) : 50
        return send(res, 200, { entries: await read(limit) })
      }
      if (url.pathname === '/api/decide') {
        if (req.method !== 'POST') return send(res, 405, { error: 'use POST' })
        let body: unknown
        try {
          body = JSON.parse(await readBody(req))
        } catch {
          return send(res, 400, { error: 'body is not valid JSON (or over 256 KB)' })
        }
        const parsed = parseDecideRequest(body)
        if (typeof parsed === 'string') return send(res, 400, { error: parsed })
        const decisions = await deps.decider.decide(parsed.arrival, parsed.state)
        // The audit trail matters, but a full disk must not block a car at the gate.
        await append({ at: new Date().toISOString(), arrival: parsed.arrival, decisions })
          .catch((e: unknown) => console.error('[audit] append failed:', e))
        const response: DecideResponse = { decisions, usage: deps.usage?.() }
        return send(res, 200, response)
      }
      return send(res, 404, { error: 'not found' })
    } catch (error) {
      console.error('[server]', error)
      if (!res.headersSent) send(res, 500, { error: 'internal error' })
    }
  }
}
