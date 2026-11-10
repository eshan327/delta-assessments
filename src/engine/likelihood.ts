import { choose, F, mean, range, sum } from './core.ts'
import type { Rng } from './core.ts'
import { family } from './questions.ts'
import type { PlotSeries, Ranking, Visual } from './questions.ts'

const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
const rounded = (x: number, digits = 2) => Number(x.toFixed(digits))

function ranking(rng: Rng, prompt: string, visual: Visual | undefined, labels: string[], scores: number[], reference: number[],
  description: string, semantic: unknown, minimum = 0.055): Ranking | null {
  const indices = range(3).sort((a, b) => scores[b] - scores[a])
  const margin = Math.min(scores[indices[0]] - scores[indices[1]], scores[indices[1]] - scores[indices[2]])
  if (!Number.isFinite(margin) || margin < minimum || scores.some((x, i) => Math.abs(x - reference[i]) > 1e-5)) return null
  const options = labels.map((label, i) => ({ key: String(i), label }))
  return {
    kind: 'ranking', prompt, visual, semantic,
    options: rng.shuffle(options), truth: indices.map(String),
    check: () => range(3).sort((a, b) => reference[b] - reference[a]).map(String),
    margin, explanation: [description, ...indices.map(i => labels[i] + ' — ' + rounded(100 * scores[i], 1) + '%')],
  }
}

function table(headers: string[], rows: (string | number)[][]): Visual {
  return { type: 'table', headers, rows }
}

function empirical<T>(values: T[], event: (x: T) => boolean) {
  const matches = values.filter(event).length
  const rejected = values.reduce((count, x) => count + Number(!event(x)), 0)
  return [matches / values.length, 1 - rejected / values.length]
}

function split(values: number[][]) {
  return [values.map(x => x[0]), values.map(x => x[1])] as const
}

function cdf(z: number) {
  const abs = Math.abs(z), t = 1 / (1 + 0.2316419 * abs)
  const tail = Math.exp(-abs * abs / 2) / Math.sqrt(2 * Math.PI) * t *
    (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))))
  return z < 0 ? tail : 1 - tail
}

function cdfIntegral(z: number) {
  if (z <= -9) return 0
  if (z >= 9) return 1
  const n = 128, h = (z + 9) / n
  const pdf = (x: number) => Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI)
  return h / 3 * (pdf(-9) + pdf(z) + sum(range(n - 1).map(j => (j % 2 === 0 ? 4 : 2) * pdf(-9 + (j + 1) * h))))
}

function normal(rng: Rng) {
  return Math.sqrt(-2 * Math.log(1 - rng.next())) * Math.cos(2 * Math.PI * rng.next())
}

function plot(x: string, y: string, series: PlotSeries[]): Visual {
  return { type: 'plot', x, y, series }
}

function leastSquares(points: [number, number][], logarithmic = false) {
  const y = (n: number) => logarithmic ? Math.log1p(n) : n
  const mx = mean(points.map(p => p[0])), my = mean(points.map(p => y(p[1])))
  const slope = sum(points.map(([x, value]) => (x - mx) * (y(value) - my))) / sum(points.map(([x]) => (x - mx) ** 2))
  const intercept = my - mx * slope
  return (x: number) => logarithmic ? Math.expm1(intercept + slope * x) : intercept + slope * x
}

function independentLine(points: [number, number][], log = false) {
  const n = points.length, x = sum(points.map(p => p[0]))
  const transform = (v: number) => log ? Math.log1p(v) : v
  const y = sum(points.map(p => transform(p[1])))
  const slope = (n * sum(points.map(p => p[0] * transform(p[1]))) - x * y) /
    (n * sum(points.map(p => p[0] ** 2)) - x * x)
  return (v: number) => log ? Math.expm1((y + slope * (n * v - x)) / n) : (y + slope * (n * v - x)) / n
}

function poisson(lambda: number, k: number) {
  return Math.exp(-lambda) * range(k).reduce((p, i) => p * lambda / (i + 1), 1)
}

export const likelihood = [
  family('linear-mixtures', 'Mixtures of time series', (rng, d, v) => {
    const count = 18 + 4 * d
    const alpha = rng.pick([-2, -1, 1, 2]), beta = rng.pick([-2, -1, 1, 2])
    const b = range(count).map(i => rng.int(-3, 3) + (i > count / 2 ? rng.int(7, 9) : 0) + i)
    const c = range(count).map(i => rng.int(-3, 3) + (i % 8 < 4 ? 8 : -4) - i / 2)
    const a = b.map((x, i) => alpha * x + beta * c[i] + rng.int(-4, 4))
    const candidates = [[alpha + (v === 0 ? 0 : 1), beta], [alpha - 1, beta + 1], [alpha + 3, beta + 2 + v]]
    const window = range(count).filter(i => v === 0 || (v === 1 ? i < count / 2 : i >= count / 2))
    const losses = candidates.map(([p, q]) => sum(window.map(i => (a[i] - p * b[i] - q * c[i]) ** 2)))
    const moments = (x: number[], y: number[]) => sum(window.map(i => x[i] * y[i]))
    const aa = moments(a, a), bb = moments(b, b), cc = moments(c, c), ab = moments(a, b), ac = moments(a, c), bc = moments(b, c)
    const alt = candidates.map(([p, q]) => aa + p * p * bb + q * q * cc - 2 * p * ab - 2 * q * ac + 2 * p * q * bc)
    const scale = Math.max(...losses)
    return ranking(rng, 'Use the chart to rank the formulas by how closely they match A. Compare the sum of squared errors over ' + ['the entire series', 'the first half of the series', 'the second half of the series'][v] + '.',
      plot('Time', 'Value', [a, b, c].map((data, i) => ({ label: letters[i], points: data.map((x, j) => [j + 1, x]) }))),
      candidates.map(([p, q]) => 'A = ' + p + 'B ' + (q >= 0 ? '+ ' : '− ') + Math.abs(q) + 'C'),
      losses.map(x => 1 - x / scale), alt.map(x => 1 - x / scale),
      'At each included time, square the difference between A and the proposed mixture. The percentages below show relative fit against the largest error.',
      [v, a, b, c, candidates])
  }),
  family('housing', 'Housing data with missing values', (rng, d, v) => {
    const residual = () => rng.int(-42 - d * 3, 42 + d * 3)
    const base = (r: number[]) => 80 + r[0] / 5 + 24 * r[1] + 18 * r[2] - 3 * r[3] + (r[4] - 1990)
    const features = range(30).map(() => [rng.int(30, 130) * 5, rng.int(2, 6), rng.int(1, 3), rng.int(2, 25), rng.int(1970, 2025)])
    const data = features.map(r => [...r, base(r) + residual()])
    const missing = [6, 17, 24], thresholds = missing.map(i => base(features[i]) + rng.int(-40, 40))
    const seen = data.flatMap((r, i) => missing.includes(i) ? [] : [r[5] - base(r)])
    const events = missing.map((i, j) => (e: number) => v === 0 ? base(features[i]) + e >= thresholds[j] :
      v === 1 ? base(features[i]) + e <= thresholds[j] : Math.abs(base(features[i]) + e - thresholds[j]) <= 16)
    const [values, checks] = split(events.map(e => empirical(seen, e)))
    return ranking(rng, 'Estimate missing prices using a baseline of 80 + area/5 + 24×beds + 18×baths − 3×distance + (year−1990), in thousands. For each missing price, add a uniformly sampled error from the complete rows.',
      table(['Home', 'Area', 'Beds', 'Baths', 'Distance', 'Year', 'Price ($k)'], data.map((r, i) => [i + 1, ...r.slice(0, 5), missing.includes(i) ? letters[missing.indexOf(i)] : r[5]])),
      thresholds.map((k, i) => 'Price ' + letters[i] + [' is at least $', ' is at most $', ' is within $16k of $'][v] + k + 'k'),
      values, checks, 'Subtract the stated baseline from complete prices. Each residual is equally likely; count the residuals satisfying each statement.',
      [v, data.map((r, i) => missing.includes(i) ? r.slice(0, 5) : r), thresholds])
  }),
  family('basketball', 'Basketball free throws', (rng, d, v) => {
    const attempts = rng.int(52, 115), makes = Math.round(attempts * rng.int(36, 78) / 100)
    const extra = rng.int(22 + 2 * d, 48 + 2 * d), p = makes / attempts
    const pivot = Math.round(extra * p)
    const stops = [pivot + rng.int(-6, -2), pivot + rng.int(-2, 2), pivot + rng.int(2, 6)]
    const width = rng.int(1, 4), events = stops.map(k => (x: number) => v === 0 ? x >= k : v === 1 ? x <= k : Math.abs(x - k) <= width)
    const pmf = range(extra + 1).map(k => Number(choose(extra, k)) * p ** k * (1 - p) ** (extra - k))
    let dp = [1]
    for (let i = 0; i < extra; i++) dp = range(dp.length + 1).map(k => (dp[k] ?? 0) * (1 - p) + (dp[k - 1] ?? 0) * p)
    const labels = stops.map(k => v === 2 ? 'Ends with ' + (makes + k - width) + '–' + (makes + k + width) + ' made shots, inclusive' :
      'Ends with ' + (v === 0 ? 'at least ' : 'at most ') + (makes + k) + ' made shots')
    return ranking(rng, 'A player made ' + makes + ' of ' + attempts + ' free throws and takes ' + extra + ' more. Model future shots as independent with success probability equal to their observed rate.',
      undefined, labels, events.map(e => sum(pmf.filter((_, k) => e(k)))), events.map(e => sum(dp.filter((_, k) => e(k)))),
      'Future makes follow a binomial distribution. Add the makes already recorded before comparing the three events.', [v, attempts, makes, extra, stops, v === 2 ? width : 0])
  }),
  family('outliers', 'Regression scatter and outliers', (rng, d, v) => {
    const points: [number, number][] = range(22 + d).map(i => [i + 1, rounded(2 + i * 1.2 + normal(rng) * 2)])
    const extras: [number, number][] = range(3).map(i => [points.length + i + 1, rounded(32 + i * 9 + rng.int(3, 17))])
    const combined = [...points, ...extras]
    const tests = (v === 0 ? range(5).map(i => i * 4 + 2) : v === 1 ? range(4).map(i => i * 4 + points.length - 7) : range(8).map(i => i * 5 + 1))
    const fits = [combined, points, combined.slice(4)]
    const labels = ['Fit using all points', 'Fit using only the main cloud', 'Fit excluding the first four main-cloud points']
    const score = (fit: (pts: [number, number][]) => (x: number) => number) => fits.map(pts => {
      const predict = fit(pts)
      return 1 / (1 + mean(tests.map(x => Math.abs(predict(x) - (0.8 + 1.2 * x)))) / 2)
    })
    return ranking(rng, 'The long-run benchmark is y = 0.8 + 1.2x. Rank the least-squares fits by closest to the benchmark, using mean absolute error at x = ' + tests.join(', ') + '.',
      plot('Input', 'Observed response', [
        { label: 'Main cloud', points, scatter: true }, { label: 'Outliers', points: extras, scatter: true },
        ...fits.map((pts, i) => ({ label: labels[i], points: [1, 39].map(x => [x, rounded(leastSquares(pts)(x))] as [number, number]) })),
      ]), labels, score(leastSquares), score(independentLine),
      'Fit the requested observations, then average the absolute prediction errors at the listed test inputs. Higher displayed percentages indicate smaller error.',
      [v, combined, tests], 0.018)
  }),
  family('score-distributions', 'Overlapping score distributions', (rng, d, v) => {
    const a = rng.int(49, 68), b = a + rng.int(-6, 9), sa = rng.int(4, 9), sb = rng.int(10, 18 + d)
    const k = rng.int(a - 6, a + 10), w = rng.int(3, 8)
    const values = (norm: (z: number) => number) => {
      const A = (x: number) => norm((x - a) / sa), B = (x: number) => norm((x - b) / sb)
      return v === 0 ? [1 - A(k), 1 - B(k), norm((b - a) / Math.hypot(sa, sb))] :
        v === 1 ? [A(k + w) - A(k - w), B(k + w) - B(k - w), A(k) * B(k)] :
          [A(k - w) / A(k + w), B(k - w) / B(k + w), A(k - w) * B(k - w) / (A(k + w) * B(k + w))]
    }
    const labels = v === 0 ? ['A scores above ' + k, 'B scores above ' + k, 'B outscores A'] :
      v === 1 ? ['A scores within ' + w + ' of ' + k, 'B scores within ' + w + ' of ' + k, 'Both score below ' + k] :
        ['A scores below ' + (k - w) + ' given A scored below ' + (k + w), 'B scores below ' + (k - w) + ' given B scored below ' + (k + w),
          'Both score below ' + (k - w) + ' given both scored below ' + (k + w)]
    return ranking(rng, 'A and B are independent normal scores. A has mean ' + a + ' and standard deviation ' + sa + '; B has mean ' + b + ' and standard deviation ' + sb + '. Rank these events.',
      plot('Score', 'Density', [[a, sa], [b, sb]].map(([m, s], i) => ({
        label: letters[i], points: range(91).map(j => [j + 15, Math.exp(-(((j + 15 - m) / s) ** 2) / 2) / (s * Math.sqrt(2 * Math.PI))] as [number, number]),
      }))), labels, values(cdf), values(cdfIntegral),
      'Convert thresholds to z-scores. For two independent scores, use their product for joint events or add variances for the difference.',
      [v, a, b, sa, sb, k, v === 0 ? 0 : w])
  }),
  family('random-walk-particles', 'Two particles on a lattice', (rng, d, v) => {
    const n = rng.int(45 + d * 4, 80 + d * 5), a = rng.int(-6, 3), b = rng.int(2, 9)
    const thresholds = [rng.int(3, 8), rng.int(9, 13), rng.int(4, 13)]
    const distances = [thresholds[0] - a, thresholds[1] - b, thresholds[2] - a]
    if (distances.some(k => k <= 0)) return null
    const hits = [v !== 1, v !== 0, v === 2]
    const diagonal = v === 2
    const dp = (bound: number, ever: boolean) => {
      let row = new Map([[0, 1]])
      const moves: [number, number][] = diagonal ? [[1, 0.5], [-1, 0.5]] : [[1, 0.25], [0, 0.5], [-1, 0.25]]
      for (let i = 0; i < n; i++) {
        const next = new Map<number, number>()
        for (const [x, w] of row) for (const [step, p] of ever && x === bound ? [[0, 1]] as [number, number][] : moves) {
          const y = x + step
          next.set(y, (next.get(y) ?? 0) + w * p)
        }
        row = next
      }
      return sum([...row].filter(([x]) => x >= bound).map(([, p]) => p))
    }
    const exact = (bound: number, ever: boolean) => {
      const size = diagonal ? n : 2 * n
      const ways = range(size + 1).reduce((a, i) => {
        const x = (diagonal ? 2 : 1) * i - n
        return a + BigInt(Number(x >= bound) + Number(ever && x > bound)) * choose(size, i)
      }, 0n)
      return F(ways, 2n ** BigInt(size)).valueOf()
    }
    const axis = diagonal ? 'x + y' : 'x'
    return ranking(rng, 'Particles A and B start at (' + a + ', 0) and (' + b + ', 0). Each of ' + n + ' independent steps is uniformly north, east, south, or west. Rank the events.',
      plot('x', 'y', [{ label: 'A', scatter: true, points: [[a, 0]] }, { label: 'B', scatter: true, points: [[b, 0]] }]),
      thresholds.map((k, i) => (i === 1 ? 'B' : 'A') + (hits[i] ? ' ever reaches ' : ' ends with ') + axis + ' ≥ ' + k),
      distances.map((k, i) => dp(k, hits[i])), distances.map((k, i) => exact(k, hits[i])),
      'Propagate step probabilities over the requested coordinate. For an ever-reaches event, keep a path in the absorbing state once it reaches the boundary.',
      [v, n, a, b, thresholds])
  }),
  family('information-network', 'Directed information network', (rng, d, v) => {
    const count = 5 + Math.min(3, d - 1)
    const edges = range(count).map(i => rng.shuffle(range(count).filter(j => j !== i)).slice(0, rng.int(1, 3)).sort((a, b) => a - b))
    const start = rng.int(0, count - 1), t = rng.int(2, 5 + d)
    const labels = letters.slice(0, count)
    const targets = rng.shuffle(range(count)).slice(0, 3)
    const sets = targets.map((j, i) => v === 0 ? [j] : v === 1 ? [j, (j + 1) % count] : [j, (j + 2 + i) % count].filter((x, k, a) => a.indexOf(x) === k))
    let row = range(count).map(i => Number(i === start))
    for (let s = 0; s < t; s++) row = range(count).map(j => sum(row.map((p, i) => edges[i].includes(j) ? p / edges[i].length : 0)))
    const back = (set: number[]) => {
      let p = range(count).map(i => Number(set.includes(i)))
      for (let s = 0; s < t; s++) p = edges.map(next => mean(next.map(j => p[j])))
      return p[start]
    }
    return ranking(rng, 'A message starts at ' + letters[start] + '. At each step it picks uniformly among outgoing arrows. Rank its possible locations after ' + t + ' steps.',
      { type: 'graph', nodes: labels, edges },
      sets.map(s => 'At ' + s.map(i => labels[i]).join(' or ')),
      sets.map(s => sum(s.map(i => row[i]))), sets.map(back),
      'Split probability equally over outgoing edges at each step, then add the terminal probabilities for each event.', [v, edges, start, t, sets], 0.045)
  }),
  family('fund-returns', 'Investment fund return history', (rng, d, v) => {
    const drift = range(4).map(() => rng.int(-3, 12)), spreads = range(4).map(() => rng.int(5, 13 + d))
    const data = range(10).map(() => drift.map((m, i) => m + rng.int(-spreads[i], spreads[i])))
    const a = rng.shuffle(range(4)).slice(0, 3), threshold = rng.int(-6, 9)
    const years = v === 1 ? data.flatMap(x => data.map(y => [x, y])) : data.map(x => [x])
    const events = a.map(i => (rows: number[][]) => v === 0 ? rows[0][i] > rows[0][3] :
      v === 1 ? (100 + rows[0][i]) * (100 + rows[1][i]) >= (100 + threshold) * 100 : rows[0][i] < threshold)
    if (v === 0 && a.includes(3)) return null
    const [values, checks] = split(events.map(e => empirical(years, e)))
    return ranking(rng, 'Model each future year by sampling a whole historical row uniformly. For multiple future years, sample rows independently.',
      table(['Year', ...letters.slice(0, 4)], data.map((r, i) => [i + 1, ...r.map(x => x + '%')])),
      a.map(i => 'Fund ' + letters[i] + [' outperforms Fund D next year', ' compounds to at least ' + threshold + '% over two years', ' returns less than ' + threshold + '% next year'][v]),
      values, checks, 'Keep the four funds paired in each sampled year. For two-year returns, multiply the two gross returns and compare against the target.',
      [v, data, a, v === 0 ? 0 : threshold], 0.045)
  }),
  family('observed-dice', 'Nonstandard dice from sample rolls', (rng, d, v) => {
    const faces = range(3).map((i) => range(6).map(() => rng.int(1 + i, 4 + d + i)))
    const data = range(20).map(() => faces.map(die => rng.pick(die)))
    const k = rng.int(2, 7)
    const event = (i: number, x: number, y: number) => v === 0 ? x >= k : v === 1 ? x + y >= k + i + 4 : x > y
    const tallies = faces.map((_, i) => {
      const die = data.map(row => row[i]), other = v === 0 ? [0] : data.map(row => row[(i + 1) % 3])
      const all = die.flatMap(x => other.map(y => [x, y]))
      const [value] = empirical(all, ([x, y]) => event(i, x, y))
      const check = sum(range(12).map(x => die.filter(n => n === x).length * other.filter(y => event(i, x, y)).length)) / all.length
      return [value, check]
    })
    return ranking(rng, 'For each future die roll, draw uniformly from its recorded observations. Draw independently when an event compares two dice.',
      table(['Roll', ...letters.slice(0, 3)], data.map((r, i) => [i + 1, ...r])),
      range(3).map(i => ['Die ' + letters[i] + ' rolls at least ' + k, letters[i] + ' plus ' + letters[(i + 1) % 3] + ' totals at least ' + (k + i + 4),
        'Die ' + letters[i] + ' exceeds die ' + letters[(i + 1) % 3]][v]),
      ...split(tallies), 'Each recorded value is equally likely. Count qualifying outcomes in the resulting single-roll or two-roll sample space.',
      [v, data, v === 2 ? 0 : k])
  }),
  family('used-cars', 'Used-car price and model year', (rng, d, v) => {
    const data = range(3).map((brand): [number, number][] => range(18 + d).map(() => {
      const year = rng.int(2008 + brand * 2, 2024)
      return [year, Math.max(1, 3 + (year - 2008) * (brand + 1) + rng.int(-5, 8))]
    }))
    const year = rng.int(2012, 2019), price = rng.int(12, 32)
    const all = data.flatMap((rows, brand) => rows.map(([x, y]) => ({ x, y, brand })))
    const [values, checks] = split(range(3).map(i => {
      const sample = all.filter(({ x, y, brand }) => v === 0 ? x >= year : v === 1 ? brand === i && x >= year : y >= price)
      return empirical(sample, row => v === 1 ? row.y >= price : row.brand === i)
    }))
    return ranking(rng, 'Sample uniformly from the plotted cars. Rank the conditional events.',
      plot('Model year', 'Price ($k)', data.map((points, i) => ({ label: 'Brand ' + letters[i], points, scatter: true }))),
      range(3).map(i => ['Brand ' + letters[i] + ' given year ≥ ' + year,
        'Price ≥ $' + price + 'k given brand ' + letters[i] + ' and year ≥ ' + year, 'Brand ' + letters[i] + ' given price ≥ $' + price + 'k'][v]),
      values, checks, 'Filter to the condition first, then divide the number of qualifying points by the size of the filtered set.',
      [v, data, v === 2 ? 0 : year, v === 0 ? 0 : price])
  }),
  family('round-robin', 'Football round-robin predictions', (rng, d, v) => {
    const strengths = range(6).map(() => rng.int(1, 4 + d))
    const data = range(6).flatMap(i => range(6).flatMap(j => i < j && (i !== 0 || j !== 1) ?
      [[i, j, rng.int(0, strengths[i]), rng.int(0, strengths[j])]] : []))
    const rates = range(2).map(i => (1 + sum(data.flatMap(row => row[0] === i ? [row[2]] : row[1] === i ? [row[3]] : []))) / 5)
    const goal = rng.int(2, 6)
    const events = [(a: number, b: number) => a > b, (a: number, b: number) => a === b, (a: number, b: number) => b > a,
      (a: number, b: number) => a + b >= goal, (a: number, b: number) => a > 0 && b > 0]
    const ix = [[0, 1, 2], [0, 3, 4], [2, 1, 3]][v]
    const labels = ['A wins', 'Match ends in a draw', 'B wins', 'At least ' + goal + ' goals in total', 'Both teams score']
    const [a, b] = rates
    const pmf = rates.map(r => range(31).map(k => poisson(r, k)))
    const values = ix.map(i => sum(pmf[0].map((p, k) => p * sum(pmf[1].filter((_, j) => events[i](k, j))))))
    const alt = [
      sum(pmf[0].map((p, k) => p * sum(pmf[1].slice(0, k)))),
      sum(pmf[0].map((p, k) => p * pmf[1][k])),
      sum(pmf[1].map((p, k) => p * sum(pmf[0].slice(0, k)))),
      1 - sum(range(goal).map(k => poisson(a + b, k))),
      (1 - Math.exp(-a)) * (1 - Math.exp(-b)),
    ]
    return ranking(rng, 'A and B have not played each other. Model their goals as independent Poisson draws. Each rate is (goals scored in the table + 1) / 5.',
      table(['Team 1', 'Team 2', 'Goals 1', 'Goals 2'], data.map(([i, j, a, b]) => [letters[i], letters[j], a, b])),
      ix.map(i => labels[i]), values, ix.map(i => alt[i]), 'Compute each team’s rate from its four recorded games. Sum the products of the goal probabilities for the qualifying outcomes.',
      [v, data, v === 0 ? 0 : goal])
  }),
  family('ant-populations', 'Ant population growth and volatility', (rng, d, v) => {
    const drift = rng.int(1, 3), deviations = [1, 2 + d / 2, 4 + d], t = rng.int(3, 9)
    const history = deviations.map(sd => {
      const data = [rng.int(12, 30)]
      for (let i = 1; i <= 24; i++) data.push(rounded(data[i - 1] + drift + sd * normal(rng)))
      return data
    })
    const goal = rng.int(29, 96)
    const calc = (norm: (z: number) => number) => history.map((x, i) => {
      const mu = x.at(-1)! + drift * t, sd = deviations[i] * Math.sqrt(t)
      return v === 0 ? 1 - norm((goal - mu) / sd) : v === 1 ? norm((goal - mu) / sd) : 1 - norm(-drift * t / sd)
    })
    return ranking(rng, 'After day 24, each population index gets independent normal daily changes with mean ' + drift + ' and standard deviations ' +
      deviations.join(', ') + ' for A, B, C. Compare outcomes on day ' + (24 + t) + '.',
      plot('Day', 'Population index', history.map((row, i) => ({ label: letters[i], points: row.map((n, j) => [j, n] as [number, number]) }))),
      range(3).map(i => letters[i] + [' ends above ' + goal, ' ends below ' + goal, ' ends above its day 24 value'][v]),
      calc(cdf), calc(cdfIntegral), 'A sum of t independent daily changes adds their means and variances. Use each final mean and standard deviation to find the requested tail.',
      [v, history, drift, deviations, t, v === 2 ? 0 : goal], 0.035)
  }),
  family('insurance', 'MSE and MSLE claim predictors', (rng, d, v) => {
    const count = 24 + d
    const claims: [number, number][] = range(count).map(i => [i + 1, Math.max(0.1, rounded((i + 1) * 0.18 * Math.exp(normal(rng) * 0.35)))])
    const luxury: [number, number][] = range(5).map(() => [rng.int(14, count), rng.int(4, 19)])
    const data = [...claims, ...luxury]
    const tolerance = v === 0 ? rng.int(4, 30) / 10 : v === 1 ? rng.int(21, 83) / 10 : rng.int(5, 55) / 10
    const windows = [tolerance, rounded(tolerance * rng.pick([0.6, 0.8, 1.1, 1.3])), rounded(tolerance * rng.pick([0.65, 0.9, 1.2, 1.5]))]
    const sample = v === 0 ? claims : v === 1 ? luxury : data
    const predict = (fit: typeof leastSquares) => [fit(data), fit(data, true), () => mean(data.map(p => p[1]))]
    const score = (fit: typeof leastSquares) => predict(fit).map((f, i) => sample.filter(([x, y]) => Math.abs(f(x) - y) <= windows[i]).length / sample.length)
    return ranking(rng, 'Sample one ' + ['ordinary vehicle', 'luxury vehicle', 'vehicle'][v] + ' uniformly from the plot. Rank the chances that each predictor is within its stated margin of the recorded claim.',
      plot('Vehicle index', 'Claim ($k)', [{ label: 'Ordinary', points: claims, scatter: true }, { label: 'Luxury', points: luxury, scatter: true },
        ...predict(leastSquares).map((fit, i) => ({ label: ['MSE fit', 'MSLE fit', 'Mean baseline'][i], points: range(count).map(x => [x + 1, rounded(fit(x + 1))] as [number, number]) }))]),
      ['Squared-error fit', 'Squared log-error fit', 'Flat mean claim'].map((label, i) => label + ' is within $' + windows[i] + 'k'), score(leastSquares), score(independentLine),
      'The log fit minimizes squared error in log(1 + claim) before converting predictions back. Compare the absolute errors in original claim units for the requested group.',
      [v, claims, luxury, windows], 0.029)
  }),
  family('student-exams', 'Forecasts from five student exams', (rng, d, v) => {
    const data = range(10).map(() => {
      const level = rng.int(53, 87)
      return range(5).map(() => level + rng.int(-9 - d, 9 + d))
    })
    const students = rng.shuffle(range(10)).slice(0, 4), target = rng.int(61, 84)
    const labels = students.slice(0, 3).map(i => 'Student ' + (i + 1) + [' scores at least ' + target, ' outscores student ' + (students[3] + 1),
      ' scores within 5 of ' + target][v])
    const [values, checks] = split(students.slice(0, 3).map(i => {
      const sample = v === 1 ? data[i].flatMap(x => data[students[3]].map(y => [x, y])) : data[i].map(x => [x, 0])
      return empirical(sample, ([x, y]) => v === 0 ? x >= target : v === 1 ? x > y : Math.abs(x - target) <= 5)
    }))
    return ranking(rng, 'Model each sixth exam score as an independent uniform draw from that student’s five past scores. Rank these events.',
      table(['Student', ...range(5).map(i => 'Exam ' + (i + 1))], data.map((r, i) => [i + 1, ...r])),
      labels, values, checks, 'For one student count eligible scores out of five. For a comparison count strict wins out of the 25 pairs.',
      [v, data, students.slice(0, v === 1 ? 4 : 3), v === 1 ? 0 : target])
  }),
]
