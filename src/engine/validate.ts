// Static checks for case data. Catches typos in flag/claim/evidence IDs that would
// otherwise silently make a branch or ending unreachable.
import { GLOBAL_CONTRADICTIONS } from './engine'
import type { Branch, CaseDef, ChoiceOption, Condition, Effect } from './types'

const ENGINE_FLAGS = ['contempt', 'word_salad', 'resolved_with_evidence', 'misspoke', 'doubled_down', 'blamed_stenographer']
const DYNAMIC_PREFIXES = ['typed:', 'pie:', 'answered:', 'ctx:']

export function validateCase(def: CaseDef): string[] {
  const errors: string[] = []
  const flags = new Set<string>(ENGINE_FLAGS)
  const claims = new Set<string>()
  const evidenceIds = new Set(def.evidence.map((e) => e.id))
  const effects: Effect[] = []
  const conditions: [string, Condition][] = []

  const visitOption = (o: ChoiceOption, where: string) => {
    if (o.effect) effects.push(o.effect)
    if (o.when) conditions.push([`${where}/${o.id}.when`, o.when])
    o.branches?.forEach((b, i) => visitBranch(b, `${where}/${o.id}.branch${i}`))
  }
  const visitBranch = (b: Branch, where: string) => {
    if (b.effect) effects.push(b.effect)
    conditions.push([where, b.when])
  }

  def.defenses.forEach((o) => visitOption(o, 'defense'))
  def.closings.forEach((o) => visitOption(o, 'closing'))
  for (const q of def.cross) {
    if (q.when) conditions.push([`cross/${q.id}.when`, q.when])
    q.options.forEach((o) => visitOption(o, `cross/${q.id}`))
  }
  for (const round of [1, 2, 3] as const) {
    if (!def.cross.some((q) => q.round === round && !q.when)) errors.push(`cross round ${round} has no unconditional fallback question`)
  }
  for (const w of def.witnesses) {
    if (w.when) conditions.push([`witness/${w.id}.when`, w.when])
    const ids = new Set<string>()
    for (const q of w.questions) {
      if (ids.has(q.id)) errors.push(`witness ${w.id} has duplicate question id ${q.id}`)
      ids.add(q.id)
      if (q.effect) effects.push(q.effect)
      if (q.when) conditions.push([`witness/${w.id}/${q.id}.when`, q.when])
      q.branches?.forEach((b, i) => visitBranch(b, `witness/${w.id}/${q.id}.branch${i}`))
    }
  }
  if (def.witnesses.filter((w) => !w.when).length < 2) errors.push('needs at least two always-available witnesses')
  for (const e of def.evidence) {
    if (e.inspect.effect) effects.push(e.inspect.effect)
    if (e.contextInspect) {
      if (e.contextInspect.effect) effects.push(e.contextInspect.effect)
      conditions.push([`evidence/${e.id}.context`, e.contextInspect.when])
    }
    if (e.presentDefault.effect) effects.push(e.presentDefault.effect)
    e.present.forEach((b, i) => visitBranch(b, `evidence/${e.id}.present${i}`))
    const hasCatchAll = e.present.some((b) => Object.keys(b.when).length === 0)
    if (!e.presentDefault.reply && !hasCatchAll) errors.push(`evidence ${e.id} has an empty default reply and no catch-all branch`)
  }
  for (const s of def.secretEndings) conditions.push([`secret/${s.id}`, s.when])

  for (const e of effects) {
    e.flags?.forEach((f) => flags.add(f))
    e.claims?.forEach((c) => claims.add(c))
    e.unlock?.forEach((u) => {
      if (!evidenceIds.has(u)) errors.push(`unlock references unknown evidence "${u}"`)
    })
  }
  const unlockable = new Set(effects.flatMap((e) => e.unlock ?? []))
  for (const e of def.evidence) if (!e.startsUnlocked && !unlockable.has(e.id)) errors.push(`evidence ${e.id} can never be unlocked`)

  const isKnownFlag = (f: string) => flags.has(f) || DYNAMIC_PREFIXES.some((p) => f.startsWith(p))
  const list = (v: string | string[] | undefined) => (v === undefined ? [] : Array.isArray(v) ? v : [v])
  const checkCond = (where: string, c: Condition) => {
    for (const f of [...list(c.flag), ...(c.anyFlag ?? []), ...list(c.noFlag)]) if (!isKnownFlag(f)) errors.push(`${where}: unknown flag "${f}"`)
    for (const k of [...list(c.claim), ...(c.anyClaim ?? []), ...list(c.noClaim)]) if (!claims.has(k)) errors.push(`${where}: unknown claim "${k}"`)
    for (const ev of [...list(c.examined), ...list(c.presented), ...list(c.notPresented)]) if (!evidenceIds.has(ev)) errors.push(`${where}: unknown evidence "${ev}"`)
    for (const d of list(c.defense)) if (!def.defenses.some((o) => o.id === d)) errors.push(`${where}: unknown defense "${d}"`)
    for (const d of list(c.closing)) if (!def.closings.some((o) => o.id === d)) errors.push(`${where}: unknown closing "${d}"`)
    if ((c.meterAtLeast !== undefined || c.meterBelow !== undefined) && !def.meter) errors.push(`${where}: meter condition without a meter`)
    c.any?.forEach((x) => checkCond(where, x))
    if (c.not) checkCond(where, c.not)
  }
  conditions.forEach(([w, c]) => checkCond(w, c))

  for (const r of [...GLOBAL_CONTRADICTIONS, ...def.contradictions]) {
    if (r.resolveWith && !evidenceIds.has(r.resolveWith)) errors.push(`contradiction ${r.id} resolves with unknown evidence`)
  }
  for (const r of def.contradictions) {
    if (!claims.has(r.a)) errors.push(`contradiction ${r.id}: claim "${r.a}" is never made`)
    if (!claims.has(r.b)) errors.push(`contradiction ${r.id}: claim "${r.b}" is never made`)
  }
  return errors
}
