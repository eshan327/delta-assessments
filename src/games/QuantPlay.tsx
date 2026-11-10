import { ArrowDown, ArrowUp, GripVertical, Minus, Plus, RotateCcw } from 'lucide-react'
import { useRef } from 'react'
import { canSubmit, tradeTotals } from '../engine/questions.ts'
import type { Book, Draft, Question } from '../engine/questions.ts'
import { goodsNames } from '../engine/orderbooks.ts'
import type { Answer, AttemptAction } from '../engine/session.ts'
import VisualBoard from './Visual.tsx'

function Goods({ type }: { type: number }) {
  return <svg viewBox="0 0 72 64" aria-hidden="true">
    {type === 0 && <><path d="M9 41 20 22 50 16 64 32 54 47 17 53Z" fill="#688493" />
      <path d="M9 41 20 22 50 16 64 32 27 39Z" fill="#b6c8ce" /><path d="M9 41 27 39 64 32 54 47 17 53Z" fill="#879da7" />
      <path d="m23 26 24-5 9 9-30 6" fill="none" stroke="#dce7ea" strokeWidth="2" /></>}
    {type === 1 && <><path d="M17 18Q12 32 17 49Q36 62 55 49Q61 32 55 18Z" fill="#294148" /><ellipse cx="36" cy="18" rx="19" ry="8" fill="#638089" />
      <ellipse cx="36" cy="18" rx="14" ry="5" fill="#3c565d" /><path d="M15 29Q37 40 57 29M15 44Q37 55 57 44" fill="none" stroke="#789197" strokeWidth="4" />
      <path d="M24 25V47" stroke="#47656e" strokeWidth="4" /></>}
    {type === 2 && <><ellipse cx="36" cy="38" rx="23" ry="15" fill="#8e3c22" /><ellipse cx="36" cy="31" rx="23" ry="15" fill="#bd5e37" />
      <ellipse cx="36" cy="28" rx="23" ry="14" fill="#dd8759" /><ellipse cx="36" cy="28" rx="12" ry="6" fill="#f2d2b9" />
      <ellipse cx="36" cy="26" rx="18" ry="10" fill="none" stroke="#f2a676" strokeWidth="2" /><path d="M18 38Q37 50 56 38" fill="none" stroke="#f2a676" strokeWidth="2" /></>}
    {type === 3 && <><path d="M23 13 33 16 50 12 45 25Q63 39 53 52Q35 61 17 51Q11 40 27 24Z" fill="#ca9a55" />
      <path d="M28 26Q18 40 25 51Q36 54 49 49Q53 42 43 26Z" fill="#dfb778" />
      <path d="M26 25Q36 29 46 24" fill="none" stroke="#86653e" strokeWidth="3" /><path d="m28 42 4-3m4 7 6-4m-6 8 4-2" stroke="#9c784c" strokeWidth="2" /></>}
  </svg>
}

function OrderBoard({ question, positions, update, practice, locked }: { question: Book; positions: number[]; update: (x: number[]) => void; practice: boolean; locked: boolean }) {
  const totals = tradeTotals(question.cards, positions)
  const step = (i: number, amount: number) => update(positions.map((n, j) => j === i ? Math.max(-9999, Math.min(9999, n + amount)) : n))
  return <>
    <div className="order-grid">
      {question.cards.map((card, i) => {
        if (!card) return <div key={i} className="order-empty" aria-hidden="true" />
        const label = card.goods.flatMap((qty, j) => qty ? [qty + ' ' + goodsNames[j] + (qty === 1 ? '' : 's')] : []).join(', ')
        return <div className={'order-card ' + (positions[i] ? 'has-position' : '')} key={i}>
          <div className="order-art" role="img" aria-label={label + ', position ' + positions[i]}>
            <span className="position">{positions[i] > 0 ? '+' : ''}{positions[i]}</span>
            <div className="goods">{card.goods.flatMap((qty, j) => Array.from({ length: qty }, (_, k) => <Goods key={j + '-' + k} type={j} />))}</div>
          </div>
          <div className="quote-buttons">
            <button disabled={locked} onClick={() => step(i, -1)} aria-label={'Sell for $' + card.bid + ' · Lot ' + (i + 1) + ' · ' + label}>Sell for {'$'}{card.bid}</button>
            <button disabled={locked} onClick={() => step(i, 1)} aria-label={'Buy for $' + card.ask + ' · Lot ' + (i + 1) + ' · ' + label}>Buy for {'$'}{card.ask}</button>
          </div>
        </div>
      })}
    </div>
    {practice && <div className="practice-ledger">
      <span>Cash <strong>{totals.profit < 0 ? '−' : ''}{'$'}{Math.abs(totals.profit)}</strong></span>
      {totals.inventory.map((n, i) => <span key={i}>{goodsNames[i]} <strong>{n}</strong></span>)}
    </div>}
  </>
}

const displayPoints = (n: number) => new Intl.NumberFormat('en', { maximumFractionDigits: 4 }).format(n)

export function Solution({ q, answer }: { q: Question; answer: Answer }) {
  let response = 'Skipped'
  const draft = answer.draft
  if (draft?.kind === 'choice' && q.kind === 'choice') response = q.options.find(x => x.key === draft.value)?.label ?? draft.value
  if (draft?.kind === 'interval') response = '[' + draft.lower + ', ' + draft.upper + ']'
  if (draft?.kind === 'ranking' && q.kind === 'ranking') response = draft.order.map(id => q.options.find(x => x.key === id)?.label).join(' → ')
  if (draft?.kind === 'book' && q.kind === 'book') {
    const { inventory, profit } = tradeTotals(q.cards, draft.positions)
    response = 'Cash ' + (profit < 0 ? '−' : '') + '$' + Math.abs(profit) + ', inventory ' + inventory.join(', ')
  }
  return <div className={'solution solution-' + answer.state}>
    <p className="result-tag">{answer.state === 'correct' ? 'Correct' : answer.state === 'wrong' ? 'Incorrect' : 'Skipped'} · {displayPoints(answer.points)} {Math.abs(answer.points) === 1 ? 'point' : 'points'}</p>
    <p><strong>Your response</strong> {response}</p>
    {q.kind === 'choice' && <p><strong>Answer</strong> {q.options.find(x => x.key === q.truth)?.label}</p>}
    <ol>{q.explanation.map((line, i) => <li key={i}>{line}</li>)}</ol>
  </div>
}

export default function QuantPlay({ q, draft, answer, practice, act }: { q: Question; draft: Draft; answer?: Answer; practice: boolean; act: (a: AttemptAction) => void }) {
  const drag = useRef<string | null>(null)
  const rankingList = useRef<HTMLOListElement>(null)
  const locked = answer !== undefined
  const update = (next: Draft) => act({ type: 'draft', draft: next })
  const move = (order: string[], from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || to >= order.length) return
    const next = [...order]
    next.splice(to, 0, next.splice(from, 1)[0])
    update({ kind: 'ranking', order: next })
    if (!drag.current) window.requestAnimationFrame(() => {
      const row = rankingList.current?.children[to]
      row?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({ preventScroll: true })
    })
  }
  return <section className={'question question-' + q.kind} aria-label="Question">
    <h2>{q.prompt}</h2>
    {q.visual && <VisualBoard visual={q.visual} />}
    {q.kind === 'choice' && draft.kind === 'choice' && (q.typed ?
      <label className="typed-answer">Your answer<input autoComplete="off" value={draft.value} maxLength={64} placeholder="Integer, decimal, or fraction" disabled={locked}
        onChange={e => update({ kind: 'choice', value: e.target.value })}
        onKeyDown={e => { if (e.key === 'Enter' && canSubmit(q, draft)) act({ type: 'submit' }) }} /></label> :
      <div className="choices" role="group" aria-label="Answer choices">{q.options.map((o, i) => <button key={o.key} className="choice"
        type="button" disabled={locked} aria-pressed={o.key === draft.value} onClick={() => update({ kind: 'choice', value: o.key })}>
        <span>{String.fromCharCode(65 + i)}</span>{o.label}
      </button>)}</div>)}
    {q.kind === 'ranking' && draft.kind === 'ranking' && <div className="ranking">
      <p className="list-label">Most likely</p>
      <ol ref={rankingList}>{draft.order.map((id, i) => {
        const label = q.options.find(o => o.key === id)?.label
        return <li key={id} draggable={!locked}
          onDragStart={e => { drag.current = id; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', id) }}
          onDragEnd={() => { drag.current = null }}
          onDragOver={e => {
            if (locked || !e.dataTransfer.types.includes('text/plain')) return
            e.preventDefault()
            e.dataTransfer.dropEffect = 'move'
          }}
          onDrop={e => {
            e.preventDefault()
            const source = e.dataTransfer.getData('text/plain')
            if (!locked && drag.current === source) move(draft.order, draft.order.indexOf(source), i)
            drag.current = null
          }}>
          <GripVertical size={18} aria-hidden="true" /><span>{label}</span>
          <div className="rank-actions">
            <button className="icon-button" type="button" aria-label={'Move up · ' + label} disabled={locked || i === 0} onClick={() => move(draft.order, i, i - 1)}><ArrowUp size={18} /></button>
            <button className="icon-button" type="button" aria-label={'Move down · ' + label} disabled={locked || i === draft.order.length - 1}
              onClick={() => move(draft.order, i, i + 1)}><ArrowDown size={18} /></button>
          </div>
        </li>
      })}</ol>
      <p className="list-label">Least likely</p>
    </div>}
    {q.kind === 'book' && draft.kind === 'book' && <OrderBoard question={q} positions={draft.positions}
      update={positions => update({ kind: 'book', positions })} practice={practice} locked={locked} />}
    {locked && <Solution q={q} answer={answer} />}
    <div className="question-footer">
      {q.kind === 'interval' && draft.kind === 'interval' && <div className="bounds">
        {(['lower', 'upper'] as const).map(key => {
          const name = key === 'lower' ? 'Lower bound' : 'Upper bound'
          const value = draft[key]
          const change = (next: string) => { if (/^\d{0,16}$/.test(next)) update({ ...draft, [key]: next }) }
          const bump = (n: number) => change(String(Math.max(0, Math.min(q.max ?? Number.MAX_SAFE_INTEGER, Number(value) + n))))
          return <div key={key}><label htmlFor={key + '-bound'}>{name}</label>
            <div className="number-stepper">
              <button className="icon-button" aria-label={'Decrease ' + name.toLowerCase()} disabled={locked} onClick={() => bump(-1)}><Minus size={17} /></button>
              <input id={key + '-bound'} inputMode="numeric" value={value} placeholder="—" disabled={locked} onChange={e => change(e.target.value)} />
              <button className="icon-button" aria-label={'Increase ' + name.toLowerCase()} disabled={locked} onClick={() => bump(1)}><Plus size={17} /></button>
            </div>
          </div>
        })}
      </div>}
      <div className="actions">
        {locked ? <button className="primary" onClick={() => act({ type: 'next' })}>Next</button> : <>
          {q.kind === 'book' && draft.kind === 'book' && <button className="secondary" onClick={() => update({ kind: 'book', positions: draft.positions.map(() => 0) })}><RotateCcw size={16} /> Reset</button>}
          <button className="secondary" onClick={() => act({ type: 'skip' })}>Skip</button>
          <button className="primary" disabled={!canSubmit(q, draft)} onClick={() => act({ type: 'submit' })}>Submit</button>
        </>}
      </div>
    </div>
    {!locked && q.kind === 'interval' && !canSubmit(q, draft) && <p className="field-note">Enter two whole numbers in order{q.max ? ' from 0 to ' + q.max : ''}.</p>}
  </section>
}
