import type { CaseDef, TrialState, VerdictResult } from './types'

export interface Profile {
  version: 1
  achievements: string[]
  /** caseId → verdict kinds (and secret ids as `secret:<id>`) reached */
  completed: Record<string, string[]>
  verdicts: string[]
  plays: number
}

export const emptyProfile = (): Profile => ({ version: 1, achievements: [], completed: {}, verdicts: [], plays: 0 })

export interface AchievementCtx {
  state: TrialState
  def: CaseDef
  result: VerdictResult
  profile: Profile
  totalCases: number
}

export interface AchievementDef {
  id: string
  title: string
  description: string
  hidden?: boolean
  check: (c: AchievementCtx) => boolean
}

const flag = (s: TrialState, f: string) => s.flags.includes(f)

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_gavel', title: 'First Gavel', description: 'Survive (or not) your first trial.', check: () => true },
  {
    id: 'botanist',
    title: 'Botanically Correct',
    description: 'Inform the court that pumpkins are technically a fruit.',
    hidden: true,
    check: ({ state }) => flag(state, 'typed:fruit') || flag(state, 'fruit_argument'),
  },
  {
    id: 'squirrel_whisperer',
    title: 'Squirrel Whisperer',
    description: 'Make a squirrel crack under cross-examination.',
    hidden: true,
    check: ({ state }) => flag(state, 'broke:squirrel'),
  },
  {
    id: 'witness_breaker',
    title: 'You Can’t Handle the Gourd',
    description: 'Expose an inconsistency in any witness’s testimony.',
    check: ({ state }) => state.flags.some((f) => f.startsWith('broke:')),
  },
  {
    id: 'flip_flopper',
    title: 'Flip-Flopper',
    description: 'Contradict yourself three times in a single trial.',
    hidden: true,
    check: ({ state }) => state.contradictions.length >= 3,
  },
  {
    id: 'teflon',
    title: 'Teflon Defendant',
    description: 'Win a not-guilty verdict without a single contradiction.',
    check: ({ state, result }) => result.kind === 'not_guilty' && state.contradictions.length === 0,
  },
  {
    id: 'honest_gourd',
    title: 'Honesty Is the Best Pumpkin',
    description: 'Confess, and still escape a full guilty verdict.',
    hidden: true,
    check: ({ state, result }) => state.claims.includes('confessed') && ['not_guilty', 'lesser', 'dismissed', 'secret'].includes(result.kind),
  },
  {
    id: 'contempt',
    title: 'Contempt of Gourd',
    description: "Drain the judge's patience to zero.",
    hidden: true,
    check: ({ state }) => state.patience <= 0,
  },
  {
    id: 'bench_coup',
    title: 'Bench Coup',
    description: 'Get the judge removed for excessive pettiness.',
    hidden: true,
    check: ({ result }) => result.kind === 'judge_removed',
  },
  {
    id: 'raccoon_justice',
    title: 'Raccoon Justice',
    description: 'Cause a mistrial via extremely suspicious raccoon.',
    hidden: true,
    check: ({ result }) => result.kind === 'mistrial_raccoon',
  },
  {
    id: 'plot_twist',
    title: 'Plot Twist',
    description: 'Unlock any secret ending.',
    hidden: true,
    check: ({ result }) => result.kind === 'secret',
  },
  {
    id: 'prosecutor_speedrun',
    title: 'Prosecutor Speedrun',
    description: 'Get a case dismissed for prosecutorial incompetence.',
    check: ({ result }) => result.kind === 'dismissed',
  },
  {
    id: 'evidence_hoarder',
    title: 'Evidence Hoarder',
    description: 'Examine every exhibit in a case.',
    check: ({ state, def }) => def.evidence.every((e) => state.examined.includes(e.id)),
  },
  {
    id: 'silver_tongue',
    title: 'Silver Tongue',
    description: 'Finish a trial with 90+ credibility.',
    check: ({ state }) => state.cred >= 90,
  },
  {
    id: 'word_salad',
    title: 'Word Salad',
    description: 'Confuse the court with three unrecognised statements.',
    hidden: true,
    check: ({ state }) => state.unrecognized >= 3,
  },
  {
    id: 'pie_enthusiast',
    title: 'Say "Pie" Three Times',
    description: 'Mention pie to a pumpkin judge three times. Why.',
    hidden: true,
    check: ({ state }) => flag(state, 'pie:3'),
  },
  {
    id: 'teachers_pet',
    title: "Teacher's Petal",
    description: 'Flatter the judge into favouritism without getting him fired.',
    hidden: true,
    check: ({ state, result }) => state.petty >= 50 && result.kind !== 'judge_removed',
  },
  {
    id: 'verdict_collector',
    title: 'Verdict Collector',
    description: 'Experience five different kinds of verdict.',
    check: ({ profile }) => profile.verdicts.length >= 5,
  },
  {
    id: 'full_docket',
    title: 'Full Docket',
    description: 'Complete every case on the docket.',
    check: ({ profile, totalCases }) => Object.keys(profile.completed).length >= totalCases,
  },
]

/** Records a finished trial in the profile and returns the updated profile plus newly unlocked achievements. */
export function recordTrial(
  profile: Profile,
  state: TrialState,
  def: CaseDef,
  totalCases: number,
): { profile: Profile; unlocked: AchievementDef[] } {
  const result = state.result
  if (!result) return { profile, unlocked: [] }
  const p: Profile = structuredClone(profile)
  p.plays++
  const key = result.kind === 'secret' ? `secret:${result.secretId}` : result.kind
  p.completed[def.id] = Array.from(new Set([...(p.completed[def.id] ?? []), key]))
  p.verdicts = Array.from(new Set([...p.verdicts, result.kind]))
  const unlocked = ACHIEVEMENTS.filter(
    (a) => !p.achievements.includes(a.id) && a.check({ state, def, result, profile: p, totalCases }),
  )
  p.achievements.push(...unlocked.map((a) => a.id))
  return { profile: p, unlocked }
}

/** Achievements earned in this specific trial (for the verdict screen), regardless of earlier unlocks. */
export function earnedThisTrial(state: TrialState, def: CaseDef, profile: Profile, totalCases: number): AchievementDef[] {
  if (!state.result) return []
  const result = state.result
  return ACHIEVEMENTS.filter((a) => a.check({ state, def, result, profile, totalCases }))
}
