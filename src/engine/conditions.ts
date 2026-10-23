import type { Condition, TrialState } from './types'

const arr = (v: string | string[] | undefined): string[] =>
  v === undefined ? [] : Array.isArray(v) ? v : [v]

export const unresolvedCount = (s: TrialState): number =>
  s.contradictions.filter((c) => !c.resolved).length

/** Evaluate a serialisable condition against the trial state. Pure and deterministic. */
export function check(cond: Condition | undefined, s: TrialState): boolean {
  if (!cond) return true
  const has = (list: string[], v: string) => list.includes(v)

  if (!arr(cond.claim).every((c) => has(s.claims, c))) return false
  if (cond.anyClaim && !cond.anyClaim.some((c) => has(s.claims, c))) return false
  if (arr(cond.noClaim).some((c) => has(s.claims, c))) return false

  if (!arr(cond.flag).every((f) => has(s.flags, f))) return false
  if (cond.anyFlag && !cond.anyFlag.some((f) => has(s.flags, f))) return false
  if (arr(cond.noFlag).some((f) => has(s.flags, f))) return false

  if (!arr(cond.examined).every((e) => has(s.examined, e))) return false
  if (!arr(cond.presented).every((e) => has(s.presented, e))) return false
  if (arr(cond.notPresented).some((e) => has(s.presented, e))) return false

  if (cond.defense !== undefined && !arr(cond.defense).includes(s.defenseChoice ?? '')) return false
  if (cond.closing !== undefined && !arr(cond.closing).includes(s.closingChoice ?? '')) return false

  if (cond.credAtLeast !== undefined && s.cred < cond.credAtLeast) return false
  if (cond.credBelow !== undefined && s.cred >= cond.credBelow) return false
  if (cond.prosAtLeast !== undefined && s.pros < cond.prosAtLeast) return false
  if (cond.prosBelow !== undefined && s.pros >= cond.prosBelow) return false
  if (cond.patienceBelow !== undefined && s.patience >= cond.patienceBelow) return false
  if (cond.pettinessAtLeast !== undefined && s.petty < cond.pettinessAtLeast) return false
  if (cond.meterAtLeast !== undefined && s.meter < cond.meterAtLeast) return false
  if (cond.meterBelow !== undefined && s.meter >= cond.meterBelow) return false

  const unresolved = unresolvedCount(s)
  if (cond.contradictionsAtLeast !== undefined && unresolved < cond.contradictionsAtLeast) return false
  if (cond.contradictionsBelow !== undefined && unresolved >= cond.contradictionsBelow) return false

  if (cond.any && !cond.any.some((c) => check(c, s))) return false
  if (cond.not && check(cond.not, s)) return false
  return true
}
