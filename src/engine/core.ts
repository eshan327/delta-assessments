import Fraction from 'fraction.js'

export type Difficulty = 1 | 2 | 3 | 4 | 5
export type Variant = 0 | 1 | 2
export const VERSION = 1
export const difficulties: readonly Difficulty[] = [1, 2, 3, 4, 5]
export const variants: readonly Variant[] = [0, 1, 2]

function seedWords(seed: string) {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return Array.from({ length: 4 }, () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    return (h ^= h >>> 16) >>> 0
  })
}

export class Rng {
  private state: number[]

  constructor(seed: string) {
    this.state = seedWords(seed)
  }

  next() {
    const s = this.state
    const x = Math.imul(s[1], 5)
    const value = Math.imul((x << 7) | (x >>> 25), 9) >>> 0
    const t = s[1] << 9
    s[2] ^= s[0]
    s[3] ^= s[1]
    s[1] ^= s[2]
    s[0] ^= s[3]
    s[2] ^= t
    s[3] = (s[3] << 11) | (s[3] >>> 21)
    return value / 4294967296
  }

  int(min: number, max: number) {
    return min + Math.floor(this.next() * (max - min + 1))
  }

  pick<T>(values: readonly T[]): T {
    return values[this.int(0, values.length - 1)]
  }

  shuffle<T>(values: readonly T[]) {
    const result = [...values]
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.int(0, i)
      ;[result[i], result[j]] = [result[j], result[i]]
    }
    return result
  }
}

export function newSeed() {
  return [...crypto.getRandomValues(new Uint8Array(12))].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

export function range(length: number) {
  return Array.from({ length }, (_, index) => index)
}

export const sum = (values: readonly number[]) => values.reduce((total, n) => total + n, 0)
export const F = (n: number | string | bigint | Fraction, d?: number | bigint) =>
  d === undefined ? new Fraction(n) : new Fraction(n as number | bigint, d)
export type Rational = Fraction
export const rational = (n: Rational) => n.toFraction()
export const mean = (values: readonly number[]) => sum(values) / values.length

export function choose(n: number, k: number): bigint {
  if (k < 0 || k > n) return 0n
  let result = 1n
  for (let i = 1; i <= k; i++) result = result * BigInt(n - i + 1) / BigInt(i)
  return result
}

export function chooseByPascal(n: number, k: number): bigint {
  if (k < 0 || k > n) return 0n
  const row = Array<bigint>(k + 1).fill(0n)
  row[0] = 1n
  for (let i = 1; i <= n; i++) {
    for (let j = Math.min(i, k); j > 0; j--) row[j] += row[j - 1]
  }
  return row[k]
}

export function binomial(n: number, hits: number, p: Rational) {
  return F(choose(n, hits)).mul(p.pow(hits)).mul(F(1).sub(p).pow(n - hits))
}

export function binomialDistribution(n: number, p: Rational) {
  let row = [F(1)]
  const q = F(1).sub(p)
  for (let i = 0; i < n; i++) {
    row = range(row.length + 1).map(j => (row[j] ?? F(0)).mul(q).add((row[j - 1] ?? F(0)).mul(p)))
  }
  return row
}
