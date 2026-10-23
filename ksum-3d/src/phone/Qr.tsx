/*
 * A QR-looking placeholder drawn as SVG. It is deterministic from the text so
 * it stays still across renders, but it is not a scannable code: the demo must
 * never take a real payment.
 */
const N = 25

function hash(text: string) {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return h >>> 0
}

const inFinder = (x: number, y: number) =>
  (x < 8 && y < 8) || (x >= N - 8 && y < 8) || (x < 8 && y >= N - 8)

function Finder({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <rect x={x} y={y} width={7} height={7} fill="currentColor" />
      <rect x={x + 1} y={y + 1} width={5} height={5} fill="#fff" />
      <rect x={x + 2} y={y + 2} width={3} height={3} fill="currentColor" />
    </g>
  )
}

export function QrPlaceholder({ text, size = 168 }: { text: string; size?: number }) {
  let seed = hash(text)
  const cells: { x: number; y: number }[] = []
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      // xorshift so the pattern looks random but never changes for a text
      seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; seed >>>= 0
      if (!inFinder(x, y) && seed % 5 < 2) cells.push({ x, y })
    }
  }
  return (
    <svg className="ph-qr" viewBox={`-2 -2 ${N + 4} ${N + 4}`} width={size} height={size} role="img" aria-label="QR placeholder, not a real payment code">
      <rect x={-2} y={-2} width={N + 4} height={N + 4} fill="#fff" />
      {cells.map((c) => <rect key={`${c.x}-${c.y}`} x={c.x} y={c.y} width={1} height={1} fill="currentColor" />)}
      <Finder x={0} y={0} />
      <Finder x={N - 7} y={0} />
      <Finder x={0} y={N - 7} />
    </svg>
  )
}
