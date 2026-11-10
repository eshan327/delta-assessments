import type { Game } from '../engine/session.ts'

const marks: Record<Game, React.ReactNode> = {
  'beat-the-odds': <><rect x="7" y="7" width="26" height="26" rx="6" className="mark-fill" /><path d="M13 26 26 13" /><circle cx="14" cy="14" r="2" /><circle cx="26" cy="26" r="2" /></>,
  numberlogic: <><path d="M11 7H7v26h4m18-26h4v26h-4" /><path d="M15 14h10m-10 6h10m-10 6h4" /><circle cx="25" cy="26" r="2" className="mark-fill" /></>,
  'likelihood-list': <><path d="M11 11h20M11 20h15m-15 9h9" strokeWidth="3" /><path d="M34 19v11m-4-4 4 4 4-4" /></>,
  intervals: <><path d="M5 28h30m-23 3v-6m16 6v-6M15 12h-3v10h3m10-10h3v10h-3" /><path d="M17 17h6" strokeWidth="3" /><circle cx="20" cy="28" r="2.5" className="mark-fill" /></>,
  orderbooks: <><path d="M20 7v26" /><path d="M6 11h10v5H6zm18 0h7v5h-7zM9 23h7v5H9zm15 0h10v5H24z" className="mark-fill" /></>,
  'classic-80-in-8': <><circle cx="20" cy="22" r="12" className="mark-fill" /><path d="M17 6h6m-3 4V6m0 9v7l5-2m4-7 3-3" /></>,
  skyscrapers: <><rect x="7" y="22" width="8" height="10" rx="1" /><rect x="16" y="8" width="8" height="24" rx="1" className="mark-fill" /><rect x="25" y="16" width="8" height="16" rx="1" /><path d="M16 16h8m-8 8h8m1 0h8" /></>,
  balloon: <><path d="M20 28C6 23 8 7 20 7s14 16 0 21Z" className="mark-fill" /><path d="m20 28-3 4h6zm0 4c-3 2 2 3 0 5M13 17c0-3 2-5 4-6" /></>,
  'grill-master': <><path d="M8 17h24a12 12 0 0 1-24 0Z" className="mark-fill" /><path d="m15 27-4 8m14-8 4 8M15 12c-3-3 3-3 0-6m10 6c-3-3 3-3 0-6" /></>,
  'figure-it-out': <><circle cx="14" cy="14" r="7" className="mark-fill" /><path d="m26 13 9 17H17zM10 26h6m-3-3v6" /></>,
  'number-box': <><rect x="7" y="7" width="26" height="26" rx="4" className="mark-fill" /><path d="M20 7v26M7 20h26m-22-6h6m-3-3v6m11-3h4M11 24l6 6m0-6-6 6m14-4h4m-4 4h4" /></>,
  'code-compare': <><rect x="6" y="9" width="28" height="22" rx="4" className="mark-fill" /><path d="m15 15-5 5 5 5m10-10 5 5-5 5m-3-12-4 14" /></>,
  digit: <><path d="M7 10h26v20H7z" className="mark-fill" /><path d="m12 17 2-2v10m6-8c0-3 5-3 5 0 0 2-5 4-5 8h6" /></>,
  'the-switch': <><path d="M7 12h7c5 0 7 16 12 16h7m-4-4 4 4-4 4M7 28h7c5 0 7-16 12-16h7m-4-4 4 4-4 4" /></>,
  shapeshift: <><rect x="7" y="9" width="16" height="16" rx="2" className="mark-fill" /><circle cx="25" cy="24" r="9" /></>,
}

export function BrandMark() {
  return <svg className="brand-mark" width="56" height="44" viewBox="0 0 56 44" fill="none" aria-hidden="true">
    <path d="M3 35 19 8l16 27H3Z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
    <path d="m28 35 12-20 13 20H28Z" fill="currentColor" />
  </svg>
}

export default function GameMark({ game }: { game: Game }) {
  return <svg className="game-mark" viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{marks[game]}</svg>
}
