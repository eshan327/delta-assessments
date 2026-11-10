import { ArrowRight, Plus } from 'lucide-react'
import type { Game } from '../engine/session.ts'
import GameMark from './GameMark.tsx'
import MathText from './MathText.tsx'

const sample: Partial<Record<Game, [string, string]>> = {
  'beat-the-odds': ['P(roll > 4) = 2/6 = 1/3', 'On a fair six-sided die, only 5 and 6 count.'],
  numberlogic: ['3, 6, 12, 24 → 48', 'Each term is twice the previous one.'],
  'classic-80-in-8': ['15% of 80 = 12', '10% gives 8 and 5% gives 4.'],
  skyscrapers: ['Tower 1 → Tower 3', 'Move only the top block of Tower 1.'],
  balloon: ['3 pumps × $2 = $6', 'Collect to bank $6 and start the next balloon.'],
  'grill-master': ['Raw → Cooked → Burnt', 'Remove the steak during Cooked.'],
  'figure-it-out': ['Circle · Teal · Stripes', '“2 matching” means two of the three choices are correct.'],
  'number-box': ['(8 − 2) × (3 + 1) = 24', 'All four starting numbers are used once.'],
  'code-compare': ['R7M4WQ2 = R7M4WQ2', 'R7M4W2Q is a different code.'],
  digit: ['5027 → 7205', 'Enter 7205 when the instruction is Reverse.'],
  'the-switch': ['7 + 4 = 11 → Odd', 'Use the right button when the sum rule is active.'],
  shapeshift: ['□ ←     ○ →', 'Left for a square, right for a circle.'],
}

function LotDrawing({ item }: { item: 'ingot' | 'barrel' }) {
  return <svg viewBox="0 0 80 50" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
    {item === 'ingot' ? <path d="M9 38 18 24 31 12h29l12 17-16 9H9zm9-14h36l6-12m-6 12 2 14" /> : <>
      <ellipse cx="40" cy="12" rx="19" ry="6" /><path d="M21 12v27c0 8 38 8 38 0V12M21 20c0 8 38 8 38 0M21 30c0 8 38 8 38 0" />
      <ellipse cx="48" cy="11.5" rx="3" ry="1.6" />
    </>}
  </svg>
}

export default function RuleExample({ game }: { game: Game }) {
  return <aside className="rule-example" aria-label="Example">
    <h2>Example</h2>
    {game === 'orderbooks' ? <div className="trade-example">
      <div><span className="lot-art"><LotDrawing item="ingot" /></span><ArrowRight size={17} /><span>Buy ingot</span><strong>−$14</strong></div>
      <div><span className="lot-art"><LotDrawing item="barrel" /></span><ArrowRight size={17} /><span>Buy barrel</span><strong>−$10</strong></div>
      <div><span className="lot-art"><LotDrawing item="ingot" /><Plus size={12} /><LotDrawing item="barrel" /></span>
        <ArrowRight size={17} /><span>Sell bundle</span><strong>+$26</strong></div>
      <p><strong>+$2 profit</strong><span>Zero inventory</span></p>
    </div> : game === 'intervals' ? <div className="interval-example">
      <svg viewBox="0 0 310 110" role="img" aria-label="42 is inside both intervals">
        <path d="M12 76h286" className="example-axis" />
        <path d="M30 66V55h250v11M113 51V40h83v11" fill="none" stroke="currentColor" strokeWidth="1.7" />
        <path d="M130 35v52" className="example-marker" />
        <text x="30" y="100">30</text><text x="130" y="28">42</text><text x="280" y="100">60</text>
      </svg>
      <dl><div><dt>[30, 60]</dt><dd>30 ÷ 60 = 50%</dd></div><div><dt>[40, 50]</dt><dd>40 ÷ 50 = 80%</dd></div></dl>
    </div> : game === 'likelihood-list' ? <div className="rank-example">
      <p>Roll a fair six-sided die.</p>
      <ol>{[['Roll 1–4', '4/6'], ['Roll 1–3', '3/6'], ['Roll 1', '1/6']].map(([label, chance], i) =>
        <li key={label}><span>{i + 1}</span>{label}<strong><MathText value={chance} /></strong></li>)}</ol>
    </div> : sample[game] && <div className="sample-example">
      <GameMark game={game} /><strong><MathText value={sample[game][0]} /></strong><p>{sample[game][1]}</p>
    </div>}
  </aside>
}
