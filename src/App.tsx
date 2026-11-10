import { ArrowLeft, Download, Upload } from 'lucide-react'
import { Component, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { HashRouter, Link, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { gameIds } from './engine/session.ts'
import type { Game, Settings } from './engine/session.ts'
import { clearData, exportData, importData, openData, saveSettings, useData } from './engine/storage.ts'
import { ChallengePage, FullSetup, GameIntro, Home } from './games/Setup.tsx'
import { ResultsPage, RunPage } from './games/Run.tsx'

function SettingsPage() {
  const settings = useData(s => s.settings)
  const [message, setMessage] = useState('')
  const [dataMessage, setDataMessage] = useState('')
  const [confirm, setConfirm] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const edit = (change: Partial<Settings>) => {
    setMessage('')
    void saveSettings({ ...useData.getState().settings, ...change }).then(() => {
      setMessage(useData.getState().limited ? 'Preferences updated for this visit.' : 'Preferences saved.')
    })
  }
  return <div className="settings-sheet">
    <Link className="back-link" to="/"><ArrowLeft size={17} /> Assessments</Link>
    <div className="page-heading"><h1>Settings</h1></div>
    <section className="panel" aria-label="Preferences">
      <label className="inline-label">Theme<select value={settings.theme} onChange={e => edit({ theme: e.target.value as Settings['theme'] })}>
        <option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option>
      </select></label>
      <label className="checkbox"><input type="checkbox" checked={settings.reducedMotion}
        onChange={e => edit({ reducedMotion: e.target.checked })} />Reduce motion</label>
      <label className="checkbox"><input type="checkbox" checked={settings.sound}
        onChange={e => edit({ sound: e.target.checked })} />Practice feedback sound</label>
      {message && <p role="status">{message}</p>}
    </section>
    <details className="panel">
      <summary>Local data</summary>
      <div className="actions">
        <button className="secondary" onClick={() => {
          const url = URL.createObjectURL(new Blob([exportData()], { type: 'application/json' }))
          const download = document.createElement('a'); download.href = url; download.download = 'delta-assessments-backup.json'; download.click()
          window.setTimeout(() => URL.revokeObjectURL(url), 3000)
        }}><Download size={17} /> Export data</button>
        <button className="secondary" onClick={() => input.current?.click()}><Upload size={17} /> Import data</button>
        <input ref={input} type="file" accept=".json,application/json" hidden onChange={async e => {
          const file = e.target.files?.[0]; e.target.value = ''
          if (!file) return
          try { await importData(await file.text()); setDataMessage('Backup imported.') } catch (err) { setDataMessage(err instanceof Error ? err.message : 'Backup could not be imported.') }
        }} />
        <button className="quiet danger" onClick={() => { setDataMessage(''); setConfirm(true) }}>Clear saved attempts</button>
      </div>
      {confirm && <div className="notice">Clear all saved attempts and progress on this device?
        <div className="actions"><button className="secondary" onClick={() => setConfirm(false)}>Cancel</button>
          <button className="primary" onClick={async () => { await clearData(); setConfirm(false); setDataMessage('Saved attempts cleared.') }}>Clear attempts</button></div>
      </div>}
      {dataMessage && <p role="status">{dataMessage}</p>}
    </details>
  </div>
}

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
          <Route path="/full" element={<FullSetup />} />
          <Route path="/play/:id" element={<RunPage />} />
          <Route path="/results/:id" element={<ResultsPage />} />
          <Route path="/challenge" element={<ChallengePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Missing />} />
        </Routes>
      </AppBoundary>}
    </main>
  </>
}

export default function App() {
  return <HashRouter><Layout /></HashRouter>
}
