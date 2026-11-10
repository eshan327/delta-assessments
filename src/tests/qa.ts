import { writeFileSync } from 'node:fs'
import { catalog } from '../engine/catalog.ts'
import { difficulties, variants, VERSION } from '../engine/core.ts'
import { bruteForceTrade } from '../engine/orderbooks.ts'
import { generateQuestion, same, tradeTotals } from '../engine/questions.ts'
import { decodeChallenge, defaults, defaultStage, freshChallenge, plannedQuestions, quantIds, shareQuery } from '../engine/session.ts'
import type { Challenge } from '../engine/session.ts'
import { compatible, digitAnswer, makeRound, moveBlock, solveBox, zapIds } from '../engine/zap.ts'
import type { Round } from '../engine/zap.ts'

const deep = process.argv.includes('--deep')
const failures: string[] = []
const items: { section: string; family: string; template: number; seed: string; passed: boolean; timeMs: number; signature: string;
  correctnessSource: string; margin: number | null; failure: string | null }[] = []
const summary: { section: string; families: number; samples: number; unique: number; invalid: number }[] = []

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const methods = {
  choice: 'separate calculation, combinatoric enumeration or rule inference',
  interval: 'independent aggregation or exact numeric formula',
  ranking: 'independent probability calculation or numerical integration',
  book: 'integer circuit enumeration',
}

let smallBooks = 0
for (const game of quantIds) {
  const families = catalog[game]
  const perFamily = deep ? Math.ceil(5000 / families.length) : 200
  const unique = new Set<string>()
  let invalid = 0
  for (const f of families) for (let i = 0; i < perFamily; i++) {
    const started = performance.now()
    const seed = (deep ? 'deep' : 'ci') + '-' + i
    const template = variants[i % variants.length], difficulty = difficulties[i % difficulties.length]
    const record = { section: game, family: f.id, template, seed, passed: false, timeMs: 0, signature: '',
      correctnessSource: '', margin: null as number | null, failure: null as string | null }
    try {
      const q = generateQuestion(game, f, seed, i, difficulty, new Set(), template)
      const solved = f.solve(q)
      assert(f.verify(q, solved), 'Independent solver mismatch')
      if (q.kind === 'book' && q.cards.filter(Boolean).length <= 5 && (deep ? smallBooks < 2000 : i % 17 === 0)) {
        const brute = bruteForceTrade(q.cards, Math.max(...q.truth.map(Math.abs)))
        assert(brute && tradeTotals(q.cards, brute).valid, 'Brute force did not find a profitable trade')
        smallBooks++
      }
      unique.add(q.signature)
      Object.assign(record, { passed: true, signature: q.signature, correctnessSource: methods[q.kind], margin: q.kind === 'ranking' ? q.margin : null })
    } catch (error) {
      record.failure = String(error)
      invalid++
      failures.push([game, f.id, seed, error].join(' · '))
    }
    record.timeMs = Number((performance.now() - started).toFixed(3))
    items.push(record)
  }
  const samples = families.length * perFamily
  summary.push({ section: game, families: families.length, samples, unique: unique.size, invalid })
  if (deep && unique.size / samples < 0.98) failures.push(game + ' semantic uniqueness is below 98%')
  console.log(game, families.length + ' families', unique.size + '/' + samples + ' unique', invalid + ' invalid')
}

function verifyRound(round: Round, duration: number) {
  switch (round.game) {
    case 'skyscrapers': {
      const solved = round.optimal.reduce((board, move) => moveBlock(board, move)!, round.board)
      assert(round.optimal.length > 0 && same(solved, round.goal), 'Invalid shortest route')
      break
    }
    case 'balloon': assert(round.minimum <= round.burst && round.burst <= round.maximum && round.reward > 0, 'Invalid burst threshold'); break
    case 'grill-master':
      assert(round.items.length > 0 && round.items.every((x, i) =>
        x.spawn < x.ready && x.ready < x.burnt && x.burnt < x.leave && x.leave <= duration &&
        !round.items.slice(0, i).some(y => y.lane === x.lane && y.leave > x.spawn)), 'Overlapping or invalid cooking windows')
      break
    case 'figure-it-out': assert(compatible(round.domains, [{ guess: round.target, matches: round.target.length }]) === 1, 'No unique complete figure'); break
    case 'number-box': assert(solveBox(round.values, round.target)?.length === 3, 'No valid four-number solution'); break
    case 'code-compare': assert(new Set(round.options).size === 4 && round.options[round.answer] === round.reference, 'Invalid exact-match choices'); break
    case 'digit': assert(digitAnswer(round).length === round.digits.length, 'Changed recall span'); break
    case 'the-switch': assert(round.answer === (round.rule === 'sum' ? (round.a + round.b) % 2 : Number(round.arrows[0] !== round.arrows[1])), 'Wrong active-rule answer'); break
    case 'shapeshift': assert(round.answer === Number(round.shape === 'circle') && round.limit > 0, 'Wrong reaction mapping'); break
  }
}

for (const game of zapIds) {
  const count = deep ? 1000 : 200, duration = 120_000
  const unique = new Set<string>()
  let invalid = 0
  for (let i = 0; i < count; i++) {
    const start = performance.now(), seed = 'zap-qa-' + i, difficulty = difficulties[i % difficulties.length]
    const record = { section: game, family: game, template: difficulty, seed, passed: false, timeMs: 0, signature: '',
      correctnessSource: 'independent state invariant or search', margin: null, failure: null as string | null }
    try {
      const round = makeRound(game, seed, i % 11, difficulty, duration)
      verifyRound(round, duration)
      const signature = JSON.stringify(round)
      record.signature = signature
      unique.add(signature)
      record.passed = true
    } catch (error) {
      record.failure = String(error)
      failures.push([game, seed, error].join(' · '))
      invalid++
    }
    record.timeMs = Number((performance.now() - start).toFixed(3))
    items.push(record)
  }
  summary.push({ section: game, families: 1, samples: count, unique: unique.size, invalid })
  console.log(game, count + ' seeds', invalid + ' invalid')
}

try {
  const stages = [...quantIds.filter(id => id !== 'classic-80-in-8'), ...defaults.games].map(game => defaultStage(game, 'full', defaults))
  const initial: Challenge = { version: VERSION, seed: 'mock-quality-one', title: 'Full assessment', mode: 'full', stages }
  const signatures = (c: Challenge) => c.stages.flatMap((_, i) => plannedQuestions(c, i).map(q => q.signature))
  const first = signatures(initial)
  const second = freshChallenge({ title: initial.title, mode: initial.mode, stages }, [])
  const next = signatures(second)
  const decoded = decodeChallenge(new URLSearchParams(shareQuery(initial)))
  assert(decoded && same(first, signatures(decoded)), 'Shared seed did not replay')
  assert(first.length === new Set(first).size && next.length === new Set(next).size, 'Duplicate inside a full mock')
  assert(first.filter(x => !next.includes(x)).length / first.length >= 0.95, 'Fresh full mocks differ by less than 95%')
} catch (error) {
  failures.push(String(error))
}
writeFileSync('qa-report.json', JSON.stringify({ deep, summary, smallBooks, failures, items }))
if (failures.length) {
  console.error(failures.slice(0, 25).join('\n'))
  process.exitCode = 1
}
