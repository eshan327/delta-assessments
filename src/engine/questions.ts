import { F, rational, Rng, variants, VERSION } from './core.ts'
import type { Difficulty, Rational, Variant } from './core.ts'

export type QuantGame = 'beat-the-odds' | 'numberlogic' | 'likelihood-list' | 'intervals' | 'orderbooks' | 'classic-80-in-8'
export type PlotSeries = { label: string; points: [number, number][]; scatter?: boolean }
export type Visual =
  | { type: 'table'; headers: string[]; rows: (string | number)[][]; highlight?: [number, number] }
  | { type: 'plot'; x: string; y: string; series: PlotSeries[] }
  | { type: 'grid'; cells: (number | string)[]; columns: number; style: 'dice' | 'coins' | 'shapes' | 'numbers'; offsets?: [number, number][] }
  | { type: 'path'; points: [number, number][]; scale: number; unit: string }
  | { type: 'graph'; nodes: string[]; edges: number[][] }
export type Card = { goods: [number, number, number, number]; bid: number; ask: number }

type Base = { prompt: string; explanation: string[]; semantic: unknown; visual?: Visual }
export type Choice = Base & { kind: 'choice'; options: { key: string; label: string }[]; truth: string; check: () => string; typed?: boolean }
export type Interval = Base & { kind: 'interval'; truth: string; check: () => string; max?: number }
export type Ranking = Base & { kind: 'ranking'; options: { key: string; label: string }[]; truth: string[]; check: () => string[]; margin: number }
export type Book = Base & { kind: 'book'; cards: (Card | null)[]; truth: number[]; check: () => number[][] }
export type Problem = Choice | Interval | Ranking | Book
export type Question = Problem & { family: string; variant: Variant; signature: string }
export type Draft = { kind: 'choice'; value: string } | { kind: 'interval'; lower: string; upper: string } | { kind: 'ranking'; order: string[] } | { kind: 'book'; positions: number[] }
export type Family = {
  id: string
  label: string
  generate: (rng: Rng, difficulty: Difficulty, variant: Variant) => Problem | null
  solve: (question: Problem) => string | string[] | number[][]
  verify: (question: Problem, solved: ReturnType<Family['solve']>) => boolean
  explain: (question: Problem) => string[]
}

export const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

export function family(id: string, label: string, generate: Family['generate']): Family {
  return {
    id, label, generate,
    solve: question => question.check(),
    verify: (q, solved) => {
      switch (q.kind) {
        case 'choice':
          return q.truth === solved && q.options.some(o => o.key === q.truth) &&
            new Set(q.options.map(o => o.key)).size === q.options.length &&
            new Set(q.options.map(o => o.label)).size === q.options.length && q.options.length >= 4
        case 'interval':
          return q.truth === solved && F(q.truth).compare(0) >= 0 && (q.max === undefined || F(q.truth).compare(q.max) <= 0)
        case 'ranking':
          return same(q.truth, solved) && q.margin > 0 && q.options.length === 3 &&
            new Set(q.options.map(o => o.key)).size === 3 && new Set(q.options.map(o => o.label)).size === 3
        case 'book':
          return same([q.truth], solved)
      }
    },
    explain: question => question.explanation,
  }
}

export function generateQuestion(game: QuantGame, f: Family, seed: string, index: number, difficulty: Difficulty, seen: Set<string>, forcedVariant?: Variant) {
  const prefix = [VERSION, seed, game, f.id, index].join('/')
  const variant = forcedVariant ?? new Rng(prefix + '/variant').pick(variants)
  for (let retry = 0; retry < 120; retry++) {
    const q = f.generate(new Rng(prefix + '/' + retry), difficulty, variant)
    if (!q || !f.verify(q, f.solve(q))) continue
    const signature = JSON.stringify(game === 'numberlogic' || game === 'orderbooks' || game === 'classic-80-in-8'
      ? [game, q.semantic] : [game, f.id, q.semantic])
    if (seen.has(signature)) continue
    seen.add(signature)
    return { ...q, family: f.id, variant, signature } as Question
  }
  throw new Error('Could not generate a verified ' + f.label + ' problem. Try a new seed or a different family.')
}

export const choice = (
  rng: Rng,
  base: Base,
  truth: Rational,
  wrong: Rational[],
  check: () => Rational,
  format: (value: Rational) => string = rational,
): Choice | null => {
  const correct = format(truth)
  const keys = new Set([correct])
  const distractors = rng.shuffle(wrong).filter(value => {
    const label = format(value)
    if (keys.has(label)) return false
    keys.add(label)
    return true
  }).slice(0, 4)
  if (distractors.length < 3) return null
  return {
    ...base, kind: 'choice', truth: rational(truth), check: () => rational(check()),
    options: rng.shuffle([truth, ...distractors]).map(value => ({ key: rational(value), label: format(value) })),
  }
}

export function initialDraft(q: Question): Draft {
  switch (q.kind) {
    case 'choice': return { kind: 'choice', value: '' }
    case 'interval': return { kind: 'interval', lower: '', upper: '' }
    case 'ranking': return { kind: 'ranking', order: q.options.map(option => option.key) }
    case 'book': return { kind: 'book', positions: q.cards.map(() => 0) }
  }
}

export function validBounds(lower: string, upper: string, max = Number.MAX_SAFE_INTEGER) {
  return /^\d+$/.test(lower) && /^\d+$/.test(upper) && Number(lower) <= Number(upper) && Number(upper) <= max
}

export function intervalScore(truth: string, lower: string, upper: string) {
  if (!validBounds(lower, upper)) return 0
  const l = F(lower)
  const u = F(upper)
  const target = F(truth)
  if (target.compare(l) < 0 || target.compare(u) > 0) return 0
  return u.equals(0) ? 1 : l.div(u).valueOf()
}

export function tradeTotals(cards: (Card | null)[], positions: number[]) {
  const inventory = [0n, 0n, 0n, 0n]
  let profit = 0n
  const invalid = { inventory: [0, 0, 0, 0], profit: 0, valid: false }
  if (cards.length !== positions.length) return invalid
  for (let i = 0; i < cards.length; i++) {
    const card = cards[i]
    const position = positions[i]
    if (!Number.isSafeInteger(position) || (!card && position !== 0)) return invalid
    if (!card) continue
    const count = BigInt(position)
    profit -= count * BigInt(position < 0 ? card.bid : card.ask)
    for (let j = 0; j < inventory.length; j++) inventory[j] += count * BigInt(card.goods[j])
  }
  return { inventory: inventory.map(Number), profit: Number(profit), valid: inventory.every(n => n === 0n) && profit > 0n }
}

export function parseNumeric(value: string) {
  const input = value.trim()
  if (!/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:\/[1-9]\d*)?$/.test(input) || input.length > 64) return null
  try {
    const [n, d] = input.split('/')
    return rational(d ? F(n).div(F(d)) : F(n))
  } catch {
    return null
  }
}

export function canSubmit(q: Question, draft: Draft) {
  if (q.kind === 'choice' && draft.kind === 'choice') {
    return q.typed ? parseNumeric(draft.value) !== null : q.options.some(o => o.key === draft.value)
  }
  if (q.kind === 'interval' && draft.kind === 'interval') return validBounds(draft.lower, draft.upper, q.max)
  if (q.kind === 'ranking' && draft.kind === 'ranking') {
    return draft.order.length === 3 && new Set(draft.order).size === 3 && draft.order.every(id => q.options.some(o => o.key === id))
  }
  if (q.kind === 'book' && draft.kind === 'book') {
    return draft.positions.length === q.cards.length && draft.positions.some(n => n !== 0) &&
      draft.positions.every((n, i) => Number.isSafeInteger(n) && (q.cards[i] !== null || n === 0))
  }
  return false
}

export type Scoring = { correct: number; wrong: number; skip: number }

export function grade(q: Question, draft: Draft | null, scoring: Scoring) {
  if (!draft || !canSubmit(q, draft)) return { state: 'skipped' as const, points: scoring.skip }
  if (q.kind === 'interval' && draft.kind === 'interval') {
    const points = intervalScore(q.truth, draft.lower, draft.upper)
    const hit = F(q.truth).compare(F(draft.lower)) >= 0 && F(q.truth).compare(F(draft.upper)) <= 0
    return { state: hit ? 'correct' as const : 'wrong' as const, points }
  }
  let correct = false
  if (q.kind === 'choice' && draft.kind === 'choice') correct = (q.typed ? parseNumeric(draft.value) : draft.value) === q.truth
  if (q.kind === 'ranking' && draft.kind === 'ranking') correct = same(draft.order, q.truth)
  if (q.kind === 'book' && draft.kind === 'book') correct = tradeTotals(q.cards, draft.positions).valid
  return { state: correct ? 'correct' as const : 'wrong' as const, points: correct ? scoring.correct : scoring.wrong }
}
