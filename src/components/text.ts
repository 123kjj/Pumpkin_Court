import { fill, JUDGE } from '../engine/dialogue'
import type { CaseDef, TrialState } from '../engine/types'

/** Fill {name}/{victim}/… placeholders for anything rendered straight from case data. */
export function t(text: string, def: CaseDef, s: Pick<TrialState, 'defendant'>): string {
  return fill(text, { name: s.defendant, victim: def.victim.name, prosecutor: def.prosecutor.name, charge: def.charge, judge: JUDGE })
}

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
