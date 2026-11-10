const notation = /((?:-?\d+|[a-zA-Z]+)\/[1-9]\d*|(?<=\S)[×÷=](?=\S))/g

export default function MathText({ value }: { value: string | number }) {
  return String(value).split(notation).map((part, i) => {
    if (i % 2 === 0) return part
    const [numerator, denominator] = part.split('/')
    return denominator ? <span className="math-fraction" role="math" aria-label={part} key={i}>
      <span aria-hidden="true">{numerator}</span><span className="sr-only" aria-hidden="true">/</span><span aria-hidden="true">{denominator}</span>
    </span> : <span className="math-operator" key={i}>{part}</span>
  })
}
