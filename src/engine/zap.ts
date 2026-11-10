import { F, range, rational, Rng, sum } from './core.ts'
import type { Difficulty } from './core.ts'

export const zapIds = ['skyscrapers', 'balloon', 'grill-master', 'figure-it-out', 'number-box', 'code-compare', 'digit', 'the-switch', 'shapeshift'] as const
export type ZapGame = typeof zapIds[number]
export type Towers = number[][]
export type Op = '+' | '−' | '×' | '÷'
export const operators: Op[] = ['+', '−', '×', '÷']
export type Tile = { id: number; value: string; label: string }
export type Move = [number, number]
export type CookItem = { spawn: number; ready: number; burnt: number; leave: number; lane: number }
export type Round =
  | { game: 'skyscrapers'; board: Towers; goal: Towers; optimal: Move[] }
  | { game: 'balloon'; burst: number; maximum: number; penalty: number; reward: number; minimum: number }
  | { game: 'grill-master'; items: CookItem[] }
  | { game: 'figure-it-out'; domains: number[]; target: number[] }
  | { game: 'number-box'; values: number[]; target: string }
  | { game: 'code-compare'; reference: string; options: string[]; answer: number; limit: number }
  | { game: 'digit'; digits: string; rule: 'forward' | 'reverse' | 'ascending'; exposure: number; limit: number }
  | { game: 'the-switch'; a: number; b: number; arrows: string[]; rule: 'sum' | 'arrows'; answer: number; limit: number; switched: boolean }
  | { game: 'shapeshift'; shape: 'circle' | 'square'; delay: number; limit: number; answer: number }

export const zapName: Record<ZapGame, string> = {
  skyscrapers: 'Skyscrapers', balloon: 'Balloon', 'grill-master': 'Grill Master', 'figure-it-out': 'Figure It Out',
  'number-box': 'Number Box', 'code-compare': 'Code Compare', digit: 'Digit', 'the-switch': 'The Switch', shapeshift: 'Shapeshift',
}

const towerKey = (board: Towers) => board.map(t => t.join('')).join('/')
export function moveBlock(board: Towers, [from, to]: Move): Towers | null {
  if (from === to || !board[from]?.length || !board[to]) return null
  const next = board.map(t => [...t])
  next[to].push(next[from].pop()!)
  return next
}

export function towerPath(start: Towers, target: Towers): Move[] | null {
  const goal = towerKey(target), initial = towerKey(start)
  const queue: { board: Towers; key: string }[] = [{ board: start, key: initial }]
  const found = new Map<string, { previous: string; move: Move } | null>([[initial, null]])
  const indices = range(start.length)
  for (let i = 0; i < queue.length; i++) {
    const { board, key } = queue[i]
    if (key === goal) {
      const path: Move[] = []
      for (let entry = found.get(key); entry; entry = found.get(entry.previous)) path.push(entry.move)
      return path.reverse()
    }
    for (const from of indices) for (const to of indices) {
      const state = moveBlock(board, [from, to])
      if (!state) continue
      const id = towerKey(state)
      if (!found.has(id)) {
        found.set(id, { previous: key, move: [from, to] })
        queue.push({ board: state, key: id })
      }
    }
  }
  return null
}

export function operate(a: string, b: string, op: Op) {
  const x = F(a), y = F(b)
  if (op === '÷' && y.equals(0)) return null
  return rational(op === '+' ? x.add(y) : op === '−' ? x.sub(y) : op === '×' ? x.mul(y) : x.div(y))
}

export function initialTiles(values: number[]): Tile[] {
  return values.map((n, i) => ({ value: String(n), label: String(n), id: 1 << i }))
}

export function combineTiles(tiles: Tile[], a: number, b: number, op: Op): Tile[] | null {
  const x = tiles.find(tile => tile.id === a), y = tiles.find(tile => tile.id === b)
  if (!x || !y || a === b || (a & b) !== 0) return null
  const value = operate(x.value, y.value, op)
  if (value === null) return null
  return [...tiles.filter(t => t.id !== a && t.id !== b), { id: a | b, label: '(' + x.label + ' ' + op + ' ' + y.label + ')', value }]
}

type BoxStep = { a: number; b: number; op: Op }
export function solveBox(values: number[], target: string) {
  const seen = new Set<string>()
  function find(tiles: Tile[]): BoxStep[] | null {
    if (tiles.length === 1) return tiles[0].value === target ? [] : null
    const key = tiles.map(t => t.value).sort().join(',')
    if (seen.has(key)) return null
    seen.add(key)
    for (let a = 0; a < tiles.length; a++) for (let b = a + 1; b < tiles.length; b++) {
      for (const op of operators) {
        const pairs = op === '+' || op === '×' ? [[a, b]] : [[a, b], [b, a]]
        for (const [i, j] of pairs) {
          const move = { a: tiles[i].id, b: tiles[j].id, op }
          const next = combineTiles(tiles, move.a, move.b, op)
          const result = next && find(next)
          if (result) return [move, ...result]
        }
      }
    }
    return null
  }
  return find(initialTiles(values))
}

export const attributes = [
  { name: 'Shape', values: ['Circle', 'Square', 'Triangle', 'Diamond'] },
  { name: 'Color', values: ['Teal', 'Rust', 'Indigo', 'Gold'] },
  { name: 'Pattern', values: ['Solid', 'Stripes', 'Dots', 'Crosshatch'] },
  { name: 'Border', values: ['Thin', 'Thick', 'Dashed', 'Double'] },
  { name: 'Mark', values: ['None', 'Plus', 'Ring', 'Star'] },
  { name: 'Orientation', values: ['Up', 'Right', 'Down', 'Left'] },
]

export const matches = (guess: number[], target: number[]) => guess.filter((n, i) => n === target[i]).length

export function compatible(domains: number[], clues: { guess: number[]; matches: number }[]) {
  let candidates: number[][] = [[]]
  for (const domain of domains) candidates = candidates.flatMap(partial => range(domain).map(value => [...partial, value]))
  return candidates.filter(target => clues.every(clue => matches(clue.guess, target) === clue.matches)).length
}

export const digitAnswer = (round: Extract<Round, { game: 'digit' }>) =>
  round.rule === 'forward' ? round.digits : (round.rule === 'reverse' ? [...round.digits].reverse() : [...round.digits].sort()).join('')

function switchRule(seed: string, index: number) {
  return new Rng(seed + '/switch-rule/' + index).pick(['sum', 'arrows'] as const)
}

export function makeRound(game: ZapGame, seed: string, index: number, d: Difficulty, duration: number, span = 0): Round {
  const rng = new Rng(seed + '/' + game + '/' + index)
  switch (game) {
    case 'skyscrapers': {
      for (let retry = 0; retry < 120; retry++) {
        const count = d <= 2 ? 3 : 4, blocks = 3 + Math.min(4, d), colors = 2 + Math.min(3, d)
        const goal: Towers = range(count).map(() => [])
        for (let i = 0; i < blocks; i++) goal[rng.int(0, count - 1)].push(i % colors)
        let board = goal
        for (let i = 0; i < 3 + d * 2; i++) {
          const from = rng.pick(range(count).filter(j => board[j].length > 0))
          const to = rng.pick(range(count).filter(j => j !== from))
          board = moveBlock(board, [from, to])!
        }
        const optimal = towerPath(board, goal)
        if (optimal && optimal.length >= Math.min(3, d)) return { game, board, goal, optimal }
      }
      throw new Error('Unable to generate a reachable tower puzzle.')
    }
    case 'balloon': {
      const minimum = rng.int(2, 4), maximum = rng.int(8 + d * 2, 13 + d * 3)
      const burst = rng.int(minimum, maximum)
      return { game, burst, minimum, maximum, reward: rng.int(2, 4 + d), penalty: index % 2 === 0 ? 0 : rng.int(3, 6 + d * 2) }
    }
    case 'grill-master': {
      const lanes = d === 1 ? 1 : d <= 3 ? 3 : 4
      const items: CookItem[] = []
      for (let lane = 0; lane < lanes; lane++) {
        let spawn = lane * 700
        while (spawn + 2900 < duration) {
          const ready = spawn + rng.int(1300, 2500 + d * 180), burnt = ready + rng.int(800 - d * 80, 1300 - d * 90)
          if (burnt >= duration) break
          const leave = Math.min(duration, burnt + 900)
          items.push({ lane, spawn, ready, burnt, leave })
          spawn = leave + rng.int(170, 640)
        }
      }
      return { game, items: items.sort((a, b) => a.spawn - b.spawn) }
    }
    case 'figure-it-out': {
      const domains = range(Math.min(6, 2 + d)).map((_, i) => i === 0 || i === 1 ? Math.min(4, 2 + d) : d < 4 ? 3 : 4)
      return { game, domains, target: domains.map(n => rng.int(0, n - 1)) }
    }
    case 'number-box': {
      for (let retry = 0; retry < 120; retry++) {
        const values = range(4).map(() => rng.int(1, 6 + d * 3))
        const ops = range(3).map(() => rng.pick(operators.slice(0, d <= 2 ? 3 : 4)))
        const left = operate(String(values[0]), String(values[1]), ops[0])
        const right = operate(String(values[2]), String(values[3]), ops[1])
        if (!left || !right) continue
        const target = operate(left, right, ops[2])
        if (!target || target.includes('/') || Number(target) <= 4 || Number(target) > 250 || values.map(String).includes(target)) continue
        if (values.some((x, i) => values.some((y, j) => i !== j && operators.some(op => operate(String(x), String(y), op) === target)))) continue
        return { game, values: rng.shuffle(values), target }
      }
      throw new Error('Unable to generate a four-number puzzle.')
    }
    case 'code-compare': {
      const alphabet = [...'ACDEFGHKMNPRTUVWXY346789']
      const size = 7 + Math.min(3, Math.floor((d - 1) / 1.3))
      const code = range(size).map(() => rng.pick(alphabet))
      const reference = code.join('')
      const distractors = new Set<string>()
      while (distractors.size < 3) {
        const changed = [...code], position = rng.int(0, size - 1)
        if (rng.int(0, 2) === 0 && position < size - 1 && changed[position] !== changed[position + 1]) {
          ;[changed[position], changed[position + 1]] = [changed[position + 1], changed[position]]
        } else changed[position] = rng.pick(alphabet.filter(c => c !== changed[position]))
        distractors.add(changed.join(''))
      }
      const options = rng.shuffle([reference, ...distractors])
      return { game, reference, options, answer: options.indexOf(reference), limit: Math.max(1600 - d * 100, 5200 - d * 450 - index * 95) }
    }
    case 'digit': {
      const length = Math.min(13, 2 + d + span)
      const digits = range(length).map(() => rng.int(0, 9)).join('')
      return { game, digits, rule: d <= 2 && index % 3 === 0 ? 'forward' : rng.pick(['forward', 'reverse', 'ascending']),
        exposure: Math.max(900, 550 * length - 190 * d), limit: 4200 + length * 500 }
    }
    case 'the-switch': {
      const rule = switchRule(seed, index), max = 5 + d * 4
      const a = rng.int(1, max), b = rng.int(1, max)
      const first = range(d <= 2 ? 2 : 3).map(() => rng.pick(['←', '→'])).join('')
      const alter = rng.int(0, first.length - 1)
      const second = rng.int(0, 1) ? first : [...first].map((x, i) => i === alter ? (x === '←' ? '→' : '←') : x).join('')
      return { game, a, b, arrows: [first, second], rule, answer: rule === 'sum' ? (a + b) % 2 : Number(first !== second),
        limit: 3600 - d * 410, switched: index > 0 && switchRule(seed, index - 1) !== rule }
    }
    case 'shapeshift': {
      const shape = rng.pick(['circle', 'square'] as const)
      return { game, shape, answer: shape === 'circle' ? 1 : 0, delay: rng.int(160, 550 - d * 25), limit: 1080 - d * 100 }
    }
  }
}

export type Work =
  | { kind: 'towers'; moves: Move[]; source: number | null }
  | { kind: 'balloon'; pumps: number }
  | { kind: 'grill'; acted: number[] }
  | { kind: 'figure'; selection: number[]; guesses: { guess: number[]; matches: number }[] }
  | { kind: 'box'; steps: BoxStep[]; selected: number[]; op: Op | null }
  | { kind: 'digit'; value: string }
  | { kind: 'rapid' }
export type ZapEntry = {
  round: number
  state: 'correct' | 'wrong' | 'missed'
  earned?: number
  latency?: number
  moves?: number
  optimal?: number
  span?: number
  switched?: boolean
  note?: string
}
export type ZapState = { index: number; onset: number; work: Work; entries: ZapEntry[]; span: number }
export type ZapConfig = { game: ZapGame; seed: string; difficulty: Difficulty; duration: number; roundLimit: number | null }
export type ZapAction =
  | { type: 'tower'; index: number }
  | { type: 'undo' | 'reset' | 'pump' | 'collect' | 'guess' | 'submit-box' | 'submit-digit' | 'next' }
  | { type: 'grill'; index: number }
  | { type: 'attribute'; index: number; value: number }
  | { type: 'tile'; id: number }
  | { type: 'operator'; op: Op }
  | { type: 'digit'; value: string }
  | { type: 'answer'; index: number }

const rounds = new Map<string, Round>()
export function roundAt(config: ZapConfig, state: Pick<ZapState, 'index' | 'span'>) {
  const key = [config.game, config.seed, config.difficulty, config.duration, state.index, state.span].join('/')
  const cached = rounds.get(key)
  if (cached) return cached
  const generated = makeRound(config.game, config.seed, state.index, config.difficulty, config.duration, state.span)
  if (rounds.size >= 64) rounds.delete(rounds.keys().next().value!)
  rounds.set(key, generated)
  return generated
}

function workFor(round: Round): Work {
  switch (round.game) {
    case 'skyscrapers': return { kind: 'towers', moves: [], source: null }
    case 'balloon': return { kind: 'balloon', pumps: 0 }
    case 'grill-master': return { kind: 'grill', acted: [] }
    case 'figure-it-out': return { kind: 'figure', selection: round.domains.map(() => 0), guesses: [] }
    case 'number-box': return { kind: 'box', steps: [], selected: [], op: null }
    case 'digit': return { kind: 'digit', value: '' }
    default: return { kind: 'rapid' }
  }
}

export function startZap(config: ZapConfig): ZapState {
  return { index: 0, onset: 0, span: 0, entries: [], work: workFor(roundAt(config, { index: 0, span: 0 })) }
}

export function zapFinished(config: ZapConfig, state: ZapState) {
  return config.roundLimit !== null && state.index >= config.roundLimit
}

export const towerBoard = (round: Extract<Round, { game: 'skyscrapers' }>, work: Extract<Work, { kind: 'towers' }>) =>
  work.moves.reduce((b, move) => moveBlock(b, move) ?? b, round.board)
export const boxTiles = (round: Extract<Round, { game: 'number-box' }>, work: Extract<Work, { kind: 'box' }>) =>
  work.steps.reduce((tiles, step) => combineTiles(tiles, step.a, step.b, step.op) ?? tiles, initialTiles(round.values))

export function zapDeadline(round: Round) {
  switch (round.game) {
    case 'code-compare':
    case 'the-switch': return round.limit
    case 'shapeshift': return round.delay + round.limit
    case 'digit': return round.exposure + round.limit
    default: return Infinity
  }
}

function advance(config: ZapConfig, state: ZapState, time: number, entry: Omit<ZapEntry, 'round'>): ZapState {
  const index = state.index + 1
  const span = config.game === 'digit' ? Math.max(0, state.span + (entry.state === 'correct' ? 1 : -1)) : state.span
  const next = { index, onset: time, entries: [...state.entries, { ...entry, round: state.index }], span }
  return { ...next, work: zapFinished(config, next as ZapState) ? state.work : workFor(roundAt(config, next)) }
}

export function tickZap(config: ZapConfig, state: ZapState, elapsed: number): ZapState {
  const time = Math.min(config.duration, elapsed)
  if (config.game === 'grill-master') {
    if (state.work.kind !== 'grill') return state
    const round = roundAt(config, state)
    if (round.game !== 'grill-master') return state
    const acted = new Set(state.work.acted)
    const missed = round.items.flatMap((item, i): ZapEntry[] => item.leave <= time && !acted.has(i)
      ? [{ round: i, state: 'missed', note: 'Left on the grill' }] : [])
    return missed.length ? { ...state, work: { kind: 'grill', acted: [...acted, ...missed.map(e => e.round)] }, entries: [...state.entries, ...missed] } : state
  }
  let next = state
  while (!zapFinished(config, next)) {
    const round = roundAt(config, next)
    const deadline = next.onset + zapDeadline(round)
    if (deadline > time) break
    next = advance(config, next, deadline, {
      state: 'missed',
      ...(round.game === 'the-switch' ? { switched: round.switched } : {}),
      ...(round.game === 'digit' ? { span: round.digits.length, note: 'Expected ' + digitAnswer(round) } : {}),
    })
  }
  return next
}

export function playZap(config: ZapConfig, previous: ZapState, time: number, action: ZapAction): ZapState {
  const state = tickZap(config, previous, time)
  if (time >= config.duration || zapFinished(config, state) || state.index !== previous.index) return state
  const round = roundAt(config, state), work = state.work
  const update = (work: Work): ZapState => ({ ...state, work })
  const finish = (entry: Omit<ZapEntry, 'round'>) => advance(config, state, time, entry)
  const latency = time - state.onset
  if (action.type === 'next' && round.game !== 'grill-master') return finish({ state: 'missed', note: 'Skipped' })
  if (round.game === 'skyscrapers' && work.kind === 'towers') {
    if (action.type === 'reset') return update({ kind: 'towers', moves: [], source: null })
    if (action.type === 'undo') return update({ kind: 'towers', moves: work.moves.slice(0, -1), source: null })
    if (action.type === 'tower') {
      const board = towerBoard(round, work)
      if (work.source === null) return board[action.index]?.length ? update({ ...work, source: action.index }) : state
      const move: Move = [work.source, action.index]
      const next = moveBlock(board, move)
      if (!next) return update({ ...work, source: null })
      const moves = [...work.moves, move]
      return towerKey(next) === towerKey(round.goal) ? finish({ state: 'correct', moves: moves.length, optimal: round.optimal.length, latency }) :
        update({ ...work, moves, source: null })
    }
  }
  if (round.game === 'balloon' && work.kind === 'balloon') {
    if (action.type === 'pump') return work.pumps + 1 < round.burst ? update({ ...work, pumps: work.pumps + 1 }) :
      finish({ state: 'wrong', earned: -round.penalty, note: 'Burst on pump ' + round.burst })
    if (action.type === 'collect') return finish({ state: 'correct', earned: work.pumps * round.reward, note: 'Cashed out after ' + work.pumps + ' pumps' })
  }
  if (round.game === 'grill-master' && work.kind === 'grill' && action.type === 'grill') {
    const item = round.items[action.index]
    if (!item || work.acted.includes(action.index) || time < item.spawn || time >= item.leave) return state
    const status = time < item.ready ? 'Raw' : time < item.burnt ? 'Cooked' : 'Burnt'
    const success = status === 'Cooked'
    return { ...state, work: { ...work, acted: [...work.acted, action.index] },
      entries: [...state.entries, { round: action.index, state: success ? 'correct' : 'wrong', earned: success ? 1 : -1, note: status }] }
  }
  if (round.game === 'figure-it-out' && work.kind === 'figure') {
    if (action.type === 'attribute' && action.value >= 0 && action.value < round.domains[action.index]) {
      return update({ ...work, selection: work.selection.map((x, i) => i === action.index ? action.value : x) })
    }
    if (action.type === 'guess') {
      if (work.guesses.some(g => g.guess.every((x, i) => x === work.selection[i]))) return state
      const score = matches(work.selection, round.target)
      if (score === round.domains.length) return finish({ state: 'correct', moves: work.guesses.length + 1, latency,
        note: round.target.map((x, i) => attributes[i].values[x]).join(', ') })
      return update({ ...work, guesses: [...work.guesses, { guess: work.selection, matches: score }] })
    }
  }
  if (round.game === 'number-box' && work.kind === 'box') {
    if (action.type === 'reset') return update(workFor(round))
    if (action.type === 'undo') return update({ ...work, steps: work.steps.slice(0, -1), selected: [], op: null })
    const tiles = boxTiles(round, work)
    if (action.type === 'submit-box' && tiles.length === 1) return finish({
      state: tiles[0].value === round.target ? 'correct' : 'wrong', latency, moves: work.steps.length, note: tiles[0].label + ' = ' + tiles[0].value,
    })
    if (action.type === 'tile' || action.type === 'operator') {
      const selected = action.type === 'tile' ? work.selected.includes(action.id) ? work.selected.filter(id => id !== action.id) :
        tiles.some(t => t.id === action.id) ? [...work.selected, action.id].slice(-2) : work.selected : work.selected
      const op = action.type === 'operator' ? action.op : work.op
      if (selected.length !== 2 || !op) return update({ ...work, selected, op })
      const [a, b] = selected
      if (!combineTiles(tiles, a, b, op)) return update({ ...work, selected, op: null })
      return update({ kind: 'box', steps: [...work.steps, { a, b, op }], selected: [], op: null })
    }
  }
  if (round.game === 'digit' && work.kind === 'digit' && latency >= round.exposure) {
    if (action.type === 'digit' && /^\d*$/.test(action.value)) return update({ ...work, value: action.value.slice(0, round.digits.length) })
    if (action.type === 'submit-digit' && work.value.length === round.digits.length) return finish({
      state: work.value === digitAnswer(round) ? 'correct' : 'wrong',
      latency: latency - round.exposure, span: round.digits.length, note: 'Entered ' + work.value + ' · Expected ' + digitAnswer(round),
    })
  }
  if (action.type === 'answer' && (round.game === 'code-compare' || round.game === 'the-switch' || (round.game === 'shapeshift' && latency >= round.delay))) {
    const max = round.game === 'code-compare' ? 3 : 1
    if (action.index < 0 || action.index > max) return state
    return finish({
      state: action.index === round.answer ? 'correct' : 'wrong',
      latency: latency - (round.game === 'shapeshift' ? round.delay : 0),
      ...(round.game === 'the-switch' ? { switched: round.switched } : {}),
    })
  }
  return state
}

export function zapSummary(entries: ZapEntry[]) {
  const times = entries.flatMap(e => e.latency !== undefined && e.state === 'correct' ? [e.latency] : []).sort((a, b) => a - b)
  const n = times.length
  return {
    correct: entries.filter(e => e.state === 'correct').length,
    wrong: entries.filter(e => e.state === 'wrong').length,
    missed: entries.filter(e => e.state === 'missed').length,
    earnings: sum(entries.map(e => e.earned ?? 0)),
    median: n === 0 ? null : (times[Math.floor((n - 1) / 2)] + times[Math.floor(n / 2)]) / 2,
    span: Math.max(0, ...entries.map(e => e.state === 'correct' ? e.span ?? 0 : 0)),
  }
}
