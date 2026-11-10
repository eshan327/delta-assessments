import { choose, F, range, rational, sum, variants } from './core.ts'
import type { Difficulty, Rng, Variant } from './core.ts'
import { choice, family } from './questions.ts'

type GeneratedTerms = { values: number[]; derivation: string }

type Rule = {
  label: string
  cost: number
  terms: (r: Rng, d: Difficulty, v: Variant, length: number) => GeneratedTerms
  infer: (terms: number[], v: Variant) => number[]
  explain: (v: Variant) => string
}

const tri = (i: number) => i * (i + 1) / 2
const square = (i: number) => i * i
const cube = (i: number) => i ** 3
const parity = (i: number) => i % 2 === 0 ? 1 : -1
const factorial = (n: number) => range(n).reduce((p, i) => p * (i + 1), 1)
const prime = (n: number) => n >= 2 && range(Math.max(0, Math.floor(Math.sqrt(n)) - 1)).every(k => n % (k + 2) !== 0)
const primes = range(350).filter(prime)
const dice = (rng: Rng, d: Difficulty) => rng.int(2, 6 + d)
const digits = (n: number) => String(Math.abs(n)).split('').map(Number)

function basisRule(label: string, cost: number, descriptions: string[], bases: ((i: number, parameter: number) => number)[], parameters = [0]): Rule {
  return {
    label, cost,
    terms: (r, d, v, length) => {
      const b = bases[v], p = r.pick(parameters), a = r.int(-18 - d * 5, 28 + d * 9), m = r.int(1, 12 + d * 2) * r.pick([-1, 1, 1])
      const base = range(length).map(i => b(i, p))
      return {
        values: base.map(n => a + m * n),
        derivation: 'The underlying values end ' + base.slice(-4).join(', ') + '. For each underlying value u, the term is ' +
          a + ' + (' + m + ' × u). The next underlying value is ' + base.at(-1) + '.',
      }
    },
    infer: (terms, v) => parameters.flatMap(p => {
      const b = bases[v], first = b(0, p), j = terms.findIndex((_, i) => b(i, p) !== first)
      if (j < 0) return []
      const den = b(j, p) - first, num = terms[j] - terms[0]
      if (num % den !== 0 || !terms.every((x, i) => (x - terms[0]) * den === num * (b(i, p) - first))) return []
      return [terms[0] + num * (b(terms.length, p) - first) / den]
    }),
    explain: v => descriptions[v],
  }
}

type Step = (terms: number[], i: number, a: number, b: number, v: Variant) => number

function recur(label: string, cost: number, descriptions: string[], steps: Step, from: number, params = [-3, -2, -1, 1, 2, 3]): Rule {
  return {
    label, cost,
    terms: (r, d, v, length) => {
      const a = r.pick(params)
      const b = r.int(-10 - d * 2, 12 + d * 3)
      const t = range(from).map(() => r.int(-10 - d * 2, 30 + d * 7))
      while (t.length < length) t.push(steps(t, t.length, a, b, v))
      const i = t.length - 1
      const pieces = [[1, 0], [0, 1], [0, 0]].map(([x, y]) => steps(t.map((n, j) => j === i - 1 ? x : j === i - 2 ? y : n), i, a, b, v))
      const [x, y, k] = pieces
      const calculation = label === 'Digit transformations' ? 'At the last step the rule uses scale ' + a + ', offset ' + b +
        ', and previous term ' + t[i - 1] + '.' : 'At the last step, the calculation is ' + (x - k) + ' × (' + t[i - 1] + ')' +
        (from === 2 ? ' + ' + (y - k) + ' × (' + t[i - 2] + ')' : '') + ' + (' + k + ').'
      return { values: t, derivation: calculation }
    },
    infer: (t, v) => params.flatMap(a => {
      // Every recurrence in this group adds b once on at least one observed step.
      const index = t.findIndex((_, i) => i >= from && steps(t, i, a, 1, v) - steps(t, i, a, 0, v) === 1)
      if (index < 0) return []
      const b = t[index] - steps(t, index, a, 0, v)
      for (let i = from; i < t.length; i++) if (steps(t, i, a, b, v) !== t[i]) return []
      return [steps(t, t.length, a, b, v)]
    }),
    explain: v => descriptions[v],
  }
}

const differences = (a: number[]) => a.slice(1).map((n, i) => n - a[i])

function project(terms: number[], order: number) {
  const layers = [terms]
  while (layers.length <= order) layers.push(differences(layers.at(-1)!))
  const bottom = layers.at(-1)!
  if (bottom.length < 2 || !bottom.every(n => n === bottom[0])) return null
  return sum(layers.map(layer => layer.at(-1)!))
}

function interleave(streams: number): Rule {
  return {
    label: streams === 2 ? 'Two interleaved rules' : 'Three interleaved rules', cost: streams + 2,
    terms: (r, d, v, length) => {
      const offsets = range(streams).map(() => r.int(-22, 60 + d * 7))
      const steps = range(streams).map(() => dice(r, d) * r.pick([-1, 1]))
      const values = range(length).map(i => {
        const k = Math.floor(i / streams), lane = i % streams
        return offsets[lane] + steps[lane] * (v === 0 ? k : v === 1 ? (lane === 0 ? tri(k) : k) : tri(k) + lane * k)
      })
      const lane = (length - 1) % streams
      const selected = values.filter((_, i) => i % streams === lane)
      return { values, derivation: 'The next term is in lane ' + (lane + 1) + '. Its shown values are ' +
        selected.slice(0, -1).join(', ') + ', followed by a change of ' + (selected.at(-1)! - selected.at(-2)!) + '.' }

    },
    infer: (terms, v) => {
      const predictions = range(streams).map(lane => project(terms.filter((_, i) => i % streams === lane), v === 2 || (v === 1 && lane === 0) ? 2 : 1))
      return predictions.some(n => n === null) ? [] : [predictions[terms.length % streams]!]
    },
    explain: v => 'Split the terms into ' + streams + ' lanes by position. ' +
      ['Each lane has a constant step.', 'The first lane has changing steps; the others have constant steps.', 'Each lane has its own quadratic progression.'][v],
  }
}

const rules: Record<string, Rule> = {
  'first-difference': basisRule('Constant first differences', 1,
    ['Add the same amount each time.', 'Alternate the signs of a steadily growing distance from the baseline.', 'Alternate between advancing and retreating along two arithmetic offsets.'],
    [i => i, i => i * parity(i), i => i + 2 * parity(i)]),
  'second-difference': basisRule('Second differences', 2,
    ['The increments rise linearly.', 'The increments fall linearly before turning.', 'Take a quadratic progression with an offset linear term.'],
    [i => tri(i), (i, p) => square(i) - p * i, (i, p) => tri(i) + p * i], [2, 3, 4, 5, 6, 7]),
  'third-difference': basisRule('Higher finite differences', 3,
    ['Third differences are constant.', 'The terms combine cubic growth with a linear offset.', 'The cubic is shifted horizontally.'],
    [i => Number(choose(i + 2, 3)), (i, p) => cube(i) - p * i, (i, p) => cube(i - p)], [1, 2, 3, 4, 5]),
  geometric: basisRule('Geometric changes', 2,
    ['Subtract the fixed baseline and multiply by the same factor.', 'After subtracting the baseline the signs alternate as the magnitude grows.', 'Read a geometric progression backward from the next smaller power.'],
    [(i, p) => p ** i, (i, p) => (-p) ** i, (i, p) => p ** (9 - i)], [2, 3]),
  'alternating-steps': basisRule('Alternating increments', 3,
    ['Alternating steps have opposite signs with a steady net drift.', 'Every other step grows in magnitude.', 'The two directions use distinct growing steps.'],
    [(i, p) => i + p * parity(i), (i, p) => i + p * Math.floor(i / 2) * parity(i), (i, p) => tri(i) + p * i * parity(i)], [3, 4, 5, 6, 7, 8]),
  'two-lanes': interleave(2),
  'three-lanes': interleave(3),
  'affine-recurrence': recur('Multiply then add', 2,
    ['Multiply the previous term by a fixed factor and add a constant.', 'Alternate adding the constant with subtracting it after multiplication.', 'Multiply, then add a constant plus the step index.'],
    (t, i, a, b, v) => t[i - 1] * a + (v === 1 ? parity(i) * b : b + (v === 2 ? i : 0)), 1),
  'second-order': recur('Second-order recurrences', 3,
    ['Use the previous two terms, weighting the older term.', 'Weight the most recent term instead.', 'Weight the older term and alternate the additive adjustment.'],
    (t, i, a, b, v) => v === 1 ? a * t[i - 1] + t[i - 2] + b : t[i - 1] + a * t[i - 2] + (v === 2 ? parity(i) * b : b), 2),
  'sum-or-difference': recur('Alternating sum and difference', 4,
    ['Alternate the sign of the older term.', 'Alternate the sign of the newer term.', 'Combine both terms with a sign determined by every third step.'],
    (t, i, a, b, v) => v === 0 ? t[i - 1] + parity(i) * t[i - 2] + a * i + b :
      v === 1 ? parity(i) * t[i - 1] + t[i - 2] + a * i + b : (i % 3 === 0 ? -1 : 1) * (t[i - 1] + t[i - 2]) + a * i + b, 2),
  'powers': basisRule('Transformed squares and cubes', 3,
    ['Scale and shift consecutive squares.', 'Scale and shift consecutive cubes.', 'Alternate a square and a cube at each integer.'],
    [(i, p) => square(i + p), (i, p) => cube(i + p), (i, p) => (i % 2 === 0 ? square : cube)(Math.floor(i / 2) + p)], [1, 2, 3, 4, 5, 6]),
  'primes': basisRule('Prime sequences', 3,
    ['Consecutive primes are scaled and shifted.', 'The successive prime gaps are scaled and shifted.', 'Use every second prime, then scale and shift.'],
    [(i, p) => primes[i + p], (i, p) => primes[i + p + 1] - primes[i + p], (i, p) => primes[i * 2 + p]], range(24)),
  'digits': recur('Digit transformations', 3,
    ['Add a multiple of the previous term’s digit sum and a constant.', 'Use the product of the last two digits plus a constant and the previous term.', 'Reverse the digits in magnitude, then add a linear adjustment using the zero-based index.'],
    (t, i, a, b, v) => {
      const x = t[i - 1], ds = digits(x)
      if (v === 0) return x + a * sum(ds) + b
      if (v === 1) return x + a * ds.at(-1)! * (ds.at(-2) ?? 1) + b
      return Number([...ds].reverse().join('')) + a * i + b
    }, 1),
  'factorial': basisRule('Factorial and combinatorial counts', 4,
    ['Use factorials up to the seventh, then repeat from the first.', 'Use binomial coefficients on a fixed diagonal.', 'Count ordered selections of three distinct objects.'],
    [(i, p) => factorial((i + p) % 7 + 1), (i, p) => Number(choose(i + p, p)), (i, p) => (i + p) * (i + p - 1) * (i + p - 2)], [3, 4, 5, 6]),
  'multiply-subtract': recur('Alternating multiplication and subtraction', 4,
    ['Multiply on even steps and subtract a constant on odd steps.', 'Alternate multiplication plus an adjustment and subtracting the step index.', 'Multiply on every third step and subtract a constant otherwise.'],
    (t, i, a, b, v) => v === 0 ? (i % 2 === 0 ? a * t[i - 1] : t[i - 1] + b) :
      v === 1 ? (i % 2 === 0 ? a * t[i - 1] + b : t[i - 1] - i) : (i % 3 === 0 ? a * t[i - 1] : t[i - 1] + b), 1, [2, 3, 4]),
  'ratios': basisRule('Ratio patterns', 3,
    ['Compare scaled, descending powers of two.', 'Successive term differences are powers of the same base.', 'Read alternating signs of scaled, descending powers.'],
    [i => 2 ** (9 - i), (i, p) => (p ** i - 1) / (p - 1), (i, p) => parity(i) * p ** (9 - i)], [2, 3]),
  'modular': basisRule('Base and remainder patterns', 4,
    ['Advance a fixed step on a seven-position cycle.', 'Use squared indices and keep their remainders modulo 11.', 'Keep only the last digit of a fixed multiple.'],
    [(i, p) => (i * p) % 7, (i, p) => square(i + p) % 11, (i, p) => (i * p) % 10], [2, 3, 4, 5, 6, 7, 8, 9]),
  'cumulative': basisRule('Cumulative sums', 3,
    ['Each term is a running total of squares.', 'Each term is a running total of cubes.', 'Each term is a running total of consecutive primes.'],
    [(i, p) => sum(range(i + 1).map(k => square(k + p))), (i, p) => sum(range(i + 1).map(k => cube(k + p))),
      (i, p) => sum(primes.slice(p, p + i + 1))], range(15).slice(1)),
  'nested': recur('Nested alternating recurrence', 5,
    ['On alternating steps, update by the last difference or multiply the last term.', 'Alternate multiplying a difference and adding the last two terms.', 'The operation cycles through three forms based on the previous pair.'],
    (t, i, a, b, v) => v === 0 ? (i % 2 ? 2 * t[i - 1] - t[i - 2] : a * t[i - 1]) + b :
      v === 1 ? (i % 2 ? a * (t[i - 1] - t[i - 2]) : t[i - 1] + t[i - 2]) + b :
        [t[i - 1] - t[i - 2], a * t[i - 1], t[i - 1] + t[i - 2]][i % 3] + b, 2),
}

export const numberlogic = Object.entries(rules).map(([id, rule]) => family(id, rule.label, (rng, d, v) => {
  const length = id === 'three-lanes' ? (v === 0 ? 10 : 13) : id === 'two-lanes' && v !== 0 ? 10 : 7 + Math.min(2, d - 1)
  const { values: terms, derivation } = rule.terms(rng, d, v, length + 1)
  if (terms.some(n => !Number.isSafeInteger(n) || Math.abs(n) > 200_000) || new Set(terms).size < 4) return null
  const sample = terms.slice(0, -1)
  const value = terms.at(-1)!
  const inferred = Object.values(rules).flatMap(other => variants.flatMap(variant =>
    other.infer(sample, variant).map(next => ({ next, cost: other.cost }))))
  const fits = rule.infer(sample, v)
  if (!fits.includes(value) || inferred.some(other => other.cost <= rule.cost && other.next !== value)) return null
  const last = sample.at(-1)!, delta = last - sample.at(-2)!
  const alternatives = [...inferred.map(rule => rule.next), last, last + delta, last - delta, last + 2 * delta, -value, value + 1, value - 1]
  const scale = id === 'ratios' ? rng.int(2, 7 + d * 2) : 1
  const display = (n: number) => scale === 1 ? n : rational(F(n, scale))
  return choice(rng, {
    prompt: 'Find the next term in the sequence.',
    visual: { type: 'grid', style: 'numbers', columns: 5, cells: [...sample.map(display), '?'] },
    semantic: [sample.map(display), display(value)],
    explanation: [rule.explain(v), ...(scale === 1 ? [] : ['Multiply each fraction by ' + scale + ' to work with integer terms.']),
      derivation, 'Extending the rule through the next position gives ' + display(value) + '.'],
  }, F(value, scale), alternatives.map(n => F(n, scale)), () => F(fits[0], scale))
}))

numberlogic.push(family('row-rules', 'Missing table value', (rng, d, v) => {
  const a = rng.int(2, 7 + d), b = rng.int(1, 7 + d), c = rng.int(-18, 18)
  const make = (x: number, y: number) => v === 0 ? a * x + b * y + c : v === 1 ? a * x * y + b * y + c : a * x * x + b * y + c
  const design = [[1, 1], [2, 1], [3, 1], [1, 2], [2, 2], [3, 2]]
  const rows = design.map(([x, y]) => [x, y, make(x, y)])
  const x = rng.int(4, 14 + d), y = rng.int(3, 12 + d), target = make(x, y)
  const slope = rows[1][2] - rows[0][2], second = rows[2][2] - rows[1][2]
  const mixed = (rows[4][2] - rows[3][2]) - slope
  const vertical = rows[3][2] - rows[0][2]
  const projected = rows[0][2] + (x - 1) * slope + tri(x - 2) * (second - slope) + (y - 1) * vertical + (x - 1) * (y - 1) * mixed
  return choice(rng, {
    prompt: 'Each row follows the same rule using both inputs. Find the missing output.',
    visual: { type: 'table', headers: ['Input A', 'Input B', 'Output'], rows: [...rows, [x, y, '?']], highlight: [rows.length, 2] },
    semantic: [rows, x, y],
    explanation: ['The output is ' + [a + 'A + ' + b + 'B', a + 'AB + ' + b + 'B', a + 'A² + ' + b + 'B'][v] + ' plus ' + c + '.', 'Substitute A = ' + x + ' and B = ' + y + ' to obtain ' + target + '.'],
  }, F(target), [make(y, x), target - c, target - b * y, target + a * x, target + b].map(n => F(n)), () => F(projected))
}))
