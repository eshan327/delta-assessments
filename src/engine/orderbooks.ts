import { range, sum } from './core.ts'
import { family, tradeTotals } from './questions.ts'
import type { Card } from './questions.ts'

export const goodsNames = ['ingot', 'barrel', 'coil', 'sack']
const gcd = (a: number, b: number): number => b === 0 ? Math.abs(a) : gcd(b, a % b)

function subsets(count: number, size: number, from = 0): number[][] {
  if (size === 0) return [[]]
  return range(count - from - size + 1).flatMap(i => {
    const first = from + i
    return subsets(count, size - 1, first + 1).map(rest => [first, ...rest])
  })
}

function determinant(m: number[][]): number {
  if (m.length === 0) return 1
  if (m.length === 1) return m[0][0]
  return sum(m[0].map((entry, column) => entry === 0 ? 0 : entry * (column % 2 === 0 ? 1 : -1) *
    determinant(m.slice(1).map(row => row.filter((_, i) => i !== column)))))
}

const rowSubsets = range(4).map(i => subsets(4, i + 1))
const columnSubsets = range(9).map(count => range(Math.min(count - 1, 4)).flatMap(i => subsets(count, i + 2)))

export function profitableCircuits(board: (Card | null)[]) {
  const positions = range(board.length).filter(i => board[i] !== null)
  const cards = positions.map(i => board[i]!)
  const profitable: number[][] = []
  for (const columns of columnSubsets[cards.length]) {
    for (const rows of rowSubsets[columns.length - 2]) {
      const matrix = rows.map(r => columns.map(c => cards[c].goods[r]))
      const cofactors = columns.map((_, i) => (i % 2 === 0 ? 1 : -1) * determinant(matrix.map(row => row.filter((_, j) => j !== i))))
      if (cofactors.every(n => n === 0)) continue
      // A nonzero minor fixes a one-dimensional nullspace on this support.
      if (cofactors.some(n => n === 0) || range(4).some(r => sum(cofactors.map((n, i) => n * cards[columns[i]].goods[r])) !== 0)) break
      const divisor = cofactors.reduce(gcd, 0)
      for (const direction of [1, -1]) {
        const trade = board.map(() => 0)
        columns.forEach((c, i) => { trade[positions[c]] = direction * cofactors[i] / divisor })
        if (tradeTotals(board, trade).valid) profitable.push(trade)
      }
      break
    }
  }
  return profitable
}

export function bruteForceTrade(board: (Card | null)[], max: number) {
  const active = range(board.length).filter(i => board[i] !== null)
  const trade = board.map(() => 0)
  const inventory = [0, 0, 0, 0]
  const walk = (depth: number, profit: number): number[] | null => {
    if (depth === active.length) return profit > 0 && inventory.every(n => n === 0) ? [...trade] : null
    const index = active[depth], card = board[index]!
    for (let x = -max; x <= max; x++) {
      trade[index] = x
      for (let j = 0; j < 4; j++) inventory[j] += card.goods[j] * x
      const result = walk(depth + 1, profit - (x < 0 ? card.bid : card.ask) * x)
      for (let j = 0; j < 4; j++) inventory[j] -= card.goods[j] * x
      if (result) return result
    }
    return null
  }
  return walk(0, 0)
}

const patterns: [string, string, string[], number[]][] = [
  ['single-bundle', 'Two singles against a bundle', ['1000', '0100', '1100'], [1, 1, -1]],
  ['crossed-quote', 'Crossed identical quotes', ['1000', '1000'], [1, -1]],
  ['lot-size', 'Different lots of one item', ['1000', '2000'], [2, -1]],
  ['bundle-single', 'Two-item bundle and a single', ['1100', '0010', '1110'], [1, 1, -1]],
  ['pair-mixtures', 'All three pair bundles', ['1100', '0110', '1010', '1110'], [1, 1, 1, -2]],
  ['weighted-assembly', 'Unequal quantities in one bundle', ['1000', '0100', '3200'], [3, 2, -1]],
  ['overlapping-goods', 'Two overlapping bundles against a lot', ['1100', '1010', '0110', '2000'], [1, 1, -1, -1]],
  ['triangle-offset', 'Three bundles and one balancing leg', ['1100', '0110', '1010', '1000'], [1, -1, 1, -2]],
  ['square-cycle', 'Four-good pair cycle', ['1100', '0110', '0011', '1001'], [1, -1, 1, -1]],
  ['weighted-cycle', 'Multiple units in a three-good cycle', ['2100', '0210', '1020', '1110'], [1, 1, 1, -3]],
  ['five-leg-offset', 'Five-leg inventory offset', ['1100', '0110', '0011', '0001', '1002'], [1, -1, 1, 1, -1]],
  ['four-good-assembly', 'Four singles and one large bundle', ['1000', '0100', '0010', '0001', '1111'], [1, 1, 1, 1, -1]],
]

const permutations = (remaining: number[]): number[][] => remaining.length === 0 ? [[]] : remaining.flatMap((x, i) =>
  permutations(remaining.filter((_, j) => i !== j)).map(rest => [x, ...rest]))
const goodsPermutations = permutations(range(4))

export const orderbooks = patterns.map(([id, label, shapes, vector]) => family(id, label, (rng, d, v) => {
  const permutation = rng.shuffle(range(4))
  const unit = range(4).map(() => rng.int(35, 125 + d * 15))
  const boost = rng.int(0, shapes.length - 1)
  const lot = v === 2 ? 2 : 1
  const goods = shapes.map((shape, i) => permutation.map(j => Number(shape[j]) * (i === boost ? lot : 1)) as Card['goods'])
  const planted = vector.map((n, i) => (v === 1 ? -n : n) * (i === boost ? 1 : lot))
  const divisor = planted.reduce(gcd, 0)
  const trade = planted.map(n => n / divisor)
  const cashValue = (g: Card['goods']) => sum(g.map((n, i) => n * unit[i]))
  const spreads = goods.map(() => rng.int(1, 7 + d))
  const cards = goods.map((g, i) => ({ goods: g, bid: cashValue(g) - spreads[i], ask: cashValue(g) + spreads[i] }))
  const target = rng.pick(range(cards.length).filter(i => trade[i] < 0))
  const cost = sum(trade.map((n, i) => Math.abs(n) * spreads[i]))
  const shift = Math.floor(cost / Math.abs(trade[target])) + rng.int(1, 7 + d * 2)
  cards[target].bid += shift
  cards[target].ask += shift
  const extras = Math.min(8 - cards.length, rng.int(d >= 4 ? 1 : 0, 2 + Math.floor(d / 2)))
  for (let i = 0; i < extras; i++) {
    const goods = [0, 0, 0, 0] as Card['goods']
    for (let j = 0; j < rng.int(1, 3 + Number(d >= 3)); j++) goods[rng.int(0, 3)]++
    const mid = cashValue(goods), wide = shift + rng.int(10, 24 + d * 3)
    cards.push({ goods, bid: Math.max(1, mid - wide), ask: mid + wide })
  }
  const indices = rng.shuffle(range(8))
  const board = range(8).map(i => cards[indices[i]] ?? null)
  const answer = indices.map(i => trade[i] ?? 0)
  const totals = tradeTotals(board, answer)
  if (!totals.valid) return null
  const canonical = goodsPermutations.map(p => cards.map(card => [
    ...p.map(j => card.goods[j]), card.bid, card.ask,
  ].join(',')).sort().join(';')).sort()[0]
  return {
    kind: 'book', cards: board, truth: answer, check: () => profitableCircuits(board), semantic: canonical,
    prompt: 'Find a profitable set of trades that leaves zero inventory.',
    explanation: [
      ...answer.flatMap((n, i) => n === 0 ? [] : [(n > 0 ? 'Buy ' : 'Sell ') + Math.abs(n) + ' × ' +
        board[i]!.goods.flatMap((qty, j) => qty > 0 ? [qty + ' ' + goodsNames[j]] : []).join(' + ') +
        ' at $' + (n > 0 ? board[i]!.ask : board[i]!.bid) + ' per lot.']),
      'The four inventory balances are zero and the cash profit is $' + totals.profit + '.',
    ],
  }
}))
