import { binomial, binomialDistribution, choose, chooseByPascal, F, range, rational, sum } from './core.ts'
import type { Rational, Rng, Variant } from './core.ts'
import { choice, family } from './questions.ts'

function probabilities(p: Rational, mistaken: Rational[]) {
  return [...mistaken, F(1).sub(p), p.mul(p), p.div(2), p.mul(2), F(1).sub(p.mul(p))]
    .filter(x => x.compare(0) >= 0 && x.compare(1) <= 0)
}

function probability(rng: Rng, prompt: string, semantic: unknown, p: Rational, check: () => Rational, reasoning: string, wrong: Rational[] = []) {
  return choice(rng, {
    prompt, semantic, explanation: [reasoning, 'The resulting probability is ' + rational(p) + '.'],
  }, p, probabilities(p, wrong), check)
}

function ev(rng: Rng, prompt: string, semantic: unknown, value: Rational, check: () => Rational, reasoning: string, wrong: Rational[]) {
  return choice(rng, {
    prompt: prompt + ' Round to the nearest cent.', semantic, explanation: [reasoning, 'The result is ' + rational(value) + ' dollars.'],
  }, value, wrong, check, n => (n.compare(0) < 0 ? '−$' : '$') + n.abs().valueOf().toFixed(2))
}

function condition(target: number, v: Variant) {
  return ['at least ', 'at most ', 'exactly '][v] + target
}

function sequences(n: number, faces: number[], visit: (rolls: number[]) => void, rolls: number[] = []) {
  if (rolls.length === n) {
    visit(rolls)
    return
  }
  for (const face of faces) sequences(n, faces, visit, [...rolls, face])
}

function successPaths(n: number, p: Rational, hit: (history: number[]) => boolean) {
  let value = F(0)
  sequences(n, [0, 1], history => {
    if (hit(history)) {
      const count = sum(history)
      value = value.add(p.pow(count).mul(F(1).sub(p).pow(n - count)))
    }
  })
  return value
}

function walkWays(steps: number, stop: number, type: Variant, position = 0, hit = false): number {
  hit ||= position >= stop
  if (steps === 0) return Number(type === 0 ? position >= stop : type === 1 ? hit : position === stop)
  return walkWays(steps - 1, stop, type, position + 1, hit) + walkWays(steps - 1, stop, type, position - 1, hit)
}

function occupancy(draws: number, slots: number) {
  let counts = Array<bigint>(slots + 1).fill(0n)
  counts[0] = 1n
  for (let d = 0; d < draws; d++) {
    counts = counts.map((count, k) => count * BigInt(k) + (counts[k - 1] ?? 0n) * BigInt(slots - k + 1))
  }
  return counts
}

export const beat = [
  family('dice-outcomes', 'Different dice and joint outcomes', (rng, d, v) => {
    const a = rng.int(5, 13 + d), b = rng.int(5, 16 + d), x = rng.int(2, a - 1), y = rng.int(2, b - 1)
    const p = F(a - x + 1, a), q = F(b - y + 1, b)
    const values = [p.mul(q), p.add(q).sub(p.mul(q)), p.add(q).sub(p.mul(q).mul(2))]
    const predicates = [(i: boolean, j: boolean) => i && j, (i: boolean, j: boolean) => i || j, (i: boolean, j: boolean) => i !== j]
    return probability(rng, 'Roll fair dice with ' + a + ' and ' + b + ' faces numbered from 1. A roll qualifies at ' + x + ' on the first die or ' + y + ' on the second (inclusive). What is the probability that ' + ['both qualify', 'at least one qualifies', 'exactly one qualifies'][v] + '?',
      [v, a, b, x, y], values[v], () => F(sum(range(a).map(i => range(b).filter(j => predicates[v](i + 1 >= x, j + 1 >= y)).length)), a * b),
      'The two qualification probabilities are ' + rational(p) + ' and ' + rational(q) + '. Use independence and count the requested outcomes.', [...values, p, q])
  }),
  family('dice-statistics', 'Sums, maxima and minima', (rng, d, v) => {
    const a = rng.int(5, 15 + d), b = rng.int(5, 17 + d)
    const k = v === 0 ? rng.int(4, a + b - 3) : rng.int(2, Math.min(a, b) - 1)
    const favorable = v === 0
      ? sum(range(a).map(i => Math.max(0, b - Math.max(1, k - i - 1) + 1)))
      : v === 1 ? a * b - (k - 1) ** 2 : (a - k + 1) * (b - k + 1)
    return probability(rng, 'Two fair dice have ' + a + ' and ' + b + ' faces numbered from 1. What is the probability their ' + ['sum', 'maximum', 'minimum'][v] + ' is at least ' + k + '?',
      [v, a, b, k], F(favorable, a * b), () => {
        const combine = [(i: number, j: number) => i + j, Math.max, Math.min][v]
        return F(sum(range(a).map(i => range(b).filter(j => combine(i + 1, j + 1) >= k).length)), a * b)
      }, 'Count the ' + favorable + ' favorable ordered pairs out of ' + a * b + '.',
      [F((k - 1) ** 2, a * b), F(Math.min(k, a), a)])
  }),
  family('finite-sampling', 'Binomial and hypergeometric sampling', (rng, d, v) => {
    const red = rng.int(4, 18 + d), blue = rng.int(5, 22 + d), n = rng.int(3, Math.min(7, red)), k = rng.int(1, n - 1)
    const p = F(red, red + blue)
    const hyper = (j: number) => F(choose(red, j) * choose(blue, n - j), choose(red + blue, n))
    const value = v === 0 ? binomial(n, k, p) : v === 1 ? hyper(k) : range(n + 1).slice(k).reduce((total, j) => total.add(hyper(j)), F(0))
    const draw = (j: number, r: number, b: number, hits: number): Rational => {
      if (j === 0) return F(Number(v === 1 ? hits === k : hits >= k))
      return draw(j - 1, r - 1, b, hits + 1).mul(F(r, r + b)).add(draw(j - 1, r, b - 1, hits).mul(F(b, r + b)))
    }
    return probability(rng, 'A box has ' + red + ' red and ' + blue + ' blue tokens. Draw ' + n + ' ' + (v === 0 ? 'with' : 'without') + ' replacement. What is the chance of ' + (v === 2 ? 'at least ' : 'exactly ') + k + ' red?',
      [v, red, blue, n, k], value, () => v === 0 ? binomialDistribution(n, p)[k] : draw(n, red, blue, 0),
      v === 0 ? 'Sum the equally probable placements of the red draws.' : 'Choose the red and blue tokens from their respective groups and divide by all size-' + n + ' samples.',
      [hyper(k), binomial(n, k, p), p.pow(k)])
  }),
  family('bayes', 'Base rates and conditional evidence', (rng, d, v) => {
    const prior = rng.int(3, 40 + d), hit = rng.int(62, 98), falseHit = rng.int(3, 26 + d)
    const positive = v !== 1
    const a = positive ? hit : 100 - hit
    const b = positive ? falseHit : 100 - falseHit
    const multiplier = v === 2 ? 2 : 1
    const real = F(prior, 100).mul(F(a, 100).pow(multiplier))
    const other = F(100 - prior, 100).mul(F(b, 100).pow(multiplier))
    return probability(rng, 'A condition affects ' + prior + '% of people. A test is positive in ' + hit + '% of affected people and ' + falseHit + '% of unaffected people. Given ' + ['one positive result', 'one negative result', 'two positive results, independent conditional on status'][v] + ', what is the probability the person has the condition?',
      [v, prior, hit, falseHit], real.div(real.add(other)), () => {
        const trueCount = prior * a ** multiplier
        return F(trueCount, trueCount + (100 - prior) * b ** multiplier)
      }, 'Bayes’ rule weights each likelihood by its population base rate, then normalizes over both groups.', [F(a, 100), F(prior, 100), real])
  }),
  family('cards', 'Deck sampling and reveals', (rng, d, v) => {
    const ranks = rng.int(7, 14 + d), suits = rng.int(3, 6), targets = rng.int(1, ranks - 2), deck = ranks * suits, good = targets * suits
    const k = rng.int(2, Math.min(5, good))
    const remaining = v === 2 ? good - 1 : good
    const total = v === 2 ? deck - 1 : deck
    const value = v === 0 ? F(good, deck).pow(k) : F(choose(remaining, k), choose(total, k))
    return probability(rng, 'A deck has ' + ranks + ' ranks and ' + suits + ' suits. ' + targets + ' ranks count as targets. ' +
      ['After each draw, return the card to the deck. ', 'Draw without replacement. ', 'One target card has already been revealed and removed. Draw without replacement. '][v] +
      'What is the chance that the next ' + k + ' cards are all targets?',
      [v, ranks, suits, targets, k], value,
      () => range(k).reduce((p, i) => p.mul(F(remaining - (v === 0 ? 0 : i), total - (v === 0 ? 0 : i))), F(1)),
      'Use the target share of the remaining deck at each draw, accounting for whether the card returns.',
      [F(good, deck), F(good, deck).pow(k), F(choose(good, k), choose(deck, k))])
  }),
  family('coins', 'Biased flips and stopping', (rng, d, v) => {
    const p = F(rng.int(20, 80), 100), n = rng.int(4, 7 + Math.min(d, 2)), k = rng.int(2, n - 1)
    const q = F(1).sub(p)
    const value = v === 0 ? binomial(n, k, p) : v === 1 ? q.pow(k - 1).mul(p) : range(k).reduce((total, i) => total.add(binomial(n, i, p)), F(0))
    return probability(rng, 'A coin shows heads with probability ' + rational(p) + '. Flips are independent. What is the chance of ' +
      ['exactly ' + k + ' heads in ' + n + ' flips', 'the first head appearing on flip ' + k, 'fewer than ' + k + ' heads in ' + n + ' flips'][v] + '?',
      [v, rational(p), v === 1 ? k : n, k], value, () => successPaths(v === 1 ? k : n, p,
        flips => v === 0 ? sum(flips) === k : v === 1 ? flips[k - 1] === 1 && sum(flips) === 1 : sum(flips) < k),
      'Multiply the probabilities along each eligible flip sequence and add their disjoint contributions.', [p.pow(k), q.pow(k), binomial(n, k, p)])
  }),
  family('urn', 'Multiple colors without replacement', (rng, d, v) => {
    const [r, b, g] = range(3).map(() => rng.int(3, 13 + d))
    const n = r + b + g
    const favorable = [r * b * g, Number(choose(r, 2)) * (b + g), sum([r, b, g].map(k => Number(choose(k, 3))))][v]
    return probability(rng, 'An urn contains ' + r + ' red, ' + b + ' blue and ' + g + ' green balls. Draw three without replacement. What is the chance of ' +
      ['one of each color', 'exactly two red balls', 'three of the same color'][v] + '?',
      [v, r, b, g], F(favorable, choose(n, 3)), () => {
        const colors = [...Array(r).fill(0), ...Array(b).fill(1), ...Array(g).fill(2)] as number[]
        let count = 0
        for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) for (let k = j + 1; k < n; k++) {
          const set = [colors[i], colors[j], colors[k]]
          count += Number(v === 0 ? new Set(set).size === 3 : v === 1 ? set.filter(x => x === 0).length === 2 : new Set(set).size === 1)
        }
        return F(count, Number(chooseByPascal(n, 3)))
      }, 'There are ' + favorable + ' favorable unordered triples. Divide by the total number of three-ball samples.',
      [F(r * b * g, n ** 3), F(r, n).pow(2), F(r, n).pow(3)])
  }),
  family('lotteries', 'Lottery value and entry costs', (rng, d, v) => {
    const weights = [rng.int(2, 19), rng.int(3, 24), rng.int(15, 48)]
    const prizes = [rng.int(25, 80 + 10 * d), rng.int(3, 24), 0]
    const fee = v === 0 ? 0 : rng.int(2, 18 + d)
    const rebate = v === 2 ? rng.int(1, 9) : 0
    const total = sum(weights)
    const gross = F(sum(prizes.map((prize, i) => weights[i] * prize)), total)
    const value = gross.sub(fee).add(F(weights[2] * rebate, total))
    return ev(rng, 'A fair draw has ' + weights[0] + ' tickets paying $' + prizes[0] + ', ' + weights[1] + ' paying $' + prizes[1] + ', and ' + weights[2] + ' paying $0. ' +
      (fee ? 'It costs $' + fee + ' to play. ' : 'Entry is free. ') + (rebate ? 'A $0 ticket refunds $' + rebate + ' of the entry cost, even if that refund exceeds the cost. ' : '') + 'What is your expected net payout?',
      [v, weights, prizes, fee, rebate], value, () => {
        const cash = prizes.flatMap((p, i) => range(weights[i]).map(() => p - fee + (i === 2 ? rebate : 0)))
        return F(sum(cash), cash.length)
      }, 'Weight each net payout by its ticket share. The entry fee applies to every ticket.',
      [gross, F(sum(prizes), 3), F(prizes[0] * weights[0], total).sub(fee), gross.sub(fee).add(rebate), gross.sub(fee * 2), F(prizes[1] - fee)])
  }),
  family('conditional-value', 'Value after a partial reveal', (rng, d, v) => {
    const a = rng.int(7, 24), b = rng.int(4, 22), payout = rng.int(15, 55 + d * 6)
    const second = rng.int(1, 14), fee = rng.int(1, 11)
    const n = a + b - Number(v !== 2), aa = a - Number(v === 0), bb = b - Number(v === 1)
    const value = F(aa, n).mul(payout).add(F(bb, n).mul(second)).sub(fee)
    return ev(rng, 'A bag has ' + a + ' high tickets paying $' + payout + ' and ' + b + ' low tickets paying $' + second + '. ' +
      ['One high ticket was shown and removed. ', 'One low ticket was shown and removed. ', 'One low ticket was shown and returned. '][v] +
      'The next draw costs $' + fee + '. What is its expected net value?',
      [v, a, b, payout, second, fee], value, () => F(aa * (payout - fee) + bb * (second - fee), n),
      'Condition on the updated bag, then average the net payouts.',
      [F(a * payout + b * second, a + b).sub(fee), F(payout + second, 2).sub(fee), F(aa * payout, n).sub(fee), value.add(fee), F(bb * payout + aa * second, n).sub(fee)])
  }),
  family('latent-factor', 'Dependence from a common state', (rng, d, v) => {
    const w = rng.int(16, 75), a = rng.int(17, 55), b = rng.int(56, 91 + Math.min(d, 4))
    const term = (p: Rational) => v === 0 ? p.pow(2) : v === 1 ? p.mul(F(1).sub(p)).mul(2) : F(1).sub(F(1).sub(p).pow(2))
    const p = F(w, 100).mul(term(F(a, 100))).add(F(100 - w, 100).mul(term(F(b, 100))))
    const marginal = F(w * a + (100 - w) * b, 10_000)
    return probability(rng, 'Weather is calm with probability ' + w + '%. Two shipments arrive on time independently conditional on weather, each with probability ' + a + '% in calm weather and ' + b + '% otherwise. What is the chance ' +
      ['both are on time', 'exactly one is on time', 'at least one is on time'][v] + '?',
      [v, w, a, b], p, () => {
        const chooseEvent = (s: number[]) => v === 0 ? sum(s) === 2 : v === 1 ? sum(s) === 1 : sum(s) >= 1
        return successPaths(2, F(a, 100), chooseEvent).mul(F(w, 100)).add(successPaths(2, F(b, 100), chooseEvent).mul(F(100 - w, 100)))
      }, 'Evaluate the joint event separately in each weather state. Only then average across states.', [term(marginal), marginal, term(F(a, 100))])
  }),
  family('geometric', 'First success and waiting windows', (rng, d, v) => {
    const p = F(rng.int(10, 74), 100), lo = rng.int(2, 5), hi = lo + rng.int(1, 4 + d)
    const q = F(1).sub(p)
    const value = v === 0 ? q.pow(hi) : v === 1 ? F(1).sub(q.pow(hi)) : q.pow(lo - 1).sub(q.pow(hi))
    return probability(rng, 'Independent attempts each succeed with probability ' + rational(p) + '. What is the probability the first success occurs ' +
      ['after attempt ' + hi, 'by attempt ' + hi, 'from attempt ' + lo + ' through attempt ' + hi + ', inclusive'][v] + '?',
      [v, rational(p), v === 2 ? lo : 1, hi], value, () => v === 0
        ? range(hi).reduce(t => t.mul(q), F(1))
        : range(hi).slice(v === 1 ? 0 : lo - 1).reduce((t, i) => t.add(q.pow(i).mul(p)), F(0)),
      'A first success on attempt n requires n−1 failures followed by one success.', [q.pow(hi - 1), p.mul(hi), q.pow(lo)])
  }),
  family('redraw', 'Optimal keep-or-redraw decisions', (rng, d, v) => {
    const sides = rng.int(8, 24 + d * 2), step = rng.int(3, 16), offset = rng.int(1, 17)
    const cost = v === 0 ? 0 : rng.int(1, sides * step / 4 | 0)
    const rolls = range(sides).map(i => offset + (i + 1) * step)
    const mean = F(rolls[0] + rolls.at(-1)!, 2)
    const draws = v === 2 ? 2 : 1
    let value = mean
    for (let i = 0; i < draws; i++) {
      const continuation = value.sub(cost)
      value = rolls.reduce((t, roll) => t.add(F(roll).compare(continuation) >= 0 ? F(roll) : continuation), F(0)).div(sides)
    }
    return ev(rng, 'A fair ' + sides + '-sided die pays $' + offset + ' plus $' + step + ' times the face value. Your first roll is free. You may discard and replace it up to ' + draws +
      ' time' + (draws === 1 ? '' : 's') + ', paying $' + cost + ' per reroll. What expected net payout can optimal decisions achieve?',
      [v, sides, step, offset, cost], value, () => {
        const recurse = (left: number): Rational => left === 0 ? F(sum(rolls), sides) : rolls.reduce((t, r) => {
          const reject = recurse(left - 1).sub(cost)
          return t.add(reject.compare(r) > 0 ? reject : F(r))
        }, F(0)).div(sides)
        return recurse(draws)
      }, 'Work backward. After each roll, compare keeping its payout with the expected value of a reroll minus its fee.',
      [mean, mean.sub(cost), F(rolls.at(-1)!), F(rolls[0]), value.add(F(step, 2)), mean.add(step)])
  }),
  family('random-walk', 'Random-walk endpoints and crossings', (rng, d, v) => {
    const n = rng.int(5, 10 + d), target = rng.int(1, n - 2)
    const right = rng.int(32, 68)
    const p = F(right, 100)
    if (v === 2 && (target + n) % 2 !== 0) return null
    const dp = new Map<number, Rational>([[0, F(1)]])
    let states = dp
    for (let i = 0; i < n; i++) {
      const next = new Map<number, Rational>()
      for (const [x, w] of states) {
        const moves: [number, Rational][] = v === 1 && x === target ? [[x, F(1)]] : [[x + 1, p], [x - 1, F(1).sub(p)]]
        for (const [y, z] of moves) next.set(y, (next.get(y) ?? F(0)).add(w.mul(z)))
      }
      states = next
    }
    const value = [...states].reduce((t, [x, w]) => v === 0 ? (x >= target ? t.add(w) : t) : (x === target ? t.add(w) : t), F(0))
    return probability(rng, 'A walker starts at 0, moving right one step with probability ' + right + '% and left otherwise. Steps are independent. In ' + n + ' steps, what is the chance it ' +
      ['ends at or above ', 'ever reaches ', 'ends at '][v] + target + '?',
      [v, n, target, right], value, () => {
        if (right === 50) return F(walkWays(n, target, v), 2 ** n)
        return range(n + 1).reduce((t, k) => {
          const ways = (v === 0 ? (2 * k - n >= target ? choose(n, k) : 0n) : v === 2 ? (2 * k - n === target ? choose(n, k) : 0n) :
            (2 * k - n >= target ? choose(n, k) : choose(n, k - target)))
          return t.add(F(ways).mul(p.pow(k)).mul(F(1).sub(p).pow(n - k)))
        }, F(0))
      }, 'Propagate the probability at each position step by step. For a crossing event, retain all paths once they reach the boundary.',
      [p.pow(target), p, F(target, n)])
  }),
  family('markov', 'Markov transitions', (rng, d, v) => {
    const a = rng.int(12, 77), b = rng.int(13, 79), steps = rng.int(2, 5 + d)
    const start = v === 1 ? 1 : 0, end = v === 2 ? 1 : 0
    const nextA = [F(a, 100), F(b, 100)]
    let value = F(Number(start === 0))
    for (let t = 0; t < steps; t++) value = value.mul(nextA[0]).add(F(1).sub(value).mul(nextA[1]))
    if (end === 1) value = F(1).sub(value)
    return probability(rng, 'Each step, A goes to A with probability ' + a + '%, and B goes to A with probability ' + b + '%. Otherwise it goes to B. Starting in ' + ['A', 'B'][start] +
      ', what is the chance of being in ' + ['A', 'B'][end] + ' after ' + steps + ' steps?',
      [v, a, b, steps], value, () => {
        const enumerate = (i: number, state: number): Rational => i === 0 ? F(Number(state === end)) :
          nextA[state].mul(enumerate(i - 1, 0)).add(F(1).sub(nextA[state]).mul(enumerate(i - 1, 1)))
        return enumerate(steps, start)
      }, 'Update each destination by summing the previous state probabilities weighted by their transition probabilities.', [nextA[0], nextA[1], nextA[0].pow(steps)])
  }),
  family('arrangements', 'Constrained arrangements', (rng, d, v) => {
    const n = rng.int(6, 34 + 8 * d), k = rng.int(2, n - 2)
    const gap = rng.int(1, n - 2)
    const near = F(gap * (2 * n - gap - 1), n * (n - 1))
    const value = [near, F(1).sub(near), F(k * (k - 1), n * (n - 1))][v]
    return probability(rng, 'Uniformly shuffle ' + n + ' distinct cards, including A and B. What is the probability ' +
      ['A and B are at most ' + gap + ' positions apart', 'A and B are more than ' + gap + ' positions apart', 'A and B are both in the first ' + k + ' positions'][v] + '?',
      [v, n, v === 2 ? k : gap], value, () => {
        const count = sum(range(n).map(i => range(n).filter(j => i !== j && (v === 0 ? Math.abs(i - j) <= gap : v === 1 ? Math.abs(i - j) > gap : i < k && j < k)).length))
        return F(count, n * (n - 1))
      }, 'A and B occupy a uniformly selected ordered pair of distinct positions. Count only pairs satisfying the constraint.',
      [F(1, n), F(k, n).pow(2), F(1, n - 1), F(k, n)])
  }),
  family('occupancy', 'Coupon collection and occupancy', (rng, d, v) => {
    const m = rng.int(4, 12 + d), n = rng.int(5, 15 + d), target = v === 0 ? Math.min(m, n) : rng.int(2, Math.min(m, n) - 1)
    const states = occupancy(n, m)
    const indices = v === 2 ? range(target + 1) : [target]
    const total = BigInt(m) ** BigInt(n)
    const value = F(indices.reduce((t, i) => t + states[i], 0n), total)
    return probability(rng, 'Each of ' + n + ' draws independently yields one of ' + m + ' equally likely coupon types. What is the chance of seeing ' +
      (v === 2 ? 'at most ' : 'exactly ') + target + ' distinct types?',
      [v, m, n, target], value, () => F(indices.reduce((t, k) => {
        const onto = range(k + 1).reduce((s, j) => s + (j % 2 ? -1n : 1n) * choose(k, j) * BigInt(k - j) ** BigInt(n), 0n)
        return t + choose(m, k) * onto
      }, 0n), total), 'Track how many types have appeared. A draw either repeats one of the seen types or adds one unseen type.',
      [F(target, m).pow(n), F(choose(m, target), total), F(1, m).pow(n - 1)])
  }),
  family('odds', 'Odds, payouts and breakeven prices', (rng, d, v) => {
    const win = rng.int(5, 55 + d), lose = rng.int(6, 64), stake = rng.int(2, 39)
    if (v === 0) return probability(rng, 'A bet wins $' + win + ' net on success and loses $' + lose + ' otherwise. At what success probability does it break even?',
      [v, win, lose], F(lose, win + lose), () => F(lose).div(F(win).add(lose)),
      'Set p times the gain equal to (1−p) times the loss.', [F(win, win + lose), F(1, lose), F(stake, win + lose)])
    if (v === 1) return probability(rng, 'Odds in favor are ' + win + ' to ' + lose + '. What is the implied probability of success?',
      [v, rational(F(win, lose))], F(win, win + lose), () => F(1).div(F(1).add(F(lose, win))),
      'Odds in favor compare successes to failures. Probability compares successes to all outcomes.', [F(lose, win + lose), F(1, lose), F(1, win)])
    return ev(rng, 'A winning $' + stake + ' stake returns the stake plus net winnings at ' + win + ':' + lose + ' payout odds. What is the total return if it wins?',
      [v, rational(F(win, lose)), stake], F(stake * (win + lose), lose), () => F(stake).add(F(stake).mul(F(win, lose))),
      'Multiply the stake by the net payout ratio, then add the returned stake.', [F(stake * win, lose), F(stake), F(stake * lose, win), F(stake * (win + lose), win)])
  }),
  family('quotes', 'Fair value and actionable offers', (rng, d, v) => {
    const count = rng.int(11, 39), wins = rng.int(2, count - 2), cash = rng.int(18, 75 + 5 * d)
    const fee = v === 0 ? 0 : rng.int(1, 14), low = v === 2 ? rng.int(1, 17) : 0
    const value = F(cash * wins + low * (count - wins), count).sub(fee)
    return ev(rng, 'A claim pays $' + cash + ' on ' + wins + ' of ' + count + ' equally likely outcomes and $' + low + ' otherwise. ' +
      (fee ? 'Buying the claim also costs a fixed $' + fee + ' fee. ' : '') + 'At what quoted price, excluding the fee, is the expected profit exactly zero?',
      [v, count, wins, cash, fee, low], value, () => {
        const outcomes = range(count).map(i => (i < wins ? cash : low) - fee)
        return F(sum(outcomes), count)
      }, 'The breakeven quoted price is the expected payout minus any separate fee.',
      [F(cash), F(cash * wins, count), F(cash + low, 2), value.add(fee), F(cash * (count - wins) + low * wins, count).sub(fee), F(low - fee)])
  }),
  family('multinomial', 'Multinomial category counts', (rng, d, v) => {
    const w = [rng.int(2, 14), rng.int(3, 19), rng.int(3, 21)]
    const n = rng.int(4, 6 + Math.min(d, 2)), a = rng.int(1, n - 2), b = rng.int(1, n - a - 1), c = n - a - b
    const total = sum(w)
    const hit = (counts: number[]) => v === 0 ? counts[0] === a && counts[1] === b : v === 1 ? counts[0] === a && counts[1] >= b : counts[0] === a && counts[1] <= b
    const value = range(n - a + 1).reduce((acc, j) => {
      if (!hit([a, j, n - a - j])) return acc
      return acc.add(F(choose(n, a) * choose(n - a, j)).mul(F(w[0], total).pow(a)).mul(F(w[1], total).pow(j)).mul(F(w[2], total).pow(n - a - j)))
    }, F(0))
    return probability(rng, 'A spinner has A, B, C sectors with relative weights ' + w.join(':') + '. After ' + n + ' independent spins, what is the chance of exactly ' + a + ' A and ' + condition(b, [2, 0, 1][v] as Variant) + ' B?',
      [v, w.map(x => rational(F(x, total))), n, a, b], value, () => {
        let tally = 0
        sequences(n, [0, 1, 2], spins => {
          const counts = range(3).map(i => spins.filter(s => s === i).length)
          if (hit(counts)) tally += spins.reduce((p, s) => p * w[s], 1)
        })
        return F(tally, total ** n)
      }, 'Sum the weighted multinomial probabilities of all count triples satisfying the event.',
      [F(w[0], total).pow(a).mul(F(w[1], total).pow(b)).mul(F(w[2], total).pow(c)), binomial(n, a, F(w[0], total))])
  }),
  family('competing-events', 'Competing events across deadlines', (rng, d, v) => {
    const a = rng.int(13, 65), b = rng.int(19, 75), steps = rng.int(2, 4 + d)
    const p = F(a, 100), q = F(b, 100), neither = F(1).sub(p).mul(F(1).sub(q))
    const event = [p.mul(F(1).sub(q)), F(1).sub(p).mul(q), p.mul(q)][v]
    const value = event.mul(F(1).sub(neither.pow(steps))).div(F(1).sub(neither))
    return probability(rng, 'Each minute, alert A fires with probability ' + a + '% and B with probability ' + b + '%, independently across alerts and minutes. Stop at the first minute with an alert or after ' + steps + ' minutes. What is the probability that ' +
      ['only A fires', 'only B fires', 'both fire together'][v] + ' in the stopping minute?',
      [v, a, b, steps], value, () => range(steps).reduce(acc => event.add(neither.mul(acc)), F(0)),
      'Before the stopping minute neither alert can fire. Sum the geometric series over all possible stopping minutes.',
      [event, p, q, F(1).sub(neither.pow(steps))])
  }),
]
