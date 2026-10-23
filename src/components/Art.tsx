import type { EvidenceArt, Portrait as PortraitKind } from '../engine/types'

type PortraitKind2 = PortraitKind | 'prosecutor' | 'defendant'

/** Small hand-drawn portraits for witnesses and the prosecution. */
export function Portrait({ kind, size = 56 }: { kind: PortraitKind2; size?: number }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className="portrait" aria-hidden="true">
      <circle cx="32" cy="32" r="31" fill="#2A1A20" stroke="#B8913F" strokeWidth="1.5" />
      {PORTRAITS[kind]}
    </svg>
  )
}

/** The same drawing as a bare group, for placing figures inside the courtroom scene. */
export function PortraitArt({ kind }: { kind: PortraitKind2 }) {
  return <g>{PORTRAITS[kind]}</g>
}

const eye = (x: number, y: number, r = 2.6) => <circle cx={x} cy={y} r={r} fill="#1E1418" />

const PORTRAITS: Record<string, React.ReactNode> = {
  squirrel: (
    <>
      <path d="M44 52 Q62 40 52 18 Q46 10 40 20 Q50 30 40 46 Z" fill="#9C6B43" />
      <ellipse cx="28" cy="40" rx="13" ry="14" fill="#B07A4C" />
      <circle cx="28" cy="26" r="10" fill="#B07A4C" />
      <path d="M20 18 L22 10 L26 17 Z M30 17 L34 10 L36 18 Z" fill="#9C6B43" />
      {eye(24, 25)}
      {eye(32, 25)}
      <ellipse cx="28" cy="30" rx="2" ry="1.5" fill="#1E1418" />
      <ellipse cx="28" cy="42" rx="7" ry="8" fill="#E2C39E" />
    </>
  ),
  scarecrow: (
    <>
      <rect x="10" y="30" width="44" height="5" fill="#6B4423" />
      <circle cx="32" cy="30" r="12" fill="#E8D7A8" />
      <path d="M16 20 L48 20 L42 12 L22 12 Z" fill="#5B4632" />
      <rect x="12" y="19" width="40" height="3" fill="#5B4632" />
      <path d="M26 28 l4 4 m0 -4 l-4 4 M34 28 l4 4 m0 -4 l-4 4" stroke="#1E1418" strokeWidth="1.6" />
      <path d="M25 36 Q32 40 39 36" stroke="#1E1418" strokeWidth="1.5" fill="none" strokeDasharray="2 2" />
      <path d="M20 42 L44 42 L48 58 L16 58 Z" fill="#7A5A8A" />
      <path d="M18 56 l-3 5 M24 58 l-1 5 M40 58 l1 5 M46 56 l3 5" stroke="#D9B85C" strokeWidth="1.5" />
    </>
  ),
  raccoon: (
    <>
      <path d="M14 22 L20 10 L26 20 Z M38 20 L44 10 L50 22 Z" fill="#6E6A70" />
      <ellipse cx="32" cy="34" rx="20" ry="17" fill="#8D8992" />
      <path d="M14 30 Q22 24 30 32 Q22 40 14 34 Z M50 30 Q42 24 34 32 Q42 40 50 34 Z" fill="#2B2730" />
      {eye(23, 31, 2.4)}
      {eye(41, 31, 2.4)}
      <ellipse cx="32" cy="42" rx="8" ry="6" fill="#D8D2DA" />
      <ellipse cx="32" cy="40" rx="2.4" ry="1.8" fill="#1E1418" />
      <rect x="14" y="27" width="36" height="3" rx="1.5" fill="#1E1418" opacity="0.4" />
    </>
  ),
  gardener: (
    <>
      <circle cx="32" cy="32" r="13" fill="#D9A97C" />
      <path d="M12 26 Q32 6 52 26 Z" fill="#7C8B3A" />
      <rect x="10" y="24" width="44" height="4" rx="2" fill="#5E6B2A" />
      {eye(27, 32, 2)}
      {eye(37, 32, 2)}
      <path d="M26 40 L38 38" stroke="#1E1418" strokeWidth="2" />
      <path d="M24 29 L30 30 M34 30 L40 29" stroke="#4B3A2A" strokeWidth="2" />
      <path d="M18 46 L46 46 L50 60 L14 60 Z" fill="#4E6A3A" />
      <circle cx="44" cy="52" r="5" fill="#5E8C3A" />
      <circle cx="47" cy="49" r="3.5" fill="#6FA046" />
    </>
  ),
  gourd: (
    <>
      <path d="M30 14 Q28 8 34 6" stroke="#5B6B2F" strokeWidth="3" fill="none" />
      <ellipse cx="32" cy="36" rx="20" ry="18" fill="#E58B3A" />
      <path d="M32 18 Q22 36 32 54 M32 18 Q42 36 32 54" stroke="#B9531E" strokeWidth="2" fill="none" opacity="0.6" />
      {eye(25, 33)}
      {eye(39, 33)}
      <path d="M22 28 Q25 25 28 28 M36 28 Q39 25 42 28" stroke="#1E1418" strokeWidth="1.5" fill="none" />
      <path d="M27 43 Q32 46 37 43" stroke="#1E1418" strokeWidth="1.8" fill="none" />
      <circle cx="21" cy="40" r="2.5" fill="#F2A0A0" opacity="0.6" />
      <circle cx="43" cy="40" r="2.5" fill="#F2A0A0" opacity="0.6" />
    </>
  ),
  owl: (
    <>
      <path d="M16 20 L22 12 L26 22 Z M38 22 L42 12 L48 20 Z" fill="#7B5B3E" />
      <ellipse cx="32" cy="36" rx="18" ry="20" fill="#9A7350" />
      <circle cx="25" cy="30" r="7" fill="#F1E3C2" />
      <circle cx="39" cy="30" r="7" fill="#F1E3C2" />
      {eye(25, 30, 3)}
      {eye(39, 30, 3)}
      <circle cx="25" cy="30" r="8.5" fill="none" stroke="#C9A24A" strokeWidth="1.4" />
      <circle cx="39" cy="30" r="8.5" fill="none" stroke="#C9A24A" strokeWidth="1.4" />
      <path d="M33.5 30 L30.5 30" stroke="#C9A24A" strokeWidth="1.4" />
      <path d="M30 37 L34 37 L32 41 Z" fill="#D99A2B" />
      <path d="M24 46 Q32 50 40 46" stroke="#7B5B3E" strokeWidth="2" fill="none" />
    </>
  ),
  ghost: (
    <>
      <path d="M16 54 L16 30 Q16 12 32 12 Q48 12 48 30 L48 54 L43 49 L38 54 L33 49 L28 54 L22 49 Z" fill="#EDE7F2" opacity="0.92" />
      <ellipse cx="26" cy="30" rx="3" ry="4" fill="#2A1630" />
      <ellipse cx="38" cy="30" rx="3" ry="4" fill="#2A1630" />
      <ellipse cx="32" cy="40" rx="3" ry="2.5" fill="#2A1630" />
    </>
  ),
  fridge: (
    <>
      <rect x="18" y="10" width="28" height="44" rx="4" fill="#DCE3E6" />
      <rect x="18" y="26" width="28" height="2" fill="#AFB9BE" />
      <rect x="40" y="16" width="2.5" height="7" rx="1" fill="#8D979C" />
      <rect x="40" y="32" width="2.5" height="10" rx="1" fill="#8D979C" />
      <circle cx="30" cy="38" r="6" fill="#FFF3C4" />
      <circle cx="30" cy="38" r="10" fill="#FFF3C4" opacity="0.25" />
      {eye(28, 37, 1.3)}
      {eye(32, 37, 1.3)}
    </>
  ),
  crow: (
    <>
      <ellipse cx="32" cy="38" rx="16" ry="16" fill="#26222C" />
      <circle cx="32" cy="24" r="11" fill="#2E2A35" />
      <path d="M40 24 L54 27 L40 30 Z" fill="#C9A24A" />
      <circle cx="35" cy="22" r="3" fill="#F3E6CC" />
      {eye(35.5, 22, 1.6)}
      <path d="M22 16 Q28 8 34 14" stroke="#3A3542" strokeWidth="3" fill="none" />
      <path d="M26 44 L38 44 L32 50 Z" fill="#B4442B" />
    </>
  ),
  peas: (
    <>
      <path d="M18 18 L46 18 L50 54 L14 54 Z" fill="#9FD3E6" opacity="0.5" stroke="#CFE9F2" strokeWidth="1.2" />
      {[
        [24, 30],
        [32, 28],
        [40, 31],
        [27, 39],
        [36, 40],
        [22, 47],
        [31, 48],
        [41, 47],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="4.5" fill="#6FAE4A" stroke="#4E8A32" strokeWidth="1" />
      ))}
      {eye(31, 27, 1.1)}
      {eye(34, 27, 1.1)}
    </>
  ),
  prosecutor: (
    <>
      <path d="M30 14 Q32 6 38 8" stroke="#5B6B2F" strokeWidth="3" fill="none" />
      <ellipse cx="32" cy="36" rx="17" ry="20" fill="#E3C46A" />
      {eye(26, 32, 2.2)}
      {eye(38, 32, 2.2)}
      <path d="M22 26 L29 28 M35 28 L42 26" stroke="#1E1418" strokeWidth="1.8" />
      <path d="M26 44 L38 44" stroke="#1E1418" strokeWidth="2" />
      <path d="M24 56 L32 50 L40 56" fill="#232022" />
    </>
  ),
  defendant: (
    <>
      <circle cx="32" cy="26" r="10" fill="#F3E6CC" />
      <path d="M14 58 Q14 40 32 40 Q50 40 50 58 Z" fill="#F3E6CC" />
      {eye(28, 26, 1.6)}
      {eye(36, 26, 1.6)}
      <path d="M29 31 Q32 29 35 31" stroke="#1E1418" strokeWidth="1.4" fill="none" />
    </>
  ),
}

/** Icons for evidence cards. */
export function EvidenceIcon({ art }: { art: EvidenceArt }) {
  const stroke = { stroke: '#2A1630', strokeWidth: 2, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  const icons: Record<EvidenceArt, React.ReactNode> = {
    phone: (
      <>
        <rect x="18" y="8" width="28" height="48" rx="5" {...stroke} />
        <path d="M24 20 h16 M24 27 h12 M24 34 h14" {...stroke} />
        <circle cx="32" cy="49" r="2" fill="#2A1630" />
      </>
    ),
    photo: (
      <>
        <rect x="8" y="14" width="48" height="38" rx="2" {...stroke} />
        <circle cx="32" cy="36" r="9" {...stroke} />
        <path d="M30 27 q1 -4 4 -5" {...stroke} />
        <path d="M14 46 l8 -8 l6 6" {...stroke} />
      </>
    ),
    receipt: (
      <>
        <path d="M16 6 h32 v52 l-4 -3 l-4 3 l-4 -3 l-4 3 l-4 -3 l-4 3 l-4 -3 l-4 3 Z" {...stroke} />
        <path d="M22 16 h20 M22 23 h14 M22 30 h18 M22 40 h10 M36 40 h6" {...stroke} />
      </>
    ),
    footprint: (
      <>
        <circle cx="32" cy="34" r="18" {...stroke} />
        <circle cx="32" cy="34" r="13" {...stroke} strokeDasharray="3 3" />
        <path d="M24 30 l4 2 M36 28 l3 3 M30 40 l4 1" {...stroke} />
      </>
    ),
    letter: (
      <>
        <path d="M14 8 h26 l10 10 v38 h-36 Z M40 8 v10 h10" {...stroke} />
        <path d="M20 26 q6 -3 10 0 t10 0 M20 34 q6 -3 10 0 t10 0 M20 42 q5 -3 9 0" {...stroke} />
      </>
    ),
    jar: (
      <>
        <rect x="18" y="16" width="28" height="40" rx="5" {...stroke} />
        <rect x="16" y="8" width="32" height="8" rx="2" {...stroke} />
        <path d="M26 30 q6 6 12 0 M26 40 q6 -6 12 0" {...stroke} />
      </>
    ),
    scissors: (
      <>
        <circle cx="18" cy="44" r="7" {...stroke} />
        <circle cx="46" cy="44" r="7" {...stroke} />
        <path d="M23 39 L44 10 M41 39 L20 10" {...stroke} />
      </>
    ),
    chart: (
      <>
        <path d="M10 10 v44 h46" {...stroke} />
        <path d="M14 18 l10 4 l6 -2 l8 22 l8 6 l8 2" {...stroke} />
      </>
    ),
    blanket: (
      <>
        <path d="M10 18 h44 v30 h-44 Z" {...stroke} />
        <path d="M10 28 h44 M10 38 h44 M22 18 v30 M42 18 v30" {...stroke} strokeDasharray="2 3" />
      </>
    ),
    thermo: (
      <>
        <rect x="14" y="8" width="36" height="48" rx="4" {...stroke} />
        <path d="M20 20 h24 M20 30 h18 M20 40 h22" {...stroke} />
        <circle cx="44" cy="30" r="2" fill="#B4442B" />
      </>
    ),
    book: (
      <>
        <path d="M10 14 q11 -4 22 2 q11 -6 22 -2 v38 q-11 -4 -22 2 q-11 -6 -22 -2 Z M32 16 v38" {...stroke} />
      </>
    ),
    can: (
      <>
        <path d="M22 18 h20 v34 a4 4 0 0 1 -4 4 h-12 a4 4 0 0 1 -4 -4 Z" {...stroke} />
        <path d="M32 18 v-6" {...stroke} />
        <path d="M32 6 q4 3 0 6 q-4 -3 0 -6" fill="#E8772E" />
      </>
    ),
  }
  return (
    <svg viewBox="0 0 64 64" className="ev-icon" aria-hidden="true">
      {icons[art]}
    </svg>
  )
}

