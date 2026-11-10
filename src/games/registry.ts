import type { Game } from '../engine/session.ts'
import { zapName } from '../engine/zap.ts'

type GameInfo = { title: string; objective: string; rules: string[]; scoring?: string }

export const gameInfo: Record<Game | 'zap-n', GameInfo> = {
  'beat-the-odds': {
    title: 'Beat The Odds',
    objective: 'Solve probability and expected-value questions.',
    rules: [
      'Choose one answer and select Submit. Fractions are exact. Round dollar answers to the nearest cent.',
      'Select Skip to move on. An unsubmitted answer is skipped when time expires.',
    ],
  },
  numberlogic: {
    title: 'NumberLogic',
    objective: 'Find the missing term or table value.',
    rules: [
      'Choose an answer and select Submit. Use Custom to switch to typed answers.',
      'Select Skip to move on. The clock applies to the whole section.',
    ],
  },
  'likelihood-list': {
    title: 'Likelihood-list',
    objective: 'Rank three outcomes from most likely to least likely.',
    rules: [
      'Drag the statements into order or use the up and down arrow buttons.',
      'Select Submit to lock in the order or Skip to move on.',
      'The current order is submitted when time runs out.',
    ],
    scoring: 'An exact ranking earns 1 point. An incorrect ranking or a skip earns 0.',
  },
  intervals: {
    title: 'Intervals',
    objective: 'Give an interval that contains the answer.',
    rules: [
      'Type nonnegative whole-number bounds or adjust them with + and −. The bounds can be equal.',
      'Use the 0–100 scale for probabilities. Enter 50 for a 50% chance.',
      'Select Submit or Skip. Valid bounds are submitted when time runs out.',
    ],
    scoring: 'If the interval contains the answer, including either endpoint, score lower bound ÷ upper bound. A miss or skip earns 0. An exact [0, 0] hit earns 1.',
  },
  orderbooks: {
    title: 'Orderbooks',
    objective: 'Make a profit and finish with zero inventory.',
    rules: [
      'Each board has one opportunity. Buy or sell each lot, which may contain several items, at its listed price.',
      'The signed counter tracks your position. Repeat a trade to change the quantity. Reset clears all positions.',
      'Submit once every item balances and the trade makes a profit, or skip the board.',
    ],
    scoring: 'Any profitable trade with zero inventory earns 1 point, regardless of profit size. An incorrect trade or a skip earns 0.',
  },
  'classic-80-in-8': {
    title: 'Classic 80-in-8',
    objective: 'Solve the arithmetic.',
    rules: [
      'Choose an answer and select Submit, or select Skip.',
      'One clock covers the whole section. Unanswered questions count as skips.',
    ],
  },
  skyscrapers: {
    title: zapName.skyscrapers,
    objective: 'Match the target towers.',
    rules: [
      'Select a source tower, then a different destination. Only the top block can move.',
      'Use the tower number keys or the buttons. Undo takes back one move. Reset restores the starting board.',
    ],
    scoring: 'Results show boards solved, time, and your moves against the shortest solution.',
  },
  balloon: {
    title: zapName.balloon,
    objective: 'Collect the balloon’s cash before it bursts.',
    rules: [
      'Select Pump to add to the round’s reward. Select Collect to bank it and move to the next balloon.',
      'A burst loses the round’s reward. On penalty rounds it also subtracts the displayed amount from your total.',
    ],
    scoring: 'Your score is the cash you collect minus burst penalties.',
  },
  'grill-master': {
    title: zapName['grill-master'],
    objective: 'Remove each steak while it is cooked.',
    rules: [
      'Each steak has its own clock. The meter marks its cooking window.',
      'Click or tap the steak while its status reads Cooked.',
    ],
    scoring: '+1 for cooked, −1 for raw or burnt. Missed steaks are counted separately.',
  },
  'figure-it-out': {
    title: zapName['figure-it-out'],
    objective: 'Find the hidden combination of attributes.',
    rules: [
      'Choose attributes and submit a guess.',
      'The result gives the number of matching attributes. Use previous guesses to narrow down the possibilities.',
    ],
    scoring: 'Results show figures solved, guesses, and time.',
  },
  'number-box': {
    title: zapName['number-box'],
    objective: 'Reach the target using all four starting numbers.',
    rules: [
      'Select two tiles in order and choose +, −, ×, or ÷. The result replaces those tiles.',
      'Use each starting number once. Intermediate fractions are exact. Submit when one tile remains.',
    ],
    scoring: 'A final tile equal to the target counts as a solve.',
  },
  'code-compare': {
    title: zapName['code-compare'],
    objective: 'Find the code that matches the reference exactly.',
    rules: [
      'Choose one of the four codes or press 1–4.',
      'Each item has a time limit. The limit gets shorter during the run.',
    ],
    scoring: 'Results show correct responses, errors, timeouts, and median correct response time.',
  },
  digit: {
    title: zapName.digit,
    objective: 'Recall the digits after they disappear.',
    rules: [
      'Read the requested order. The answer may be forward, reversed, or sorted.',
      'Enter every digit, including leading zeros and repeats, then submit.',
    ],
    scoring: 'Results show exact recalls, response time, and the longest correct sequence.',
  },
  'the-switch': {
    title: zapName['the-switch'],
    objective: 'Answer the highlighted rule.',
    rules: [
      'For the sum, choose Even or Odd. For the arrows, choose Same or Different.',
      'Use the buttons or press Left for Even or Same and Right for Odd or Different.',
    ],
    scoring: 'Accuracy and response time are reported separately for switch and repeat trials.',
  },
  shapeshift: {
    title: zapName.shapeshift,
    objective: 'Respond when a shape appears.',
    rules: [
      'Press Left for a square and Right for a circle, or tap the matching button.',
      'Wait for the shape before responding.',
    ],
    scoring: 'Results show correct responses, errors, misses, and median correct reaction time.',
  },
  'zap-n': { title: 'Zap-N', objective: '', rules: [] },
}

export function timeLabel(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '—'
  const whole = Math.max(0, Math.ceil(seconds))
  return Math.floor(whole / 60) + ':' + String(whole % 60).padStart(2, '0')
}
