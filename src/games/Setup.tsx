import { ArrowDownRight, ArrowLeft, ArrowRight, Clock3, Play, Settings2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { catalog } from '../engine/catalog.ts'
import { newSeed } from '../engine/core.ts'
import { begin, decodeChallenge, defaultStage, freshChallenge, mainGames, stageSchema } from '../engine/session.ts'
import type { Challenge, Game, Mode, Stage } from '../engine/session.ts'
import { saveAttempt, useData } from '../engine/storage.ts'
import { zapIds } from '../engine/zap.ts'
import { gameInfo, timeLabel } from './registry.ts'

export function useStart() {
  const nav = useNavigate()
  const [error, setError] = useState('')
  const [starting, setStarting] = useState(false)
  const start = (options: Omit<Challenge, 'seed' | 'version'>, challenge?: Challenge) => {
    if (starting) return
    setError('')
    setStarting(true)
    window.setTimeout(() => {
      try {
        const { attempts } = useData.getState()
        const run = begin(challenge ?? freshChallenge(options, attempts), newSeed())
        void saveAttempt(run)
        nav('/play/' + run.id)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'The run could not start.')
      } finally {
        setStarting(false)
      }
    }, 20)
  }
  return { start, starting, error }
}

export function GameList({ games }: { games: (Game | 'zap-n')[] }) {
  const settings = useData(s => s.settings)
  return <div className="game-list">{games.map(game => {
    const info = gameInfo[game], Icon = info.icon
    const stage = game === 'zap-n' ? null : defaultStage(game, 'timed', settings)
    const meta = !stage ? '9 mini-games' : stage.kind === 'quant' ? stage.count + ' questions · ' + timeLabel(stage.seconds) : timeLabel(stage.seconds) + ' default'
    return <Link key={game} className="game-row" to={game === 'zap-n' ? '/zap-n' : '/game/' + game}>
      <span className={'game-icon ' + info.color}><Icon size={23} strokeWidth={1.8} /></span>
      <span className="game-copy"><strong>{info.title}</strong><span>{info.description}</span></span>
      <span className="game-meta">{meta}</span><ArrowRight className="game-arrow" size={19} />
    </Link>
  })}</div>
}

export function Home() {
  const resume = useData(s => s.attempts.find(a => a.phase !== 'done'))
  return <>
    <section className="home-hero">
      <div><h1>Delta Assessments</h1><p>Practice quantitative reasoning and cognitive games, then put them together in a timed assessment.</p>
        <div className="actions"><Link className="primary" to="/full">Set up full mock <ArrowRight size={18} /></Link>
          {resume && <Link className="secondary" to={'/play/' + resume.id}>Resume run</Link>}</div>
      </div>
      <svg className="hero-art" viewBox="0 0 360 210" aria-hidden="true">
        <defs><pattern id="hero-grid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" fill="none" stroke="#adced0" opacity=".35" /></pattern>
          <linearGradient id="delta-fill" x2="1" y2="1"><stop stopColor="#99d4d3" /><stop offset="1" stopColor="#479096" /></linearGradient></defs>
        <rect x="8" y="7" width="344" height="196" rx="20" fill="url(#hero-grid)" />
        <path d="M180 33 269 181H91Z" fill="url(#delta-fill)" opacity=".56" />
        <path d="M180 33 269 181H91Z M180 79 225 155H135Z" fill="none" stroke="#39797e" strokeWidth="1.7" />
        <path d="M42 165 85 124 123 145 166 108 215 120 259 73 320 49" fill="none" stroke="#1d686f" strokeWidth="2.4" />
        {[ [42, 165], [85, 124], [123, 145], [166, 108], [215, 120], [259, 73], [320, 49] ].map(([x, y]) =>
          <circle key={x} cx={x} cy={y} r="3.6" fill="#f5fbfa" stroke="#1d686f" strokeWidth="2" />)}
      </svg>
    </section>
    <section className="home-section" aria-labelledby="library">
      <div className="section-heading"><div><h2 id="library">Assessment library</h2><p>Choose a section to practice or start a timed run.</p></div><span>6 sections</span></div>
      <GameList games={mainGames as (Game | 'zap-n')[]} />
    </section>
    <section className="home-section"><div className="section-heading"><div><h2>Bonus trainer</h2><p>A separate mental-math sprint.</p></div></div><GameList games={['classic-80-in-8']} /></section>
  </>
}

export function StageFields({ stage, onChange, full = false }: { stage: Stage; onChange: (s: Stage) => void; full?: boolean }) {
  return <div className="stage-fields">
    <div className="form-grid">
      <label>Difficulty<select value={stage.difficulty} onChange={e => onChange({ ...stage, difficulty: Number(e.target.value) as Stage['difficulty'] })}>
        {['Recognition', 'Short reasoning', 'Exam-like', 'Challenging', 'Expert'].map((label, i) => <option key={label} value={i + 1}>{i + 1} · {label}</option>)}
      </select></label>
      <label>{stage.kind === 'zap' ? 'Game seconds' : 'Section seconds'}<input type="number" min={stage.kind === 'zap' ? 120 : full ? 1 : 0}
        max={stage.kind === 'zap' ? 900 : 10_800} value={stage.seconds} onChange={e => onChange({ ...stage, seconds: Number(e.target.value) })} />
      </label>
      {stage.kind === 'quant' && <>
        <label>Question count<input type="number" min={1} max={250} value={stage.count} onChange={e => onChange({ ...stage, count: Number(e.target.value) })} /></label>
        <label>Seconds per question<input type="number" min={0} max={10_800} value={stage.itemSeconds}
          onChange={e => onChange({ ...stage, itemSeconds: Number(e.target.value) })} /></label>
      </>}
      {stage.kind === 'zap' && stage.game !== 'grill-master' && <label>Round limit<input type="number" min={0} max={300} value={stage.rounds ?? 0}
        onChange={e => onChange({ ...stage, rounds: Number(e.target.value) || null })} /></label>}
    </div>
    {stage.kind === 'quant' && <>
      <p className="field-note">A clock set to 0 has no limit.</p>
      {stage.game === 'numberlogic' && <label className="checkbox"><input type="checkbox" checked={stage.typed} onChange={e => onChange({ ...stage, typed: e.target.checked })} />Use typed answers</label>}
      {(stage.game === 'numberlogic' || stage.game === 'beat-the-odds' || stage.game === 'classic-80-in-8') && <div className="form-grid score-fields">
        {(['correct', 'wrong', 'skip'] as const).map(key => <label key={key}>{key[0].toUpperCase() + key.slice(1)} points<input type="number" min={-100} max={100}
          value={stage.scoring[key]} onChange={e => onChange({ ...stage, scoring: { ...stage.scoring, [key]: Number(e.target.value) } })} /></label>)}
      </div>}
      <details><summary>Choose question families</summary><p className="field-note">An empty selection includes every family.</p>
        <div className="family-fields">{catalog[stage.game].map(f => <label className="checkbox" key={f.id}>
          <input type="checkbox" checked={stage.families.includes(f.id)} onChange={e => onChange({ ...stage, families: e.target.checked ?
            [...stage.families, f.id] : stage.families.filter(id => id !== f.id) })} />{f.label}</label>)}</div>
      </details>
    </>}
    {stage.kind === 'zap' && stage.game !== 'grill-master' && <p className="field-note">Use 0 rounds to play until the clock expires.</p>}
  </div>
}

export function GameIntro({ game }: { game: Game }) {
  const settings = useData(s => s.settings)
  const played = useData(s => s.attempts.some(a => a.stages.some(stage => stage.game === game)))
  const info = gameInfo[game], Icon = info.icon
  const timed = defaultStage(game, 'timed', settings)
  const { start, starting, error } = useStart()
  const [custom, setCustom] = useState(false), [mode, setMode] = useState<Mode>('timed')
  const [stage, setStage] = useState(timed)
  const [query] = useSearchParams()
  const supplied = query.has('seed') ? decodeChallenge(query) : null
  const launch = (mode: Mode, s: Stage, title = info.title) => start({ mode, stages: [s], title })
  const demo: Stage = timed.kind === 'quant' ? { ...timed, count: 1, difficulty: 1, seconds: 0, itemSeconds: 0, families: [] } :
    { ...timed, difficulty: 1, rounds: timed.game === 'grill-master' ? null : 1, seconds: timed.game === 'grill-master' ? 16 : 120 }
  const customValid = stageSchema.safeParse(stage).success && (stage.kind !== 'zap' || stage.seconds >= 120)
  return <>
    <Link className="back-link" to={timed.kind === 'zap' ? '/zap-n' : '/'}><ArrowLeft size={17} />{timed.kind === 'zap' ? 'Zap-N' : 'Assessment library'}</Link>
    <section className="intro panel">
      <span className={'game-icon large ' + info.color}><Icon size={31} strokeWidth={1.7} /></span>
      <div><p className="kicker">{info.type}</p><h1>{info.title}</h1><p className="intro-lead">{info.description}</p></div>
      <div className="intro-meta"><Clock3 size={16} /> {timeLabel(timed.seconds)} timed{timed.kind === 'quant' ? ' · ' + timed.count + ' questions' : ''}</div>
    </section>
    <section className="panel instructions">
      <h2>How to play</h2><p>{info.how}</p><h3>Scoring</h3><p>{info.scoring}</p>
      <div className="actions">
        {settings.tutorial && !played && <button className="secondary" disabled={starting} onClick={() => launch('practice', demo, info.title + ' tutorial')}>Play tutorial</button>}
        <button className="secondary" disabled={starting} onClick={() => launch('practice', defaultStage(game, 'practice', settings))}>Start practice</button>
        <button className="primary" disabled={starting} onClick={() => launch('timed', timed)}><Play size={16} /> Start timed</button>
        <button className="quiet" aria-expanded={custom} onClick={() => setCustom(!custom)}><Settings2 size={17} /> Custom</button>
        {(played || !settings.tutorial) && <button className="quiet" disabled={starting} onClick={() => launch('practice', demo, info.title + ' tutorial')}>Tutorial</button>}
      </div>
      {supplied && <button className="secondary" disabled={starting} onClick={() => start(supplied, supplied)}>Play shared seed</button>}
      {query.has('seed') && !supplied && <p className="field-note">The shared preset is invalid or uses a different generator version.</p>}
      {error && <p role="alert">{error}</p>}
      {starting && <p role="status">Preparing the seeded run…</p>}
    </section>
    {custom && <section className="panel">
      <h2>Custom setup</h2>
      <label className="inline-label">Mode<select value={mode} onChange={e => {
        const m = e.target.value as Mode
        setMode(m)
        setStage(defaultStage(game, m, settings))
      }}><option value="timed">Timed</option><option value="practice">Practice</option></select></label>
      <StageFields stage={stage} onChange={setStage} />
      <button className="primary" disabled={starting || !customValid} onClick={() => launch(mode, stage)}>Start custom run <ArrowRight size={17} /></button>
    </section>}
  </>
}

export function ZapHub() {
  return <>
    <Link className="back-link" to="/"><ArrowLeft size={17} /> Assessment library</Link>
    <div className="page-heading"><h1>Zap-N</h1><p>Nine games for attention, working memory, decision-making, and planning.</p>
      <Link className="primary" to="/full?arcade=1">Set up a Zap-N battery <ArrowRight size={17} /></Link></div>
    <GameList games={[...zapIds]} />
  </>
}

export function FullSetup() {
  const settings = useData(s => s.settings)
  const [query] = useSearchParams()
  const onlyZap = query.get('arcade') === '1'
  const base = (onlyZap ? [] : mainGames.filter(id => id !== 'zap-n')) as Game[]
  const [selected, setSelected] = useState(settings.games), [includeBonus, setBonus] = useState(false)
  const [edited, setEdited] = useState<Record<string, Stage>>({})
  const stages = [...base, ...selected, ...(includeBonus ? ['classic-80-in-8' as const] : [])].map(game => edited[game] ?? defaultStage(game, 'full', settings))
  const { start, starting, error } = useStart()
  const valid = selected.length > 0 && stages.every(stage => stageSchema.safeParse(stage).success && (stage.kind === 'quant' ? stage.seconds > 0 : stage.seconds >= 120))
  const resume = useData(s => s.attempts.find(a => a.phase !== 'done' && (onlyZap ? a.title === 'Zap-N battery' : a.mode === 'full')))
  const title = onlyZap ? 'Zap-N battery' : 'Full assessment'
  return <>
    <Link className="back-link" to={onlyZap ? '/zap-n' : '/'}><ArrowLeft size={17} /> {onlyZap ? 'Zap-N' : 'Assessment library'}</Link>
    <div className="page-heading"><h1>{title}</h1><p>{onlyZap ? 'Choose one or more games and play them back to back.' : 'Run the six sections in portal order with a configurable Zap-N battery.'}</p></div>
    <section className="panel">
      <h2>Choose your Zap-N games</h2><div className="family-fields">{zapIds.map(game => <label className="checkbox" key={game}>
        <input type="checkbox" checked={selected.includes(game)} onChange={e => setSelected(e.target.checked ? [...selected, game] : selected.filter(g => g !== game))} />{gameInfo[game].title}</label>)}</div>
      {!onlyZap && <label className="checkbox bonus-check"><input type="checkbox" checked={includeBonus} onChange={e => setBonus(e.target.checked)} /> Add Classic 80-in-8 after the six sections</label>}
    </section>
    <section className="panel">
      <h2>Run order</h2><p className="muted">Expand a stage to edit its preset. The next stage starts when you choose Continue.</p>
      <ol className="stage-list">{stages.map((stage, index) => <li key={stage.game}><details><summary><span>{index + 1} · {gameInfo[stage.game].title}</span>
        <small>{timeLabel(stage.seconds)}{stage.kind === 'quant' ? ' · ' + stage.count + ' questions' : ''}</small></summary>
        <StageFields stage={stage} full onChange={s => setEdited({ ...edited, [s.game]: s })} /></details></li>)}</ol>
      <div className="actions"><button className="primary" disabled={!valid || starting} onClick={() => start({ mode: onlyZap ? 'timed' : 'full', title, stages })}>
        Start {onlyZap ? 'battery' : 'full mock'} <ArrowRight size={17} /></button>
        {resume && <Link className="secondary" to={'/play/' + resume.id}>Resume saved run</Link>}</div>
      {!selected.length && <p className="field-note">Select at least one Zap-N game.</p>}
      {error && <p role="alert">{error}</p>}{starting && <p role="status">Preparing the seeded run…</p>}
    </section>
  </>
}

export function ChallengePage() {
  const [query] = useSearchParams()
  const challenge = decodeChallenge(query)
  const { start, starting, error } = useStart()
  return <section className="panel"><p className="kicker">Shared challenge</p><h1>{challenge?.title ?? 'Challenge unavailable'}</h1>
    {challenge ? <><p className="muted">Play the same generated content with the shared seed and preset.</p>
      <p className="seed">{challenge.seed}</p>
      <button className="primary" disabled={starting} onClick={() => start(challenge, challenge)}>Start challenge <ArrowDownRight size={17} /></button>
      {starting && <p role="status">Preparing the seeded run…</p>}
    </> : <p>The link is incomplete or uses an unavailable generator version.</p>}
    {error && <p role="alert">{error}</p>}
    <Link className="back-link" to="/">Assessment library</Link>
  </section>
}
