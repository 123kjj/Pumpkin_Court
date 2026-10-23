// Automated playthroughs. Used by tests to prove every case can be finished and
// that each verdict / secret ending is reachable through legitimate choices.
import {
  availableQuestions,
  availableWitnesses,
  createTrial,
  getPrompt,
  presentLimit,
  reduce,
  unlockedEvidence,
  witnessBudget,
} from './engine'
import { rng } from './rng'
import type { Action, CaseDef, TrialState } from './types'

const JUNK = ['banana phone', 'I plead the fifth', 'pie', 'your honor is wise and majestic', 'asdf qwerty', 'it was the squirrel', 'I was not there', 'I did it', 'pumpkins are technically fruit']

export interface PolicyOptions {
  /** Probability of typing instead of clicking when a prompt is open. */
  typeRate?: number
  junk?: string[]
  maxSteps?: number
}

export const INSULTS = ['you are a rotten moldy clown', 'shut up you ugly gourd', 'stupid pie filling', 'I hate you, idiot']

export function randomPlaythrough(def: CaseDef, seed: number, opts: PolicyOptions = {}): { state: TrialState; actions: Action[] } {
  const { typeRate = 0.08, junk = JUNK, maxSteps = 400 } = opts
  const r = rng(seed)
  let s = createTrial(def, 'Tester', seed)
  const actions: Action[] = []
  const act = (a: Action) => {
    actions.push(a)
    s = reduce(s, a, def)
  }
  for (let step = 0; step < maxSteps && !s.result; step++) {
    const prompt = getPrompt(s, def)
    if (prompt) {
      if (r() < typeRate) act({ type: 'type', text: junk[Math.floor(r() * junk.length)] })
      else act({ type: 'choose', optionId: prompt.options[Math.floor(r() * prompt.options.length)].id })
      continue
    }
    if (s.stage === 'opening') {
      act({ type: 'advance' })
      continue
    }
    if (s.stage === 'evidence') {
      const ev = unlockedEvidence(s, def)
      for (const e of ev) if (r() < 0.8) act({ type: 'examine', evidenceId: e.id })
      // re-examine for context readings
      for (const e of ev) if (r() < 0.3) act({ type: 'examine', evidenceId: e.id })
      const shuffled = [...unlockedEvidence(s, def)].sort(() => r() - 0.5)
      for (const e of shuffled.slice(0, presentLimit(def))) if (r() < 0.75 && !s.pending) act({ type: 'present', evidenceId: e.id })
      if (!s.pending) act({ type: 'advance' })
      continue
    }
    if (s.stage === 'witnesses') {
      for (const e of unlockedEvidence(s, def)) if (r() < 0.6 && !s.pending) act({ type: 'examine', evidenceId: e.id })
      let guard = 0
      while (s.asked.length < witnessBudget(def) && !s.pending && guard++ < 20) {
        const options = availableWitnesses(s, def).flatMap((w) => availableQuestions(s, w).map((q) => [w.id, q.id] as const))
        if (!options.length) break
        const [w, q] = options[Math.floor(r() * options.length)]
        act({ type: 'ask', witnessId: w, questionId: q })
        // examine anything newly unlocked mid-testimony, sometimes
        for (const e of unlockedEvidence(s, def)) if (!s.examined.includes(e.id) && r() < 0.5 && !s.pending) act({ type: 'examine', evidenceId: e.id })
      }
      if (!s.pending) act({ type: 'advance' })
      continue
    }
    break
  }
  return { state: s, actions }
}

export function verdictKey(s: TrialState): string {
  if (!s.result) return 'unfinished'
  return s.result.kind === 'secret' ? `secret:${s.result.secretId}` : s.result.kind
}

/** Replays a recorded action list on a fresh trial. */
export function replay(def: CaseDef, actions: Action[], seed = 1, name = 'Tester'): TrialState {
  return actions.reduce((s, a) => reduce(s, a, def), createTrial(def, name, seed))
}
