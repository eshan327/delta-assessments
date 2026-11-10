import { F, rational } from './core.ts'
import type { Difficulty, Rational, Rng, Variant } from './core.ts'
import { choice, family } from './questions.ts'

type Calculation = {
  text: string
  answer: Rational
  check: () => Rational
  explain: string
  wrong: Rational[]
}

type Template = (a: number, b: number, c: number, d: number, v: Variant) => Calculation

function math(text: string, answer: Rational | number, check: () => Rational | number, explain: string, wrong: (Rational | number)[]): Calculation {
  return { text, answer: F(answer), check: () => F(check()), explain, wrong: wrong.map(n => F(n)) }
}

const templates: [string, string, Template][] = [
  ['addition', 'Signed sums', (a, b, c, _, v) => {
    const sign = v === 0 ? 1 : -1, k = v === 2 ? -c : c
    return math(a + ' + (' + sign * b + ') + (' + k + ')', a + sign * b + k, () => sign * b + (a + k),
      'Group the positive and negative terms before adding.', [a + b + c, a - b + c, a + b - c, a - b - c, a + sign * b])
  }],
  ['subtraction', 'Differences and parentheses', (a, b, c, _, v) => {
    const sign = v === 0 ? 1 : -1, z = v === 2 ? -a : a
    return math(z + ' − (' + b + (sign === 1 ? ' + ' : ' − ') + c + ')', z - (b + sign * c), () => z - b - sign * c,
      'Subtracting the bracket reverses both signs inside it.', [z - b + sign * c, z + b + sign * c, z + b - sign * c, z - b])
  }],
  ['products', 'Signed products', (a, b, c, _, v) => {
    const x = v === 0 ? a : -a, y = v === 2 ? -b : b
    return math('(' + x + ') × (' + y + ') × ' + c, x * y * c, () => x * (y * c),
      'Multiply the magnitudes and then apply the product’s sign.', [-x * y * c, x * y, x * c, y * c, x * y + c])
  }],
  ['division', 'Exact quotients', (a, b, c, _, v) => {
    const x = v === 0 ? a : -a, y = v === 2 ? -b : b
    return math('(' + x * y * c + ') ÷ (' + y * c + ')', F(x * y * c, y * c), () => x,
      'Cancel the common factors in the dividend and divisor.', [-x, x * c, x * y, F(x, c), y])
  }],
  ['distribute', 'Distributive property', (a, b, c, _, v) => {
    const x = v === 0 ? a : -a, y = v === 2 ? -c : c
    return math('(' + x + ') × (' + b + ' + (' + y + '))', x * (b + y), () => x * b + x * y,
      'Multiply both terms inside the bracket.', [x * b + y, x * b - x * y, -x * (b + y), x * b, x + b + y])
  }],
  ['precedence', 'Order of operations', (a, b, c, d, v) => {
    const x = v === 0 ? a : -a, k = v === 2 ? -d : d
    return math(x + ' + ' + b + ' × ' + c + ' − (' + k + ')', x + b * c - k, () => x - k + b * c,
      'Do the multiplication first, then combine the signed terms.', [(x + b) * c - k, x + b * (c - k), x + b * c + k, b * c - k, x + b + c - k])
  }],
  ['frac-sum', 'Fraction sums and differences', (a, b, c, d, v) => {
    const x = v === 0 ? a : -a, y = v === 2 ? -c : c
    return math(rational(F(x, b)) + ' + (' + rational(F(y, d)) + ')', F(x, b).add(F(y, d)), () => F(x * d + y * b, b * d),
      'Convert to a common denominator, then add the numerators.', [F(x + y, b + d), F(x + y, b * d), F(x * d - y * b, b * d), F(x, b), F(y, d)])
  }],
  ['frac-product', 'Fraction products and quotients', (a, b, c, d, v) => {
    const x = v === 2 ? -a : a, division = v !== 0
    return math('(' + rational(F(x, b)) + ') ' + (division ? '÷' : '×') + ' ' + rational(F(c, d)),
      division ? F(x, b).div(F(c, d)) : F(x, b).mul(F(c, d)), () => division ? F(x * d, b * c) : F(x * c, b * d),
      division ? 'Multiply by the reciprocal of the divisor.' : 'Multiply numerators and denominators separately.',
      [F(x * c, b * d), F(x * d, b * c), F(x + c, b + d), F(x, b), F(c, d), F(-x * d, b * c)])
  }],
  ['decimal-sum', 'Decimal place values', (a, b, c, _, v) => {
    const x = v === 0 ? a : -a, k = v === 2 ? 1000 : 100
    return math(x / 10 + ' + ' + b / k + ' − ' + c / 100, F(x, 10).add(F(b, k)).sub(F(c, 100)), () => F(x * k / 10 + b - c * k / 100, k),
      'Align the decimal points or work in a common integer unit.',
      [F(x, 10).add(F(b + c, k)), F(x + b - c, 100), F(x + b - c, 10), F(x, 10), F(x, 10).add(F(b, k))])
  }],
  ['decimal-product', 'Scaling decimals', (a, b, c, _, v) => {
    const k = 10 ** (v + 1), x = v === 2 ? -a : a
    return math('(' + x / k + ') × ' + (b * c / 10), F(x, k).mul(F(b * c, 10)), () => F(x * b * c, k * 10),
      'Multiply the integers, then divide by the combined place-value scale.',
      [F(x * b * c, k), F(x * b * c, k * 100), F(x + b * c, k), F(-x * b * c, k * 10), F(x * b, k)])
  }],
  ['percent-of', 'Percent of a quantity', (a, b, c, _, v) => {
    const p = a + c + (v === 1 ? 50 : v === 2 ? 100 : 0), total = b * c
    return math(p + '% of ' + total, F(p * total, 100), () => F(total).mul(F(p, 100)),
      'Percent means per hundred.', [F(total, p), F(p * total, 10), F((100 - p) * total, 100), F(p, 100), F(total + p)])
  }],
  ['percent-change', 'Percent changes', (a, b, c, _, v) => {
    const p = a + b, total = b * c
    const sign = v === 1 ? -1 : 1
    const answer = v === 2 ? F(total * (100 + p) * (100 - p), 10_000) : F(total * (100 + sign * p), 100)
    return math(v === 2 ? total + ' increased by ' + p + '%, then decreased by ' + p + '%' : total + (sign > 0 ? ' increased by ' : ' decreased by ') + p + '%',
      answer, () => v === 2 ? F(total).sub(F(total * p * p, 10_000)) : F(total).add(F(total * sign * p, 100)),
      'Apply each percent change to the current amount.', [F(total), F(total * (100 - sign * p), 100), F(total + sign * p), F(total * p, 100), F(total * (100 + p), 100)])
  }],
  ['reverse-percent', 'Original value from a percentage', (a, b, c, _, v) => {
    const rate = v === 0 ? a + 5 : v === 1 ? 100 + a : 100 - a
    const total = b * c, observed = F(total * rate, 100)
    return math(rational(observed) + ' is ' + rate + '% of what number?', observed.div(F(rate, 100)), () => total,
      'Divide the observed value by the stated percent expressed as a fraction.', [observed, observed.mul(F(rate, 100)), F(total + rate), F(total - rate), F(total, 100)])
  }],
  ['missing-factor', 'Missing factors', (a, b, c, _, v) => {
    const x = v === 0 ? c : -c, k = v === 2 ? -a : a
    return math(k + ' × x + ' + b + ' = ' + (k * x + b), F(k * x + b - b, k), () => x,
      'Subtract the constant from both sides, then divide by the coefficient.', [-x, k * x, x + b, F(x, k), x - b])
  }],
  ['linear-equations', 'Two-sided linear equations', (a, b, c, d, v) => {
    const x = v === 0 ? d : -d, k = v === 2 ? -a : a, m = k + b
    const y = x * (k - m) + c
    return math(k + 'x + ' + c + ' = ' + m + 'x + (' + y + ')', F(y - c, k - m), () => x,
      'Move the variable terms to one side and the constants to the other.', [-x, x + b, F(y + c, k - m), F(y - c, k + m || 1), x * b])
  }],
  ['difference-squares', 'Difference of squares', (a, b, c, _, v) => {
    const x = a + b + c, delta = v === 0 ? 1 : v === 1 ? b : -b
    return math(x + '² − ' + (x + delta) + '²', x ** 2 - (x + delta) ** 2, () => -delta * (2 * x + delta),
      'Use (u−v)(u+v) instead of squaring both values.', [delta * (2 * x + delta), delta ** 2, -delta * x, 2 * x + delta, -delta])
  }],
  ['square-root', 'Exact roots', (a, b, c, _, v) => {
    const x = a + b + c
    const n = v === 1 ? 3 : 2
    return math((n === 3 ? '∛' : '√') + (x ** n) + (v === 2 ? ' − ' + b : ''), x - (v === 2 ? b : 0), () => Math.round((x ** n) ** (1 / n)) - (v === 2 ? b : 0),
      'Identify the positive integer whose power is the number under the root.', [x, x + b, x - a, x - c, x * n, -x])
  }],
  ['rates', 'Rates and proportionality', (a, b, c, d, v) => {
    const total = a * b + c, minutes = b + d
    return math(total + ' units in ' + minutes + ' minutes at a constant rate. ' +
      ['How many units in ' + d + ' minutes?', 'How many minutes for ' + c + ' units?', 'How many units per hour?'][v],
    [F(total * d, minutes), F(c * minutes, total), F(total * 60, minutes)][v],
    () => { const rate = F(total, minutes); return [rate.mul(d), F(c).div(rate), rate.mul(60)][v] },
    'Compute units per minute, then convert the requested time or quantity.',
    [F(total, minutes), F(total, d), F(minutes * d, total), F(total * minutes, d), F(total * 60, minutes), F(c)])
  }],
  ['averages', 'Averages and missing values', (a, b, c, d, v) => {
    const x = v === 0 ? a : -a, fourth = v === 2 ? d : 0, n = v === 2 ? 4 : 3
    return math('Mean of ' + [x, b, c, ...(v === 2 ? [d] : [])].join(', '), F(x + b + c + fourth, n), () => F(x, n).add(F(b, n)).add(F(c + fourth, n)),
      'Add the values with their signs, then divide by the number of values.',
      [F(x + b + c + fourth, n - 1), F(a + b + c + fourth, n), F(x + b + c, n), F(x + b + c + fourth, n + 1), F(b)])
  }],
  ['remainders', 'Remainders and quotients', (a, b, c, d, v) => {
    const divisor = b + d, value = a * c + b, remainder = value % divisor, quotient = Math.floor(value / divisor)
    return math(['Find the remainder of ' + value + ' divided by ' + divisor, 'Find the integer quotient of ' + value + ' divided by ' + divisor,
      'What smallest positive integer must be added to ' + value + ' to make it a multiple of ' + divisor + '?'][v],
    [remainder, quotient, divisor - remainder][v],
    () => { const left = value - quotient * divisor; return [left, (value - left) / divisor, divisor - left][v] },
    'Write the number as a multiple of the divisor plus a remainder from zero to one less than the divisor.',
    [remainder, quotient, divisor - remainder, divisor, a, c, value - divisor])
  }],
]

const values = (rng: Rng, difficulty: Difficulty) => rng.int(2, 23 + 8 * difficulty)

export const classic = templates.map(([id, label, solve]) => family(id, label, (rng, d, v) => {
  const q = solve(values(rng, d), values(rng, d), values(rng, d), values(rng, d), v)
  return choice(rng, {
    prompt: q.text,
    semantic: q.text.replace(/\s/g, ''),
    explanation: [q.explain, 'The answer is ' + rational(q.answer) + '.'],
  }, q.answer, [...q.wrong, q.answer.neg(), q.answer.add(1), q.answer.sub(1)], q.check)
}))
