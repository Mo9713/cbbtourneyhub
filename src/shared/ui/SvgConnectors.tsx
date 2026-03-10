// src/shared/ui/SvgConnectors.tsx
//
// User-facing bracket connector lines — orthogonal right-angle "elbow" style.
// Matches the sharp, aggressive corners of the broadcast-block GameCard.
//
// Path shape (H → V → H):
//   M x1 y1  — start at output anchor (right edge of source card)
//   H midX   — run right to the column midpoint gap
//   V y2     — vertical step to destination row
//   H x2     — run right into the input anchor (left edge of dest card)
//
// ⚠️  ARCHITECTURAL NOTE
// This is the *shared* renderer used only by the read-only BracketView.
// AdminBracketGrid keeps its own SvgConnectors (bezier curves) — untouched.

import type { ConnectorLine } from '../lib/bracketMath'

interface Props {
  lines: ConnectorLine[]
  dims:  { w: number; h: number }
}

export default function SvgConnectors({ lines, dims }: Props) {
  if (!lines.length) return null

  return (
    <svg
      style={{
        position:      'absolute',
        top:           0,
        left:          0,
        width:         dims.w || '100%',
        height:        dims.h || '100%',
        pointerEvents: 'none',
        zIndex:        1,
        overflow:      'visible',
      }}
    >
      {lines.map((line, i) => {
        const midX = (line.x1 + line.x2) / 2
        const d    = `M ${line.x1} ${line.y1} H ${midX} V ${line.y2} H ${line.x2}`

        return (
          <path
            key={`${line.gameId}-${i}`}
            d={d}
            stroke="#10b981"        /* emerald-500 — high contrast against dark bg */
            strokeWidth="2"
            fill="none"
            strokeOpacity="0.7"
            strokeLinecap="square"  /* crisp 90° corners, no rounded caps */
            strokeLinejoin="miter"
          />
        )
      })}
    </svg>
  )
}