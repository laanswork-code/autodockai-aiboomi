import type { MouseEvent, ReactNode } from 'react'
import { navigate, useRoute, type Route } from './route.ts'

/** In-app link: plain anchor (works with new tab and middle click), routed on a normal click. */
export function Link({ to, className, children }: { to: Route; className?: string; children: ReactNode }) {
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    navigate(to)
  }
  return <a href={to} className={className} onClick={onClick} aria-current={useRoute() === to ? 'page' : undefined}>{children}</a>
}

/** The three pages, shown on every one of them. */
export function NavLinks({ className = 'nav' }: { className?: string }) {
  return (
    <nav className={className} aria-label="Pages">
      <Link to="/">Digital twin</Link>
      <Link to="/dashboard">Dashboard</Link>
      <Link to="/problems">Problems</Link>
    </nav>
  )
}
