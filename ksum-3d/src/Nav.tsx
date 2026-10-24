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

/** The AutoDock stack mark: three pallets, one footprint. */
export function LogoMark() {
  return (
    <svg viewBox="0 0 18 20" aria-hidden="true">
      <rect x="1" y="1" width="16" height="4.4" rx="1.2" fill="currentColor" />
      <rect x="1" y="7.8" width="16" height="4.4" rx="1.2" fill="currentColor" />
      <rect x="1" y="14.6" width="16" height="4.4" rx="1.2" fill="currentColor" />
    </svg>
  )
}

export function Logo() {
  return <Link to="/" className="ad-logo"><LogoMark />AutoDock<sup>AI</sup></Link>
}

/** Header for the content pages: logo, page links in mono caps, and the game as the call to action. */
export function SiteHeader() {
  return (
    <header className="ad-header">
      <Logo />
      <NavLinks />
      <Link to="/play" className="ad-btn">Play the game</Link>
    </header>
  )
}

/** Dark footer with the giant wordmark. */
export function SiteFooter() {
  return (
    <footer className="ad-footer">
      <div className="ad-footer__grid">
        <div>
          <Logo />
          <p>The AI intelligence layer for smart parking, and for the autonomous parking infrastructure that comes next.</p>
        </div>
        <div>
          <h4>Product</h4>
          <ul>
            <li><Link to="/">Digital twin</Link></li>
            <li><Link to="/how">How it works</Link></li>
            <li><Link to="/play">Play</Link></li>
          </ul>
        </div>
        <div>
          <h4>Operations</h4>
          <ul>
            <li><Link to="/dashboard">Dashboard</Link></li>
            <li><Link to="/problems">Problems</Link></li>
            <li><Link to="/film">Driver journey</Link></li>
          </ul>
        </div>
        <div>
          <h4>Source</h4>
          <ul>
            <li><a href="https://github.com/laanswork-code/autodockai-aiboomi">GitHub ↗</a></li>
            <li><a href="https://autodockai.com/">autodockai.com ↗</a></li>
          </ul>
        </div>
      </div>
      <span className="ad-footer__mark" aria-hidden="true">AutoDock</span>
      <div className="ad-footer__base">
        <span>AutoDock AI × Jev · AIBoomi Startup Weekend</span>
        <span>KINFRA Hi-Tech Park, Kalamassery, Kerala</span>
      </div>
    </footer>
  )
}

/** The pages, shown on every one of them. */
export function NavLinks({ className = 'nav' }: { className?: string }) {
  return (
    <nav className={className} aria-label="Pages">
      <Link to="/">Digital twin</Link>
      <Link to="/how">How it works</Link>
      <Link to="/dashboard">Dashboard</Link>
      <Link to="/problems">Problems</Link>
      <Link to="/play">Play</Link>
    </nav>
  )
}
