// src/features/tournament/AdminBuilderView/AdminSvgConnectors.tsx
// Pure renderer: receives pre-computed line data and draws it.
// All DOM measurement and slot resolution live in AdminBracketGrid.
import type { SVGLine } from '../../../shared/types'

interface Props {
  lines: SVGLine[]
  dims:  { w: number; h: number }
}

export default function AdminSvgConnectors({ lines, dims }: Props) {
  return (
    <svg
      style={{
        position:      'absolute',
        top: 0, left:  0,
        width:         dims.w || '100%',
        height:        dims.h || '100%',
        pointerEvents: 'none',
        zIndex:        0,
      }}
      className="overflow-visible"
    >
      <defs>
        {/* Soft glow so connectors don't visually compete with card borders */}
        <filter id="connector-glow">
          <feGaussianBlur stdDeviation="2" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {lines.map((line, i) => {
        // Cubic bezier: exit horizontally from out-dot, arrive horizontally at in-dot
        const cx = (line.x1 + line.x2) / 2
        return (
          <path
            key={`${line.gameId}-${i}`}
            d={`M ${line.x1} ${line.y1} C ${cx} ${line.y1}, ${cx} ${line.y2}, ${line.x2} ${line.y2}`}
            // amber = team1 slot (in1), sky = team2 slot (in2)
            stroke={line.fromSlot === 'in1' ? '#f59e0b' : '#38bdf8'}
            strokeWidth="1.5"
            fill="none"
            strokeOpacity="0.55"
            strokeDasharray="5 3"
            filter="url(#connector-glow)"
          />
        )
      })}
    </svg>
  )
}




