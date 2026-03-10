// src/shared/ui/SvgConnectors.tsx
//
// User-facing bracket connector lines — orthogonal right-angle "elbow" style.
// Path: exit right → horizontal to column midpoint → vertical step → arrive left.
//

// This is the *shared* connector renderer for the read-only BracketView.
// The Admin view keeps its own copy at:
//   src/features/bracket/ui/AdminBracketGrid/SvgConnectors.tsx  (bezier curves)

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
        // Orthogonal elbow connector (right-angle, like the screenshot):
        //   M x1 y1   — start at output anchor (right edge of source card)
        //   H midX    — run horizontally to the column midpoint
        //   V y2      — drop or rise vertically to the destination row
        //   H x2      — run horizontally into the input anchor (left edge of dest card)
        const midX = (line.x1 + line.x2) / 2
        const d    = `M ${line.x1} ${line.y1} H ${midX} V ${line.y2} H ${line.x2}`

        return (
          <path
            key={`${line.gameId}-${i}`}
            d={d}
            stroke="#10b981"
            strokeWidth="3"
            fill="none"
            strokeOpacity="0.75"     // Bumped opacity up slightly so it pops
            strokeLinecap="square"
            strokeLinejoin="miter"
          />
        )
      })}
    </svg>
  )
}