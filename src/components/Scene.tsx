import { memo } from 'react'
import type { Mood, Portrait as PortraitKind } from '../engine/types'
import { PortraitArt } from './Art'
import { JudgeFigure } from './Judge'
import { MOTTLE, WOOD_H, WOOD_V } from './textures'

// The courtroom, in three stacked layers that share one 1200×600 coordinate space:
//   back  (static: panelled wall, curtain, seal, sconces)  — painted once
//   judge (animated candle face)                           — its own compositing layer
//   front (bench, props, witness box, lectern, vignette)
// Every layer uses preserveAspectRatio "xMidYMax slice", so narrow screens crop
// the sides and keep the judge large.

const VB = '0 0 1200 600'
const PAR = 'xMidYMax slice'

export type Speaker = 'judge' | 'clerk' | 'prosecutor' | 'witness' | 'defendant' | null

interface Props {
  mood: Mood
  speaker: Speaker
  witness: PortraitKind | null
  patience: number
  cred: number
  pros: number
  gavelKey: number
  plaque?: string
}

const Back = memo(function Back() {
  const planks = Array.from({ length: 13 }, (_, i) => i * 96)
  const panels = [0, 1, 2, 3, 4, 5].map((i) => 12 + i * 200)
  return (
    <svg viewBox={VB} preserveAspectRatio={PAR} className="stage__layer" aria-hidden="true">
      <defs>
        <pattern id="woodV" patternUnits="userSpaceOnUse" width="400" height="400">
          <image href={WOOD_V} width="400" height="400" />
        </pattern>
        <pattern id="woodH" patternUnits="userSpaceOnUse" width="400" height="400">
          <image href={WOOD_H} width="400" height="400" />
        </pattern>
        <pattern id="velvetNoise" patternUnits="userSpaceOnUse" width="300" height="300">
          <image href={MOTTLE} width="300" height="300" />
        </pattern>
        <linearGradient id="folds" x1="0" x2="0.1" spreadMethod="reflect">
          <stop offset="0" stopColor="#2E0F24" />
          <stop offset="0.55" stopColor="#5B2348" />
          <stop offset="1" stopColor="#6C2B55" />
        </linearGradient>
        <linearGradient id="curtainShade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#000" stopOpacity="0.45" />
          <stop offset="0.35" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.35" />
        </linearGradient>
        <linearGradient id="brass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#E9CB82" />
          <stop offset="0.5" stopColor="#B08A3E" />
          <stop offset="1" stopColor="#6F5222" />
        </linearGradient>
        <radialGradient id="sconceGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#FFC870" stopOpacity="0.38" />
          <stop offset="0.4" stopColor="#FF9A3D" stopOpacity="0.12" />
          <stop offset="1" stopColor="#FF9A3D" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="sealFace" cx="40%" cy="35%" r="75%">
          <stop offset="0" stopColor="#4B2A2E" />
          <stop offset="1" stopColor="#1E1014" />
        </radialGradient>
        <path id="sealRing" d="M600 112 m-49 0 a49 49 0 1 1 98 0 a49 49 0 1 1 -98 0" />
      </defs>

      {/* panelled wall */}
      <rect width="1200" height="600" fill="#3A1F22" />
      <rect width="1200" height="600" fill="url(#woodV)" />
      {planks.map((x) => (
        <g key={x}>
          <line x1={x} y1="0" x2={x} y2="600" stroke="#160A0C" strokeWidth="3" opacity="0.7" />
          <line x1={x + 3} y1="0" x2={x + 3} y2="600" stroke="#FFD9B0" strokeWidth="1" opacity="0.06" />
        </g>
      ))}
      {/* cornice */}
      <rect width="1200" height="34" fill="#1F0F12" />
      <rect y="34" width="1200" height="4" fill="url(#brass)" opacity="0.7" />
      {/* wainscot */}
      <rect y="318" width="1200" height="282" fill="#2B1517" />
      <rect y="318" width="1200" height="282" fill="url(#woodH)" />
      <rect y="310" width="1200" height="14" fill="#4E2A26" />
      <rect y="310" width="1200" height="2" fill="#FFD9B0" opacity="0.15" />
      <rect y="322" width="1200" height="3" fill="#0E0607" opacity="0.6" />
      {panels.map((x) => (
        <g key={x}>
          <rect x={x} y="346" width="176" height="190" fill="#000" opacity="0.18" />
          <path d={`M${x} 536 V346 H${x + 176}`} stroke="#FFD9B0" strokeOpacity="0.08" strokeWidth="2" fill="none" />
          <path d={`M${x + 176} 346 V536 H${x}`} stroke="#000" strokeOpacity="0.45" strokeWidth="2" fill="none" />
        </g>
      ))}

      {/* sconces */}
      {[240, 960].map((x) => (
        <g key={x}>
          <circle cx={x} cy="182" r="170" fill="url(#sconceGlow)" />
          <rect x={x - 10} y="176" width="20" height="44" rx="4" fill="url(#brass)" />
          <path d={`M${x - 18} 180 h36 l-6 -14 h-24 z`} fill="url(#brass)" />
          <rect x={x - 5} y="140" width="10" height="28" rx="2" fill="#F1E4C6" />
          <path d={`M${x} 124 q-6 9 0 16 q6 -7 0 -16`} fill="#FFD27A" />
        </g>
      ))}

      {/* dais curtain behind the bench */}
      <g>
        <rect x="380" y="38" width="440" height="300" fill="url(#folds)" />
        <rect x="380" y="38" width="440" height="300" fill="url(#velvetNoise)" opacity="0.6" style={{ mixBlendMode: 'multiply' }} />
        <rect x="380" y="38" width="440" height="300" fill="url(#curtainShade)" />
        <path d="M372 38 H828 V64 Q806 84 784 64 Q762 84 740 64 Q718 84 696 64 Q674 84 652 64 Q630 84 608 64 Q586 84 564 64 Q542 84 520 64 Q498 84 476 64 Q454 84 432 64 Q410 84 388 64 Q380 70 372 64 Z" fill="#43183A" />
        <path d="M372 64 Q380 70 388 64 Q410 84 432 64 Q454 84 476 64 Q498 84 520 64 Q542 84 564 64 Q586 84 608 64 Q630 84 652 64 Q674 84 696 64 Q718 84 740 64 Q762 84 784 64 Q806 84 828 64" stroke="url(#brass)" strokeWidth="3" fill="none" />
        <rect x="372" y="36" width="456" height="6" fill="url(#brass)" />
      </g>

      {/* court seal */}
      <g>
        <circle cx="600" cy="112" r="66" fill="url(#brass)" />
        <circle cx="600" cy="112" r="60" fill="url(#sealFace)" stroke="#E9CB82" strokeWidth="1.2" />
        <circle cx="600" cy="112" r="40" fill="none" stroke="#B08A3E" strokeWidth="1" />
        <text className="seal-text" fill="#D9B86A">
          <textPath href="#sealRing" startOffset="0" textLength="300" lengthAdjust="spacing">
            PUMPKIN SUPREME COURT ✦ IN GOURD WE TRUST ✦
          </textPath>
        </text>
        <g fill="url(#brass)">
          <ellipse cx="588" cy="118" rx="14" ry="17" />
          <ellipse cx="612" cy="118" rx="14" ry="17" />
          <ellipse cx="600" cy="118" rx="13" ry="19" />
          <path d="M598 100 q-2 -8 6 -12 l2 3 q-5 2 -4 9 z" />
        </g>
        <ellipse cx="582" cy="86" rx="24" ry="9" fill="#FFF3D0" opacity="0.12" transform="rotate(-20 582 86)" />
      </g>

      {/* floor */}
      <rect y="560" width="1200" height="40" fill="#1C0E0A" />
      <rect y="560" width="1200" height="40" fill="url(#woodH)" />
    </svg>
  )
})

function Candle({ patience }: { patience: number }) {
  // candle sits on the bench at x=388, its base at y=388
  const h = 14 + (Math.max(0, patience) / 100) * 66
  const top = 386 - h
  const lit = patience > 0
  const hot = patience < 26
  return (
    <g className="candle" aria-hidden="true">
      {lit && <circle cx="388" cy={top - 16} r="44" fill="url(#flameGlow)" className="candle__glow" />}
      <rect x="378" y={top} width="20" height={h} rx="3" fill="url(#wax)" />
      <path d={`M378 ${top + 4} q3 10 0 18 M394 ${top + 2} q2 6 1 12`} stroke="#F7EEDB" strokeWidth="3" strokeLinecap="round" fill="none" />
      <ellipse cx="388" cy={top + 1} rx="10" ry="3" fill="#FFF8E8" />
      <line x1="388" y1={top} x2="388" y2={top - 6} stroke="#2A1A12" strokeWidth="1.5" />
      {lit && <path className="candle__flame" d={`M388 ${top - 26} q-8 12 0 20 q8 -8 0 -20`} fill={hot ? '#FF7A3A' : '#FFD27A'} />}
      {lit && <path className="candle__flame" d={`M388 ${top - 18} q-3 6 0 10 q3 -4 0 -10`} fill="#FFF6D8" />}
      {!lit && <path className="candle__smoke" d={`M388 ${top - 6} q-8 -12 2 -22 q8 -10 -2 -24`} stroke="#9A8F86" strokeWidth="2" fill="none" opacity="0.6" />}
      <ellipse cx="388" cy="388" rx="28" ry="7" fill="url(#brassFront)" />
      <ellipse cx="388" cy="386" rx="20" ry="4" fill="#5A4220" />
    </g>
  )
}

function Scales({ cred, pros }: { cred: number; pros: number }) {
  // Beam tilts toward whichever side is heavier: defense (left) is credibility, prosecution (right).
  const cx = 830
  const cy = 300
  const half = 58
  const angle = Math.max(-18, Math.min(18, (cred - pros) / 3))
  const rad = (angle * Math.PI) / 180
  const lx = cx - half * Math.cos(rad)
  const ly = cy + half * Math.sin(rad)
  const rx = cx + half * Math.cos(rad)
  const ry = cy - half * Math.sin(rad)
  const pan = (x: number, y: number, key: string) => (
    <g key={key} className="scales__pan" style={{ transform: `translate(${x}px, ${y}px)` }}>
      <line x1="0" y1="0" x2="-20" y2="44" stroke="#C9A85A" strokeWidth="1.2" />
      <line x1="0" y1="0" x2="20" y2="44" stroke="#C9A85A" strokeWidth="1.2" />
      <path d="M-26 44 h52 q-6 14 -26 14 q-20 0 -26 -14 z" fill="url(#brassFront)" />
    </g>
  )
  return (
    <g className="scales">
      <title>{`The scales of justice: credibility ${cred}, prosecution ${pros}`}</title>
      <path d={`M${cx - 26} 388 h52 l-8 -10 h-36 z`} fill="url(#brassFront)" />
      <rect x={cx - 3} y={cy} width="6" height="80" fill="url(#brassFront)" />
      <circle cx={cx} cy={cy - 6} r="7" fill="url(#brassFront)" />
      <g className="scales__beam" style={{ transform: `rotate(${-angle}deg)`, transformOrigin: `${cx}px ${cy}px` }}>
        <rect x={cx - half} y={cy - 3} width={half * 2} height="6" rx="3" fill="url(#brassFront)" />
      </g>
      {pan(lx, ly, 'l')}
      {pan(rx, ry, 'r')}
    </g>
  )
}

function Gavel({ strikeKey }: { strikeKey: number }) {
  return (
    <g aria-hidden="true">
      <ellipse cx="700" cy="384" rx="26" ry="7" fill="#2A140C" />
      <ellipse cx="700" cy="380" rx="26" ry="7" fill="#6B3A20" />
      <g key={strikeKey} className="gavel">
        <rect x="694" y="320" width="7" height="58" rx="3" fill="#5A2E16" transform="rotate(62 697 349)" />
        <g transform="rotate(62 697 349)">
          <rect x="680" y="306" width="36" height="20" rx="5" fill="#7A4424" />
          <rect x="680" y="312" width="36" height="5" fill="url(#brassFront)" />
        </g>
      </g>
    </g>
  )
}

function Stenographer() {
  return (
    <g className="steno" aria-hidden="true">
      <path d="M1000 300 L1000 254 Q1000 222 1028 222 Q1056 222 1056 254 L1056 300 L1049 293 L1042 300 L1035 293 L1028 300 L1021 293 L1014 300 L1007 293 Z" fill="#EDE7F2" opacity="0.7" />
      <ellipse cx="1018" cy="252" rx="3" ry="4.5" fill="#2A1630" />
      <ellipse cx="1038" cy="252" rx="3" ry="4.5" fill="#2A1630" />
      <rect x="1010" y="292" width="40" height="14" rx="2" fill="#2E2A2D" />
      <rect x="1014" y="286" width="32" height="8" rx="1" fill="#F1E4C6" opacity="0.8" />
    </g>
  )
}

const Front = memo(function Front({ speaker, witness, patience, cred, pros, gavelKey, plaque }: Omit<Props, 'mood'>) {
  const witnessActive = speaker === 'witness'
  const prosActive = speaker === 'prosecutor'
  return (
    <svg viewBox={VB} preserveAspectRatio={PAR} className="stage__layer stage__front" aria-hidden="true">
      <defs>
        <pattern id="woodVf" patternUnits="userSpaceOnUse" width="400" height="400">
          <image href={WOOD_V} width="400" height="400" />
        </pattern>
        <pattern id="woodHf" patternUnits="userSpaceOnUse" width="400" height="400">
          <image href={WOOD_H} width="400" height="400" />
        </pattern>
        <linearGradient id="brassFront" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#EED494" />
          <stop offset="0.5" stopColor="#B48D40" />
          <stop offset="1" stopColor="#6A4D1E" />
        </linearGradient>
        <linearGradient id="benchTop" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7A4630" />
          <stop offset="1" stopColor="#4C2719" />
        </linearGradient>
        <linearGradient id="benchFace" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#58301F" />
          <stop offset="1" stopColor="#2C150D" />
        </linearGradient>
        <linearGradient id="wax" x1="0" x2="1">
          <stop offset="0" stopColor="#D9CBAE" />
          <stop offset="0.4" stopColor="#F6EEDC" />
          <stop offset="1" stopColor="#C8B794" />
        </linearGradient>
        <radialGradient id="flameGlow">
          <stop offset="0" stopColor="#FFC870" stopOpacity="0.45" />
          <stop offset="1" stopColor="#FFC870" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="vignette" cx="50%" cy="45%" r="75%">
          <stop offset="0.55" stopColor="#0B0406" stopOpacity="0" />
          <stop offset="1" stopColor="#0B0406" stopOpacity="0.75" />
        </radialGradient>
      </defs>

      {/* witness box (stage left) */}
      <g className={`figure ${witnessActive ? 'is-speaking' : ''}`}>
        {witness && (
          <g transform="translate(118 268) scale(2.9)">
            <PortraitArt kind={witness} />
          </g>
        )}
      </g>
      <g>
        <rect x="80" y="440" width="300" height="160" fill="url(#benchFace)" />
        <rect x="80" y="440" width="300" height="160" fill="url(#woodVf)" />
        <rect x="70" y="430" width="320" height="14" fill="url(#benchTop)" />
        <rect x="70" y="430" width="320" height="2" fill="#FFD9B0" opacity="0.2" />
        <rect x="104" y="466" width="252" height="104" fill="#000" opacity="0.2" />
        <rect x="190" y="482" width="80" height="20" rx="2" fill="url(#brassFront)" />
        <text x="230" y="496.5" className="plate-text" textAnchor="middle">
          WITNESS
        </text>
      </g>

      {/* prosecution lectern (stage right) */}
      <g className={`figure ${prosActive ? 'is-speaking' : ''}`}>
        <g transform="translate(960 300) scale(2.5)">
          <PortraitArt kind="prosecutor" />
        </g>
      </g>
      <g>
        <path d="M930 452 h190 l-14 148 h-162 z" fill="url(#benchFace)" />
        <path d="M930 452 h190 l-14 148 h-162 z" fill="url(#woodVf)" />
        <path d="M918 440 h214 l-6 16 h-202 z" fill="url(#benchTop)" />
        <rect x="985" y="486" width="80" height="20" rx="2" fill="url(#brassFront)" />
        <text x="1025" y="500.5" className="plate-text" textAnchor="middle">
          PEOPLE
        </text>
      </g>
      <Stenographer />

      {/* the bench */}
      <g>
        <path d="M300 392 L900 392 L912 410 L288 410 Z" fill="url(#benchTop)" />
        <path d="M300 392 L900 392 L912 410 L288 410 Z" fill="url(#woodHf)" />
        <path d="M300 392 L900 392" stroke="#FFD9B0" strokeOpacity="0.25" strokeWidth="2" />
        <rect x="288" y="410" width="624" height="190" fill="url(#benchFace)" />
        <rect x="288" y="410" width="624" height="190" fill="url(#woodVf)" />
        <rect x="288" y="410" width="624" height="6" fill="#000" opacity="0.35" />
        {[318, 718].map((x) => (
          <g key={x}>
            <rect x={x} y="440" width="164" height="132" fill="#000" opacity="0.22" />
            <path d={`M${x} 572 V440 H${x + 164}`} stroke="#FFD9B0" strokeOpacity="0.1" strokeWidth="2" fill="none" />
            <path d={`M${x + 164} 440 V572 H${x}`} stroke="#000" strokeOpacity="0.5" strokeWidth="2" fill="none" />
          </g>
        ))}
        <rect x="498" y="440" width="204" height="132" fill="#000" opacity="0.22" />
        <rect x="508" y="470" width="184" height="40" rx="3" fill="url(#brassFront)" />
        <rect x="512" y="474" width="176" height="32" rx="2" fill="none" stroke="#5A4220" strokeOpacity="0.5" />
        <text x="600" y="496" className="plate-text plate-text--big" textAnchor="middle">
          {plaque ?? "HON. J. O'LANTERN"}
        </text>
      </g>

      <Candle patience={patience} />
      <Gavel strikeKey={gavelKey} />
      <Scales cred={cred} pros={pros} />

      <rect width="1200" height="600" fill="url(#vignette)" pointerEvents="none" />
    </svg>
  )
})

export function Scene({ mood, ...rest }: Props) {
  return (
    <div className="stage">
      <Back />
      <svg viewBox={VB} preserveAspectRatio={PAR} className="stage__layer stage__judge" aria-hidden="true">
        <g transform="translate(435 150) scale(1.1)">
          <JudgeFigure mood={mood} />
        </g>
      </svg>
      <Front {...rest} />
    </div>
  )
}
