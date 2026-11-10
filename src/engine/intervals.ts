import { choose, chooseByPascal, F, range, rational, sum } from './core.ts'
import type { Rational } from './core.ts'
import { family } from './questions.ts'
import type { Interval, Visual } from './questions.ts'

function interval(prompt: string, visual: Visual | undefined, semantic: unknown, value: Rational | number,
  check: () => Rational | number, explanation: string, percent = false): Interval {
  const truth = rational(F(value))
  return {
    kind: 'interval', prompt, visual, semantic, truth, check: () => rational(F(check())),
    explanation: [explanation, 'The exact target is ' + truth + (percent ? ' on the 0–100 scale.' : '.')],
    max: percent ? 100 : undefined,
  }
}

function compareDice(a: number, b: number, rule: (x: number, y: number) => boolean) {
  let count = 0
  for (let i = 1; i <= a; i++) for (let j = 1; j <= b; j++) if (rule(i, j)) count++
  return count
}

export const intervals = [
  family('two-input-table', 'Two-input rule table', (rng, d, v) => {
    const a = rng.int(2, 12 + d), b = rng.int(2, 15 + d), offset = rng.int(1, 28)
    const k = (x: number) => v === 2 ? x * x : x
    const value = (x: number, y: number) => offset + a * k(x) + b * y * (v === 1 ? x : 1)
    const data = [[1, 1], [2, 1], [3, 1], [1, 2], [2, 2], [3, 2], [3, 3]].map(([x, y]) => [x, y, value(x, y)])
    const x = rng.int(4, 10 + d), y = rng.int(3, 11 + d)
    return interval('Estimate the missing output. The table follows one rule using both inputs.',
      { type: 'table', headers: ['Input 1', 'Input 2', 'Output'], rows: [...data, [x, y, '?']], highlight: [data.length, 2] },
      [data, x, y], value(x, y), () => {
        const [o, p, q, r, s] = data.map(row => row[2])
        return o + (x - 1) * (p - o) + (x - 1) * (x - 2) * (q - 2 * p + o) / 2 +
          (y - 1) * (r - o + (x - 1) * (s - r - p + o))
      }, 'The output is ' + a + (v === 2 ? ' × input 1 squared' : ' × input 1') + ' + ' + b +
      (v === 1 ? ' × input 1 × input 2' : ' × input 2') + ' + ' + offset + '.')
  }),
  family('percentiles', 'Percentiles in a score matrix', (rng, d, v) => {
    const length = [100, 150, 200][v]
    const data = range(length).map(() => rng.int(22 - d * 3, 95 + d))
    const position = rng.int(0, length - 1), target = data[position]
    const count = data.filter(n => n <= target).length
    const rows = range(length / 10).map(i => data.slice(i * 10, (i + 1) * 10))
    return interval('Estimate the percentile of the highlighted score. Count the percentage of entries at or below it, including ties and the highlighted entry.',
      { type: 'table', headers: range(10).map(i => String(i + 1)), rows, highlight: [Math.floor(position / 10), position % 10] },
      [v, data, position], F(100 * count, length), () => F(100 * (length - data.filter(n => n > target).length), length),
      count + ' out of ' + length + ' scores are at or below ' + target + '.', true)
  }),
  family('scattered-sums', 'Scattered integers', (rng, d, v) => {
    const data = range(8 + v * 2 + (d >= 4 ? 2 : 0)).map(() => rng.int(12, 78 + d * 4))
    const selected = (n: number) => v === 0 || (v === 1 ? n % 2 === 0 : n >= 50)
    const valid = data.filter(selected)
    return interval('Estimate the sum of ' + ['all the numbers', 'the even numbers', 'the numbers that are at least 50'][v] + '.',
      { type: 'grid', cells: data, columns: data.length / 2, style: 'numbers' }, [v, [...data].sort((a, b) => a - b)],
      sum(valid), () => data.reduce((acc, n) => selected(n) ? acc + n : acc, 0), 'The included values are ' + (valid.join(', ') || 'none') + '.')
  }),
  family('polynomial-series', 'Polynomial extrapolation', (rng, d, v) => {
    const a = rng.int(1, 13 + d), b = rng.int(1, 14 + d), c = rng.int(2, 28), n = rng.int(6, 9 + d)
    const value = (t: number) => c + b * t + a * (v === 0 ? t * t : v === 1 ? t * (t - 1) / 2 : t ** 3)
    const series = range(n).map(i => value(i + 1))
    return interval('Estimate the next output. The sequence has constant ' + (v === 2 ? 'third' : 'second') + ' differences.',
      { type: 'table', headers: ['Step', 'Output'], rows: [...series.map((x, i) => [i + 1, x]), [n + 1, '?']], highlight: [n, 1] },
      [v, series], value(n + 1), () => {
        let terms = series
        let next = terms.at(-1)!
        for (let i = 0; i < (v === 2 ? 3 : 2); i++) {
          terms = terms.slice(1).map((x, j) => x - terms[j])
          next += terms.at(-1)!
        }
        return next
      }, 'Take successive differences, extend the constant row, then add back up through the rows.')
  }),
  family('coin-field', 'Counting heads and tails', (rng, d, v) => {
    const length = rng.int(24 + d * 2, 44 + d * 2), threshold = rng.int(23, 77)
    const data = range(length).map(() => rng.int(1, 100) <= threshold ? 'H' : 'T')
    const heads = data.filter(x => x === 'H').length
    const target = v === 1 ? length - heads : heads
    const prompt = ['What percentage of coins show heads?', 'What percentage of coins show tails?', 'How many more heads than tails are there, ignoring the sign?'][v]
    return interval(prompt,
      { type: 'grid', cells: data, columns: 9, style: 'coins', offsets: data.map(() => [rng.int(-6, 6), rng.int(-6, 6)]) },
      [v, data], v === 2 ? Math.abs(2 * heads - length) : F(100 * target, length), () => {
        const tails = data.reduce((n, face) => n + Number(face === 'T'), 0)
        return v === 2 ? Math.abs(length - 2 * tails) : F(100 * (v === 0 ? length - tails : tails), length)
      }, 'There are ' + heads + ' heads and ' + (length - heads) + ' tails in the display.', v !== 2)
  }),
  family('dice-comparison', 'Fair dice comparisons', (rng, d, v) => {
    const a = rng.int(5, 17 + d), b = rng.int(5, 18 + d), k = rng.int(0, Math.min(7, a - 2))
    const relation = v === 0 ? 'is more than ' + k + ' above' : v === 1 ? 'is exactly ' + k + ' above' : 'is no more than ' + k + ' above'
    const favorable = compareDice(a, b, (x, y) => v === 0 ? x - y > k : v === 1 ? x - y === k : x - y <= k)
    return interval('Roll a fair ' + a + '-sided and a fair ' + b + '-sided die, both numbered from 1. Estimate the percentage of ordered rolls where the first roll ' + relation + ' the second.',
      undefined, [v, a, b, k], F(100 * favorable, a * b), () => {
        const greater = sum(range(a).map(i => Math.max(0, Math.min(b, i - k))))
        const equal = Math.min(b, a - k)
        return F(100 * [greater, equal, a * b - greater][v], a * b)
      }, favorable + ' of the ' + a * b + ' equally likely pairs meet the requested relation.', true)
  }),
  family('order-statistics', 'Order statistics', (rng, d, v) => {
    const data = range(20 + 5 * (d >= 4 ? 1 : 0)).map(() => rng.int(2, 90 + d * 5))
    const k = rng.int(2, 5), m = rng.int(2, 6)
    const sorted = [...data].sort((a, b) => a - b)
    const largest = sorted[data.length - k], smallest = sorted[m - 1]
    const value = [largest - smallest, largest + smallest, largest][v]
    const ordinals = ['', '1st', '2nd', '3rd', '4th', '5th', '6th']
    return interval(['Find the difference between the ' + ordinals[k] + ' largest and the ' + ordinals[m] + ' smallest number.',
      'Find the sum of the ' + ordinals[k] + ' largest and the ' + ordinals[m] + ' smallest number.', 'Find the ' + ordinals[k] + ' largest number.'][v] + ' Count duplicates as separate entries.',
    { type: 'grid', cells: data, columns: 5, style: 'numbers' }, [v, sorted, k, v === 2 ? 0 : m], value, () => {
      const find = (index: number) => range(Math.max(...data) + 1).find(n => data.filter(x => x <= n).length > index)!
      const a = find(data.length - k), b = find(m - 1)
      return [a - b, a + b, a][v]
    }, 'In ascending order: ' + sorted.join(', ') + '. The selected values are ' + largest + ' and ' + smallest + '.')
  }),
  family('scaled-path', 'Scaled orthogonal paths', (rng, d, v) => {
    const count = rng.int(7 + d, 9 + d)
    const lengths = range(count).map(() => rng.int(2, 12 + d))
    const points: [number, number][] = [[0, 0]]
    for (const [i, size] of lengths.entries()) {
      const [x, y] = points.at(-1)!
      points.push(i % 2 === 0 ? [x + size * (i % 4 === 0 ? 1 : -1), y] : [x, y + size])
    }
    const scale = rng.pick([2, 3, 4, 5, 8])
    const units = ['meters', 'centimeters', 'kilometers'][v]
    return interval('Use the ruler to estimate the ' + ['total', 'horizontal', 'vertical'][v] + ' distance along the marked route, in ' + units + '.',
      { type: 'path', points, scale, unit: units }, [v, lengths, scale],
      sum(lengths.filter((_, i) => v === 0 || i % 2 === v - 1)) * scale,
      () => sum(points.slice(1).map(([x, y], i) => (v === 2 ? 0 : Math.abs(x - points[i][0])) + (v === 1 ? 0 : Math.abs(y - points[i][1])))) * scale,
      'Measure each included segment and multiply its length in ruler intervals by ' + scale + ' ' + units + '.')
  }),
  family('dice-grid', 'Filtered dice-pip grids', (rng, d, v) => {
    const count = d <= 2 ? 64 : 100
    const data = range(count).map(() => rng.int(1, 6))
    const faces = rng.shuffle([1, 2, 3, 4, 5, 6]).slice(0, v === 2 ? 3 : 2).sort((a, b) => a - b)
    const dice = data.filter(n => faces.includes(n))
    const value = v === 1 ? dice.length : sum(dice)
    return interval((v === 1 ? 'Count the dice' : 'Sum the pips on the dice') + ' showing ' + faces.join(' or ') + '.',
      { type: 'grid', cells: data, columns: Math.sqrt(count), style: 'dice' }, [v === 1, faces, data], value,
      () => sum(faces.map(face => data.filter(x => x === face).length * (v === 1 ? 1 : face))),
      'Matching counts: ' + faces.map(face => face + ' → ' + dice.filter(x => x === face).length).join(', ') + '.')
  }),
  family('multiplicative-series', 'Multiplicative extrapolation', (rng, d, v) => {
    const initial = rng.int(2, 30 + d), factor = rng.int(2, 4 + d), offset = rng.int(2, 28)
    const n = rng.int(5, 7 + Math.min(d, 2))
    const bias = (i: number) => v === 0 ? offset : v === 1 ? offset + i : offset * (i % 2 === 0 ? 2 : 1)
    const series = [initial]
    for (let i = 1; i <= n; i++) series.push(series.at(-1)! * factor + bias(i))
    const data = series.slice(0, -1)
    return interval('Estimate the next output. Each row multiplies the previous output by the same integer and adds ' +
      ['a fixed offset', 'an offset that rises by 1 per step', 'one of two alternating offsets'][v] + '.',
    { type: 'table', headers: ['Step', 'Output'], rows: [...data.map((x, i) => [i + 1, x]), [n + 1, '?']], highlight: [n, 1] },
    [v, data], series.at(-1)!, () => {
      const candidate = range(10).slice(2).find(f => {
        const b = data.slice(1).map((x, i) => x - f * data[i])
        return b.every((x, i) => x === (v === 0 ? b[0] : v === 1 ? b[0] + i : b[i % 2]))
      })!
      const b = data.slice(1).map((x, i) => x - candidate * data[i])
      return candidate * data.at(-1)! + (v === 0 ? b[0] : v === 1 ? b[0] + b.length : b[b.length % 2])
    }, 'Multiply by ' + factor + ' and add ' + bias(n) + ' at the next step.')
  }),
  family('shapes-without-replacement', 'Sampling from a shape grid', (rng, d, v) => {
    const shapes = ['circle', 'square', 'triangle']
    const length = d <= 2 ? 64 : 100
    const data = range(length).map(() => rng.pick(shapes))
    const selected = rng.pick(range(3))
    const count = shapes.map(shape => data.filter(x => x === shape).length)
    const event = [
      'one of each shape',
      'exactly two ' + shapes[selected] + 's',
      'three of the same shape',
    ][v]
    const cases = [count[0] * count[1] * count[2], Number(choose(count[selected], 2)) * (length - count[selected]),
      sum(count.map(n => Number(choose(n, 3))))][v]
    return interval('Draw three shapes uniformly without replacement. Estimate the chance of drawing ' + event + ', as a percentage.',
      { type: 'grid', cells: data, columns: Math.sqrt(length), style: 'shapes' }, [v, data, v === 1 ? selected : 0],
      F(100 * cases, choose(length, 3)), () => {
        const [a, b, c] = count
        const favorable = v === 0 ? 6 * a * b * c : v === 1 ? 3 * count[selected] * (count[selected] - 1) * (length - count[selected]) :
          sum(count.map(n => n * (n - 1) * (n - 2)))
        return F(100 * favorable, 6n * chooseByPascal(length, 3))
      }, 'The grid has ' + count.map((n, i) => n + ' ' + shapes[i] + 's').join(', ') + '. Count favorable three-shape samples, then divide by all samples.', true)
  }),
]
