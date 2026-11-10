import { ArrowLeft, ArrowRight, ArrowUpRight } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { catalog } from '../engine/catalog.ts'
import { newSeed } from '../engine/core.ts'
import { begin, decodeChallenge, defaultStage, freshChallenge, mainGames, stageSchema } from '../engine/session.ts'
import type { Challenge, Game, Mode, Stage } from '../engine/session.ts'
import { saveAttempt, useData } from '../engine/storage.ts'
import { zapIds } from '../engine/zap.ts'
import GameMark, { DeltaMark } from './GameMark.tsx'
import { gameInfo, timeLabel } from './registry.ts'
import RuleExample from './RuleExample.tsx'

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

function stageMeta(stage: Stage) {
  return stage.kind === 'quant' ? stage.count + ' questions · ' + timeLabel(stage.seconds) : timeLabel(stage.seconds)
}

const assessmentGames = [...mainGames, 'classic-80-in-8'] as (Game | 'zap-n')[]

function GameList({ games }: { games: readonly (Game | 'zap-n')[] }) {
  return <ul className="game-list">{games.map(game => <li key={game}>
    <Link className="game-row" to={game === 'zap-n' ? '/zap-n' : '/game/' + game}>
      <span className="game-symbol"><GameMark game={game} /></span>
      <strong>{gameInfo[game].title}</strong>
      <ArrowRight className="game-arrow" size={21} strokeWidth={1.6} aria-hidden="true" />
    </Link>
  </li>)}</ul>
}

export function Home() {
  const resume = useData(s => s.attempts.find(a => a.phase !== 'done'))
  return <div className="assessment-index folio">
    <header className="folio-cover">
      <DeltaMark />
      <h1>Delta Assessments</h1>
      <div className="actions">
        <Link className="secondary index-action" to="/full">Full mock <ArrowUpRight size={18} /></Link>
        {resume && <Link className="quiet" to={'/play/' + resume.id}>Resume run</Link>}
      </div>
    </header>
    <section className="folio-index" aria-label="Assessments">
      <GameList games={assessmentGames} />
    </section>
    <nav className="folio-utilities" aria-label="Utilities">
      <Link to="/history">History</Link>
      <Link to="/settings">Settings</Link>
      <Link to="/about">About</Link>
    </nav>
  </div>
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
  const info = gameInfo[game]
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
  const formatPoints = (n: number) => n === 0 ? '0' : (n < 0 ? '−' : '+') + Math.abs(n)
  const scoring = info.scoring ?? (timed.kind === 'quant' && [
    formatPoints(timed.scoring.correct) + ' correct', formatPoints(timed.scoring.wrong) + ' incorrect',
    formatPoints(timed.scoring.skip) + ' skipped',
  ].join(' · '))
  return <>
    <section className="rule-sheet" aria-label={info.title + ' instructions'}>
      <Link className="back-link" to={timed.kind === 'zap' ? '/zap-n' : '/'}><ArrowLeft size={17} />
        {timed.kind === 'zap' ? 'Zap-N' : 'Assessments'}
      </Link>
      <header className="rule-heading">
        <h1>{info.title}</h1>
        <div className="rule-meta">
          <span>{stageMeta(timed)}</span>
          {timed.kind === 'quant' && timed.itemSeconds > 0 && <span>{timeLabel(timed.itemSeconds)} per question</span>}
        </div>
      </header>
      <div className="rule-body">
        <div className="rule-copy">
          <h2>Rules</h2>
          <p className="rule-objective">{info.objective}</p>
          <ol role="list">{info.rules.map(rule => <li key={rule}>{rule}</li>)}</ol>
          <h2>Scoring</h2>
          <p>{scoring}</p>
        </div>
        <RuleExample game={game} />
      </div>
      <div className="rule-actions">
        <div className="actions">
          <button className={settings.tutorial && !played ? 'secondary index-action' : 'secondary'} disabled={starting}
            onClick={() => launch('practice', demo, info.title + ' tutorial')}>Start tutorial</button>
          <button className="secondary" disabled={starting} onClick={() => launch('practice', defaultStage(game, 'practice', settings))}>Practice</button>
          <button className="secondary" aria-expanded={custom} aria-controls={custom ? 'custom-setup' : undefined} onClick={() => setCustom(!custom)}>Custom</button>
        </div>
        <button className="primary" disabled={starting} onClick={() => launch('timed', timed)}>Start timed <ArrowRight size={17} /></button>
      </div>
      {supplied && <button className="secondary" disabled={starting} onClick={() => start(supplied, supplied)}>Play shared seed</button>}
      {query.has('seed') && !supplied && <p className="field-note">This challenge link is invalid or uses a different generator version.</p>}
      {error && <p role="alert">{error}</p>}
      {starting && <p role="status">Starting…</p>}
    </section>
    {custom && <section className="panel custom-setup" id="custom-setup">
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
  return <div className="assessment-index arcade-index">
    <Link className="back-link" to="/"><ArrowLeft size={17} /> Assessments</Link>
    <header className="index-heading">
      <h1>Zap-N</h1>
      <Link className="secondary index-action" to="/full?arcade=1">Zap-N battery <ArrowUpRight size={19} /></Link>
    </header>
    <GameList games={zapIds} />
  </div>
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
    <Link className="back-link" to={onlyZap ? '/zap-n' : '/'}><ArrowLeft size={17} /> {onlyZap ? 'Zap-N' : 'Assessments'}</Link>
    <div className="page-heading"><h1>{title}</h1></div>
    <section className="panel">
      <h2>Zap-N games</h2><div className="family-fields">{zapIds.map(game => <label className="checkbox" key={game}>
        <input type="checkbox" checked={selected.includes(game)} onChange={e => setSelected(e.target.checked ? [...selected, game] : selected.filter(g => g !== game))} />{gameInfo[game].title}</label>)}</div>
      {!onlyZap && <label className="checkbox bonus-check"><input type="checkbox" checked={includeBonus} onChange={e => setBonus(e.target.checked)} /> Add Classic 80-in-8 after the six sections</label>}
    </section>
    <section className="panel">
      <h2>Run order</h2>
      <ol className="stage-list">{stages.map((stage, index) => <li key={stage.game}><details><summary><span>{index + 1} · {gameInfo[stage.game].title}</span>
        <small>{timeLabel(stage.seconds)}{stage.kind === 'quant' ? ' · ' + stage.count + ' questions' : ''}</small></summary>
        <StageFields stage={stage} full onChange={s => setEdited({ ...edited, [s.game]: s })} /></details></li>)}</ol>
      <div className="actions"><button className="primary" disabled={!valid || starting} onClick={() => start({ mode: onlyZap ? 'timed' : 'full', title, stages })}>
        Start {onlyZap ? 'battery' : 'full mock'} <ArrowRight size={17} /></button>
        {resume && <Link className="secondary" to={'/play/' + resume.id}>Resume saved run</Link>}</div>
      {!selected.length && <p className="field-note">Select at least one Zap-N game.</p>}
      {error && <p role="alert">{error}</p>}{starting && <p role="status">Starting…</p>}
    </section>
  </>
}

export function ChallengePage() {
  const [query] = useSearchParams()
  const challenge = decodeChallenge(query)
  const { start, starting, error } = useStart()
  return <section className="panel challenge-sheet"><h1>{challenge?.title ?? 'Challenge unavailable'}</h1>
    {challenge ? <>
      <p className="seed">{challenge.seed}</p>
      <button className="primary" disabled={starting} onClick={() => start(challenge, challenge)}>Start challenge <ArrowRight size={17} /></button>
      {starting && <p role="status">Starting…</p>}
    </> : <p>The link is incomplete or uses an unavailable generator version.</p>}
    {error && <p role="alert">{error}</p>}
    <Link className="back-link" to="/">Assessments</Link>
  </section>
}
