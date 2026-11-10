import {
  ArrowDownUp, BarChart3, Calculator, CircleDot, Flame, Keyboard, Layers3, Shapes, Target,
} from 'lucide-react'
import type { Game } from '../engine/session.ts'

const zapMarks = {
  skyscrapers: Layers3,
  balloon: CircleDot,
  'grill-master': Flame,
  'figure-it-out': Shapes,
  'number-box': Calculator,
  'code-compare': Keyboard,
  digit: BarChart3,
  'the-switch': ArrowDownUp,
  shapeshift: Target,
}

export function DeltaMark() {
  return <svg className="brand-mark" width="32" height="23" viewBox="0 0 34 24" fill="none" aria-hidden="true">
    <path d="M2 21 12 3l10 18H2Zm19 0 5-10 6 10H21Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
  </svg>
}

export default function GameMark({ game }: { game: Game | 'zap-n' }) {
  if (game in zapMarks) {
    const Icon = zapMarks[game as keyof typeof zapMarks]
    return <Icon className="game-mark" size={30} strokeWidth={1.5} aria-hidden="true" />
  }
  return <svg className="game-mark" viewBox="0 0 100 42" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
    {game === 'beat-the-odds' && <>
      <path d="M3 35h94M4 35c15-1 17-24 30-24s15 24 30 24" />
      <path d="M36 35c15-1 17-24 30-24s15 24 30 24M50 5v31" strokeDasharray="4 3" />
    </>}
    {game === 'numberlogic' && <>
      <path d="M24 7h-6v28h6m52-28h6v28h-6" />
      <text x="29" y="18" className="mark-type" textLength="42">7 4 9</text>
      <text x="29" y="31" className="mark-type" textLength="42">2 8 6</text>
    </>}
    {game === 'likelihood-list' && <>
      <path d="M30 9h51M30 21h51M30 33h51" />
      <text x="15" y="12" className="mark-type">1</text>
      <text x="15" y="24" className="mark-type">2</text>
      <text x="15" y="36" className="mark-type">3</text>
    </>}
    {game === 'intervals' && <>
      <path d="M7 30h86M27 29V13h5m41 16V13h-5" />
      <circle cx="27" cy="30" r="2" fill="currentColor" /><circle cx="73" cy="30" r="2" fill="currentColor" />
    </>}
    {game === 'orderbooks' && <>
      <path d="M37 5h26v13H37zm0 0 26 13M63 5 37 18M22 23h26v13H22zm0 0 26 13m0-13L22 36m30-13h26v13H52zm0 0 26 13m0-13L52 36" />
    </>}
    {game === 'zap-n' && <>
      <path d="M18 8h27v26H18zm37 0h27v26H55zM31.5 16v10M26 21h11" />
      <path d="M64 16h9v10h-9z" fill="currentColor" />
    </>}
    {game === 'classic-80-in-8' && <>
      <path d="M18 9h9v9h-9zm18 0h9v9h-9zm18 0h9v9h-9zm18 0h9v9h-9zM18 24h9v9h-9zm18 0h9v9h-9zm18 0h9v9h-9zm18 0h9v9h-9z" />
    </>}
  </svg>
}
