import type { PropsWithChildren } from 'react'
import { Link, NavLink } from 'react-router-dom'
import './AppLayout.css'

export function AppLayout({ children }: PropsWithChildren) {
  return (
    <div className="app-layout">
      <header className="app-header">
        <div className="app-header__content">
          <Link to="/" className="app-title">App</Link>
          <nav className="app-nav">
            <NavLink to="/" className={({ isActive }) => isActive ? 'active' : ''}>Home</NavLink>
            <NavLink to="/about" className={({ isActive }) => isActive ? 'active' : ''}>About</NavLink>
          </nav>
        </div>
      </header>
      <main className="app-main">{children}</main>
    </div>
  )
}