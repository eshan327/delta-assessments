import { ArrowLeft, Download, Upload } from 'lucide-react'
import { Component, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { HashRouter, Link, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { defaultStage, gameIds, stageSchema } from './engine/session.ts'
import type { Game, Settings, Stage } from './engine/session.ts'
import { clearData, exportData, importData, openData, saveSettings, useData } from './engine/storage.ts'
import { zapIds } from './engine/zap.ts'
import { ChallengePage, FullSetup, GameIntro, Home, StageFields, ZapHub } from './games/Setup.tsx'
import { ResultsPage, resultScore, RunPage } from './games/Run.tsx'
import { gameInfo } from './games/registry.ts'

function HistoryPage() {
  const attempts = useData(s => s.attempts)
  const [game, setGame] = useState<Game | ''>('')
  const finished = attempts.filter(a => a.phase === 'done')
  const filtered = game ? finished.filter(a => a.results.some(r => r.game === game)) : finished
  const trend = game ? filtered.slice(0, 12).reverse().map(a => resultScore(a.results.find(r => r.game === game)!)) : []
  const max = Math.max(1, ...trend.map(Math.abs))
  return <>
    <Link className="back-link" to="/"><ArrowLeft size={17} /> Assessments</Link>
    <div className="page-heading"><h1>History</h1></div>
    <section className="panel">
      <h2>Saved runs</h2>
      {attempts.length === 0 && <p>No saved runs yet.</p>}
      {attempts.filter(a => a.phase !== 'done').map(a => <div className="history-row" key={a.id}><span><strong>{a.title}</strong><small>In progress</small></span>
        <Link className="secondary" to={'/play/' + a.id}>Resume</Link></div>)}
      {finished.length > 0 && <>
        <label className="inline-label">Filter by game<select value={game} onChange={e => setGame(e.target.value as Game | '')}>
          <option value="">All games</option>{gameIds.map(id => <option key={id} value={id}>{gameInfo[id].title}</option>)}
        </select></label>
        {trend.length > 1 && <div className="history-trend" aria-label="Recent scores from oldest to newest">
          {trend.map((score, i) => <div key={i}><i className={score < 0 ? 'negative' : ''} style={{ height: 6 + Math.abs(score) / max * 64 }} /><span>{Number(score.toFixed(2))}</span></div>)}
        </div>}
        {filtered.length === 0 && <p>No completed attempts for this game yet.</p>}
        {filtered.map(a => <div className="history-row" key={a.id}><span><strong>{a.title}</strong>
          <small>{a.mode} · {new Date(a.updatedAt).toLocaleString()} · {a.results.length} {a.results.length === 1 ? 'stage' : 'stages'}</small></span>
          <Link className="secondary" to={'/results/' + a.id}>Review</Link>
        </div>)}
      </>}
    </section>
    <Link className="back-link" to="/settings">Manage backups and history</Link>
  </>
}

function SettingsPage() {
  const settings = useData(s => s.settings)
  const [game, setGame] = useState<Game>('beat-the-odds')
  const [draft, setDraft] = useState<Stage | null>(null)
  const [message, setMessage] = useState('')
  const [confirm, setConfirm] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const edit = (change: Partial<Settings>) => {
    setMessage('')
    void saveSettings({ ...useData.getState().settings, ...change }).then(() => {
      setMessage(useData.getState().limited ? 'Preferences updated for this visit.' : 'Preferences saved.')
    })
  }
  const stage = draft ?? defaultStage(game, 'timed', settings)
  const valid = stageSchema.safeParse(stage).success && (stage.kind === 'zap' ? stage.seconds >= 120 : stage.seconds > 0)
  return <>
    <Link className="back-link" to="/"><ArrowLeft size={17} /> Assessments</Link>
    <div className="page-heading"><h1>Settings</h1></div>
    <section className="panel">
      <h2>Display and defaults</h2>
      <div className="form-grid">
        <label>Theme<select value={settings.theme} onChange={e => edit({ theme: e.target.value as Settings['theme'] })}>
          <option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option>
        </select></label>
        <label>Default difficulty<select value={settings.difficulty} onChange={e => edit({ difficulty: Number(e.target.value) as Settings['difficulty'] })}>
          {[1, 2, 3, 4, 5].map(n => <option key={n}>{n}</option>)}
        </select></label>
      </div>
      <div className="family-fields">
        {([['reducedMotion', 'Reduce motion'], ['compact', 'Compact layout'], ['sound', 'Practice feedback sound'], ['tutorial', 'Highlight tutorial on first play']] as const).map(([key, label]) =>
          <label className="checkbox" key={key}><input type="checkbox" checked={settings[key]} onChange={e => edit({ [key]: e.target.checked })} />{label}</label>)}
      </div>
      <h3>Default Zap-N battery</h3>
      <div className="family-fields">{zapIds.map(g => <label className="checkbox" key={g}><input type="checkbox" checked={settings.games.includes(g)}
        disabled={settings.games.length === 1 && settings.games.includes(g)} onChange={e => edit({ games: e.target.checked ? [...settings.games, g] : settings.games.filter(x => x !== g) })} />{gameInfo[g].title}</label>)}</div>
    </section>
    <section className="panel">
      <h2>Default timed presets</h2><label className="inline-label">Game<select value={game} onChange={e => { setGame(e.target.value as Game); setDraft(null) }}>
        {gameIds.map(id => <option key={id} value={id}>{gameInfo[id].title}</option>)}
      </select></label>
      <StageFields stage={stage} full onChange={setDraft} />
      <div className="actions"><button className="primary" disabled={!valid || !draft} onClick={() => {
        edit({ presets: { ...settings.presets, [game]: stage } }); setDraft(null); setMessage('Preset saved.')
      }}>Save preset</button>
        <button className="secondary" disabled={!settings.presets[game]} onClick={() => {
          const presets = { ...settings.presets }
          delete presets[game]
          edit({ presets }); setDraft(null); setMessage('Default preset restored.')
        }}>Restore default</button></div>
    </section>
    <section className="panel"><h2>Local data</h2><p>Saved on this device.</p><div className="actions">
      <button className="secondary" onClick={() => {
        const url = URL.createObjectURL(new Blob([exportData()], { type: 'application/json' }))
        const download = document.createElement('a'); download.href = url; download.download = 'delta-assessments-backup.json'; download.click()
        window.setTimeout(() => URL.revokeObjectURL(url), 3000)
      }}><Download size={17} /> Export data</button>
      <button className="secondary" onClick={() => input.current?.click()}><Upload size={17} /> Import data</button>
      <input ref={input} type="file" accept=".json,application/json" hidden onChange={async e => {
        const file = e.target.files?.[0]; e.target.value = ''
        if (!file) return
        try { await importData(await file.text()); setMessage('Backup imported.') } catch (err) { setMessage(err instanceof Error ? err.message : 'Backup could not be imported.') }
      }} />
      <button className="quiet danger" onClick={() => setConfirm(true)}>Clear history</button>
    </div>
      {confirm && <div className="notice">Clear all saved attempts and progress on this device?
        <div className="actions"><button className="secondary" onClick={() => setConfirm(false)}>Cancel</button>
          <button className="primary" onClick={async () => { await clearData(); setConfirm(false); setMessage('History cleared.') }}>Clear saved attempts</button></div>
      </div>}
      {message && <p role="status">{message}</p>}
    </section>
  </>
}

function About() {
  return <section className="panel about"><Link className="back-link" to="/"><ArrowLeft size={17} /> Assessments</Link><h1>About</h1>
    <h2>Challenge links</h2><p>A link replays the same seed, generator version, and settings.</p>
    <h2>Keyboard controls</h2><p>Tab moves through controls. Use the ranking arrow buttons to change order, 1–4 for code choices and tower numbers, and left or right for reaction games.</p>
    <h2>On-device data</h2><p>History and preferences are stored in your browser. Export a JSON backup from Settings to carry them between devices.</p>
    <Link className="secondary" to="/settings">Open settings</Link>
  </section>
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
  const { pathname } = useLocation()
  const settings = useData(s => s.settings), warning = useData(s => s.warning), ready = useData(s => s.ready)
  const playing = pathname.startsWith('/play/')
  useEffect(() => { void openData() }, [])
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
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
          <Route path="/zap-n" element={<ZapHub />} />
          <Route path="/full" element={<FullSetup />} />
          <Route path="/play/:id" element={<RunPage />} />
          <Route path="/results/:id" element={<ResultsPage />} />
          <Route path="/challenge" element={<ChallengePage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/about" element={<About />} />
          <Route path="*" element={<Missing />} />
        </Routes>
      </AppBoundary>}
    </main>
  </>
}

export default function App() {
  return <HashRouter><Layout /></HashRouter>
}
