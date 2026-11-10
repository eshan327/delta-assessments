import { z } from 'zod'
import presets from '../../config/presets.json' with { type: 'json' }
import { catalog, freshQuestions, planQuestions } from './catalog.ts'
import { VERSION } from './core.ts'
import { canSubmit, grade, initialDraft } from './questions.ts'
import type { Draft, QuantGame, Question } from './questions.ts'
import { playZap, startZap, tickZap, zapFinished, zapIds } from './zap.ts'
import type { ZapAction, ZapConfig, ZapGame } from './zap.ts'

export const quantIds = ['beat-the-odds', 'numberlogic', 'likelihood-list', 'intervals', 'orderbooks', 'classic-80-in-8'] as const
export const mainGames = presets.mainSix
export const gameIds = [...quantIds, ...zapIds] as const
export type Game = typeof gameIds[number]
const finite = z.number().finite()
const natural = finite.int().min(0)
const whole = finite.int()
const difficulty = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)])
const clock = natural.max(10_800)
const options = { difficulty, seconds: clock }
const scoring = z.object({ correct: finite.min(-100).max(100), wrong: finite.min(-100).max(100), skip: finite.min(-100).max(100) })
export const stageSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('quant'), game: z.enum(quantIds), ...options,
    count: natural.min(1).max(250), itemSeconds: clock, typed: z.boolean(),
    families: z.array(z.string().max(80)).max(40), scoring,
  }),
  z.object({ kind: z.literal('zap'), game: z.enum(zapIds), ...options, seconds: natural.min(1).max(900), rounds: natural.min(1).max(300).nullable() }),
]).refine(stage => stage.kind === 'zap' || stage.families.every(id => catalog[stage.game].some(family => family.id === id)))
export type Stage = z.infer<typeof stageSchema>
export type QuantStage = Extract<Stage, { kind: 'quant' }>
export type ZapStage = Extract<Stage, { kind: 'zap' }>

export const modeSchema = z.enum(['practice', 'timed', 'full'])
export type Mode = z.infer<typeof modeSchema>

export const challengeSchema = z.object({
  version: z.literal(VERSION), seed: z.string().regex(/^[\w-]{1,72}$/),
  mode: modeSchema, title: z.string().min(1).max(100), stages: z.array(stageSchema).min(1).max(15),
})
export type Challenge = z.infer<typeof challengeSchema>

const draftSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('choice'), value: z.string().max(100) }),
  z.object({ kind: z.literal('interval'), lower: z.string().max(30), upper: z.string().max(30) }),
  z.object({ kind: z.literal('ranking'), order: z.array(z.string().max(20)).max(3) }),
  z.object({ kind: z.literal('book'), positions: z.array(whole.min(-9999).max(9999)).max(8) }),
])

const zapEntry = z.object({
  round: natural, state: z.enum(['correct', 'wrong', 'missed']),
  earned: finite.optional(), latency: finite.min(0).optional(), moves: natural.optional(), optimal: natural.optional(),
  span: natural.optional(), switched: z.boolean().optional(), note: z.string().max(300).optional(),
})
const workSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('towers'), moves: z.array(z.tuple([natural.max(4), natural.max(4)])).max(2000), source: natural.max(4).nullable() }),
  z.object({ kind: z.literal('balloon'), pumps: natural.max(100) }),
  z.object({ kind: z.literal('grill'), acted: z.array(natural).max(2500) }),
  z.object({ kind: z.literal('figure'), selection: z.array(natural.max(4)).max(6),
    guesses: z.array(z.object({ guess: z.array(natural.max(4)).max(6), matches: natural.max(6) })).max(4096) }),
  z.object({ kind: z.literal('box'), steps: z.array(z.object({ a: natural.max(15), b: natural.max(15), op: z.enum(['+', '−', '×', '÷']) })).max(3),
    selected: z.array(natural.max(15)).max(2), op: z.enum(['+', '−', '×', '÷']).nullable() }),
  z.object({ kind: z.literal('digit'), value: z.string().regex(/^\d{0,13}$/) }),
  z.object({ kind: z.literal('rapid') }),
])
const zapSchema = z.object({ index: natural, onset: finite.min(0), span: natural, work: workSchema, entries: z.array(zapEntry).max(9000) })
const answerSchema = z.object({ index: natural, draft: draftSchema.nullable(), state: z.enum(['correct', 'wrong', 'skipped']), points: finite, elapsed: finite.min(0) })
export const resultSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('quant'), game: z.enum(quantIds), elapsed: finite.min(0), answers: z.array(answerSchema).max(250),
    fingerprints: z.array(z.string().max(60_000)).max(250) }),
  z.object({ kind: z.literal('zap'), game: z.enum(zapIds), elapsed: finite.min(0), entries: z.array(zapEntry).max(9000) }),
])
export type StageResult = z.infer<typeof resultSchema>
export type Answer = z.infer<typeof answerSchema>

export const attemptSchema = challengeSchema.extend({
  id: z.string().regex(/^[\w-]{1,72}$/), phase: z.enum(['playing', 'between', 'done']),
  stageIndex: natural.max(14), stageAt: finite, startedAt: finite, updatedAt: finite,
  pausedAt: finite.nullable(), pausedMs: finite.min(0), revision: natural,
  index: natural.max(250), itemAt: finite.min(0), draft: draftSchema.nullable(), answers: z.array(answerSchema).max(250),
  zap: zapSchema.nullable(), results: z.array(resultSchema).max(15),
}).refine(a => a.stageIndex < a.stages.length && a.results.every((r, i) => a.stages[i]?.game === r.game) &&
  a.results.length === a.stageIndex + Number(a.phase !== 'playing') &&
  (a.phase !== 'playing' || (a.stages[a.stageIndex].kind === 'zap' ? a.zap !== null : a.draft !== null)))

export type Attempt = z.infer<typeof attemptSchema>

export const settingsSchema = z.object({
  difficulty, theme: z.enum(['system', 'light', 'dark']), reducedMotion: z.boolean(), sound: z.boolean(),
  compact: z.boolean(), tutorial: z.boolean(), games: z.array(z.enum(zapIds)).min(1).max(9),
  presets: z.record(z.string(), stageSchema),
})
export type Settings = z.infer<typeof settingsSchema>
export const defaults: Settings = {
  difficulty: 3, theme: 'system', reducedMotion: false, sound: false, compact: false, tutorial: true,
  games: presets.sections['zap-n'].defaultSelected as ZapGame[], presets: {},
}

const defaultScores = { correct: 1, wrong: 0, skip: 0 }
export function defaultStage(game: Game, mode: Mode, settings: Settings): Stage {
  const custom = settings.presets[game]
  if (custom?.game === game && mode !== 'practice') return custom
  const practice = mode === 'practice', difficulty = settings.difficulty
  if (zapIds.includes(game as ZapGame)) {
    const zap = game as ZapGame
    const rounds = zap === 'grill-master' ? null : zap === 'shapeshift' ? 40 + difficulty * 20 : practice ? (zap === 'code-compare' || zap === 'the-switch' ? 12 : 5) : null
    return { kind: 'zap', game: zap, difficulty, seconds: 120, rounds }
  }
  const quant = game as QuantGame
  if (quant === 'classic-80-in-8') {
    const c = presets.bonus[quant]
    return { kind: 'quant', game: quant, difficulty, count: practice ? 10 : c.questionCount,
      seconds: practice ? 0 : c.examSeconds, itemSeconds: 0, families: [], typed: false,
      scoring: { correct: c.correct, wrong: c.wrong, skip: c.skip } }
  }
  const preset = presets.sections[quant]
  return {
    kind: 'quant', game: quant, difficulty, count: practice ? 10 : preset.questionCount,
    seconds: practice ? 0 : preset.examSeconds, itemSeconds: practice ? 0 : (preset.questionSeconds ?? 0),
    scoring: quant === 'numberlogic' || quant === 'beat-the-odds' ? preset.scoring as typeof defaultScores : defaultScores,
    families: [], typed: false,
  }
}

const questionCache = new Map<string, Question[]>()
function questions(seed: string, stage: QuantStage, stageIndex: number) {
  const key = JSON.stringify([seed, stage, stageIndex])
  const cached = questionCache.get(key)
  if (cached) return cached
  const generated = planQuestions(stage.game, seed + '/' + stageIndex, stage.difficulty, stage.count, stage.families, stage.typed)
  if (questionCache.size >= 32) questionCache.delete(questionCache.keys().next().value!)
  questionCache.set(key, generated)
  return generated
}

export function plannedQuestions(attempt: Challenge, stageIndex: number) {
  const stage = attempt.stages[stageIndex]
  return stage.kind === 'quant' ? questions(attempt.seed, stage, stageIndex) : []
}

export function freshChallenge(options: Omit<Challenge, 'seed' | 'version'>, history: Attempt[]): Challenge {
  const recent = new Set<string>()
  for (const id of quantIds) {
    const entries = history.flatMap(a => a.results.flatMap(r => r.kind === 'quant' && r.game === id ? r.fingerprints : []))
    for (const fingerprint of entries.slice(0, 200)) recent.add(fingerprint)
  }
  const { result } = freshQuestions(
    seed => ({ ...options, version: VERSION as typeof VERSION, seed }),
    challenge => challenge.stages.flatMap((_, i) => plannedQuestions(challenge, i).map(q => q.signature)),
    recent,
  )
  return result
}

export function configFor(challenge: Challenge, stageIndex: number, stage: ZapStage): ZapConfig {
  return { game: stage.game, seed: challenge.seed + '/' + stageIndex,
    difficulty: stage.difficulty, duration: stage.seconds * 1000 || Infinity, roundLimit: stage.rounds }
}

const clockOrigin = Date.now() - performance.now()
export const now = () => clockOrigin + performance.now()
export const elapsed = (a: Attempt, timestamp: number) => Math.max(0, (a.pausedAt ?? timestamp) - a.stageAt - a.pausedMs)

function openStage(a: Attempt, stageIndex: number, timestamp: number): Attempt {
  const stage = a.stages[stageIndex]
  return {
    ...a, stageIndex, phase: 'playing', stageAt: timestamp, index: 0, itemAt: 0, pausedAt: null, pausedMs: 0, answers: [],
    draft: stage.kind === 'quant' ? initialDraft(plannedQuestions(a, stageIndex)[0]) : null,
    zap: stage.kind === 'zap' ? startZap(configFor(a, stageIndex, stage)) : null,
  }
}

export function begin(challenge: Challenge, id: string, timestamp = now()): Attempt {
  return openStage({
    ...challenge, id, phase: 'playing', stageIndex: 0, stageAt: timestamp, startedAt: timestamp, updatedAt: timestamp, revision: 0,
    pausedAt: null, pausedMs: 0, index: 0, itemAt: 0, draft: null, answers: [], zap: null, results: [],
  }, 0, timestamp)
}

export type AttemptAction =
  | { type: 'tick' | 'skip' | 'submit' | 'next' | 'continue' | 'pause' }
  | { type: 'draft'; draft: Draft }
  | { type: 'zap'; action: ZapAction }

function finish(a: Attempt, result: StageResult): Attempt {
  return { ...a, results: [...a.results, result], phase: a.stageIndex + 1 === a.stages.length ? 'done' : 'between' }
}

function quantStep(a: Attempt, stage: QuantStage, action: AttemptAction, time: number): Attempt {
  const globalExpired = stage.seconds > 0 && time >= stage.seconds * 1000
  const itemExpired = stage.itemSeconds > 0 && time - a.itemAt >= stage.itemSeconds * 1000
  const feedback = a.answers.some(answer => answer.index === a.index)
  if (!globalExpired && (!itemExpired || feedback) && action.type === 'tick') return a
  const qs = plannedQuestions(a, a.stageIndex)
  const q = qs[a.index]
  const done = (state: Attempt) => finish(state, { kind: 'quant', game: stage.game, elapsed: stage.seconds ? Math.min(time, stage.seconds * 1000) : time,
    answers: state.answers, fingerprints: qs.map(q => q.signature) })
  const next = (state: Attempt) => a.index + 1 >= qs.length ? done(state) : {
    ...state, index: a.index + 1, itemAt: time, draft: initialDraft(qs[a.index + 1]),
  }
  const respond = (index: number, draft: Draft | null) => ({ index, draft, elapsed: time, ...grade(qs[index], draft, stage.scoring) })
  if (globalExpired) {
    const current = !feedback && (q.kind === 'interval' || q.kind === 'ranking') && a.draft && canSubmit(q, a.draft) ? a.draft : null
    const pending = qs.slice(a.index + Number(feedback)).map((_, i) => {
      const index = a.index + Number(feedback) + i
      return respond(index, index === a.index ? current : null)
    })
    return done({ ...a, answers: [...a.answers, ...pending] })
  }
  if (feedback) return action.type === 'next' ? next(a) : a
  if (itemExpired || action.type === 'submit' || action.type === 'skip') {
    const draft = action.type === 'skip' && !itemExpired ? null : itemExpired && q.kind !== 'interval' && q.kind !== 'ranking' ? null : a.draft
    const valid = draft && canSubmit(q, draft) ? draft : null
    if (action.type === 'submit' && !itemExpired && !valid) return a
    const updated = { ...a, answers: [...a.answers, respond(a.index, valid)] }
    return a.mode === 'practice' ? updated : next(updated)
  }
  if (action.type === 'draft' && action.draft.kind === q.kind) return { ...a, draft: action.draft }
  return a
}

export function reduceAttempt(a: Attempt, action: AttemptAction, timestamp = now()): Attempt {
  const stage = a.stages[a.stageIndex]
  let result = a
  if (a.phase === 'between' && action.type === 'continue') result = openStage(a, a.stageIndex + 1, timestamp)
  if (a.phase === 'playing') {
    if (action.type === 'pause' && a.mode === 'practice') {
      result = a.pausedAt === null ? { ...a, pausedAt: timestamp } :
        { ...a, pausedAt: null, pausedMs: a.pausedMs + timestamp - a.pausedAt }
    } else if (a.pausedAt === null) {
      const time = elapsed(a, timestamp)
      if (stage.kind === 'quant') result = quantStep(a, stage, action, time)
      else {
        const config = configFor(a, a.stageIndex, stage)
        const zap = action.type === 'zap' ? playZap(config, a.zap!, time, action.action) : tickZap(config, a.zap!, time)
        if (time >= config.duration || zapFinished(config, zap)) {
          result = finish({ ...a, zap }, { kind: 'zap', game: stage.game, elapsed: Math.min(time, config.duration), entries: zap.entries })
        } else if (zap !== a.zap) result = { ...a, zap }
      }
    }
  }
  return result === a ? a : { ...result, updatedAt: timestamp, revision: a.revision + 1 }
}

function encode(value: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(value))
  return btoa(Array.from(bytes, b => String.fromCharCode(b)).join('')).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

export function shareQuery(challenge: Challenge) {
  const { seed, version, mode, title, stages } = challenge
  return new URLSearchParams({ seed, v: String(version), preset: encode({ mode, title, stages }) }).toString()
}

export function decodeChallenge(query: URLSearchParams) {
  try {
    const base = query.get('preset') ?? ''
    if (base.length > 20_000) return null
    const data = Uint8Array.from(atob(base.replaceAll('-', '+').replaceAll('_', '/')), c => c.charCodeAt(0))
    const decoded = JSON.parse(new TextDecoder().decode(data))
    const result = challengeSchema.safeParse({ ...decoded, seed: query.get('seed'), version: Number(query.get('v')) })
    return result.success ? result.data : null
  } catch {
    return null
  }
}
