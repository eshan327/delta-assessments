import { beat } from './beat.ts'
import { classic } from './classic.ts'
import { intervals } from './intervals.ts'
import { likelihood } from './likelihood.ts'
import { numberlogic } from './numberlogic.ts'
import { orderbooks } from './orderbooks.ts'
import { newSeed, Rng } from './core.ts'
import type { Difficulty } from './core.ts'
import { generateQuestion } from './questions.ts'
import type { Family, QuantGame, Question } from './questions.ts'

export const catalog = {
  'beat-the-odds': beat,
  numberlogic,
  'likelihood-list': likelihood,
  intervals,
  orderbooks,
  'classic-80-in-8': classic,
} satisfies Record<QuantGame, Family[]>

export function planQuestions(game: QuantGame, seed: string, difficulty: Difficulty, count: number, selected: string[], typed: boolean) {
  const rng = new Rng(seed + '/' + game + '/schedule')
  const enabled = catalog[game].filter(f => selected.length === 0 || selected.includes(f.id))
  if (!enabled.length) throw new Error('Choose at least one available family.')
  const questions: Question[] = [], seen = new Set<string>()
  while (questions.length < count) {
    for (const f of rng.shuffle(enabled)) {
      const q = generateQuestion(game, f, seed, questions.length, difficulty, seen)
      if (q.kind === 'choice' && game === 'numberlogic') q.typed = typed
      questions.push(q)
      if (questions.length === count) break
    }
  }
  return questions
}

export function freshQuestions<T>(plan: (seed: string) => T, signatures: (result: T) => string[], recent: Set<string>) {
  for (let retry = 0; retry < 120; retry++) {
    const seed = newSeed()
    const result = plan(seed)
    if (signatures(result).every(signature => !recent.has(signature))) return { seed, result }
  }
  throw new Error('Could not create a fresh run with these settings. Try a broader family selection.')
}
