import MathText from './MathText.tsx'
import type { Visual } from '../engine/questions.ts'

const colors = ['--chart-teal', '--chart-rust', '--chart-violet', '--chart-green', '--chart-ochre'].map(color => 'var(' + color + ')')
const linePatterns = [undefined, '7 4', '2 4']
const pips = [
  [[1, 1]], [[0, 0], [2, 2]], [[0, 0], [1, 1], [2, 2]],
  [[0, 0], [2, 0], [0, 2], [2, 2]], [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]],
  [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]],
]

function Die({ value }: { value: number }) {
  return <svg viewBox="0 0 30 30" role="img" aria-label={'Die showing ' + value}>
    <rect x="1" y="1" width="28" height="28" rx="5" fill="#fff" stroke="#a8b8c0" />
    {pips[value - 1]?.map(([x, y]) => <circle key={x + '-' + y} cx={7 + x * 8} cy={7 + y * 8} r="2.1" fill="#15353e" />)}
  </svg>
}

function Plot({ visual }: { visual: Extract<Visual, { type: 'plot' }> }) {
  const all = visual.series.flatMap(series => series.points)
  let minX = Math.min(...all.map(p => p[0])), maxX = Math.max(...all.map(p => p[0]))
  let minY = Math.min(...all.map(p => p[1])), maxY = Math.max(...all.map(p => p[1]))
  if (minX === maxX) { minX--; maxX++ }
  if (minY === maxY) { minY--; maxY++ }
  const left = 58, right = 622, top = 24, bottom = 273
  const X = (x: number) => left + (x - minX) / (maxX - minX) * (right - left)
  const Y = (y: number) => bottom - (y - minY) / (maxY - minY) * (bottom - top)
  const label = (n: number) => String(Number(n.toPrecision(5)))
  return <>
    <div className="chart-scroll"><svg className="plot" viewBox="0 0 650 325" role="img" aria-label={visual.y + ' by ' + visual.x}>
      {[0, 0.25, 0.5, 0.75, 1].map(t => {
        const y = bottom - t * (bottom - top), x = left + t * (right - left)
        return <g key={t}>
          <line x1={left} x2={right} y1={y} y2={y} className="gridline" />
          <text x={left - 8} y={y + 4} textAnchor="end">{label(minY + t * (maxY - minY))}</text>
          <text x={x} y={bottom + 17} textAnchor="middle">{label(minX + t * (maxX - minX))}</text>
        </g>
      })}
      <path d={'M' + left + ' ' + top + 'V' + bottom + 'H' + right} className="axis" />
      {visual.series.map(({ label, points, scatter }, i) => scatter ?
        <g key={label} fill={colors[i % colors.length]}>{points.map(([x, y], j) => <circle key={j} cx={X(x)} cy={Y(y)} r="4" opacity=".78">
          <title>{label + ' · ' + x + ', ' + y}</title>
        </circle>)}</g> :
        <polyline key={label} points={points.map(([x, y]) => X(x) + ',' + Y(y)).join(' ')} fill="none" stroke={colors[i % colors.length]}
          strokeDasharray={linePatterns[i % linePatterns.length]} strokeWidth="2.5" />)}
      <text x={(left + right) / 2} y="314" textAnchor="middle">{visual.x}</text>
      <text x="13" y="146" transform="rotate(-90 13 146)" textAnchor="middle">{visual.y}</text>
    </svg></div>
    <div className="chart-legend">{visual.series.map((s, i) => <span key={s.label}><i className={s.scatter ? undefined : 'legend-line'} style={{ background: colors[i % colors.length] }} />{s.label}</span>)}</div>
    <details className="chart-data"><summary>View plot data</summary>
      {visual.series.map(s => <p key={s.label}><strong>{s.label}</strong> {s.points.map(([x, y]) => '(' + label(x) + ', ' + label(y) + ')').join(', ')}</p>)}
    </details>
  </>
}

function Route({ visual }: { visual: Extract<Visual, { type: 'path' }> }) {
  const minX = Math.min(...visual.points.map(p => p[0])), maxX = Math.max(...visual.points.map(p => p[0]))
  const maxY = Math.max(...visual.points.map(p => p[1]))
  const step = Math.min(13, 420 / Math.max(12, maxX - minX), 240 / Math.max(12, maxY))
  const width = (maxX - minX) * step + 90
  const X = (x: number) => 45 + (x - minX) * step
  const Y = (y: number) => 48 + y * step
  const points = visual.points.map(([x, y]) => X(x) + ',' + Y(y)).join(' ')
  const [endX, endY] = visual.points.at(-1)!
  return <svg className="route" viewBox={'0 0 ' + width + ' ' + (Y(maxY) + 22)} role="img" aria-label="Orthogonal route with a distance ruler">
    <path d={'M26 19v8m0 -4h' + step * 4 + 'm0 -4v8'} fill="none" stroke="currentColor" />
    <text x={34 + step * 4} y="27">{4 * visual.scale + ' ' + visual.unit}</text>
    <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    <circle cx={X(0)} cy={Y(0)} r="4" fill="#317b84" />
    <circle cx={X(endX)} cy={Y(endY)} r="4" fill="#a34b26" />
    <text x={X(0) + 6} y={Y(0) - 6}>Start</text><text x={X(endX) + 6} y={Y(endY) + 11}>End</text>
  </svg>
}

function Network({ visual }: { visual: Extract<Visual, { type: 'graph' }> }) {
  const points = visual.nodes.map((_, i) => {
    const a = 2 * Math.PI * i / visual.nodes.length - Math.PI / 2
    return [165 + 120 * Math.cos(a), 153 + 105 * Math.sin(a)]
  })
  return <>
    <svg className="network" viewBox="0 0 330 306" role="img" aria-label="Directed network of locations">
      <defs><marker id="arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
        <path d="M0 0L10 5L0 10Z" fill="#3b707e" />
      </marker></defs>
      {visual.edges.flatMap((nodes, i) => nodes.map(j => {
        const [x, y] = points[i], [a, b] = points[j], l = Math.hypot(a - x, b - y)
        const dx = (a - x) / l, dy = (b - y) / l
        return <path key={i + '-' + j} d={'M' + (x + dx * 17) + ' ' + (y + dy * 17) + 'Q' +
          ((x + a) / 2 - 18 * dy) + ' ' + ((y + b) / 2 + 18 * dx) + ' ' + (a - dx * 22) + ' ' + (b - dy * 22)}
          stroke="#3b707e" strokeWidth="1.7" fill="none" markerEnd="url(#arrow)" />
      }))}
      {visual.nodes.map((name, i) => <g key={name}><circle cx={points[i][0]} cy={points[i][1]} r="17" fill="#dbeef1" stroke="#3b707e" />
        <text x={points[i][0]} y={points[i][1] + 5} textAnchor="middle" fill="#143841">{name}</text></g>)}
    </svg>
    <details className="chart-data"><summary>View outgoing links</summary>
      {visual.edges.map((edges, i) => <p key={i}>{visual.nodes[i]} → {edges.map(j => visual.nodes[j]).join(', ')}</p>)}
    </details>
  </>
}

export default function VisualBoard({ visual }: { visual: Visual }) {
  return <div className={'visual visual-' + visual.type}>
    {visual.type === 'table' && <div className="table-scroll" tabIndex={0} aria-label="Question data table"><table>
      <thead><tr>{visual.headers.map((x, i) => <th key={i} scope="col">{x}</th>)}</tr></thead>
      <tbody>{visual.rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j}
        className={visual.highlight?.[0] === i && visual.highlight[1] === j ? 'highlight' : undefined}>
        {visual.highlight?.[0] === i && visual.highlight[1] === j && <span className="sr-only">Highlighted value </span>}<MathText value={cell} />
      </td>)}</tr>)}</tbody>
    </table></div>}
    {visual.type === 'plot' && <Plot visual={visual} />}
    {visual.type === 'graph' && <Network visual={visual} />}
    {visual.type === 'path' && <Route visual={visual} />}
    {visual.type === 'grid' && <div className={'visual-grid ' + visual.style} style={{ gridTemplateColumns: 'repeat(' + visual.columns + ', minmax(0, 1fr))' }}>
      {visual.cells.map((cell, i) => <div key={i} className="visual-cell" style={visual.offsets ? { transform: 'translate(' + visual.offsets[i][0] / 2 + 'px,' + visual.offsets[i][1] / 2 + 'px)' } : undefined}>
        {visual.style === 'dice' ? <Die value={Number(cell)} /> :
          visual.style === 'coins' ? <span className="coin" aria-label={cell === 'H' ? 'Heads' : 'Tails'}>{cell}</span> :
            visual.style === 'shapes' ? <span className={'shape shape-' + cell} role="img" aria-label={String(cell)} /> : <MathText value={cell} />}
      </div>)}
    </div>}
  </div>
}
