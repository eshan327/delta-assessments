import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { catalog, planQuestions } from '../engine/catalog.ts'
import { F, Rng, VERSION } from '../engine/core.ts'
import { bruteForceTrade, profitableCircuits } from '../engine/orderbooks.ts'
import { grade, intervalScore, parseNumeric, tradeTotals, validBounds } from '../engine/questions.ts'
import type { Card, Question } from '../engine/questions.ts'
import { attemptSchema, begin, decodeChallenge, defaults, defaultStage, freshChallenge, plannedQuestions, reduceAttempt, shareQuery } from '../engine/session.ts'
import type { Challenge, Game } from '../engine/session.ts'
import { compatible, digitAnswer, initialTiles, makeRound, moveBlock, operate, playZap, solveBox, startZap, tickZap, towerPath } from '../engine/zap.ts'
import type { ZapConfig } from '../engine/zap.ts'

const seed = 'test-seed'
const challenge = (game: Game, mode: Challenge['mode'] = 'timed'): Challenge => {
  const stage = defaultStage(game, mode, defaults)
  return { version: VERSION, seed, mode, title: 'Fixture', stages: [stage.kind === 'quant' ? { ...stage, count: 2, seconds: 20, itemSeconds: 5 } : stage] }
}
const points = { correct: 1, wrong: -1, skip: 0 }

describe('seeded scheduling', () => {
  it('replays content independently of the browser and covers the enabled families', () => {
    const a = planQuestions('intervals', seed, 3, 18, [], false)
    const b = planQuestions('intervals', seed, 3, 18, [], false)
    expect(a.map(q => q.signature)).toEqual(b.map(q => q.signature))
    expect(new Set(a.map(q => q.signature)).size).toBe(18)
    expect(new Set(a.map(q => q.family)).size).toBe(catalog.intervals.length)
    const c = challenge('intervals')
    expect(decodeChallenge(new URLSearchParams(shareQuery(c)))).toEqual(c)
    expect(decodeChallenge(new URLSearchParams('seed=bad&v=3'))).toBeNull()
  })

  it('replays the PRNG across a variety of seed strings', () => fc.assert(fc.property(fc.string(), text => {
    const a = new Rng(text), b = new Rng(text)
    expect(Array.from({ length: 24 }, () => a.next())).toEqual(Array.from({ length: 24 }, () => b.next()))
  })))

  it('avoids recent signatures in fresh runs', () => {
    let c = begin(challenge('intervals'), 'old', 0)
    c = reduceAttempt(c, { type: 'tick' }, 21_000)
    const fresh = freshChallenge({ title: c.title, mode: c.mode, stages: c.stages }, [c])
    const earlier = new Set(plannedQuestions(c, 0).map(q => q.signature))
    expect(plannedQuestions(fresh, 0).every(q => !earlier.has(q.signature))).toBe(true)
  })
})

describe('answer grading', () => {
  it('grades the original interval examples, inclusivity, fractions, zero, and invalid fields', () => {
    expect(intervalScore('42', '30', '60')).toBe(0.5)
    expect(intervalScore('42', '40', '50')).toBe(0.8)
    expect(intervalScore('42', '42', '42')).toBe(1)
    expect(intervalScore('42', '42', '50')).toBe(0.84)
    expect(intervalScore('42', '41', '42')).toBeCloseTo(41 / 42)
    expect(intervalScore('85/2', '42', '42')).toBe(0)
    expect(intervalScore('85/2', '42', '43')).toBeCloseTo(42 / 43)
    expect(intervalScore('0', '0', '0')).toBe(1)
    expect(intervalScore('1', '0', '100')).toBe(0)
    expect(validBounds('40.5', '42')).toBe(false)
    expect(validBounds('5', '4')).toBe(false)
    expect(validBounds('1', '101', 100)).toBe(false)
    expect(validBounds('-1', '4')).toBe(false)
  })

  it('grades intervals against the exact containment property', () => fc.assert(fc.property(
    fc.nat(2000), fc.nat(1000), fc.nat(1000),
    (twiceTruth, a, b) => {
      const [lo, hi] = [a, b].sort((x, y) => x - y)
      const truth = F(twiceTruth, 2).toFraction()
      const score = twiceTruth >= 2 * lo && twiceTruth <= 2 * hi ? (hi === 0 ? 1 : lo / hi) : 0
      expect(intervalScore(truth, String(lo), String(hi))).toBeCloseTo(score, 11)
    },
  )))

  it('requires the entire rank permutation and validates choice input', () => {
    const q = planQuestions('likelihood-list', seed, 3, 1, [], false)[0]
    if (q.kind !== 'ranking') throw new Error('Expected a ranking')
    expect(grade(q, { kind: 'ranking', order: q.truth }, points).state).toBe('correct')
    expect(grade(q, { kind: 'ranking', order: [q.truth[1], q.truth[0], q.truth[2]] }, points).state).toBe('wrong')
    expect(grade(q, { kind: 'ranking', order: [q.truth[0], q.truth[0], q.truth[2]] }, points).state).toBe('skipped')
    expect(parseNumeric(' 0.125 ')).toBe('1/8')
    expect(parseNumeric('1/0')).toBeNull()
    expect(parseNumeric('Infinity')).toBeNull()
  })

  it('allows any profitable flat trade and rejects false cash or inventory', () => {
    const cards: Card[] = [
      { goods: [1, 0, 0, 0], bid: 8, ask: 10 },
      { goods: [0, 1, 0, 0], bid: 12, ask: 14 },
      { goods: [1, 1, 0, 0], bid: 26, ask: 28 },
    ]
    expect(tradeTotals(cards, [1, 1, -1])).toMatchObject({ valid: true, profit: 2, inventory: [0, 0, 0, 0] })
    expect(tradeTotals(cards, [2, 2, -2])).toMatchObject({ valid: true, profit: 4 })
    expect(tradeTotals(cards, [-1, -1, 1]).valid).toBe(false)
    expect(tradeTotals(cards, [0, 1, -1]).valid).toBe(false)
    expect(tradeTotals(cards, [0, 0, 0]).valid).toBe(false)
    expect(profitableCircuits(cards)).toEqual([[1, 1, -1]])
    expect(bruteForceTrade(cards, 1)).toEqual([1, 1, -1])
    cards[2] = { ...cards[2], bid: 24 }
    expect(tradeTotals(cards, [1, 1, -1]).valid).toBe(false)
    expect(profitableCircuits(cards)).toEqual([])
  })

  it('scores wrong and skipped answers according to the selected game preset', () => {
    const classic = defaultStage('classic-80-in-8', 'timed', defaults)
    if (classic.kind !== 'quant') throw new Error('Expected a quantitative preset')
    expect([classic.count, classic.seconds]).toEqual([80, 480])
    const q = planQuestions('classic-80-in-8', seed, 3, 1, [], false)[0]
    if (q.kind !== 'choice') throw new Error('Expected a choice')
    const wrong = q.options.find(o => o.key !== q.truth)!
    expect(grade(q, { kind: 'choice', value: wrong.key }, classic.scoring).points).toBe(-1)
    expect(grade(q, null, classic.scoring).points).toBe(-1)
  })
})

describe('run and clock state', () => {
  it('autosubmits a valid interval exactly once and restores from its saved timestamp', () => {
    let a = begin(challenge('intervals'), 'interval-timer', 100_000)
    const q = plannedQuestions(a, 0)[0] as Extract<Question, { kind: 'interval' }>
    const target = F(q.truth).valueOf()
    a = reduceAttempt(a, { type: 'draft', draft: { kind: 'interval', lower: String(Math.floor(target)), upper: String(Math.ceil(target)) } }, 101_000)
    const recovered = attemptSchema.parse(JSON.parse(JSON.stringify(a)))
    a = reduceAttempt(recovered, { type: 'tick' }, 105_100)
    expect(a.index).toBe(1)
    expect(a.answers).toHaveLength(1)
    expect(a.answers[0].state).toBe('correct')
    expect(reduceAttempt(a, { type: 'tick' }, 105_101)).toBe(a)
  })

  it('pauses only practice and counts unanswered Classic questions at expiry', () => {
    const timed = begin(challenge('classic-80-in-8'), 'timed', 0)
    expect(reduceAttempt(timed, { type: 'pause' }, 1000)).toBe(timed)
    const ended = reduceAttempt(timed, { type: 'tick' }, 20_000)
    expect(ended.phase).toBe('done')
    expect(ended.answers.map(a => a.points)).toEqual([-1, -1])
    const practice = begin(challenge('intervals', 'practice'), 'practice', 0)
    const paused = reduceAttempt(practice, { type: 'pause' }, 1000)
    expect(reduceAttempt(paused, { type: 'tick' }, 20_000)).toBe(paused)
    const resumed = reduceAttempt(paused, { type: 'pause' }, 30_000)
    expect(resumed.pausedMs).toBe(29_000)
    expect(reduceAttempt(resumed, { type: 'tick' }, 30_010)).toBe(resumed)
  })
})

describe('cognitive rules', () => {
  it('finds shortest tower paths and blocks illegal moves', () => {
    const start = [[0, 1], [2], []], target = [[0], [2], [1]]
    expect(moveBlock(start, [2, 1])).toBeNull()
    expect(moveBlock(start, [0, 0])).toBeNull()
    expect(towerPath(start, target)).toEqual([[0, 2]])
  })

  it('uses precommitted balloon thresholds and applies the penalty round', () => {
    const config: ZapConfig = { game: 'balloon', seed, difficulty: 3, duration: 120_000, roundLimit: null }
    let state = startZap(config)
    state = playZap(config, state, 10, { type: 'pump' })
    state = playZap(config, state, 20, { type: 'collect' })
    expect(state.entries[0].earned).toBeGreaterThan(0)
    const round = makeRound('balloon', seed, 1, 3, 120_000)
    if (round.game !== 'balloon') throw new Error('Expected balloon')
    for (let i = 0; i < round.burst; i++) state = playZap(config, state, 30 + i, { type: 'pump' })
    expect(state.entries[1]).toMatchObject({ state: 'wrong', earned: -round.penalty })
  })

  it('grades at the exact grill window and records lost-frame misses', () => {
    const config: ZapConfig = { game: 'grill-master', seed, difficulty: 3, duration: 120_000, roundLimit: null }
    const state = startZap(config), round = makeRound(config.game, seed, 0, 3, 120_000)
    if (round.game !== 'grill-master') throw new Error('Expected grill')
    const first = round.items[0]
    expect(playZap(config, state, first.ready - 1, { type: 'grill', index: 0 }).entries[0].state).toBe('wrong')
    expect(playZap(config, state, first.ready, { type: 'grill', index: 0 }).entries[0].state).toBe('correct')
    expect(playZap(config, state, first.burnt, { type: 'grill', index: 0 }).entries[0].state).toBe('wrong')
    expect(tickZap(config, state, first.leave).entries[0].state).toBe('missed')
  })

  it('keeps all operands and leading zeroes in exact cognitive answers', () => {
    expect(compatible([3, 3, 3], [{ guess: [0, 1, 2], matches: 3 }])).toBe(1)
    expect(solveBox([3, 3, 8, 8], '24')).toHaveLength(3)
    expect(operate('1/3', '1/3', '+')).toBe('2/3')
    expect(operate('1/3', '0', '÷')).toBeNull()
    expect(initialTiles([3, 3, 8, 8]).map(t => t.id)).toEqual([1, 2, 4, 8])
    expect(digitAnswer({ game: 'digit', digits: '20013', rule: 'ascending', exposure: 1, limit: 1 })).toBe('00123')
    expect(digitAnswer({ game: 'digit', digits: '2300', rule: 'reverse', exposure: 1, limit: 1 })).toBe('0032')
  })
})
