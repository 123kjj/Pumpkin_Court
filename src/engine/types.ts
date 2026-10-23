// ─────────────────────────────────────────────────────────────
//  Pumpkin Supreme Court — core types
//  Everything a case needs is plain data. The engine interprets it.
// ─────────────────────────────────────────────────────────────

export type Stage =
  | 'opening'
  | 'defense'
  | 'cross'
  | 'evidence'
  | 'witnesses'
  | 'closing'
  | 'verdict'

export const STAGE_ORDER: Stage[] = [
  'opening',
  'defense',
  'cross',
  'witnesses',
  'evidence',
  'closing',
  'verdict',
]

export type Mood = 'neutral' | 'suspicious' | 'furious' | 'shocked' | 'smug' | 'laughing'

export type Speaker = 'judge' | 'prosecutor' | 'defendant' | 'witness' | 'clerk'

/** Concepts the keyword matcher can recognise in typed text. */
export type Concept =
  | 'forget'
  | 'accident'
  | 'squirrel'
  | 'raccoon'
  | 'evidence'
  | 'witness'
  | 'innocent'
  | 'confess'
  | 'revenge'
  | 'absent'
  | 'present'
  | 'blame'
  | 'flattery'
  | 'insult'
  | 'fruit'
  | 'pie'
  | 'sorry'
  | 'love'
  | 'silence'
  | 'bribe'
  | 'intent'
  | 'cold'
  | 'art'

/**
 * A serialisable condition. Every populated field must hold (logical AND).
 * `any` holds if at least one sub-condition holds; `not` inverts a sub-condition.
 */
export interface Condition {
  claim?: string | string[]
  anyClaim?: string[]
  noClaim?: string | string[]
  flag?: string | string[]
  anyFlag?: string[]
  noFlag?: string | string[]
  examined?: string | string[]
  presented?: string | string[]
  notPresented?: string | string[]
  defense?: string | string[]
  closing?: string | string[]
  credAtLeast?: number
  credBelow?: number
  prosAtLeast?: number
  prosBelow?: number
  patienceBelow?: number
  pettinessAtLeast?: number
  meterAtLeast?: number
  meterBelow?: number
  contradictionsAtLeast?: number
  contradictionsBelow?: number
  any?: Condition[]
  not?: Condition
}

/** A change to the trial state. All numeric fields are deltas. */
export interface Effect {
  cred?: number
  pros?: number
  patience?: number
  petty?: number
  meter?: number
  claims?: string[]
  flags?: string[]
  unlock?: string[]
  mood?: Mood
  /** Second-person, past tense: "claimed you were in Ohio". Used for recaps and roasts. */
  memo?: string
}

/** A conditional override evaluated at the moment of choosing. First match wins. */
export interface Branch {
  when: Condition
  reply: string
  effect?: Effect
  prosecutor?: string
}

/** Something the defendant can say (defense, cross-examination, closing, contradiction). */
export interface ChoiceOption {
  id: string
  label: string
  /** Phrases (normalised) that make typed input map to this option. */
  keywords?: string[]
  concepts?: Concept[]
  /** Option only appears when this holds. */
  when?: Condition
  reply: string
  effect?: Effect
  prosecutor?: string
  branches?: Branch[]
}

export interface CrossQuestion {
  id: string
  round: 1 | 2 | 3
  when?: Condition
  ask: string
  options: ChoiceOption[]
}

export interface WitnessQuestion {
  id: string
  label: string
  when?: Condition
  answer: string
  effect?: Effect
  branches?: Branch[]
}

export type Portrait =
  | 'squirrel'
  | 'scarecrow'
  | 'raccoon'
  | 'gardener'
  | 'gourd'
  | 'owl'
  | 'ghost'
  | 'fridge'
  | 'crow'
  | 'peas'

export interface Witness {
  id: string
  name: string
  title: string
  portrait: Portrait
  personality: string
  intro: string
  when?: Condition
  /** Facts this witness will always hold to. Shown in the dossier; used to keep testimony consistent. */
  facts: string[]
  questions: WitnessQuestion[]
}

export type EvidenceArt =
  | 'phone'
  | 'photo'
  | 'receipt'
  | 'footprint'
  | 'letter'
  | 'jar'
  | 'scissors'
  | 'chart'
  | 'blanket'
  | 'thermo'
  | 'book'
  | 'can'

export interface Evidence {
  id: string
  name: string
  art: EvidenceArt
  side: 'defense' | 'prosecution' | 'misleading'
  startsUnlocked?: boolean
  /** Short line on the card front. */
  summary: string
  inspect: { text: string; effect?: Effect }
  /** Re-reading of the evidence once context is known (used for misleading evidence). */
  contextInspect?: { when: Condition; text: string; effect?: Effect }
  present: Branch[]
  presentDefault: { reply: string; effect?: Effect }
  /** How strong this is as a headline piece of evidence. */
  weight: number
}

export interface ContradictionRule {
  id: string
  a: string
  b: string
  line: string
  /** Examining this evidence lets the defendant explain the contradiction away. */
  resolveWith?: string
  resolveLine?: string
  penalty?: number
}

export type VerdictKind =
  | 'guilty'
  | 'not_guilty'
  | 'lesser'
  | 'dismissed'
  | 'mistrial_raccoon'
  | 'judge_removed'
  | 'secret'

export interface SecretEnding {
  id: string
  title: string
  priority: number
  when: Condition
  narration: string[]
  sentence: string
  explanation: string
  mood: Mood
}

export interface CaseMeter {
  id: string
  label: string
  start: number
  min: number
  max: number
  unit?: string
  /** True when a low value is good for the defendant. */
  lowIsGood?: boolean
  /** Meter change whenever the defendant types a concept (e.g. saying "pie" eats the court's pie). */
  onTyped?: Partial<Record<Concept, number>>
  /** How many margin points each meter unit (relative to start) is worth in the verdict. */
  verdictWeight?: number
  /** Meter change whenever a contradiction is detected. */
  onContradiction?: number
}

export interface CaseDef {
  id: string
  number: number
  title: string
  shortTitle: string
  statute: string
  charge: string
  lesserCharge: string
  tagline: string
  victim: { name: string; description: string }
  prosecutor: { name: string; title: string }
  mechanic: { name: string; description: string }
  meter?: CaseMeter
  opening: { speaker: Speaker; text: string }[]
  prosecutorArgument: string[]
  defensePrompt: string
  defenses: ChoiceOption[]
  cross: CrossQuestion[]
  witnesses: Witness[]
  witnessBudget?: number
  evidence: Evidence[]
  presentLimit?: number
  contradictions: ContradictionRule[]
  closingPrompt: string
  closings: ChoiceOption[]
  secretEndings: SecretEnding[]
  sentences: Record<Exclude<VerdictKind, 'secret'>, string>
}

// ─────────── Runtime state ───────────

export interface TranscriptLine {
  id: number
  speaker: Speaker
  name: string
  text: string
  mood?: Mood
  tag?: 'contradiction' | 'evidence' | 'witness' | 'interpret' | 'unrecognized' | 'aside' | 'system'
}

export interface LedgerEntry {
  stage: Stage
  reason: string
  cred: number
  pros: number
}

export interface ContradictionRecord {
  ruleId: string
  line: string
  resolved: boolean
  stage: Stage
}

export interface PendingContradiction {
  ruleId: string
}

export interface TrialState {
  version: 1
  caseId: string
  seed: number
  defendant: string
  stage: Stage
  round: number
  claims: string[]
  flags: string[]
  unlocked: string[]
  examined: string[]
  presented: string[]
  asked: string[] // `${witnessId}:${questionId}`
  askedCross: string[]
  contradictions: ContradictionRecord[]
  pending: PendingContradiction | null
  /** Stage progression waiting for the pending contradiction to be answered. */
  deferred: boolean
  cred: number
  pros: number
  patience: number
  petty: number
  meter: number
  unrecognized: number
  defenseChoice: string | null
  closingChoice: string | null
  mood: Mood
  transcript: TranscriptLine[]
  ledger: LedgerEntry[]
  memos: { text: string; impact: number }[]
  /** Net effect (credibility gained minus prosecution gained) of presenting each exhibit. */
  evidenceImpact: Record<string, number>
  result: VerdictResult | null
}

export interface VerdictResult {
  kind: VerdictKind
  secretId?: string
  title: string
  sentence: string
  narration: string[]
  margin: number
  credibilityLabel: string
  strongestEvidence: string
  biggestMistake: string
  roast: string
  explanation: string[]
  mood: Mood
}

export type Action =
  | { type: 'advance' }
  | { type: 'choose'; optionId: string }
  | { type: 'type'; text: string }
  | { type: 'examine'; evidenceId: string }
  | { type: 'present'; evidenceId: string }
  | { type: 'ask'; witnessId: string; questionId: string }

/** What the UI should ask the player right now (for choice-based stages). */
export interface Prompt {
  kind: 'defense' | 'cross' | 'closing' | 'contradiction'
  question: string
  options: ChoiceOption[]
  allowTyping: boolean
}
