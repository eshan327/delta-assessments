import { ArrowDown, ArrowUp, GripVertical, Minus, Plus, RotateCcw } from 'lucide-react'
import { useRef } from 'react'
import { canSubmit, tradeTotals } from '../engine/questions.ts'
import type { Book, Draft, Question } from '../engine/questions.ts'
import { goodsNames } from '../engine/orderbooks.ts'
import type { Answer, AttemptAction } from '../engine/session.ts'
import VisualBoard from './Visual.tsx'

function Goods({ type }: { type: number }) {
  return <svg viewBox="0 0 96 80" aria-hidden="true">
    {type === 0 && <g stroke="#5d6e6b" strokeWidth="1.1" strokeLinejoin="round">
      <path d="M11 51 25 28 64 19 83 42 72 59 23 68Z" fill="#839391" />
      <path d="M11 51 25 28 64 19 83 42 32 53Z" fill="#c5cfca" />
      <path d="M32 53 83 42 72 59 23 68Z" fill="#9aa9a5" />
      <path d="m27 33 34-8 12 14-36 8" fill="none" stroke="#eef1ea" strokeWidth="1.6" />
    </g>}
    {type === 1 && <g stroke="#263433" strokeWidth="1.3">
      <path d="M23 19H73L70 64C69 75 27 75 26 64Z" fill="#3b4847" />
      <path d="M31 22 33 66M61 23 59 67" stroke="#65716e" opacity=".7" />
      <ellipse cx="48" cy="19" rx="25" ry="9" fill="#75817c" />
      <ellipse cx="48" cy="19" rx="20" ry="6" fill="#4b5a57" />
      <ellipse cx="58" cy="18" rx="3.5" ry="1.8" fill="#a3aaa2" />
      <path d="M24 33C27 43 70 43 72 33M25 51C28 61 69 61 71 51M26 63C29 73 68 73 70 63"
        fill="none" stroke="#89928a" strokeWidth="2.6" />
    </g>}
    {type === 2 && <g stroke="#8b4a32" strokeWidth="1.15">
      <path d="M12 40C12 16 84 16 84 40v11C84 75 12 75 12 51Z" fill="#ad6548" />
      <path d="M12 40a36 19 0 1 0 72 0 36 19 0 1 0-72 0m17 0a19 9 0 1 1 38 0 19 9 0 1 1-38 0"
        fill="#d98e63" fillRule="evenodd" />
      <ellipse cx="48" cy="40" rx="29" ry="15" fill="none" stroke="#f4bb91" />
      <ellipse cx="48" cy="40" rx="24" ry="12" fill="none" stroke="#a55b3d" />
      <path d="M13 47C18 68 77 68 83 47M16 55C25 73 71 73 80 55" fill="none" stroke="#e6a477" />
      <path d="M22 52 29 55l-1 12-7-4zM70 52l6-4v12l-6 4z" fill="#b0aaa0" />
    </g>}
    {type === 3 && <g stroke="#8c653f" strokeWidth="1.15" strokeLinejoin="round">
      <path d="M26 12 40 16 48 11 56 16 70 12 59 30Q77 47 77 59Q78 71 49 71Q19 71 19 59Q19 47 37 30Z" fill="#c89f66" />
      <path d="M39 31Q24 48 26 59Q28 66 46 68Q66 68 71 61Q70 48 57 30Z" fill="#e0bc82" stroke="none" />
      <path d="M36 29q12 5 24 0m-16 2-5 11m14-12 7 9m-27 20 7 4m9-2 7-3" fill="none" strokeWidth="2" strokeLinecap="round" />
    </g>}
  </svg>
}

function OrderBoard({ question, positions, update, practice, locked }: { question: Book; positions: number[]; update: (x: number[]) => void; practice: boolean; locked: boolean }) {
  const totals = tradeTotals(question.cards, positions)
  const step = (i: number, amount: number) => update(positions.map((n, j) => j === i ? Math.max(-9999, Math.min(9999, n + amount)) : n))
  return <>
    <div className="order-grid">
      {question.cards.map((card, i) => {
        if (!card) return <div key={i} className="order-empty" aria-hidden="true" />
        const quantity = card.goods.reduce((total, count) => total + count, 0)
        const label = card.goods.flatMap((qty, j) => qty ? [qty + ' ' + goodsNames[j] + (qty === 1 ? '' : 's')] : []).join(', ')
        return <div className={'order-card ' + (positions[i] ? 'has-position' : '')} key={i}>
          <div className="order-art" role="img" aria-label={label + ', position ' + positions[i]}>
            <span className="lot-number" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
            <span className="position">{positions[i] > 0 ? '+' : ''}{positions[i]}</span>
            <div className="goods" data-size={quantity > 3 ? 'large' : quantity > 1 ? 'bundle' : 'single'}>{card.goods.flatMap((qty, j) => Array.from({ length: qty }, (_, k) => <Goods key={j + '-' + k} type={j} />))}</div>
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
  const submittable = canSubmit(q, draft)
  const invalidBounds = !locked && q.kind === 'interval' && draft.kind === 'interval' && draft.lower !== '' && draft.upper !== '' && !submittable
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
    {q.kind !== 'book' && <h2>{q.prompt}</h2>}
    {q.visual && <VisualBoard visual={q.visual} />}
    {q.kind === 'choice' && draft.kind === 'choice' && (q.typed ?
      <label className="typed-answer">Your answer<input autoComplete="off" value={draft.value} maxLength={64} disabled={locked}
        onChange={e => update({ kind: 'choice', value: e.target.value })}
        onKeyDown={e => { if (e.key === 'Enter' && submittable) act({ type: 'submit' }) }} /></label> :
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
              <input id={key + '-bound'} inputMode="numeric" value={value} placeholder="—" disabled={locked}
                aria-invalid={invalidBounds} aria-describedby={invalidBounds ? "bound-error" : undefined} onChange={e => change(e.target.value)} />
              <button className="icon-button" aria-label={'Increase ' + name.toLowerCase()} disabled={locked} onClick={() => bump(1)}><Plus size={17} /></button>
            </div>
          </div>
        })}
      </div>}
      <div className="actions">
        {locked ? <button className="primary" onClick={() => act({ type: 'next' })}>Next</button> : <>
          {q.kind === 'book' && draft.kind === 'book' && <button className="secondary" onClick={() => update({ kind: 'book', positions: draft.positions.map(() => 0) })}><RotateCcw size={16} /> Reset</button>}
          <button className="secondary" onClick={() => act({ type: 'skip' })}>Skip</button>
          <button className="primary" disabled={!submittable} onClick={() => act({ type: 'submit' })}>Submit</button>
        </>}
      </div>
    </div>
    {invalidBounds && draft.kind === 'interval' && <p id="bound-error" className="bound-error">
      {Number(draft.lower) > Number(draft.upper) ? 'Upper bound is below the lower bound.' : 'Bounds are outside the allowed range.'}
    </p>}
  </section>
}
