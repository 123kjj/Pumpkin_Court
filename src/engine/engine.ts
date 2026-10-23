// ─────────────────────────────────────────────────────────────
//  The trial engine: a pure reducer over TrialState.
//  reduce(state, action, case) → new state. No side effects, no AI.
// ─────────────────────────────────────────────────────────────
import { check, unresolvedCount } from './conditions'
import {
  ASIDES,
  BUDGET_DONE,
  CONTRADICTION_OPEN,
  CONTRADICTION_RESOLVED,
  INTERPRET,
  JUDGE,
  PATIENCE_WARN,
  PRESENT_LIMIT,
  STAGE_INTRO,
  UNRECOGNIZED,
  decorate,
  fill,
  type FillCtx,
} from './dialogue'
import { matchOption, type Analysis } from './nlp'
import { pick, rng } from './rng'
import type {
  Action,
  CaseDef,
  ChoiceOption,
  ContradictionRule,
  Effect,
  Evidence,
  Mood,
  Prompt,
  Speaker,
  Stage,
  TrialState,
  TranscriptLine,
  Witness,
} from './types'
import { computeVerdict } from './verdict'

export const START = { cred: 50, pros: 60, patience: 100, petty: 0 } as const
export const DEFAULT_WITNESS_BUDGET = 5
export const DEFAULT_PRESENT_LIMIT = 2
export const CLERK = 'Court Clerk Boo'

export const GLOBAL_CONTRADICTIONS: ContradictionRule[] = [
  {
    id: 'g_innocent_confessed',
    a: 'innocent',
    b: 'confessed',
    line: 'You told this court you were innocent. You ALSO told this court you did it. Which one is it, Schrödinger’s defendant?',
    penalty: 12,
  },
  {
    id: 'g_absent_present',
    a: 'absent',
    b: 'present',
    line: 'Earlier you were nowhere near the scene. Now you were right there. Did you teleport? Bailiff, check whether the defendant is a ghost.',
    penalty: 12,
  },
  {
    id: 'g_accident_intent',
    a: 'accident',
    b: 'intentional',
    line: 'First it was an accident. Now it was on purpose. Make up your mind or the court will make it up for you, and the court is in a mood.',
    penalty: 10,
  },
]

// ─────────── helpers ───────────

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const uniqPush = (list: string[], v: string) => {
  if (!list.includes(v)) list.push(v)
}

export function allContradictionRules(def: CaseDef): ContradictionRule[] {
  return [...GLOBAL_CONTRADICTIONS, ...def.contradictions]
}

function ctx(d: TrialState, def: CaseDef): FillCtx {
  return {
    name: d.defendant,
    victim: def.victim.name,
    prosecutor: def.prosecutor.name,
    charge: def.charge,
    judge: JUDGE,
    meter: d.meter,
    cred: d.cred,
  }
}

const flavour = (d: TrialState) => rng(d.seed + d.transcript.length * 7919)

function say(
  d: TrialState,
  def: CaseDef,
  speaker: Speaker,
  text: string,
  opts: { name?: string; mood?: Mood; tag?: TranscriptLine['tag'] } = {},
) {
  const names: Record<Speaker, string> = {
    judge: JUDGE,
    prosecutor: def.prosecutor.name,
    defendant: d.defendant,
    witness: opts.name ?? 'Witness',
    clerk: CLERK,
  }
  d.transcript.push({
    id: d.transcript.length,
    speaker,
    name: opts.name ?? names[speaker],
    text: fill(text, ctx(d, def)),
    mood: opts.mood,
    tag: opts.tag,
  })
}

function judge(d: TrialState, def: CaseDef, text: string, mood: Mood, tag?: TranscriptLine['tag'], decorated = true) {
  d.mood = mood
  say(d, def, 'judge', decorated ? decorate(text, mood, flavour(d)) : text, { mood, tag })
}

export function mergeEffects(a: Effect | undefined, b: Effect | undefined): Effect {
  if (!a) return { ...(b ?? {}) }
  if (!b) return { ...a }
  const num = (k: 'cred' | 'pros' | 'patience' | 'petty' | 'meter') =>
    a[k] === undefined && b[k] === undefined ? undefined : (a[k] ?? 0) + (b[k] ?? 0)
  const list = (k: 'claims' | 'flags' | 'unlock') =>
    a[k] || b[k] ? [...(a[k] ?? []), ...(b[k] ?? [])] : undefined
  return {
    cred: num('cred'),
    pros: num('pros'),
    patience: num('patience'),
    petty: num('petty'),
    meter: num('meter'),
    claims: list('claims'),
    flags: list('flags'),
    unlock: list('unlock'),
    mood: b.mood ?? a.mood,
    memo: b.memo ?? a.memo,
  }
}

function deriveMood(d: TrialState, dc: number, dp: number): Mood {
  if (d.patience <= 20) return 'furious'
  if (dc >= 8 || dp <= -8) return 'shocked'
  if (dc <= -8 || dp >= 8) return 'smug'
  if (unresolvedCount(d) > 0) return 'suspicious'
  if (d.petty >= 60) return 'smug'
  return 'neutral'
}

/** Apply numeric/flag/unlock parts of an effect. Claims are handled by addClaims so replies precede contradictions. */
function applyEffect(d: TrialState, def: CaseDef, e: Effect | undefined, reason: string): { dc: number; dp: number } {
  if (!e) return { dc: 0, dp: 0 }
  const c0 = d.cred
  const p0 = d.pros
  const pat0 = d.patience
  if (e.cred) d.cred = clamp(d.cred + e.cred, 0, 100)
  if (e.pros) d.pros = clamp(d.pros + e.pros, 0, 100)
  const dc = d.cred - c0
  const dp = d.pros - p0
  if (dc || dp) d.ledger.push({ stage: d.stage, reason: e.memo ?? reason, cred: dc, pros: dp })
  if (e.patience) d.patience = clamp(d.patience + e.patience, 0, 100)
  if (e.petty) d.petty = clamp(d.petty + e.petty, 0, 150)
  if (e.meter && def.meter) d.meter = clamp(d.meter + e.meter, def.meter.min, def.meter.max)
  if (e.memo) d.memos.push({ text: e.memo, impact: dc - dp })
  for (const f of e.flags ?? []) uniqPush(d.flags, f)
  for (const id of e.unlock ?? []) {
    const ev = def.evidence.find((x) => x.id === id)
    if (ev && !d.unlocked.includes(id)) {
      d.unlocked.push(id)
      say(d, def, 'clerk', `New exhibit entered into evidence: “${ev.name}”.`, { tag: 'evidence' })
    }
  }
  if (e.mood) d.mood = e.mood
  patienceCheck(d, def, pat0)
  return { dc, dp }
}

function patienceCheck(d: TrialState, def: CaseDef, before: number) {
  const r = flavour(d)
  if (before > 50 && d.patience <= 50) say(d, def, 'clerk', pick(PATIENCE_WARN.half, r), { tag: 'aside' })
  else if (before > 25 && d.patience <= 25 && d.patience > 0) judge(d, def, pick(PATIENCE_WARN.low, r), 'furious', 'aside', false)
  else if (before > 0 && d.patience <= 0) {
    uniqPush(d.flags, 'contempt')
    judge(d, def, pick(PATIENCE_WARN.zero, r), 'furious', 'aside', false)
  }
}

function addClaims(d: TrialState, def: CaseDef, claims: string[] | undefined) {
  if (!claims?.length) return
  const fresh = claims.filter((c) => !d.claims.includes(c))
  for (const c of fresh) d.claims.push(c)
  detectContradictions(d, def, fresh)
}

/** Detect contradictions introduced by newly made claims. Exported for tests. */
export function detectContradictions(d: TrialState, def: CaseDef, fresh: string[]) {
  for (const rule of allContradictionRules(def)) {
    if (d.contradictions.some((c) => c.ruleId === rule.id)) continue
    const hit = fresh.some(
      (nc) => (nc === rule.a && d.claims.includes(rule.b)) || (nc === rule.b && d.claims.includes(rule.a)),
    )
    if (!hit) continue
    const penalty = rule.penalty ?? 10
    d.contradictions.push({ ruleId: rule.id, line: rule.line, resolved: false, stage: d.stage })
    const c0 = d.cred
    const pat0 = d.patience
    d.cred = clamp(d.cred - penalty, 0, 100)
    d.patience = clamp(d.patience - 10, 0, 100)
    d.ledger.push({ stage: d.stage, reason: 'contradicted yourself', cred: d.cred - c0, pros: 0 })
    d.memos.push({ text: 'told the court two stories that cannot both be true', impact: d.cred - c0 })
    const r = flavour(d)
    judge(d, def, `${pick(CONTRADICTION_OPEN, r)} ${rule.line}`, unresolvedCount(d) > 1 ? 'furious' : 'suspicious', 'contradiction', false)
    patienceCheck(d, def, pat0)
    if (def.meter?.onContradiction) d.meter = clamp(d.meter + def.meter.onContradiction, def.meter.min, def.meter.max)
    if (!d.pending) d.pending = { ruleId: rule.id }
  }
}

// ─────────── public API ───────────

export function createTrial(def: CaseDef, defendant: string, seed: number): TrialState {
  const d: TrialState = {
    version: 1,
    caseId: def.id,
    seed: seed >>> 0,
    defendant: defendant.trim().slice(0, 32) || 'The Defendant',
    stage: 'opening',
    round: 0,
    claims: [],
    flags: [],
    unlocked: def.evidence.filter((e) => e.startsUnlocked).map((e) => e.id),
    examined: [],
    presented: [],
    asked: [],
    askedCross: [],
    contradictions: [],
    pending: null,
    deferred: false,
    cred: START.cred,
    pros: START.pros,
    patience: START.patience,
    petty: START.petty,
    meter: def.meter?.start ?? 0,
    unrecognized: 0,
    defenseChoice: null,
    closingChoice: null,
    mood: 'neutral',
    transcript: [],
    ledger: [],
    memos: [],
    evidenceImpact: {},
    result: null,
  }
  say(d, def, 'clerk', `All rise! The Pumpkin Supreme Court is now in session. ${JUDGE} presiding.`, { tag: 'system' })
  for (const line of def.opening) {
    if (line.speaker === 'judge') judge(d, def, line.text, 'neutral', undefined, false)
    else say(d, def, line.speaker, line.text)
  }
  return d
}

export function visibleOptions(options: ChoiceOption[], d: TrialState): ChoiceOption[] {
  return options.filter((o) => check(o.when, d))
}

export function currentCrossQuestion(d: TrialState, def: CaseDef) {
  if (d.stage !== 'cross') return null
  const id = d.askedCross[d.round - 1]
  return def.cross.find((q) => q.id === id) ?? null
}

function contradictionOptions(d: TrialState, def: CaseDef): ChoiceOption[] {
  const rule = allContradictionRules(def).find((r) => r.id === d.pending?.ruleId)
  const opts: ChoiceOption[] = []
  if (rule?.resolveWith && d.examined.includes(rule.resolveWith)) {
    const ev = def.evidence.find((e) => e.id === rule.resolveWith)
    opts.push({
      id: 'c_resolve',
      label: `I can explain — look at the ${ev?.name ?? 'evidence'}.`,
      keywords: ['explain', 'look at', ...(ev ? [ev.name] : [])],
      concepts: ['evidence'],
      reply: '',
    })
  }
  opts.push(
    {
      id: 'c_misspoke',
      label: 'I misspoke, Your Honor. Please strike my earlier statement.',
      keywords: ['misspoke', 'strike', 'correct', 'take it back', 'mistake'],
      concepts: ['sorry'],
      reply: '',
    },
    {
      id: 'c_double',
      label: 'I stand by BOTH statements. They are both true.',
      keywords: ['both', 'stand by', 'both true', 'both statements'],
      reply: '',
    },
    {
      id: 'c_steno',
      label: 'The stenographer clearly misheard me.',
      keywords: ['stenographer', 'misheard', 'typo', 'record is wrong', 'misquoted'],
      concepts: ['blame'],
      reply: '',
    },
  )
  return opts
}

export function getPrompt(d: TrialState, def: CaseDef): Prompt | null {
  if (d.result) return null
  if (d.pending) {
    const rule = allContradictionRules(def).find((r) => r.id === d.pending!.ruleId)
    return {
      kind: 'contradiction',
      question: `Explain this contradiction: ${rule?.line ?? ''}`,
      options: contradictionOptions(d, def),
      allowTyping: true,
    }
  }
  if (d.stage === 'defense')
    return { kind: 'defense', question: def.defensePrompt, options: visibleOptions(def.defenses, d), allowTyping: true }
  if (d.stage === 'cross') {
    const q = currentCrossQuestion(d, def)
    if (!q) return null
    return { kind: 'cross', question: q.ask, options: visibleOptions(q.options, d), allowTyping: true }
  }
  if (d.stage === 'closing')
    return { kind: 'closing', question: def.closingPrompt, options: visibleOptions(def.closings, d), allowTyping: true }
  return null
}

export const witnessBudget = (def: CaseDef) => def.witnessBudget ?? DEFAULT_WITNESS_BUDGET
export const presentLimit = (def: CaseDef) => def.presentLimit ?? DEFAULT_PRESENT_LIMIT
export const availableWitnesses = (d: TrialState, def: CaseDef): Witness[] => def.witnesses.filter((w) => check(w.when, d))
export const availableQuestions = (d: TrialState, w: Witness) =>
  w.questions.filter((q) => check(q.when, d) && !d.asked.includes(`${w.id}:${q.id}`))
export const unlockedEvidence = (d: TrialState, def: CaseDef): Evidence[] =>
  def.evidence.filter((e) => d.unlocked.includes(e.id))

// ─────────── stage flow ───────────

function enterStage(d: TrialState, def: CaseDef, stage: Stage) {
  d.stage = stage
  const intro = STAGE_INTRO[stage]
  if (intro) judge(d, def, pick(intro, flavour(d)), d.mood, 'system', false)
  if (stage === 'defense') {
    def.prosecutorArgument.forEach((t) => say(d, def, 'prosecutor', t))
    judge(d, def, def.defensePrompt, 'suspicious', 'system', false)
  }
  if (stage === 'cross') {
    d.round = 1
    enterCrossRound(d, def)
  }
  if (stage === 'witnesses') {
    const names = availableWitnesses(d, def).map((w) => w.name)
    say(d, def, 'clerk', `Witnesses available: ${names.join(', ')}. You may ask ${witnessBudget(def)} questions in total.`, {
      tag: 'witness',
    })
  }
  if (stage === 'closing') {
    const recap = closingRecap(d)
    if (recap) judge(d, def, recap, unresolvedCount(d) ? 'suspicious' : 'smug', undefined, false)
    judge(d, def, def.closingPrompt, d.mood, 'system', false)
  }
}

function enterCrossRound(d: TrialState, def: CaseDef) {
  while (d.round <= 3) {
    const q = def.cross.find((x) => x.round === d.round && check(x.when, d))
    if (q) {
      d.askedCross[d.round - 1] = q.id
      judge(d, def, `Question ${d.round} of 3. ${q.ask}`, d.mood, 'system', false)
      return
    }
    d.round++
  }
  enterStage(d, def, 'witnesses')
}

function progress(d: TrialState, def: CaseDef) {
  if (d.stage === 'defense') enterStage(d, def, 'cross')
  else if (d.stage === 'cross') {
    if (d.round < 3) {
      d.round++
      enterCrossRound(d, def)
    } else enterStage(d, def, 'witnesses')
  } else if (d.stage === 'closing') finalize(d, def)
}

/** A recap built purely from what the player did, used before closings. */
export function closingRecap(d: TrialState): string {
  const parts: string[] = []
  const notable = [...d.memos].sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact)).slice(0, 2)
  for (const m of notable) parts.push(`you ${m.text}`)
  const u = unresolvedCount(d)
  if (u) parts.push(`you left ${u} contradiction${u > 1 ? 's' : ''} unexplained`)
  if (d.presented.length === 0) parts.push('you presented no evidence whatsoever')
  if (!parts.length) return ''
  const last = parts.pop()!
  return `Before you close, let the record show: ${parts.length ? parts.join(', ') + ', and ' : ''}${last}.`
}

function finalize(d: TrialState, def: CaseDef) {
  const result = computeVerdict(d, def)
  d.result = result
  d.stage = 'verdict'
  d.mood = result.mood
  for (const line of result.narration) judge(d, def, line, result.mood, undefined, false)
  judge(d, def, `The verdict: ${result.title}. ${result.sentence}`, result.mood, 'system', false)
}

// ─────────── handlers ───────────

function handleChoice(d: TrialState, def: CaseDef, opt: ChoiceOption, typed: string | null) {
  if (d.stage === 'defense') d.defenseChoice = opt.id
  if (d.stage === 'closing') d.closingChoice = opt.id
  if (typed === null) say(d, def, 'defendant', opt.label)
  else say(d, def, 'clerk', pick(INTERPRET, flavour(d)).replace('{label}', opt.label), { tag: 'interpret' })

  const branch = opt.branches?.find((b) => check(b.when, d))
  const effect = mergeEffects(opt.effect, branch?.effect)
  const reply = branch?.reply ?? opt.reply
  const prosecutor = branch?.prosecutor ?? opt.prosecutor
  const { dc, dp } = applyEffect(d, def, { ...effect, claims: undefined }, `said “${fill(opt.label, ctx(d, def))}”`)
  judge(d, def, reply, effect.mood ?? deriveMood(d, dc, dp))
  if (prosecutor) say(d, def, 'prosecutor', prosecutor)
  addClaims(d, def, effect.claims)
  if (d.pending) d.deferred = true
  else progress(d, def)
}

function handleContradiction(d: TrialState, def: CaseDef, optId: string, typed: string | null) {
  const rule = allContradictionRules(def).find((r) => r.id === d.pending?.ruleId)
  const rec = d.contradictions.find((c) => c.ruleId === d.pending?.ruleId)
  if (!rule || !rec) {
    d.pending = null
    return
  }
  const opt = contradictionOptions(d, def).find((o) => o.id === optId)
  if (!opt) return
  if (typed === null) say(d, def, 'defendant', opt.label)
  else say(d, def, 'clerk', pick(INTERPRET, flavour(d)).replace('{label}', opt.label), { tag: 'interpret' })
  const penalty = rule.penalty ?? 10
  const r = flavour(d)
  if (optId === 'c_resolve') {
    rec.resolved = true
    applyEffect(d, def, { cred: penalty, flags: ['resolved_with_evidence'], memo: 'explained a contradiction with actual evidence' }, 'explained a contradiction')
    judge(d, def, rule.resolveLine ?? pick(CONTRADICTION_RESOLVED, r), 'shocked')
  } else if (optId === 'c_misspoke') {
    rec.resolved = true
    applyEffect(d, def, { cred: Math.ceil(penalty / 2), patience: -6, flags: ['misspoke'] }, 'corrected yourself')
    judge(d, def, 'Corrected. The court accepts the correction and will remember that you needed one.', 'smug')
  } else if (optId === 'c_double') {
    applyEffect(d, def, { cred: -4, petty: 12, flags: ['doubled_down'], memo: 'insisted two contradictory statements were BOTH true' }, 'doubled down')
    judge(d, def, 'BOTH? The defendant has discovered quantum alibis. The court is impressed, horrified, and still not convinced.', 'laughing')
  } else {
    applyEffect(d, def, { patience: -12, petty: 6, flags: ['blamed_stenographer'], memo: 'blamed the stenographer for your own words' }, 'blamed the stenographer')
    say(d, def, 'clerk', 'The stenographer would like it noted that they heard you perfectly, and they are a ghost, so they hear EVERYTHING.', { tag: 'aside' })
    judge(d, def, 'Blaming the staff. Classy. The contradiction stands.', 'furious')
  }
  d.pending = null
  // another contradiction may already be waiting
  const next = d.contradictions.find((c) => !c.resolved && c.ruleId !== rule.id && !d.flags.includes(`answered:${c.ruleId}`))
  uniqPush(d.flags, `answered:${rule.id}`)
  if (next) {
    d.pending = { ruleId: next.ruleId }
    return
  }
  if (d.deferred) {
    d.deferred = false
    progress(d, def)
  }
}

function asides(d: TrialState, def: CaseDef, a: Analysis) {
  const r = flavour(d)
  let spoken = 0
  const speak = (text: string, mood: Mood) => {
    if (spoken++ < 2) judge(d, def, text, mood, 'aside', false)
  }
  for (const c of a.concepts) {
    uniqPush(d.flags, `typed:${c}`)
    const delta = def.meter?.onTyped?.[c]
    if (delta && def.meter) d.meter = clamp(d.meter + delta, def.meter.min, def.meter.max)
  }
  if (a.concepts.includes('insult')) {
    applyEffect(d, def, { petty: 20, patience: -12, cred: -3, memo: 'insulted the bench to its face' }, 'insulted the judge')
    speak(pick(ASIDES.insult, r), 'furious')
  }
  if (a.concepts.includes('flattery')) {
    applyEffect(d, def, { petty: 12, patience: 4 }, 'flattered the judge')
    speak(pick(ASIDES.flattery, r), 'smug')
  }
  if (a.concepts.includes('bribe')) {
    applyEffect(d, def, { patience: -10, cred: -5, memo: 'attempted to bribe a pumpkin' }, 'attempted bribery')
    speak(pick(ASIDES.bribe, r), 'shocked')
  }
  if (a.concepts.includes('pie')) {
    const n = d.flags.filter((f) => f.startsWith('pie:')).length + 1
    uniqPush(d.flags, `pie:${n}`)
    applyEffect(d, def, { petty: 4 }, 'mentioned pie')
    speak(pick(ASIDES.pie, r), n >= 3 ? 'furious' : 'shocked')
  }
  if (a.concepts.includes('silence')) {
    applyEffect(d, def, { cred: -2 }, 'pleaded the fifth')
    speak(pick(ASIDES.silence, r), 'suspicious')
  }
  if (a.concepts.includes('fruit')) speak(pick(ASIDES.fruit, r), 'shocked')
}

function handleTyped(d: TrialState, def: CaseDef, raw: string) {
  const prompt = getPrompt(d, def)
  const text = raw.replace(/\s+/g, ' ').trim().slice(0, 280)
  if (!prompt || !text) return
  say(d, def, 'defendant', text)
  const m = matchOption(text, prompt.options)
  asides(d, def, m.analysis)
  if (d.pending && prompt.kind !== 'contradiction') {
    // an aside cannot create contradictions, but stay defensive
    return
  }
  if (m.option) {
    if (prompt.kind === 'contradiction') handleContradiction(d, def, m.option.id, text)
    else handleChoice(d, def, m.option, text)
    return
  }
  d.unrecognized++
  if (d.unrecognized >= 3) uniqPush(d.flags, 'word_salad')
  const pat0 = d.patience
  d.patience = clamp(d.patience - 5, 0, 100)
  judge(d, def, pick(UNRECOGNIZED, flavour(d)), 'suspicious', 'unrecognized', false)
  patienceCheck(d, def, pat0)
}

function handleExamine(d: TrialState, def: CaseDef, id: string) {
  const ev = def.evidence.find((e) => e.id === id)
  if (!ev || !d.unlocked.includes(id)) return
  const ctxKey = `ctx:${id}`
  if (ev.contextInspect && check(ev.contextInspect.when, d) && !d.flags.includes(ctxKey)) {
    uniqPush(d.flags, ctxKey)
    uniqPush(d.examined, id)
    say(d, def, 'clerk', `Re-examining “${ev.name}” in light of new facts…`, { tag: 'evidence' })
    const { dc, dp } = applyEffect(d, def, { ...ev.contextInspect.effect, claims: undefined }, `re-examined ${ev.name}`)
    judge(d, def, ev.contextInspect.text, ev.contextInspect.effect?.mood ?? deriveMood(d, dc, dp), 'evidence')
    addClaims(d, def, ev.contextInspect.effect?.claims)
    return
  }
  if (d.examined.includes(id)) return
  d.examined.push(id)
  const { dc, dp } = applyEffect(d, def, { ...ev.inspect.effect, claims: undefined }, `examined ${ev.name}`)
  judge(d, def, ev.inspect.text, ev.inspect.effect?.mood ?? deriveMood(d, dc, dp), 'evidence', false)
  addClaims(d, def, ev.inspect.effect?.claims)
}

function handlePresent(d: TrialState, def: CaseDef, id: string) {
  const ev = def.evidence.find((e) => e.id === id)
  if (!ev || d.stage !== 'evidence' || !d.unlocked.includes(id) || d.presented.includes(id)) return
  if (d.presented.length >= presentLimit(def)) {
    judge(d, def, pick(PRESENT_LIMIT, flavour(d)), 'smug', 'evidence', false)
    return
  }
  if (!d.examined.includes(id)) handleExamine(d, def, id)
  if (d.pending) return
  d.presented.push(id)
  say(d, def, 'defendant', `Your Honor, I present Exhibit: “${ev.name}”!`)
  const branch = ev.present.find((b) => check(b.when, d))
  const effect = branch?.effect ?? ev.presentDefault.effect
  const reply = branch?.reply ?? ev.presentDefault.reply
  const { dc, dp } = applyEffect(d, def, { ...effect, claims: undefined }, `presented ${ev.name}`)
  d.evidenceImpact[id] = dc - dp
  judge(d, def, reply, effect?.mood ?? deriveMood(d, dc, dp), 'evidence')
  if (branch?.prosecutor) say(d, def, 'prosecutor', branch.prosecutor)
  addClaims(d, def, effect?.claims)
}

function handleAsk(d: TrialState, def: CaseDef, witnessId: string, questionId: string) {
  if (d.stage !== 'witnesses') return
  const w = availableWitnesses(d, def).find((x) => x.id === witnessId)
  if (!w) return
  const q = availableQuestions(d, w).find((x) => x.id === questionId)
  if (!q) return
  if (d.asked.length >= witnessBudget(def)) {
    judge(d, def, pick(BUDGET_DONE, flavour(d)), 'neutral', 'witness', false)
    return
  }
  d.asked.push(`${w.id}:${q.id}`)
  say(d, def, 'defendant', q.label)
  const branch = q.branches?.find((b) => check(b.when, d))
  const effect = mergeEffects(q.effect, branch?.effect)
  const answer = branch?.reply ?? q.answer
  const { dc, dp } = applyEffect(d, def, { ...effect, claims: undefined }, `questioned ${w.name}`)
  say(d, def, 'witness', answer, { name: w.name, tag: 'witness' })
  if (branch?.prosecutor) say(d, def, 'prosecutor', branch.prosecutor)
  d.mood = effect.mood ?? deriveMood(d, dc, dp)
  addClaims(d, def, effect.claims)
}

function handleAdvance(d: TrialState, def: CaseDef) {
  if (d.pending || d.result) return
  if (d.stage === 'opening') enterStage(d, def, 'defense')
  else if (d.stage === 'witnesses') enterStage(d, def, 'evidence')
  else if (d.stage === 'evidence') enterStage(d, def, 'closing')
}

export function reduce(state: TrialState, action: Action, def: CaseDef): TrialState {
  if (state.caseId !== def.id) throw new Error(`Case mismatch: state is ${state.caseId}, def is ${def.id}`)
  if (state.result) return state
  const d: TrialState = structuredClone(state)
  switch (action.type) {
    case 'advance':
      handleAdvance(d, def)
      break
    case 'choose': {
      const prompt = getPrompt(d, def)
      if (!prompt) break
      const opt = prompt.options.find((o) => o.id === action.optionId)
      if (!opt) break
      if (prompt.kind === 'contradiction') handleContradiction(d, def, opt.id, null)
      else handleChoice(d, def, opt, null)
      break
    }
    case 'type':
      handleTyped(d, def, action.text)
      break
    case 'examine':
      if (!d.pending) handleExamine(d, def, action.evidenceId)
      break
    case 'present':
      if (!d.pending) handlePresent(d, def, action.evidenceId)
      break
    case 'ask':
      if (!d.pending) handleAsk(d, def, action.witnessId, action.questionId)
      break
  }
  return d
}
