import type { Mood } from '../engine/types'
import { MOTTLE } from './textures'

// Judge Jack O'Lantern, drawn in a 300×270 box. Rendered as a <g> so the
// courtroom scene can place him behind the bench.

const GLOW: Record<Mood, [string, string]> = {
  // [hot centre, edge]
  neutral: ['#FFF1B8', '#FFB347'],
  suspicious: ['#FFF4C2', '#F2B23C'],
  furious: ['#FFD0A0', '#FF5A28'],
  shocked: ['#FFFBE0', '#FFD066'],
  smug: ['#FFEFB0', '#FFA43A'],
  laughing: ['#FFF6CC', '#FFBE4D'],
}

/** Carved openings for each expression. Drawn twice: once as cut flesh, once as light. */
function faceShapes(mood: Mood) {
  switch (mood) {
    case 'suspicious':
      return [
        'M88 122 L140 112 L136 130 L94 132 Z',
        'M164 104 L212 124 L184 140 Z',
        'M102 182 L198 172 L192 190 L176 184 L160 194 L144 186 L128 194 L108 190 Z',
      ]
    case 'furious':
      return [
        'M84 102 L140 126 L102 142 Z',
        'M216 102 L160 126 L198 142 Z',
        'M94 200 L110 170 L128 188 L150 166 L172 188 L190 170 L206 200 L182 190 L150 210 L118 190 Z',
      ]
    case 'shocked':
      return [
        'M114 96 a18 22 0 1 0 0.1 0 Z',
        'M186 96 a18 22 0 1 0 0.1 0 Z',
        'M150 162 a20 25 0 1 0 0.1 0 Z',
      ]
    case 'smug':
      return [
        'M90 124 Q114 106 138 124 Q114 134 90 124 Z',
        'M162 124 Q186 106 210 124 Q186 134 162 124 Z',
        'M106 176 Q160 200 202 164 L196 182 Q160 208 110 186 Z',
      ]
    case 'laughing':
      return [
        'M90 128 Q114 96 138 128 L128 128 Q114 112 100 128 Z',
        'M162 128 Q186 96 210 128 L200 128 Q186 112 172 128 Z',
        'M94 164 L206 164 Q198 218 150 218 Q102 218 94 164 Z',
      ]
    default:
      return [
        'M94 134 L116 98 L138 134 Z',
        'M162 134 L184 98 L206 134 Z',
        'M98 174 L116 186 L132 174 L150 188 L168 174 L184 186 L202 174 L194 196 L150 204 L106 196 Z',
      ]
  }
}

const LOBES = [
  { cx: 72, rx: 64, ry: 88, shade: 'lobeDark' },
  { cx: 228, rx: 64, ry: 88, shade: 'lobeDark' },
  { cx: 108, rx: 66, ry: 100, shade: 'lobeMid' },
  { cx: 192, rx: 66, ry: 100, shade: 'lobeMid' },
  { cx: 150, rx: 62, ry: 106, shade: 'lobeLight' },
]

export function JudgeFigure({ mood }: { mood: Mood }) {
  const [hot, edge] = GLOW[mood]
  const shapes = faceShapes(mood)
  return (
    <g className={`judge judge--${mood}`}>
      <defs>
        <radialGradient id="lobeLight" cx="42%" cy="34%" r="70%">
          <stop offset="0" stopColor="#F9A85A" />
          <stop offset="0.55" stopColor="#E3742B" />
          <stop offset="1" stopColor="#9C3F17" />
        </radialGradient>
        <radialGradient id="lobeMid" cx="45%" cy="34%" r="72%">
          <stop offset="0" stopColor="#EE9346" />
          <stop offset="0.6" stopColor="#D2641F" />
          <stop offset="1" stopColor="#8A3512" />
        </radialGradient>
        <radialGradient id="lobeDark" cx="50%" cy="36%" r="74%">
          <stop offset="0" stopColor="#DA7B33" />
          <stop offset="0.6" stopColor="#B9531A" />
          <stop offset="1" stopColor="#6E2A0F" />
        </radialGradient>
        <radialGradient id="faceLight" cx="50%" cy="55%" r="60%">
          <stop offset="0" stopColor={hot} />
          <stop offset="1" stopColor={edge} />
        </radialGradient>
        <radialGradient id="judgeHalo" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor={edge} stopOpacity="0.35" />
          <stop offset="1" stopColor={edge} stopOpacity="0" />
        </radialGradient>
        <linearGradient id="stem" x1="0" x2="1">
          <stop offset="0" stopColor="#3F4A1E" />
          <stop offset="0.45" stopColor="#7A8040" />
          <stop offset="1" stopColor="#3A3418" />
        </linearGradient>
        <radialGradient id="curl" cx="38%" cy="32%" r="70%">
          <stop offset="0" stopColor="#FFFDF6" />
          <stop offset="0.6" stopColor="#E9E0CC" />
          <stop offset="1" stopColor="#B7A889" />
        </radialGradient>
        <pattern id="skin" patternUnits="userSpaceOnUse" width="300" height="300">
          <image href={MOTTLE} width="300" height="300" />
        </pattern>
        <clipPath id="pumpkinClip">
          {LOBES.map((l, i) => (
            <ellipse key={i} cx={l.cx} cy="152" rx={l.rx} ry={l.ry} />
          ))}
        </clipPath>
        <filter id="faceBloom" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
      </defs>

      {/* candlelight spilling onto the curtain */}
      <ellipse className="judge__halo" cx="150" cy="150" rx="190" ry="150" fill="url(#judgeHalo)" />

      {/* side rolls of the wig hang behind the pumpkin */}
      <g fill="url(#curl)" stroke="#9C8D70" strokeWidth="0.8">
        {[0, 1, 2, 3].map((i) => (
          <circle key={`l${i}`} cx={46 - i * 3} cy={96 + i * 26} r="17" />
        ))}
        {[0, 1, 2, 3].map((i) => (
          <circle key={`r${i}`} cx={254 + i * 3} cy={96 + i * 26} r="17" />
        ))}
      </g>

      {/* body */}
      <g className="judge__body">
        {LOBES.map((l, i) => (
          <ellipse key={i} cx={l.cx} cy="152" rx={l.rx} ry={l.ry} fill={`url(#${l.shade})`} stroke="#6E2A0F" strokeOpacity="0.45" strokeWidth="1.5" />
        ))}
        <g clipPath="url(#pumpkinClip)">
          <rect x="0" y="40" width="300" height="230" fill="url(#skin)" opacity="0.35" style={{ mixBlendMode: 'multiply' }} />
          {/* sheen and the shadow side */}
          <ellipse cx="128" cy="92" rx="34" ry="18" fill="#FFE2B8" opacity="0.28" transform="rotate(-18 128 92)" />
          <ellipse cx="150" cy="268" rx="160" ry="44" fill="#3A1406" opacity="0.45" />
        </g>
        {/* stem in its dimple */}
        <ellipse cx="152" cy="52" rx="20" ry="6" fill="#6E2A0F" opacity="0.7" />
        <path d="M142 54 Q138 30 150 14 Q158 8 166 12 L163 19 Q155 18 155 32 Q157 44 162 54 Z" fill="url(#stem)" />
        <path d="M147 50 Q145 32 152 20 M155 52 Q153 36 158 24" stroke="#2B2A12" strokeWidth="1" fill="none" opacity="0.6" />
      </g>

      {/* barrister's wig: a cap of curls sitting on the crown, stem poking through */}
      <g fill="url(#curl)" stroke="#9C8D70" strokeWidth="0.8">
        {[66, 90, 114, 138, 162, 186, 210, 234].map((x, i) => (
          <circle key={`a${i}`} cx={x} cy={i === 0 || i === 7 ? 84 : i === 1 || i === 6 ? 70 : 62} r="15" />
        ))}
        {[92, 116, 140, 164, 188, 212].map((x, i) => (
          <circle key={`b${i}`} cx={x} cy={i === 0 || i === 5 ? 54 : 44} r="14" />
        ))}
        {[128, 152, 176].map((x, i) => (
          <circle key={`c${i}`} cx={x} cy="34" r="12" />
        ))}
      </g>
      <path d="M150 30 Q148 14 156 4 L163 8 Q157 14 158 30 Z" fill="url(#stem)" />

      {/* carved face: cut flesh offset below, light on top, bloom over it */}
      <g className="judge__face">
        <g fill="#F5C77A" transform="translate(2 3)">
          {shapes.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </g>
        <g fill="#5A1E06">
          {shapes.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </g>
        <g className="judge__light" fill="url(#faceLight)">
          {shapes.map((d, i) => (
            <path key={i} d={d} transform="translate(-1.5 -1.5) scale(1)" />
          ))}
        </g>
        <g className="judge__bloom" fill={edge} filter="url(#faceBloom)" opacity="0.55">
          {shapes.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </g>
      </g>
      {mood === 'furious' && (
        <g stroke="#4A1806" strokeWidth="6" strokeLinecap="round">
          <path d="M80 92 L136 110" />
          <path d="M220 92 L164 110" />
        </g>
      )}
    </g>
  )
}
