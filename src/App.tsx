import { Component, useEffect } from 'react'
import type { ReactNode } from 'react'
import { HashRouter, Link, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { gameIds } from './engine/session.ts'
import type { Game } from './engine/session.ts'
import { openData, useData } from './engine/storage.ts'
import { ChallengePage, GameIntro, Home } from './games/Setup.tsx'
import { ResultsPage, RunPage } from './games/Run.tsx'

function GameRoute() {
  const { game } = useParams()
  if (!gameIds.includes(game as Game)) return <Missing />
  return <GameIntro game={game as Game} key={game} />
}

function Missing() {
  return <section className="panel"><h1>Page unavailable</h1><Link to="/">Assessments</Link></section>
}

class AppBoundary extends Component<{ children: ReactNode }, { error: string }> {
  state = { error: '' }
  static getDerivedStateFromError(error: Error) { return { error: error.message } }
  render() {
    return this.state.error ? <section className="panel" role="alert"><h1>This screen could not open</h1>
      <p>{this.state.error}</p><a className="secondary" href={import.meta.env.BASE_URL}>Assessments</a></section> : this.props.children
  }
}

function Layout() {
  const { pathname, hash } = useLocation()
  const settings = useData(s => s.settings), warning = useData(s => s.warning), ready = useData(s => s.ready)
  const playing = pathname.startsWith('/play/')
  useEffect(() => { void openData() }, [])
  useEffect(() => {
    if (!ready) return
    if (pathname === '/' && hash === '#zap-n') {
      const group = document.getElementById('zap-n')
      group?.focus({ preventScroll: true })
      group?.scrollIntoView()
    } else window.scrollTo(0, 0)
  }, [pathname, hash, ready])
  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme
    document.documentElement.dataset.motion = settings.reducedMotion ? 'reduced' : 'normal'
    document.documentElement.dataset.density = settings.compact ? 'compact' : 'standard'
  }, [settings.compact, settings.reducedMotion, settings.theme])
  return <>
    <a className="skip-link" href="#main-content" onClick={e => { e.preventDefault(); document.getElementById('main-content')?.focus() }}>Skip to content</a>
    <main id="main-content" tabIndex={-1} className={playing ? 'main playing' : pathname === '/' ? 'main folio-page' : 'main'}>
      {warning && <p className="notice" role="status">{warning}</p>}
      {!ready ? <p className="loading" role="status">Loading…</p> : <AppBoundary key={pathname}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/game/:game" element={<GameRoute />} />
          <Route path="/zap-n" element={<Navigate to="/#zap-n" replace />} />
          <Route path="/full" element={<Navigate to="/" replace />} />
          <Route path="/play/:id" element={<RunPage />} />
          <Route path="/results/:id" element={<ResultsPage />} />
          <Route path="/challenge" element={<ChallengePage />} />
          <Route path="/settings" element={<Navigate to="/" replace />} />
          <Route path="*" element={<Missing />} />
        </Routes>
      </AppBoundary>}
    </main>
  </>
}

export default function App() {
  return <HashRouter><Layout /></HashRouter>
}
