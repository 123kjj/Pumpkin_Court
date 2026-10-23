import { describe, expect, it } from 'vitest'
import { CASES, getCase } from '../cases'
import { ACHIEVEMENTS, emptyProfile, recordTrial } from '../engine/achievements'
import { check, unresolvedCount } from '../engine/conditions'
import { createTrial, getPrompt, reduce } from '../engine/engine'
import { analyze, matchOption, normalize } from '../engine/nlp'
import { INSULTS, randomPlaythrough, replay, verdictKey } from '../engine/simulate'
import type { Action, CaseDef, TrialState } from '../engine/types'
import { validateCase } from '../engine/validate'
import { baseVerdict, computeMargin, computeVerdict, meterBonus, THRESHOLDS } from '../engine/verdict'

const neglect = getCase('neglect')!
const fridge = getCase('fridge')!

const run = (def: CaseDef, actions: Action[], seed = 7) => replay(def, actions, seed)
const choose = (optionId: string): Action => ({ type: 'choose', optionId })
const ask = (witnessId: string, questionId: string): Action => ({ type: 'ask', witnessId, questionId })
const examine = (evidenceId: string): Action => ({ type: 'examine', evidenceId })
const present = (evidenceId: string): Action => ({ type: 'present', evidenceId })
const advance: Action = { type: 'advance' }
const say = (text: string): Action => ({ type: 'type', text })

// ─────────── keyword matcher ───────────

describe('nlp', () => {
  it('normalises contractions and apostrophe-less forms', () => {
    expect(normalize("I didn't do it, I'm innocent!")).toBe('i did not do it i am innocent')
    expect(normalize('i wasnt there')).toBe('i was not there')
  })

  it('detects concepts and flips them under negation', () => {
    expect(analyze('I forgot to water him').concepts).toContain('forget')
    const neg = analyze('I did not forget him')
    expect(neg.concepts).not.toContain('forget')
    expect(neg.concepts).toContain('innocent')
    const ng = analyze('Not guilty, your honor')
    expect(ng.concepts).toContain('innocent')
    expect(ng.concepts).not.toContain('confess')
    expect(analyze('I was not there that night').concepts).toContain('absent')
  })

  it('stems plurals and verb forms', () => {
    expect(analyze('The squirrels did this').concepts).toContain('squirrel')
    expect(analyze('totally an accident, I tripped').concepts).toContain('accident')
  })

  it('maps free text to the best available option, or to nothing', () => {
    const opts = neglect.defenses
    expect(matchOption('honestly it was that squirrel', opts).option?.id).toBe('squirrel')
    expect(matchOption("I didn't forget, I was away in Ohio", opts).option?.id).toBe('vacation')
    expect(matchOption('I installed a drip system and it got sabotaged', opts).option?.id).toBe('sprinkler')
    expect(matchOption('banana phone', opts).option).toBeNull()
  })
})

// ─────────── conditions ───────────

describe('conditions', () => {
  it('evaluates AND / any / not over trial state', () => {
    const s = createTrial(neglect, 'T', 1)
    s.claims.push('absent')
    s.flags.push('x')
    s.cred = 70
    expect(check({ claim: 'absent', flag: 'x', credAtLeast: 70 }, s)).toBe(true)
    expect(check({ claim: ['absent', 'present'] }, s)).toBe(false)
    expect(check({ any: [{ claim: 'present' }, { flag: 'x' }] }, s)).toBe(true)
    expect(check({ not: { flag: 'x' } }, s)).toBe(false)
    expect(check({ noClaim: 'present', credBelow: 71 }, s)).toBe(true)
  })
})

// ─────────── decision engine ───────────

describe('trial flow', () => {
  it('opens, takes a defense and runs three rounds of cross-examination that depend on that defense', () => {
    const a = run(neglect, [advance, choose('vacation')])
    expect(a.stage).toBe('cross')
    expect(a.askedCross[0]).toBe('q1_ohio')
    const b = run(neglect, [advance, choose('squirrel')])
    expect(b.askedCross[0]).toBe('q1_squirrel')
    const c = run(neglect, [advance, choose('vacation'), choose('drip'), choose('oct2'), choose('tried')])
    expect(c.askedCross).toEqual(['q1_ohio', 'q2_drip', 'q3_default'])
    expect(c.stage).toBe('witnesses')
  })

  it('different choices produce different judge dialogue', () => {
    const judgeLines = (s: TrialState) => s.transcript.filter((l) => l.speaker === 'judge').map((l) => l.text).join('|')
    const a = run(neglect, [advance, choose('forgot')])
    const b = run(neglect, [advance, choose('squirrel')])
    expect(judgeLines(a)).not.toEqual(judgeLines(b))
    expect(judgeLines(a)).toContain('YOU FORGOT?')
  })

  it('unlocks a witness only when the story points to them', () => {
    const s = run(neglect, [advance, choose('vacation'), choose('drip'), choose('oct2'), choose('tried')])
    expect(getPrompt(s, neglect)).toBeNull()
    const ids = neglect.witnesses.filter((w) => check(w.when, s)).map((w) => w.id)
    expect(ids).not.toContain('squirrel')
    const s2 = reduce(s, examine('calendar'), neglect)
    expect(neglect.witnesses.filter((w) => check(w.when, s2)).map((w) => w.id)).toContain('squirrel')
  })

  it('handles typed input: matched text picks an option and is labelled; nonsense costs patience', () => {
    const s = run(neglect, [advance, say('Honestly, a squirrel did this')])
    expect(s.defenseChoice).toBe('squirrel')
    expect(s.transcript.some((l) => l.tag === 'interpret')).toBe(true)
    const t = run(neglect, [advance, say('banana phone')])
    expect(t.stage).toBe('defense')
    expect(t.unrecognized).toBe(1)
    expect(t.patience).toBe(95)
    expect(t.transcript.at(-1)?.tag).toBe('unrecognized')
  })

  it('ignores impossible actions instead of crashing', () => {
    const s = run(neglect, [advance, choose('not-an-option'), present('selfie'), ask('squirrel', 'gavel'), examine('acorn_ledger')])
    expect(s.stage).toBe('defense')
    expect(s.presented).toEqual([])
    expect(s.examined).toEqual([])
  })
})

describe('contradictions', () => {
  it('detects contradictions between claims, interrupts, and defers the next question', () => {
    const s = run(neglect, [advance, choose('forgot'), choose('flip_ohio')])
    expect(s.contradictions.map((c) => c.ruleId).sort()).toEqual(['g_absent_present', 'g_innocent_confessed'])
    expect(s.pending).not.toBeNull()
    expect(s.deferred).toBe(true)
    expect(s.round).toBe(1)
    expect(getPrompt(s, neglect)?.kind).toBe('contradiction')
    const after1 = reduce(s, choose('c_misspoke'), neglect)
    expect(after1.pending).not.toBeNull() // second contradiction still waiting
    expect(unresolvedCount(after1)).toBe(1)
    const after2 = reduce(after1, choose('c_double'), neglect)
    expect(after2.pending).toBeNull()
    expect(after2.round).toBe(2)
    expect(unresolvedCount(after2)).toBe(1)
    expect(after2.flags).toContain('doubled_down')
  })

  it('lets evidence explain a contradiction away, refunding credibility', () => {
    const base: Action[] = [advance, choose('blanket'), examine('blanket_receipt'), choose('no_blanket')]
    const s = run(fridge, base)
    const prompt = getPrompt(s, fridge)!
    expect(prompt.kind).toBe('contradiction')
    expect(prompt.options.map((o) => o.id)).toContain('c_resolve')
    const credBefore = s.cred
    const r = reduce(s, choose('c_resolve'), fridge)
    expect(r.contradictions.find((c) => c.ruleId === 'f_blanket')?.resolved).toBe(true)
    expect(r.cred).toBeGreaterThan(credBefore)
    // without examining the receipt, the evidence option is not offered
    const noEv = run(fridge, [advance, choose('blanket'), choose('no_blanket')])
    expect(getPrompt(noEv, fridge)!.options.map((o) => o.id)).not.toContain('c_resolve')
  })

  it('does not record the same contradiction twice', () => {
    const s = run(neglect, [advance, choose('watered'), choose('most_days'), choose('c_double')])
    const ids = s.contradictions.map((c) => c.ruleId)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('evidence', () => {
  it('re-reads misleading evidence once the right context is known', () => {
    const s = run(neglect, [advance, choose('vacation'), choose('drip'), choose('oct2'), choose('tried'), examine('calendar')])
    const prosAfterFirstLook = s.pros
    expect(s.flags).toContain('calendar_suspicious')
    const s2 = reduce(reduce(s, examine('calendar'), neglect), examine('calendar'), neglect)
    expect(s2.pros).toBe(prosAfterFirstLook) // nothing new without context
    const s3 = reduce(reduce(s, ask('squirrel', 'calendar'), neglect), examine('calendar'), neglect)
    expect(s3.flags).toContain('ctx:calendar')
    expect(s3.pros).toBeLessThan(prosAfterFirstLook)
  })

  it('presenting evidence changes the score depending on what you claimed', () => {
    const consistent = run(neglect, [advance, choose('vacation'), choose('nobody'), choose('irrelevant'), choose('tried'), advance, present('boarding_pass')])
    // claim to be home, then blurt out Ohio (two contradictions, doubled down on), then present the pass
    const self_own = run(neglect, [advance, choose('watered'), choose('seven'), choose('actually_ohio'), choose('c_double'), choose('c_double'), choose('consistent'), advance, present('boarding_pass')])
    expect(self_own.askedCross[2]).toBe('q3_contra') // and contradictions change the third
    expect(self_own.askedCross[1]).toBe('q2_present') // claiming to be home changes the next question
    expect(consistent.cred).toBeGreaterThan(self_own.cred)
    expect(self_own.memos.some((m) => m.text.includes('disproved your own story'))).toBe(true)
  })

  it('enforces the presentation limit', () => {
    const s = run(neglect, [advance, choose('sprinkler'), choose('family'), choose('oct2'), choose('tried'), advance, present('calendar'), present('selfie'), present('drip_receipt')])
    expect(s.presented).toHaveLength(2)
  })
})

describe('witnesses', () => {
  it('witnesses hold their facts: pressing without evidence gets a denial, with evidence a confession', () => {
    const toWitnesses: Action[] = [advance, choose('sprinkler'), choose('family'), choose('oct2'), choose('tried'), ask('gourdelia', 'texts')]
    const denial = run(neglect, [...toWitnesses, examine('calendar')])
    expect(neglect.witnesses.find((w) => w.id === 'squirrel')!.questions.find((q) => q.id === 'hose')!.when).toBeDefined()
    // hose question requires the chewed tube to have been examined (flag hose_chewed)
    const d2 = reduce(denial, ask('squirrel', 'hose'), neglect)
    expect(d2.flags).not.toContain('broke:squirrel')
    const confess = run(neglect, [...toWitnesses, examine('chewed_hose'), ask('squirrel', 'hose')])
    expect(confess.flags).toContain('broke:squirrel')
    expect(confess.unlocked).toContain('acorn_ledger')
  })

  it('a witness contradicts a defendant who lies to the court', () => {
    const home = run(neglect, [advance, choose('watered'), choose('seven'), choose('dramatic'), choose('tried'), ask('scarecrow', 'saw')])
    const ohio = run(neglect, [advance, choose('vacation'), choose('nobody'), choose('no_idea'), choose('tried'), ask('scarecrow', 'saw')])
    expect(home.transcript.at(-1)!.text).toContain('SUITCASE')
    expect(ohio.cred - 50).toBeGreaterThan(home.cred - 50)
  })

  it('enforces the question budget', () => {
    const s = run(neglect, [advance, choose('vacation'), choose('drip'), choose('oct2'), choose('tried'), ask('scarecrow', 'saw'), ask('scarecrow', 'direction'), ask('scarecrow', 'unusual'), ask('scarecrow', 'crows'), ask('gourdelia', 'state'), ask('gourdelia', 'texts')])
    expect(s.asked).toHaveLength(5)
  })
})

// ─────────── verdicts ───────────

const CLEAN_WIN: Action[] = [
  advance,
  choose('vacation'),
  choose('drip'),
  choose('oct2'),
  choose('tried'),
  ask('gourdelia', 'texts'),
  examine('chewed_hose'),
  ask('scarecrow', 'saw'),
  ask('scarecrow', 'direction'),
  advance,
  examine('boarding_pass'),
  examine('drip_receipt'),
  present('boarding_pass'),
  present('drip_receipt'),
  advance,
  choose('evidence'),
]

const SURE_LOSS: Action[] = [advance, choose('forgot'), choose('blend'), choose('wrong_pumpkin'), choose('more_water'), advance, present('selfie'), advance, choose('faker')]

describe('verdicts', () => {
  it('a consistent, evidence-backed defense wins', () => {
    const s = run(neglect, CLEAN_WIN)
    expect(s.result?.kind).toBe('not_guilty')
    expect(s.contradictions).toHaveLength(0)
    expect(s.result!.strongestEvidence).toMatch(/Gourd Depot Receipt|Boarding Pass/)
  })

  it('a self-sabotaging defense loses, and the roast names the worst moment', () => {
    const s = run(neglect, SURE_LOSS)
    expect(s.result?.kind).toBe('guilty')
    expect(s.result!.biggestMistake).toMatch(/^You /)
    expect(s.result!.explanation.at(-1)).toMatch(/^Final math/)
  })

  it('the prosecutor-culprit secret ending follows the acorn trail', () => {
    const s = run(neglect, [
      advance,
      choose('sprinkler'),
      choose('family'),
      choose('oct2'),
      choose('tried'),
      ask('gourdelia', 'texts'),
      examine('chewed_hose'),
      ask('squirrel', 'hose'),
      examine('acorn_ledger'),
      advance,
      present('acorn_ledger'),
      advance,
      choose('evidence'),
    ])
    expect(verdictKey(s)).toBe('secret:prosecutor_culprit')
  })

  it('the squirrel steals the gavel from an exhausted judge', () => {
    const s = run(neglect, [
      advance,
      say('you rotten clown'),
      say('shut up you moldy gourd'),
      say('stupid pie filling'),
      say('I hate you, idiot'),
      say('you ugly loser'),
      choose('squirrel'),
      choose('chewed'),
      choose('oct2'),
      choose('tried'),
      ask('squirrel', 'gavel'),
      advance,
      advance,
      choose('mercy'),
    ])
    expect(s.patience).toBeLessThan(30)
    expect(verdictKey(s)).toBe('secret:squirrel_judge')
  })

  it('outcomes are reproducible: the same choices give the same verdict whatever the joke seed', () => {
    for (const def of CASES) {
      for (let i = 0; i < 25; i++) {
        const { state, actions } = randomPlaythrough(def, 500 + i)
        const again = replay(def, actions, 99999 + i)
        expect(again.result?.kind).toBe(state.result?.kind)
        expect(again.result?.secretId).toBe(state.result?.secretId)
        expect([again.cred, again.pros, again.patience, again.petty, again.meter]).toEqual([state.cred, state.pros, state.patience, state.petty, state.meter])
      }
    }
  })

  it('applies the verdict ladder in priority order', () => {
    const s = createTrial(neglect, 'T', 1)
    s.meter = neglect.meter!.start
    Object.assign(s, { cred: 80, pros: 40 })
    expect(baseVerdict(s, neglect)).toBe('not_guilty')
    Object.assign(s, { cred: 50, pros: 55 })
    expect(baseVerdict(s, neglect)).toBe('lesser')
    Object.assign(s, { cred: 20, pros: 80 })
    expect(baseVerdict(s, neglect)).toBe('guilty')
    Object.assign(s, { pros: 10 })
    expect(baseVerdict(s, neglect)).toBe('dismissed')
    s.flags.push('raccoon_mistrial')
    expect(baseVerdict(s, neglect)).toBe('mistrial_raccoon')
    s.petty = THRESHOLDS.pettyRemoval
    expect(baseVerdict(s, neglect)).toBe('judge_removed')
  })

  it('unresolved contradictions, contempt and the case meter all move the margin', () => {
    const s = createTrial(neglect, 'T', 1)
    const m0 = computeMargin(s, neglect)
    s.contradictions.push({ ruleId: 'x', line: '', resolved: false, stage: 'cross' })
    expect(computeMargin(s, neglect)).toBe(m0 - THRESHOLDS.contradictionWeight)
    s.patience = 0
    expect(computeMargin(s, neglect)).toBe(m0 - THRESHOLDS.contradictionWeight - THRESHOLDS.contemptPenalty)
    s.meter = 0 // all nine days accounted for, low is good
    expect(meterBonus(s, neglect)).toBe(9)
  })

  it('secret endings take priority over the base ladder', () => {
    const s = createTrial(neglect, 'T', 1)
    s.flags.push('prosecutor_exposed')
    s.petty = 120
    expect(computeVerdict(s, neglect).kind).toBe('secret')
  })
})

// ─────────── every case ───────────

describe('all cases', () => {
  it('pass static validation (no dangling IDs, every round has a fallback)', () => {
    for (const def of CASES) expect(validateCase(def), def.id).toEqual([])
  })

  it('has at least six distinct cases with witnesses, evidence and endings', () => {
    expect(CASES.length).toBeGreaterThanOrEqual(6)
    expect(new Set(CASES.map((c) => c.mechanic.name)).size).toBe(CASES.length)
    for (const def of CASES) {
      expect(def.witnesses.length).toBeGreaterThanOrEqual(2)
      expect(def.evidence.length).toBeGreaterThanOrEqual(4)
      expect(def.secretEndings.length).toBeGreaterThanOrEqual(1)
      expect(def.cross.length).toBeGreaterThanOrEqual(3)
    }
  })

  it('can always be finished: 300 random playthroughs per case, no dead ends', () => {
    for (const def of CASES) {
      for (let i = 0; i < 300; i++) expect(randomPlaythrough(def, i * 13 + 1).state.result, `${def.id} seed ${i}`).not.toBeNull()
    }
  }, 60000)

  it('every verdict and secret ending is reachable through legitimate choices', () => {
    for (const def of CASES) {
      const seen = new Set<string>()
      for (let i = 0; i < 700; i++) seen.add(verdictKey(randomPlaythrough(def, i).state))
      for (let i = 0; i < 250; i++) seen.add(verdictKey(randomPlaythrough(def, 9000 + i, { typeRate: 0.5, junk: INSULTS }).state))
      const required = ['guilty', 'not_guilty', 'lesser', 'dismissed', 'judge_removed', ...def.secretEndings.map((e) => `secret:${e.id}`)]
      if (def.id === 'influencer' || def.id === 'fridge') required.push('mistrial_raccoon')
      for (const k of required) expect(seen.has(k), `${def.id} → ${k} (saw ${[...seen].join(', ')})`).toBe(true)
    }
  }, 180000)

  it('state never leaks between trials or cases', () => {
    const a = run(neglect, CLEAN_WIN)
    const b = createTrial(fridge, 'Kriti', 3)
    expect(b.caseId).toBe('fridge')
    expect(b.claims).toEqual([])
    expect(b.flags).toEqual([])
    expect(b.cred).toBe(50)
    expect(a.caseId).toBe('neglect')
    expect(() => reduce(a, advance, fridge)).toThrow(/Case mismatch/)
    // reduce never mutates its input
    const before = JSON.stringify(b)
    reduce(b, advance, fridge)
    expect(JSON.stringify(b)).toBe(before)
  })
})

// ─────────── achievements ───────────

describe('achievements', () => {
  it('defines at least ten achievements with unique ids', () => {
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(10)
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length)
  })

  it('unlocks on the right conditions and only once', () => {
    const win = run(neglect, CLEAN_WIN)
    const { profile, unlocked } = recordTrial(emptyProfile(), win, neglect, CASES.length)
    const ids = unlocked.map((a) => a.id)
    expect(ids).toContain('first_gavel')
    expect(ids).toContain('teflon')
    expect(ids).toContain('witness_breaker')
    expect(ids).not.toContain('bench_coup')
    const again = recordTrial(profile, win, neglect, CASES.length)
    expect(again.unlocked).toEqual([])
    expect(again.profile.plays).toBe(2)
  })

  it('awards Full Docket after every case is completed', () => {
    let p = emptyProfile()
    let last: string[] = []
    for (const def of CASES) {
      const s = randomPlaythrough(def, 4).state
      const r = recordTrial(p, s, def, CASES.length)
      p = r.profile
      last = r.unlocked.map((a) => a.id)
    }
    expect(last).toContain('full_docket')
  })
})
