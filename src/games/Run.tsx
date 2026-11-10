import { ArrowLeft, ArrowRight, CheckCircle2, Clipboard, Pause, Play, RotateCcw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { catalog } from '../engine/catalog.ts'
import { sum } from '../engine/core.ts'
import { configFor, elapsed, now, plannedQuestions, reduceAttempt, shareQuery } from '../engine/session.ts'
import type { Attempt, AttemptAction, StageResult } from '../engine/session.ts'
import { saveAttempt, useData } from '../engine/storage.ts'
import { roundAt, zapSummary } from '../engine/zap.ts'
import type { ZapAction } from '../engine/zap.ts'
import QuantPlay, { Solution } from './QuantPlay.tsx'
import { gameInfo, timeLabel } from './registry.ts'
import { useStart } from './Setup.tsx'
import VisualBoard from './Visual.tsx'
import ZapPlay from './ZapPlay.tsx'

const display = (n: number) => new Intl.NumberFormat('en', { maximumFractionDigits: 3 }).format(n)
let audio: AudioContext | undefined
function playSound(correct: boolean) {
  try {
    audio ??= new AudioContext()
    if (audio.state === 'suspended') void audio.resume().catch(() => {})
    const note = audio.createOscillator(), gain = audio.createGain(), at = audio.currentTime
    note.frequency.value = correct ? 520 : 280
    gain.gain.setValueAtTime(0.045, at)
    gain.gain.exponentialRampToValueAtTime(0.001, at + 0.14)
    note.connect(gain).connect(audio.destination)
    note.start(at)
    note.stop(at + 0.15)
  } catch {
    // Sound is optional on browsers without Web Audio.
  }
}

function useRun(id: string) {
  const run = useData(s => s.attempts.find(a => a.id === id))
  const [time, setTime] = useState(now)
  const act = useCallback((action: AttemptAction, at = now()) => {
    const { attempts, settings } = useData.getState()
    const current = attempts.find(a => a.id === id)
    if (!current) return
    const next = reduceAttempt(current, action, at)
    if (next !== current) {
      if (settings.sound && action.type !== 'tick' && current.mode === 'practice') {
        const answer = next.answers.length > current.answers.length ? next.answers.at(-1) :
          (next.zap?.entries.length ?? 0) > (current.zap?.entries.length ?? 0) ? next.zap?.entries.at(-1) : undefined
        if (answer) playSound(answer.state === 'correct')
      }
      void saveAttempt(next)
    }
    setTime(at)
  }, [id])
  const ticking = run?.phase === 'playing' && run.pausedAt === null
  useEffect(() => {
    if (!ticking) return
    const tick = () => act({ type: 'tick' })
    tick()
    const handle = window.setInterval(tick, 35)
    document.addEventListener('visibilitychange', tick)
    return () => { window.clearInterval(handle); document.removeEventListener('visibilitychange', tick) }
  }, [act, ticking])
  const zapAct = useCallback((action: ZapAction) => act({ type: 'zap', action }), [act])
  return { run, time, act, zapAct }
}

function ScoreCard({ label, value }: { label: string; value: string | number }) {
  return <div className="score-card"><strong>{value}</strong><span>{label}</span></div>
}

export function RunPage() {
  const { id = '' } = useParams()
  const { run, time, act, zapAct } = useRun(id)
  const [exit, setExit] = useState(false)
  const stageIndex = run?.stageIndex
  const index = run?.index
  useEffect(() => { window.scrollTo(0, 0) }, [stageIndex, index])
  if (!run) return <section className="panel"><h1>Run unavailable</h1><p>Saved runs are stored on the browser where you played them.</p><Link to="/">Assessments</Link></section>
  if (run.phase === 'done') return <Navigate to={'/results/' + run.id} replace />
  const stage = run.stages[run.stageIndex], info = gameInfo[stage.game], activeTime = elapsed(run, time)
  if (run.phase === 'between') {
    const next = gameInfo[run.stages[run.stageIndex + 1].game]
    return <section className="panel stage-complete">
      <CheckCircle2 size={34} /><h1>{info.title} complete</h1><p>Stage {run.stageIndex + 1} of {run.stages.length}</p>
      <StageScores result={run.results.at(-1)!} />
      <div className="actions"><button className="primary" onClick={() => act({ type: 'continue' })}>Continue to {next.title} <ArrowRight size={17} /></button>
        <Link className="secondary" to="/">Save and exit</Link></div>
    </section>
  }
  const remaining = stage.seconds > 0 ? Math.max(0, stage.seconds - activeTime / 1000) : Infinity
  const itemRemaining = stage.kind === 'quant' && stage.itemSeconds > 0 ? Math.max(0, stage.itemSeconds - (activeTime - run.itemAt) / 1000) : Infinity
  const progress = stage.kind === 'quant' ? run.index / stage.count : stage.seconds > 0 ? 1 - remaining / stage.seconds : 0
  const q = stage.kind === 'quant' ? plannedQuestions(run, run.stageIndex)[run.index] : undefined
  const round = stage.kind === 'zap' && run.zap ? roundAt(configFor(run, run.stageIndex, stage), run.zap) : undefined
  const answer = run.mode === 'practice' ? run.answers.find(a => a.index === run.index) : undefined
  return <div className="run">
    <header className="run-header">
      <div className="run-title">
        <h1>{info.title}</h1>
        {run.mode === 'full' && <span className="run-mode">Stage {run.stageIndex + 1} of {run.stages.length}</span>}
        {run.mode === 'practice' && <span className="run-mode">Practice</span>}
      </div>
      <div className="run-controls">
        <span className="run-progress">{stage.kind === 'quant' ? (run.index + 1) + ' of ' + stage.count :
          stage.game === 'grill-master' ? 'Live grill' : 'Round ' + ((run.zap?.index ?? 0) + 1) + (stage.rounds ? ' of ' + stage.rounds : '')}</span>
        <div className={'clock ' + (remaining < 15 ? 'clock-urgent' : '')} role="timer" aria-label="Section time remaining">
          {Number.isFinite(remaining) ? timeLabel(remaining) : 'Untimed'}
        </div>
        {Number.isFinite(itemRemaining) && <div className="item-clock" role="timer" aria-label="Question time remaining">Item {timeLabel(itemRemaining)}</div>}
        {run.mode === 'practice' && <button className="icon-button" aria-label={run.pausedAt === null ? 'Pause practice' : 'Resume practice'}
          onClick={() => act({ type: 'pause' })}>{run.pausedAt === null ? <Pause size={17} /> : <Play size={17} />}</button>}
        <button className="quiet run-exit" aria-label="Exit run" aria-expanded={exit} onClick={() => setExit(!exit)}>Exit</button>
      </div>
      <div className="run-meter"><i style={{ width: Math.max(0, Math.min(1, progress)) * 100 + '%' }} /></div>
    </header>
    {exit && <div className="notice" role="status">Progress saved.{run.mode !== 'practice' && ' The timer keeps running.'}
      <div className="actions"><button className="secondary" onClick={() => setExit(false)}>Stay</button><Link className="primary" to="/">Exit to assessments</Link></div></div>}
    {run.pausedAt !== null ? <div className="panel"><h2>Practice paused</h2><button className="primary" onClick={() => act({ type: 'pause' })}>Resume practice</button></div> : <>
      {q && run.draft && <QuantPlay key={run.stageIndex + '/' + run.index} q={q} draft={run.draft} answer={answer} practice={run.mode === 'practice'} act={act} />}
      {round && run.zap && <ZapPlay round={round} state={run.zap} elapsed={activeTime} practice={run.mode === 'practice'} act={zapAct} />}
    </>}
  </div>
}

function resultScore(result: StageResult) {
  return result.kind === 'quant' ? sum(result.answers.map(a => a.points)) :
    result.game === 'balloon' || result.game === 'grill-master' ? zapSummary(result.entries).earnings : zapSummary(result.entries).correct
}

function StageScores({ result }: { result: StageResult }) {
  const time = timeLabel(result.elapsed / 1000)
  if (result.kind === 'quant') return <div className="score-grid">
    <ScoreCard label="Points" value={display(resultScore(result))} />
    <ScoreCard label="Correct" value={result.answers.filter(a => a.state === 'correct').length} />
    <ScoreCard label="Incorrect" value={result.answers.filter(a => a.state === 'wrong').length} />
    <ScoreCard label="Skipped" value={result.answers.filter(a => a.state === 'skipped').length} />
    <ScoreCard label="Time" value={time} />
  </div>
  const s = zapSummary(result.entries)
  const extras = result.game === 'balloon' ? [{ label: 'Net cash', value: '$' + s.earnings }] :
    result.game === 'grill-master' ? [{ label: 'Grill score', value: s.earnings }] :
      result.game === 'digit' ? [{ label: 'Highest correct span', value: s.span }] : []
  return <div className="score-grid">
    <ScoreCard label={result.game === 'balloon' ? 'Cashed out' : 'Correct / solved'} value={s.correct} />
    <ScoreCard label="Errors" value={s.wrong} /><ScoreCard label="Missed" value={s.missed} />
    <ScoreCard label="Time" value={time} />
    {s.median !== null && <ScoreCard label="Median correct response" value={Math.round(s.median) + ' ms'} />}
    {extras.map(extra => <ScoreCard key={extra.label} {...extra} />)}
  </div>
}

function StageReview({ run, result, index }: { run: Attempt; result: StageResult; index: number }) {
  const best = useData(s => Math.max(resultScore(result), ...s.attempts.flatMap(a =>
    a.results.filter(r => r.game === result.game && a.mode === run.mode).map(resultScore))))
  const questions = result.kind === 'quant' ? plannedQuestions(run, index) : []
  const mix = new Map<string, number>()
  for (const q of questions) mix.set(q.family, (mix.get(q.family) ?? 0) + 1)
  return <section className="panel result-stage">
    <h2>{gameInfo[result.game].title}</h2>
    <StageScores result={result} />
    <p className="muted">Personal best in this mode · {display(best)}</p>
    {result.kind === 'quant' && <>
      <details className="mix"><summary>Family mix · {mix.size} families</summary><div>{[...mix].map(([family, count]) => <span key={family}>
        {catalog[result.game].find(f => f.id === family)?.label} · {count}</span>)}</div></details>
      <div className="review-list">{result.answers.map(answer => {
        const q = questions[answer.index]
        if (!q) return null
        const label = catalog[result.game].find(f => f.id === q.family)?.label ?? q.family
        return <details key={answer.index}><summary><span>{answer.index + 1}. {label}</span><small className={'state-' + answer.state}>{answer.state} · {display(answer.points)}</small></summary>
          <div className="review-body"><p>{q.prompt}</p>{q.visual && <VisualBoard visual={q.visual} />}<Solution q={q} answer={answer} /></div>
        </details>
      })}</div>
    </>}
    {result.kind === 'zap' && result.game === 'the-switch' && <div className="score-grid">{[false, true].map(switched => {
      const trials = result.entries.filter(e => e.switched === switched)
      const s = zapSummary(trials)
      return <ScoreCard key={String(switched)} label={switched ? 'Switch trials' : 'Repeat trials'}
        value={trials.length ? Math.round(s.correct / trials.length * 100) + '% · ' + (s.median === null ? '—' : Math.round(s.median) + ' ms') : '—'} />
    })}</div>}
    {result.kind === 'zap' && <details className="round-review"><summary>Round details · {result.entries.length}</summary>
      <div className="table-scroll"><table><thead><tr><th>Round</th><th>Outcome</th><th>Details</th></tr></thead>
        <tbody>{result.entries.map(e => <tr key={e.round}><td>{e.round + 1}</td><td>{e.state}</td><td>
          {[e.note, e.earned !== undefined ? 'Score ' + e.earned : null, e.moves !== undefined ? e.moves + ' moves' + (e.optimal ? ' · optimal ' + e.optimal : '') : null,
            e.latency !== undefined ? Math.round(e.latency) + ' ms' : null].filter(Boolean).join(' · ') || '—'}
        </td></tr>)}</tbody></table></div>
    </details>}
  </section>
}

async function copyLink(link: string) {
  try { await navigator.clipboard.writeText(link); return true } catch { return false }
}

export function ResultsPage() {
  const { id } = useParams()
  const run = useData(s => s.attempts.find(a => a.id === id))
  const { start, starting, error } = useStart()
  const [copied, setCopied] = useState<boolean | null>(null)
  if (!run) return <section className="panel"><h1>Results unavailable</h1><Link to="/">Assessments</Link></section>
  if (run.phase !== 'done') return <Navigate to={'/play/' + run.id} replace />
  const link = new URL(import.meta.env.BASE_URL, window.location.origin)
  link.hash = '/challenge?' + shareQuery(run)
  return <>
    <Link className="back-link" to="/"><ArrowLeft size={17} /> Assessments</Link>
    <div className="page-heading"><h1>{run.title} complete</h1>
      <p>{run.mode === 'full' ? 'Full mock' : run.mode === 'timed' ? 'Timed run' : 'Practice'} · {new Date(run.updatedAt).toLocaleString()}</p>
      <div className="actions"><button className="primary" disabled={starting} onClick={() => start({ mode: run.mode, title: run.title, stages: run.stages })}>
        <RotateCcw size={17} /> Retake with new seed</button>
        <button className="secondary" onClick={async () => setCopied(await copyLink(String(link)))}><Clipboard size={17} /> Copy challenge link</button>
      </div>
      {copied === true && <p role="status">Challenge link copied.</p>}
      {copied === false && <label className="copy-fallback">Challenge link<input readOnly value={String(link)} onFocus={e => e.target.select()} /></label>}
      {error && <p role="alert">{error}</p>}
    </div>
    {run.results.map((result, i) => <StageReview key={i} run={run} result={result} index={i} />)}
  </>
}
