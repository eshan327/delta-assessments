import {
  ArrowDownUp, ArrowLeftRight, BarChart3, Calculator, CircleDot, Flame, Grid2X2, Keyboard, Layers3,
  ListOrdered, Percent, Shapes, Sparkles, Target,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Game } from '../engine/session.ts'
import { zapName } from '../engine/zap.ts'

export type GameInfo = { title: string; type: string; description: string; how: string; scoring: string; icon: LucideIcon; color: string }
export const gameInfo: Record<Game | 'zap-n', GameInfo> = {
  'beat-the-odds': { title: 'Beat The Odds', type: 'Probability', description: 'Make decisions under uncertainty with probability and expected value.',
    how: 'Read the conditions and select one answer. Fractional choices are exact; dollar amounts are rounded to cents.',
    scoring: 'Default scoring is +1 correct, −1 incorrect, and 0 skipped.', icon: Percent, color: 'teal' },
  numberlogic: { title: 'NumberLogic', type: 'Patterns', description: 'Find the rule behind a sequence or complete a missing table value.',
    how: 'Look for differences, alternating rules, or interleaved sequences. Custom setup offers typed answers.',
    scoring: 'Default scoring is +1 correct, −1 incorrect, and 0 skipped.', icon: Grid2X2, color: 'indigo' },
  'likelihood-list': { title: 'Likelihood-list', type: 'Data reasoning', description: 'Read the evidence and rank three events from most to least likely.',
    how: 'Drag the rows into order or use their up and down buttons. The current ranking is submitted when time runs out.',
    scoring: 'The exact ordering earns 1 point. Other orders and skips earn 0.', icon: ListOrdered, color: 'purple' },
  intervals: { title: 'Intervals', type: 'Estimation', description: 'Put a tight range around the true value in a visual estimation task.',
    how: 'Enter two nonnegative whole numbers using the fields or the + and − controls. Use 0–100 for percentages.',
    scoring: 'A range containing the answer earns lower ÷ upper. An exact [0, 0] hit earns 1. Misses and skips earn 0.', icon: ArrowLeftRight, color: 'teal' },
  orderbooks: { title: 'Orderbooks', type: 'Trading logic', description: 'Buy and sell item bundles to find a profitable trade with zero inventory.',
    how: 'Sell at the bid and buy at the ask. Use a card more than once when necessary. Reset clears your positions.',
    scoring: 'Any profitable trade with zero remaining inventory earns 1 point. Other trades and skips earn 0.', icon: Layers3, color: 'ochre' },
  'zap-n': { title: 'Zap-N', type: 'Cognitive arcade', description: 'Nine interactive games spanning memory, attention, planning, and reaction.',
    how: 'Choose a game to play on its own or combine several in a battery.',
    scoring: 'Each game reports its own raw performance measures.', icon: Sparkles, color: 'indigo' },
  'classic-80-in-8': { title: 'Classic 80-in-8', type: 'Bonus · Mental math', description: 'Race through 80 arithmetic and algebra questions in eight minutes.',
    how: 'Choose the best exact answer and submit. Use mental math and keep an eye on the shared clock.',
    scoring: 'Default scoring is +1 correct and −1 for a wrong, skipped, or unanswered item.', icon: Calculator, color: 'sage' },
  skyscrapers: { title: zapName.skyscrapers, type: 'Planning', description: 'Rearrange colored blocks to match a target arrangement.',
    how: 'Select a tower with a top block, then choose a destination. You can use the tower number keys. Undo and Reset are available.',
    scoring: 'Solved boards, elapsed time, and moves compared with a shortest solution.', icon: Layers3, color: 'indigo' },
  balloon: { title: zapName.balloon, type: 'Risk and reward', description: 'Pump a balloon to build a reward, then cash out before it bursts.',
    how: 'Choose Pump or Collect. Standard and penalty rounds alternate. Each threshold is set when the round is generated.',
    scoring: 'Your total is collected cash minus any displayed burst penalties.', icon: CircleDot, color: 'purple' },
  'grill-master': { title: zapName['grill-master'], type: 'Attention', description: 'Watch several steaks and pull each one during its cooking window.',
    how: 'Select each steak when its status reads Cooked. The meter shows its own cooking progress.',
    scoring: '+1 for cooked, −1 for raw or burnt removals. Missed items are tracked separately.', icon: Flame, color: 'ochre' },
  'figure-it-out': { title: zapName['figure-it-out'], type: 'Deduction', description: 'Use feedback from each guess to deduce a hidden figure.',
    how: 'Build a figure with the selectors and submit. The game tells you how many attributes match.',
    scoring: 'Solved figures, guesses to solve, and time.', icon: Shapes, color: 'teal' },
  'number-box': { title: zapName['number-box'], type: 'Arithmetic', description: 'Combine four tiles using arithmetic to reach a target number.',
    how: 'Select two tiles in order and an operation. Use each original tile exactly once. Intermediate fractions are exact.',
    scoring: 'A final tile matching the target earns a solve.', icon: Calculator, color: 'indigo' },
  'code-compare': { title: zapName['code-compare'], type: 'Attention', description: 'Spot the exact code among three near matches under a shrinking clock.',
    how: 'Select a code or press 1–4 to respond. Check every character and its position.',
    scoring: 'Correct responses, errors, timeouts, and median correct response time.', icon: Keyboard, color: 'sage' },
  digit: { title: zapName.digit, type: 'Working memory', description: 'Remember a digit string and reproduce it in the requested order.',
    how: 'Watch the digits while visible. Enter them forward, backward, or sorted as requested, including zeroes and repeats.',
    scoring: 'Exact recalls, response time, and highest correct digit span.', icon: BarChart3, color: 'purple' },
  'the-switch': { title: zapName['the-switch'], type: 'Task switching', description: 'Switch between checking parity and comparing arrow groups.',
    how: 'Answer only the highlighted panel. Left means Even or Same; right means Odd or Different.',
    scoring: 'Accuracy and correct response time for switch and repeat trials.', icon: ArrowDownUp, color: 'teal' },
  shapeshift: { title: zapName.shapeshift, type: 'Reaction', description: 'Respond to each shape as soon as it appears.',
    how: 'Press left for a square, right for a circle, or use the matching buttons. Wait for the shape.',
    scoring: 'Correct responses, wrong keys, missed stimuli, and median correct reaction time.', icon: Target, color: 'ochre' },
}

export function timeLabel(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '—'
  const whole = Math.max(0, Math.ceil(seconds))
  return Math.floor(whole / 60) + ':' + String(whole % 60).padStart(2, '0')
}
