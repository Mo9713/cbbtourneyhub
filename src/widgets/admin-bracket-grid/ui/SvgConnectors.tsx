// src/widgets/admin-bracket-grid/ui/SvgConnectors.tsx

import type { ConnectorLine } from '../../../shared/lib/bracketMath'

interface Props {
  lines: ConnectorLine[]
  dims:  { w: number; h: number }
}

export default function SvgConnectors({ lines, dims }: Props) {
  return (
    <svg
      className="absolute inset-0 pointer-events-none z-0"
      style={{ width: dims.w ? `${dims.w}px` : '100%', height: dims.h ? `${dims.h}px` : '100%' }}
    >
      {lines.map((l, i) => {
        // Option A Fix: Convert straight lines to Smooth Bezier Curves
        const curveOffset = Math.max(Math.abs(l.x2 - l.x1) * 0.5, 40)
        const pathData = `M ${l.x1} ${l.y1} C ${l.x1 + curveOffset} ${l.y1}, ${l.x2 - curveOffset} ${l.y2}, ${l.x2} ${l.y2}`

        return (
          <path
            key={i}
            d={pathData}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-amber-500/30 dark:text-amber-500/40"
            strokeLinecap="round"
          />
        )
      })}
    </svg>
  )
}