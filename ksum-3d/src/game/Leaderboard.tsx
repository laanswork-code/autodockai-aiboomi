/*
 * Leaderboard: most completed parks, then the fastest hand-over (from booking
 * a slot to the car being on its pallet). In game it is built from the shared
 * world (L to open); on the login screen it comes from the server over HTTP.
 */
import { useEffect, useState } from 'react'
import type { PlayerStats } from './protocol'
import { useGame } from './store'

interface Entry extends PlayerStats { plate: string }

const rank = (stats: Record<string, PlayerStats>): Entry[] => Object.entries(stats)
  .map(([plate, s]) => ({ plate, ...s }))
  .sort((a, b) => b.parks - a.parks || a.bestMs - b.bestMs)
  .slice(0, 10)

function Board({ entries, me }: { entries: Entry[]; me?: string }) {
  if (!entries.length) return <p className="gm-board-empty">No parks yet. Be the first on the board.</p>
  return (
    <ol className="gm-board-list">
      {entries.map((e, i) => (
        <li key={e.plate} aria-current={e.plate === me ? 'true' : undefined}>
          <span className="gm-rank">{i + 1}</span>
          <span className="gm-who"><strong>{e.name}</strong><em>{e.plate}</em></span>
          <span className="gm-num">{e.parks}<small>parks</small></span>
          <span className="gm-num">{(e.bestMs / 1000).toFixed(1)}<small>s best</small></span>
        </li>
      ))}
    </ol>
  )
}

/** In game: L toggles it. */
export function BoardOverlay() {
  const open = useGame((s) => s.board)
  const stats = useGame((s) => s.world?.stats)
  const me = useGame((s) => s.me?.plate)
  if (!open) return null
  return (
    <div className="gm-board" role="dialog" aria-label="Leaderboard">
      <h2>Leaderboard</h2>
      <p className="gm-board-sub">Most parks, then the fastest hand-over: from booking to the car on its pallet.</p>
      <Board entries={rank(stats ?? {})} me={me} />
      <p className="gm-board-foot">L or Esc to close</p>
    </div>
  )
}

/** On the login card: fetched before you join, refreshed every few seconds. */
export function BoardPreview() {
  const [entries, setEntries] = useState<Entry[] | null>(null)
  useEffect(() => {
    let alive = true
    const load = () => fetch('/game/board').then((r) => (r.ok ? r.json() : null)).then((e) => { if (alive && e) setEntries(e) }).catch(() => {})
    load()
    const id = window.setInterval(load, 8000)
    return () => { alive = false; window.clearInterval(id) }
  }, [])
  if (!entries) return null
  return (
    <section className="gm-board-mini" aria-label="Leaderboard">
      <h2>Leaderboard</h2>
      <Board entries={entries.slice(0, 5)} />
    </section>
  )
}
