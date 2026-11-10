import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { catalog } from '../engine/catalog.ts'
import { newSeed } from '../engine/core.ts'
import { begin, decodeChallenge, defaultStage, freshChallenge, quantIds, stageSchema } from '../engine/session.ts'
import type { Challenge, Game, Mode, Stage } from '../engine/session.ts'
import { saveAttempt, useData } from '../engine/storage.ts'
import { zapIds } from '../engine/zap.ts'
import GameMark, { BrandMark } from './GameMark.tsx'
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

function GameList({ games }: { games: readonly Game[] }) {
  return <ul className="game-list" role="list">{games.map(game => <li key={game}>
    <Link className="game-row" to={'/game/' + game}>
      <span className="game-symbol"><GameMark game={game} /></span>
      <strong>{gameInfo[game].title}</strong>
      <ArrowRight className="game-arrow" size={21} strokeWidth={1.6} aria-hidden="true" />
    </Link>
  </li>)}</ul>
}

export function Home() {
  const resume = useData(s => s.attempts.find(a => a.phase !== 'done'))
  return <div className="folio">
    <header className="folio-cover">
      <BrandMark />
      <h1>Optiver Assessments</h1>
      {resume && <div className="actions"><Link className="secondary" to={'/play/' + resume.id}>Resume run <ArrowRight size={16} /></Link></div>}
    </header>
    <div className="folio-index">
      <section aria-label="Assessments"><GameList games={quantIds} /></section>
      <section className="zap-index" id="zap-n" tabIndex={-1} aria-labelledby="zap-n-title">
        <h2 id="zap-n-title">Zap-N</h2>
        <GameList games={zapIds} />
      </section>
    </div>
  </div>
}

function StageFields({ stage, mode, onChange }: { stage: Stage; mode: Mode; onChange: (s: Stage) => void }) {
  return <div className="stage-fields">
    <div className="form-grid">
      <label>Difficulty<select value={stage.difficulty} onChange={e => onChange({ ...stage, difficulty: Number(e.target.value) as Stage['difficulty'] })}>
        {['Introductory', 'Easy', 'Standard', 'Hard', 'Expert'].map((label, i) => <option key={label} value={i + 1}>{i + 1} · {label}</option>)}
      </select></label>
      <label>{stage.kind === 'zap' ? 'Game seconds' : 'Section seconds'}<input type="number" min={stage.kind === 'zap' ? (mode === 'practice' ? 15 : 120) : 0}
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
      <details><summary>Question families</summary>
        {stage.families.length > 0 ?
          <button type="button" className="quiet" onClick={() => onChange({ ...stage, families: [] })}>Use all families</button> :
          <p className="field-note">All families are included.</p>}
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
  const timed = defaultStage(game, 'timed', settings), practice = defaultStage(game, 'practice', settings)
  const { start, starting, error } = useStart()
  const [custom, setCustom] = useState(false), [mode, setMode] = useState<Mode>('timed')
  const [stage, setStage] = useState(timed)
  const [query] = useSearchParams()
  const supplied = query.has('seed') ? playableChallenge(query, game) : null
  const launch = (mode: Mode, s: Stage, title = info.title) => start({ mode, stages: [s], title })
  const demo: Stage = practice.kind === 'quant' ?
    { ...practice, count: 1, difficulty: 1, families: [practice.families[0] ?? catalog[practice.game][0].id] } :
    { ...practice, difficulty: 1, rounds: practice.game === 'grill-master' ? null : 1, seconds: practice.game === 'grill-master' ? 16 : 120 }
  const customValid = stageSchema.safeParse(stage).success && (stage.kind !== 'zap' || stage.seconds >= (mode === 'practice' ? 15 : 120))
  const formatPoints = (n: number) => n === 0 ? '0' : (n < 0 ? '−' : '+') + Math.abs(n)
  const scoring = info.scoring ?? (timed.kind === 'quant' && [
    formatPoints(timed.scoring.correct) + ' correct', formatPoints(timed.scoring.wrong) + ' incorrect',
    formatPoints(timed.scoring.skip) + ' skipped',
  ].join(' · '))
  return <>
    <section className="rule-sheet" aria-label={info.title + ' instructions'}>
      <Link className="back-link" to={timed.kind === 'zap' ? '/#zap-n' : '/'}><ArrowLeft size={17} />
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
          <button className="secondary" disabled={starting} onClick={() => launch('practice', practice)}>Practice</button>
          <button className="secondary" aria-expanded={custom} aria-controls={custom ? 'custom-setup' : undefined} onClick={() => setCustom(!custom)}>Custom</button>
        </div>
        <button className="primary" disabled={starting} onClick={() => launch('timed', timed)}>Start timed <ArrowRight size={17} /></button>
      </div>
      {supplied && <button className="secondary" disabled={starting} onClick={() => start(supplied, supplied)}>Play shared seed</button>}
      {query.has('seed') && !supplied && <p className="field-note">This challenge link is invalid or uses an unavailable run format.</p>}
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
      <StageFields stage={stage} mode={mode} onChange={setStage} />
      <button className="primary" disabled={starting || !customValid} onClick={() => launch(mode, stage)}>Start custom run <ArrowRight size={17} /></button>
    </section>}
  </>
}

function playableChallenge(query: URLSearchParams, game?: Game) {
  const challenge = decodeChallenge(query)
  return challenge && challenge.mode !== 'full' && challenge.stages.length === 1 && (!game || challenge.stages[0].game === game) ? challenge : null
}

export function ChallengePage() {
  const [query] = useSearchParams()
  const challenge = playableChallenge(query)
  const { start, starting, error } = useStart()
  return <section className="panel challenge-sheet"><h1>{challenge?.title ?? 'Challenge unavailable'}</h1>
    {challenge ? <>
      <p className="seed">{challenge.seed}</p>
      <button className="primary" disabled={starting} onClick={() => start(challenge, challenge)}>Start challenge <ArrowRight size={17} /></button>
      {starting && <p role="status">Starting…</p>}
    </> : <p>This link is incomplete or uses an unavailable run format.</p>}
    {error && <p role="alert">{error}</p>}
    <Link className="back-link" to="/">Assessments</Link>
  </section>
}
