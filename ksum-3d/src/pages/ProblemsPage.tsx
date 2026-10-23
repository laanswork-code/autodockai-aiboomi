import { memo, useDeferredValue, useMemo, useState } from 'react'
import { NavLinks } from '../Nav.tsx'
import { CATEGORY_LABEL, CITIES, KERALA, KIND_LABEL, PROBLEMS, countBy, type Problem } from './problems.ts'
import './pages.css'
import './problems.css'

type Kind = keyof typeof KIND_LABEL
const keralaCount = PROBLEMS.filter((p) => KERALA.has(p.city)).length
const cityCounts = new Map(countBy(PROBLEMS, (p) => p.city))
// "Google News" dates look like "04/28/2025, 07:00 AM, +0000 UTC"
const niceDate = (d: string) => {
  const m = /^(\d\d)\/(\d\d)\/(\d{4})/.exec(d)
  return m ? new Date(+m[3], +m[1] - 1, +m[2]).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : d
}
const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, '') } catch { return '' } }

/** Real parking problems from Reddit, forums and news, grouped by problem, biggest first. */
export default function ProblemsPage() {
  const [kind, setKind] = useState<Kind>('all')
  const [city, setCity] = useState('')
  const [query, setQuery] = useState('')
  const q = useDeferredValue(query.trim().toLowerCase())

  const list = useMemo(() => PROBLEMS.filter((p) => {
    if (kind !== 'all' && p.kind !== kind) return false
    if (city && p.city !== city) return false
    if (!q) return true
    const hay = `${p.problem} ${p.quote} ${p.title} ${p.snippet} ${p.source} ${p.city}`.toLowerCase()
    return q.split(/\s+/).every((w) => hay.includes(w))
  }), [kind, city, q])
  const groups = useMemo(() => countBy(list, (p) => p.category), [list])

  return (
    <div className="page">
      <div className="page__bar" />
      <div className="page__wrap">
        <header className="page__head">
          <div className="page__title">
            <p className="kicker">AutoDock · research</p>
            <h1>Parking problems people face</h1>
            <p className="sub">{PROBLEMS.length} problems from Reddit, forums and news, {keralaCount} of them in Kerala. Biggest problem first, Kerala first within each. Every card links to the original.</p>
          </div>
          <NavLinks />
        </header>

        <div className="pbar">
          <input type="search" placeholder="Search problems…" aria-label="Search problems" value={query} onChange={(e) => setQuery(e.target.value)} />
          <div className="seg seg--small" role="group" aria-label="Source type">
            {(Object.keys(KIND_LABEL) as Kind[]).map((k) => (
              <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}>{KIND_LABEL[k]}</button>
            ))}
          </div>
          <select value={city} onChange={(e) => setCity(e.target.value)} aria-label="Place">
            <option value="">All places</option>
            {CITIES.filter((c) => cityCounts.has(c)).map((c) => <option key={c} value={c}>{c} ({cityCounts.get(c)})</option>)}
          </select>
          <span className="pbar__count">{list.length} of {PROBLEMS.length}</span>
        </div>
        <nav className="pjump" aria-label="Jump to problem">
          {groups.map(([cat, n]) => <a key={cat} href={`#p-${cat}`}>{CATEGORY_LABEL[cat] ?? cat} <b>{n}</b></a>)}
        </nav>

        {groups.length === 0 ? <p className="pempty">Nothing matches. <button type="button" className="btn" onClick={() => { setQuery(''); setKind('all'); setCity('') }}>Clear filters</button></p> : groups.map(([cat, n], g) => (
          <section key={cat} className="pgroup">
            <h2 id={`p-${cat}`}><span>{String(g + 1).padStart(2, '0')}</span> {CATEGORY_LABEL[cat] ?? cat} <small>{n} {n === 1 ? 'problem' : 'problems'}</small></h2>
            <div className="pgrid">
              {list.filter((p) => p.category === cat).map((p) => <ProblemCard key={p.url} p={p} />)}
            </div>
          </section>
        ))}
        <p className="pfoot">Problem lines are AI summaries of each search result's title and snippet; open the original before quoting. Collected with SerpAPI on 23 Oct 2026. Posts belong to their authors.</p>
      </div>
    </div>
  )
}

const ProblemCard = memo(function ProblemCard({ p }: { p: Problem }) {
  const showQuote = p.quote && !p.title.toLowerCase().includes(p.quote.toLowerCase().slice(0, 40))
  const who = [p.source || host(p.url), p.city, p.engagement || niceDate(p.date)].filter(Boolean).join(' · ')
  return (
    <article className={`pcard pcard--${p.kind}`}>
      <p className="pcard__problem">{p.problem || p.title}</p>
      {showQuote && <p className="pcard__quote">“{p.quote}”</p>}
      <div className="pcard__src">
        <span>{who}</span>
        <a href={p.url} target="_blank" rel="noopener noreferrer">{p.problem ? p.title : 'Read original'} ↗</a>
        {p.related && <span className="pcard__rel">+{p.related.length} more {p.related.length === 1 ? 'report' : 'reports'}: {p.related.map((r, i) => (
          <a key={r.url} href={r.url} target="_blank" rel="noopener noreferrer">{r.source || host(r.url)}{i < p.related!.length - 1 ? ', ' : ''}</a>
        ))}</span>}
      </div>
    </article>
  )
})
