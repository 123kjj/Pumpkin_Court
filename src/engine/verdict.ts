// ─────────────────────────────────────────────────────────────
//  Deterministic verdict generation. Same choices → same verdict.
//  (The seed only picks which roast template is used.)
// ─────────────────────────────────────────────────────────────
import { check, unresolvedCount } from './conditions'
import { CRED_LABELS, ROAST, ROAST_CLEAN, fill } from './dialogue'
import { pick, rng } from './rng'
import type { CaseDef, Mood, TrialState, VerdictKind, VerdictResult } from './types'

export const THRESHOLDS = {
  notGuilty: 10,
  lesser: -12,
  dismissedPros: 15,
  pettyRemoval: 100,
  contradictionWeight: 10,
  contemptPenalty: 10,
} as const

export function verdictTitle(kind: Exclude<VerdictKind, 'secret'>, def: CaseDef): string {
  switch (kind) {
    case 'guilty':
      return 'GUILTY'
    case 'not_guilty':
      return 'NOT GUILTY'
    case 'lesser':
      return `GUILTY OF A LESSER OFFENSE: ${def.lesserCharge}`
    case 'dismissed':
      return 'CASE DISMISSED due to prosecutorial incompetence'
    case 'mistrial_raccoon':
      return 'MISTRIAL caused by an extremely suspicious raccoon'
    case 'judge_removed':
      return 'JUDGE REMOVED FROM THE BENCH for excessive pettiness'
  }
}

const NARRATION: Record<Exclude<VerdictKind, 'secret'>, string[]> = {
  guilty: ['The court has weighed the evidence. It weighed a lot. Almost all of it on the wrong side of the scale for you.'],
  not_guilty: ['The court has weighed the evidence and finds, through gritted teeth, that the defense actually made sense.'],
  lesser: ['The court is not convinced you are innocent. The court is also not convinced you are competent enough to be fully guilty.'],
  dismissed: ["The prosecution's case has fallen apart like a pumpkin in mid-November. There is nothing left to judge."],
  mistrial_raccoon: ['Before the court can rule, it notices the raccoon bailiff is gone. So is the evidence. So is the gavel. So, somehow, is the bench.'],
  judge_removed: [
    'The Pumpkin Judicial Council has been watching the livestream. They have seen enough pettiness to fill a pie dish.',
    "Judge Jack O'Lantern is escorted from the bench, still yelling about respect.",
  ],
}

const MOODS: Record<Exclude<VerdictKind, 'secret'>, Mood> = {
  guilty: 'smug',
  not_guilty: 'shocked',
  lesser: 'suspicious',
  dismissed: 'furious',
  mistrial_raccoon: 'shocked',
  judge_removed: 'furious',
}

/** Case meters nudge the verdict: each unit of movement from the start is worth `verdictWeight` points. */
export function meterBonus(s: TrialState, def: CaseDef): number {
  const m = def.meter
  if (!m?.verdictWeight) return 0
  const delta = (s.meter - m.start) * (m.lowIsGood ? -1 : 1)
  return Math.round(delta * m.verdictWeight)
}

export function computeMargin(s: TrialState, def: CaseDef): number {
  return (
    meterBonus(s, def) +
    s.cred -
    s.pros -
    unresolvedCount(s) * THRESHOLDS.contradictionWeight -
    (s.patience <= 0 ? THRESHOLDS.contemptPenalty : 0)
  )
}

/** The non-secret verdict rule ladder. Exported for tests. */
export function baseVerdict(s: TrialState, def: CaseDef): Exclude<VerdictKind, 'secret'> {
  if (s.petty >= THRESHOLDS.pettyRemoval) return 'judge_removed'
  if (s.flags.includes('raccoon_mistrial')) return 'mistrial_raccoon'
  if (s.pros <= THRESHOLDS.dismissedPros) return 'dismissed'
  const m = computeMargin(s, def)
  if (m >= THRESHOLDS.notGuilty) return 'not_guilty'
  if (m >= THRESHOLDS.lesser) return 'lesser'
  return 'guilty'
}

export function credibilityLabel(cred: number): string {
  return (CRED_LABELS.find(([min]) => cred >= min) ?? CRED_LABELS[CRED_LABELS.length - 1])[1]
}

export function strongestEvidence(s: TrialState, def: CaseDef): string {
  const impact = s.evidenceImpact ?? {}
  const helpful = def.evidence
    .filter((e) => s.presented.includes(e.id) && (impact[e.id] ?? 0) > 0)
    .sort((a, b) => (impact[b.id] ?? 0) - (impact[a.id] ?? 0) || b.weight - a.weight)[0]
  if (helpful) return `${helpful.name}: ${helpful.summary}`
  const theirs = def.evidence
    .filter((e) => s.examined.includes(e.id) && e.side === 'prosecution')
    .sort((a, b) => b.weight - a.weight)[0]
  if (s.presented.length && theirs) return `Nothing you presented helped. The strongest exhibit was ${theirs.name}, for the prosecution.`
  if (theirs) return `${theirs.name} (for the prosecution, unfortunately)`
  return 'None. You brought vibes to a gourd fight.'
}

export function biggestMistake(s: TrialState): string | null {
  const worst = [...s.memos].sort((a, b) => a.impact - b.impact)[0]
  if (worst && worst.impact < 0) return worst.text
  if (unresolvedCount(s)) return 'left a contradiction hanging in the air like a bad smell'
  if (s.unrecognized >= 2) return 'spoke in riddles the court could not parse'
  if (s.presented.length === 0) return 'presented zero evidence at an evidence-based trial'
  return null
}

export function explain(s: TrialState, def: CaseDef, kind: VerdictKind): string[] {
  const lines: string[] = []
  const impact = (e: { cred: number; pros: number }) => e.cred - e.pros
  const sorted = [...s.ledger].sort((a, b) => impact(b) - impact(a))
  const fmt = (e: { reason: string; cred: number; pros: number }) => {
    const bits: string[] = []
    if (e.cred) bits.push(`${e.cred > 0 ? '+' : ''}${e.cred} credibility`)
    if (e.pros) bits.push(`${e.pros > 0 ? '+' : ''}${e.pros} prosecution`)
    return `${bits.join(', ')}: you ${e.reason}`
  }
  sorted.filter((e) => impact(e) > 0).slice(0, 3).forEach((e) => lines.push(`Helped: ${fmt(e)}`))
  sorted.filter((e) => impact(e) < 0).reverse().slice(0, 3).forEach((e) => lines.push(`Hurt: ${fmt(e)}`))
  const u = unresolvedCount(s)
  const m = computeMargin(s, def)
  const mb = meterBonus(s, def)
  lines.push(
    `Final math: credibility ${s.cred} − prosecution ${s.pros}${mb ? ` ${mb > 0 ? '+' : '−'} ${Math.abs(mb)} (${def.meter!.label.toLowerCase()})` : ''}${u ? ` − ${u}×${THRESHOLDS.contradictionWeight} unresolved contradictions` : ''}${s.patience <= 0 ? ` − ${THRESHOLDS.contemptPenalty} contempt` : ''} = ${m >= 0 ? '+' : ''}${m} (not guilty needs +${THRESHOLDS.notGuilty}, a lesser charge needs ${THRESHOLDS.lesser}).`,
  )
  if (kind === 'judge_removed') lines.push(`Judicial pettiness reached ${s.petty}/${THRESHOLDS.pettyRemoval}. You baited the bench until it broke.`)
  if (kind === 'dismissed') lines.push(`Prosecution strength fell to ${s.pros}, below the ${THRESHOLDS.dismissedPros} needed to keep a case alive.`)
  if (kind === 'mistrial_raccoon') lines.push('A raccoon-related event was triggered, which overrides all math.')
  return lines
}

export function computeVerdict(s: TrialState, def: CaseDef): VerdictResult {
  const secret = [...def.secretEndings].sort((a, b) => b.priority - a.priority).find((e) => check(e.when, s))
  const r = rng(s.seed ^ 0x9e3779b9)
  const mistake = biggestMistake(s)
  const roastCtx = { name: s.defendant, victim: def.victim.name, prosecutor: def.prosecutor.name, charge: def.charge, cred: s.cred, mistake: mistake ?? '' }
  const roast = fill(mistake ? pick(ROAST, r) : pick(ROAST_CLEAN, r), roastCtx)
  const common = {
    margin: computeMargin(s, def),
    credibilityLabel: credibilityLabel(s.cred),
    strongestEvidence: strongestEvidence(s, def),
    biggestMistake: mistake ? `You ${mistake}.` : 'Honestly? Nothing. It was irritating.',
    roast,
  }
  if (secret) {
    return {
      ...common,
      kind: 'secret',
      secretId: secret.id,
      title: secret.title,
      sentence: fill(secret.sentence, roastCtx),
      narration: secret.narration.map((n) => fill(n, roastCtx)),
      explanation: [fill(secret.explanation, roastCtx), ...explain(s, def, 'secret')],
      mood: secret.mood,
    }
  }
  const kind = baseVerdict(s, def)
  return {
    ...common,
    kind,
    title: verdictTitle(kind, def),
    sentence: fill(def.sentences[kind], roastCtx),
    narration: NARRATION[kind],
    explanation: explain(s, def, kind),
    mood: MOODS[kind],
  }
}
