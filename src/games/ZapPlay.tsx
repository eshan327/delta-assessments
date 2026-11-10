import { ArrowLeft, ArrowRight, Flame, RotateCcw, Undo2 } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { sum } from '../engine/core.ts'
import { attributes, boxTiles, compatible, operators, towerBoard, zapDeadline } from '../engine/zap.ts'
import type { Round, Towers, ZapAction, ZapState } from '../engine/zap.ts'

const blockColors = ['teal', 'ochre', 'indigo', 'rose', 'sage']
const figureColors = ['#208390', '#bb563b', '#6853aa', '#d4a439']

function TowerRow({ board, source, choose }: { board: Towers; source?: number | null; choose?: (i: number) => void }) {
  return <div className="towers" style={{ gridTemplateColumns: 'repeat(' + board.length + ', 1fr)' }}>{board.map((tower, i) => {
    const stack = <><div className="tower-stack">{[...tower].reverse().map((block, j) => <span key={j} className={'block ' + blockColors[block]}>
      <span aria-hidden="true">{String.fromCharCode(65 + block)}</span>
    </span>)}</div><span className="tower-name">{i + 1}</span></>
    const label = 'Tower ' + (i + 1) + ', bottom to top: ' + (tower.map(b => blockColors[b] + ' ' + String.fromCharCode(65 + b)).join(', ') || 'empty')
    return choose ? <button type="button" key={i} className="tower" aria-label={label} aria-pressed={source === i} data-tower={i} onClick={() => choose(i)}>{stack}</button> :
      <div key={i} className="tower" role="img" aria-label={label}>{stack}</div>
  })}</div>
}

function Figure({ selection }: { selection: number[] }) {
  const [shape, color, pattern, border = 0, mark = 0, direction = 0] = selection
  const paths = ['M80 24a56 56 0 1 0 0 112 56 56 0 0 0 0-112', 'M29 29H131V131H29Z', 'M80 19 139 133H21Z', 'M80 17 143 80 80 143 17 80Z']
  const fill = figureColors[color]
  return <svg className="figure-art" viewBox="0 0 160 160" role="img" aria-label={selection.map((value, i) => attributes[i].values[value]).join(', ')}>
    <defs><pattern id="figure-pattern" width="14" height="14" patternUnits="userSpaceOnUse">
      <rect width="14" height="14" fill={fill} />
      {pattern === 1 && <path d="M-2 2 2-2m-2 14 14-14m-2 14 4-4" stroke="#f7f8f6" opacity=".65" strokeWidth="3" />}
      {pattern === 2 && <circle cx="5" cy="5" r="2.6" fill="#f7f8f6" opacity=".75" />}
      {pattern === 3 && <path d="M0 6H14M6 0V14" stroke="#f7f8f6" opacity=".75" strokeWidth="2" />}
    </pattern></defs>
    <g transform={'rotate(' + direction * 90 + ' 80 80)'}>
      <path d={paths[shape]} fill={pattern ? 'url(#figure-pattern)' : fill} stroke="#25414b" strokeWidth={border === 1 ? 7 : 3}
        strokeDasharray={border === 2 ? '8 5' : undefined} />
      {border === 3 && <path d={paths[shape]} fill="none" transform="translate(8 8) scale(.9)" stroke="#f7f8f6" strokeWidth="2" />}
      <path d="m77 31 3-4 3 4" fill="none" stroke="#fff" strokeWidth="2.5" />
      {mark === 1 && <path d="M67 80h26m-13-13v26" stroke="#fff" strokeWidth="4" />}
      {mark === 2 && <circle cx="80" cy="80" r="13" fill="none" stroke="#fff" strokeWidth="4" />}
      {mark === 3 && <path d="m80 64 5 11 12 1-9 8 3 12-11-6-11 6 3-12-9-8 12-1Z" fill="#fff" />}
    </g>
  </svg>
}

function RapidButtons({ names, available = true, act }: { names: [string, string]; available?: boolean; act: (a: ZapAction) => void }) {
  return <div className="rapid-buttons">
    <button className="secondary" disabled={!available} onClick={() => act({ type: 'answer', index: 0 })}><ArrowLeft size={19} />{names[0]}</button>
    <button className="secondary" disabled={!available} onClick={() => act({ type: 'answer', index: 1 })}>{names[1]}<ArrowRight size={19} /></button>
  </div>
}

export default function ZapPlay({ round, state, elapsed, practice, act }: {
  round: Round; state: ZapState; elapsed: number; practice: boolean; act: (a: ZapAction) => void
}) {
  const work = state.work, age = Math.max(0, elapsed - state.onset)
  const deadline = zapDeadline(round)
  const candidates = useMemo(() => practice && round.game === 'figure-it-out' && work.kind === 'figure' && work.guesses.length > 0 ?
    compatible(round.domains, work.guesses) : null, [practice, round, work])
  const tiles = round.game === 'number-box' && work.kind === 'box' ? boxTiles(round, work) : []
  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey || (event.target instanceof HTMLElement && event.target.matches('input,select,textarea'))) return
      if (round.game === 'code-compare' && /^[1-4]$/.test(event.key)) {
        event.preventDefault()
        act({ type: 'answer', index: Number(event.key) - 1 })
      }
      if (((round.game === 'shapeshift' && age >= round.delay) || round.game === 'the-switch') && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
        event.preventDefault()
        act({ type: 'answer', index: event.key === 'ArrowLeft' ? 0 : 1 })
      }
      if (round.game === 'digit' && work.kind === 'digit' && age >= round.exposure) {
        if (/^\d$/.test(event.key)) act({ type: 'digit', value: work.value + event.key })
        if (event.key === 'Backspace') { event.preventDefault(); act({ type: 'digit', value: work.value.slice(0, -1) }) }
      }
      if (round.game === 'skyscrapers' && /^[1-5]$/.test(event.key)) act({ type: 'tower', index: Number(event.key) - 1 })
    }
    window.addEventListener('keydown', keyDown)
    return () => window.removeEventListener('keydown', keyDown)
  }, [act, age, round, work])

  return <section className="question zap-question" aria-label="Game board">
    {Number.isFinite(deadline) && <div className="trial-meter" role="meter" aria-label="Trial time remaining" aria-valuemin={0} aria-valuemax={100}
      aria-valuenow={Math.round(Math.max(0, 1 - age / deadline) * 100)}><div style={{ width: Math.max(0, 1 - age / deadline) * 100 + '%' }} /></div>}
    {round.game === 'skyscrapers' && work.kind === 'towers' && <>
      <div className="tower-panels">
        <div><h3>Your towers</h3><TowerRow board={towerBoard(round, work)} source={work.source} choose={index => act({ type: 'tower', index })} /></div>
        <div><h3>Target</h3><TowerRow board={round.goal} /></div>
      </div>
      <div className="question-footer"><span>{work.moves.length} moves{practice ? ' · ' + round.optimal.length + ' optimal' : ''}</span><div className="actions">
        <button className="secondary" onClick={() => act({ type: 'undo' })} disabled={!work.moves.length}><Undo2 size={17} /> Undo</button>
        <button className="secondary" onClick={() => act({ type: 'reset' })}><RotateCcw size={17} /> Reset</button>
      </div></div>
    </>}
    {round.game === 'balloon' && work.kind === 'balloon' && <>
      <div className="balloon-stats">
        <span>Round <strong>{'$'}{work.pumps * round.reward}</strong></span>
        <span>Collected <strong>{'$'}{sum(state.entries.map(e => e.earned ?? 0))}</strong></span>
        <span>Per pump <strong>{'$'}{round.reward}</strong></span>
        {round.penalty > 0 && <span>Burst penalty <strong>−{'$'}{round.penalty}</strong></span>}
        {practice && <span>Burst range <strong>{round.minimum}–{round.maximum}</strong></span>}
      </div>
      <div className="balloon-stage"><svg viewBox="0 0 180 200" className="balloon-art" role="img" aria-label={'Balloon after ' + work.pumps + ' pumps'}
        style={{ transform: 'scale(' + (0.78 + work.pumps * 0.037) + ')' }}>
        <defs><radialGradient id="balloon-color" cx="31%" cy="24%" r="70%"><stop stopColor="#96e3dc" /><stop offset="1" stopColor="#1b7d88" /></radialGradient></defs>
        <path d="M90 151Q79 159 88 174T89 196" fill="none" stroke="#658895" strokeWidth="2.8" />
        <path d="M90 143 80 155Q90 160 100 155Z" fill="#277786" />
        <path d="M90 150C41 135 20 82 40 45 58 12 117 12 137 42 159 80 139 131 90 150Z" fill="url(#balloon-color)" />
        <path d="M58 50Q46 68 50 87" fill="none" stroke="#dbfbf7" opacity=".65" strokeWidth="6" strokeLinecap="round" />
      </svg></div>
      {practice && state.entries.at(-1)?.note && <p role="status">{state.entries.at(-1)?.note}</p>}
      <div className="actions"><button className="secondary" onClick={() => act({ type: 'collect' })}>Collect</button>
        <button className="primary" onClick={() => act({ type: 'pump' })}>Pump</button></div>
    </>}
    {round.game === 'grill-master' && work.kind === 'grill' && <>
      <div className="grill">{Array.from({ length: Math.max(1, ...round.items.map(x => x.lane + 1)) }, (_, lane) => {
        const i = round.items.findIndex((item, i) => item.lane === lane && !work.acted.includes(i) && item.spawn <= elapsed && item.leave > elapsed)
        const item = round.items[i], label = !item ? 'Waiting' : elapsed < item.ready ? 'Raw' : elapsed < item.burnt ? 'Cooked' : 'Burnt'
        const progress = !item ? 0 : (elapsed - item.spawn) / (item.leave - item.spawn) * 100
        return <button className={'grill-item ' + label.toLowerCase()} key={lane} disabled={!item} data-cook={i}
          aria-label={'Grill ' + (lane + 1) + ', ' + label} onClick={() => act({ type: 'grill', index: i })}>
          <svg viewBox="0 0 92 73" aria-hidden="true"><path d="M12 29Q12 12 35 11 55 9 74 25 90 39 69 53 45 67 27 58 11 49 12 29Z" fill="currentColor" />
            <path d="m27 24 16 24m-6-29 18 27m-5-29 15 24" stroke="#281f1b" strokeWidth="4" strokeLinecap="round" /></svg>
          <span>{label === 'Cooked' ? 'Cooked · Remove' : label}</span>
          <span className="cook-meter"><span style={{ left: !item ? 0 : (item.ready - item.spawn) / (item.leave - item.spawn) * 100 + '%',
            width: !item ? 0 : (item.burnt - item.ready) / (item.leave - item.spawn) * 100 + '%' }} />
            <i style={{ left: progress + '%' }} /></span>
        </button>
      })}</div>
      <p><Flame size={16} aria-hidden="true" /> {state.entries.filter(e => e.state === 'correct').length} cooked · {state.entries.filter(e => e.state === 'wrong').length} errors</p>
    </>}
    {round.game === 'figure-it-out' && work.kind === 'figure' && <>
      <div className="figure-builder"><div><Figure selection={work.selection} /></div><div className="attribute-grid">
        {round.domains.map((n, i) => <label key={i}>{attributes[i].name}<select value={work.selection[i]} onChange={e => act({ type: 'attribute', index: i, value: Number(e.target.value) })}>
          {attributes[i].values.slice(0, n).map((value, j) => <option key={value} value={j}>{value}</option>)}
        </select></label>)}
      </div></div>
      <div className="question-footer"><span>{work.guesses.length} guesses{candidates === null ? '' : ' · ' + candidates + ' possibilities'}</span>
        <button className="primary" disabled={work.guesses.some(g => g.guess.every((x, i) => x === work.selection[i]))} onClick={() => act({ type: 'guess' })}>Submit guess</button></div>
      {work.guesses.length > 0 && <ol className="guess-list">{work.guesses.map((g, i) => <li key={i}>{g.guess.map((x, j) => attributes[j].values[x]).join(' · ')} <strong>{g.matches} matching</strong></li>)}</ol>}
    </>}
    {round.game === 'number-box' && work.kind === 'box' && <>
      <h2>Target {round.target}</h2>
      <div className="tile-tray">{tiles.map(t => <button key={t.id} className="number-tile" data-tile={t.id} aria-pressed={work.selected.includes(t.id)}
        onClick={() => act({ type: 'tile', id: t.id })}><strong>{t.value}</strong>{t.label !== t.value && <small>{t.label}</small>}</button>)}</div>
      <div className="operators">{operators.map(op => <button key={op} className="secondary" disabled={work.selected.length !== 2 || (op === '÷' && tiles.find(t => t.id === work.selected[1])?.value === '0')}
        aria-label={'Operator ' + op} onClick={() => act({ type: 'operator', op })}>{op}</button>)}</div>
      <div className="question-footer"><div className="actions">
        <button className="secondary" onClick={() => act({ type: 'undo' })} disabled={!work.steps.length}>Undo</button>
        <button className="secondary" onClick={() => act({ type: 'reset' })}>Reset</button>
      </div><button className="primary" disabled={tiles.length !== 1} onClick={() => act({ type: 'submit-box' })}>Submit</button></div>
    </>}
    {round.game === 'code-compare' && <>
      <div className="code-reference" aria-label={'Reference ' + round.reference}>{round.reference}</div>
      <div className="code-choices">{round.options.map((text, i) => <button className="choice" key={text} onClick={() => act({ type: 'answer', index: i })}>
        <span>{i + 1}</span><code>{text}</code></button>)}</div>
    </>}
    {round.game === 'digit' && work.kind === 'digit' && <>
      <h2>{age < round.exposure ? 'Memorize' : 'Recall'}</h2>
      <p className="muted">Order: {round.rule}</p>
      {age < round.exposure ? <div className="digit-display" aria-label="Digits to remember">{round.digits}</div> : <div className="digit-entry">
        <label>Recalled sequence<input inputMode="numeric" autoComplete="off" value={work.value} placeholder={'·'.repeat(round.digits.length)}
          onChange={e => act({ type: 'digit', value: e.target.value.replace(/\D/g, '') })} onKeyDown={e => { if (e.key === 'Enter') act({ type: 'submit-digit' }) }} /></label>
        <div className="keypad">{'1234567890'.split('').map(n => <button className="secondary" key={n} onClick={() => act({ type: 'digit', value: work.value + n })}>{n}</button>)}
          <button className="secondary" onClick={() => act({ type: 'digit', value: work.value.slice(0, -1) })}>Delete</button>
          <button className="primary" disabled={work.value.length !== round.digits.length} onClick={() => act({ type: 'submit-digit' })}>Submit</button>
        </div></div>}
    </>}
    {round.game === 'the-switch' && <>
      <div className="switch-panels"><div className={round.rule === 'sum' ? 'active-stimulus' : ''}><p>Sum {round.rule === 'sum' ? '· Active' : ''}</p><strong>{round.a} + {round.b}</strong></div>
        <div className={round.rule === 'arrows' ? 'active-stimulus' : ''}><p>Arrows {round.rule === 'arrows' ? '· Active' : ''}</p><strong>{round.arrows.join(' / ')}</strong></div></div>
      <RapidButtons names={round.rule === 'sum' ? ['Even', 'Odd'] : ['Same', 'Different']} act={act} />
    </>}
    {round.game === 'shapeshift' && <>
      <div className="reaction-board">
        {age < round.delay ? <span className="fixation" aria-label="Wait for the shape">+</span> :
          <span className={'shape shape-' + round.shape} role="img" aria-label={round.shape} />}
      </div><RapidButtons names={['Square', 'Circle']} available={age >= round.delay} act={act} />
    </>}
    {practice && round.game !== 'grill-master' && <button className="quiet zap-skip" onClick={() => act({ type: 'next' })}>Skip round</button>}
  </section>
}
