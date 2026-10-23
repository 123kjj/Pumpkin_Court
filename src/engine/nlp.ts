// ─────────────────────────────────────────────────────────────
//  A deliberately small, honest phrase matcher. No AI.
//  normalise → tokenise → stem → phrase-match concepts (with negation)
//  → score the currently available options.
// ─────────────────────────────────────────────────────────────
import type { ChoiceOption, Concept } from './types'

const CONTRACTIONS: [RegExp, string][] = [
  [/\bwon'?t\b/g, 'will not'],
  [/\bcan'?t\b/g, 'can not'],
  [/\bain'?t\b/g, 'is not'],
  [/\b(do|does|did|was|were|is|are|has|have|had|would|could|should)n'?t\b/g, '$1 not'],
  [/n't\b/g, ' not'],
  [/\bi'?m\b/g, 'i am'],
  [/'re\b/g, ' are'],
  [/'ve\b/g, ' have'],
  [/'ll\b/g, ' will'],
  [/'d\b/g, ' would'],
  [/\b(it|that|there|what|he|she)'s\b/g, '$1 is'],
  [/'s\b/g, ''],
]

const STOP = new Set(
  'the a an and or but of to in on at for with is am are was were be been i you it this that my me your we our they them he she his her its so just very really did do does have has had will would can could should not no yes there here what who when why how about from by as if then than too also only'.split(
    ' ',
  ),
)

const NEGATORS = new Set(['not', 'never', 'no', 'nobody', 'nothing', 'neither', 'nor', 'without'])

export function stem(word: string): string {
  let w = word
  if (w.length > 5 && w.endsWith('ing')) w = w.slice(0, -3)
  else if (w.length > 4 && w.endsWith('ied')) w = w.slice(0, -3) + 'y'
  else if (w.length > 4 && w.endsWith('ed')) w = w.slice(0, -2)
  else if (w.length > 4 && w.endsWith('ies')) w = w.slice(0, -3) + 'y'
  else if (w.length > 4 && /(s|x|ch|sh)es$/.test(w)) w = w.slice(0, -2)
  else if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) w = w.slice(0, -1)
  // collapse doubled final consonant from -ing/-ed stripping ("stopped" → "stopp" → "stop")
  if (w.length > 3 && /([bdgmnprt])\1$/.test(w)) w = w.slice(0, -1)
  return w
}

export function normalize(text: string): string {
  let t = text.toLowerCase().replace(/[’`]/g, "'")
  for (const [re, rep] of CONTRACTIONS) t = t.replace(re, rep)
  // apostrophe-less forms people actually type
  t = t
    .replace(/\b(dont|didnt|doesnt|wasnt|werent|isnt|arent|hasnt|havent|wouldnt|couldnt|shouldnt)\b/g, (m) =>
      m.slice(0, -2) + ' not',
    )
    .replace(/\bcant\b/g, 'can not')
    .replace(/\bwont\b/g, 'will not')
    .replace(/\bim\b/g, 'i am')
  return t
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function tokenize(text: string): string[] {
  const n = normalize(text)
  return n ? n.split(' ').map(stem) : []
}

/** Concept lexicon. Phrases are written naturally and stemmed at load time. */
export const LEXICON: Record<Concept, string[]> = {
  forget: ['forgot', 'forget', 'forgotten', 'slipped my mind', 'did not remember', 'lost track', 'too busy', 'distracted', 'busy'],
  accident: ['accident', 'accidentally', 'oops', 'mistake', 'by mistake', 'did not mean', 'unintentional', 'tripped', 'slipped'],
  squirrel: ['squirrel', 'nutsworth', 'rodent', 'acorn'],
  raccoon: ['raccoon', 'trash panda', 'bandit', 'rascal'],
  evidence: ['evidence', 'proof', 'receipt', 'photo', 'photograph', 'exhibit', 'document', 'record', 'log'],
  witness: ['witness', 'saw me', 'testify', 'testimony', 'eyewitness', 'ask the'],
  innocent: ['innocent', 'did not do it', 'framed', 'set up', 'not guilty', 'was not me', 'never touched', 'not my fault'],
  confess: ['guilty', 'i did it', 'confess', 'admit', 'my fault', 'it was me', 'responsible', 'i am to blame'],
  revenge: ['revenge', 'payback', 'deserved it', 'had it coming', 'getting even', 'grudge', 'vengeance'],
  absent: ['was not there', 'not there', 'nowhere near', 'out of town', 'away', 'vacation', 'alibi', 'elsewhere', 'ohio', 'not home'],
  present: ['was there', 'was home', 'at home', 'right there', 'nearby', 'next to'],
  blame: ['blame', 'fault of', 'it was the', 'someone else', 'somebody else', 'they did'],
  flattery: ['your honor is wise', 'magnificent', 'handsome', 'brilliant', 'best judge', 'majestic', 'love your stem', 'beautiful', 'gorgeous', 'wise'],
  insult: ['stupid', 'dumb', 'idiot', 'rotten', 'ugly', 'moldy', 'shut up', 'clown', 'loser', 'pie filling', 'hate you'],
  fruit: ['fruit', 'botanical', 'botanically', 'seed', 'berry', 'ovary', 'technically'],
  pie: ['pie', 'pies'],
  sorry: ['sorry', 'apologize', 'apologise', 'apology', 'regret', 'forgive'],
  love: ['love', 'care about', 'cherish', 'adore', 'friend', 'family'],
  silence: ['fifth', 'remain silent', 'no comment', 'lawyer', 'attorney'],
  bribe: ['bribe', 'money', 'pay you', 'cash', 'donation', 'venmo', 'deal'],
  intent: ['on purpose', 'intentionally', 'meant to', 'deliberately', 'planned', 'plan'],
  cold: ['cold', 'chill', 'fridge', 'refrigerator', 'freezer', 'frozen', 'blanket'],
  art: ['art', 'artistic', 'style', 'fashion', 'aesthetic', 'trend', 'avant garde', 'creative'],
}

/** What a concept becomes when negated ("I did NOT forget" → innocent). */
const NEGATION_MAP: Partial<Record<Concept, Concept | null>> = {
  confess: 'innocent',
  innocent: 'confess',
  present: 'absent',
  absent: 'present',
  forget: 'innocent',
  accident: 'intent',
  intent: 'accident',
  flattery: 'insult',
  insult: null,
  sorry: null,
  love: null,
  blame: null,
}

const STEMMED_LEXICON: [Concept, string[][]][] = (Object.keys(LEXICON) as Concept[]).map((c) => [
  c,
  LEXICON[c].map((p) => tokenize(p)),
])

function findPhrase(tokens: string[], phrase: string[]): number {
  outer: for (let i = 0; i + phrase.length <= tokens.length; i++) {
    for (let j = 0; j < phrase.length; j++) if (tokens[i + j] !== phrase[j]) continue outer
    return i
  }
  return -1
}

function negatedAt(tokens: string[], index: number): boolean {
  for (let k = Math.max(0, index - 3); k < index; k++) if (NEGATORS.has(tokens[k])) return true
  return false
}

export interface Analysis {
  raw: string
  tokens: string[]
  concepts: Concept[]
}

export function analyze(text: string): Analysis {
  const tokens = tokenize(text)
  const found = new Set<Concept>()
  for (const [concept, phrases] of STEMMED_LEXICON) {
    let positive = false
    let negative = false
    for (const phrase of phrases) {
      const at = findPhrase(tokens, phrase)
      if (at < 0) continue
      // a phrase that itself contains a negator (e.g. "not guilty") is never re-negated
      const selfNegating = phrase.some((t) => NEGATORS.has(t))
      if (!selfNegating && negatedAt(tokens, at)) negative = true
      else positive = true
    }
    if (positive) found.add(concept)
    else if (negative) {
      const flipped = NEGATION_MAP[concept]
      if (flipped) found.add(flipped)
    }
  }
  // "not guilty" both matches innocent directly and negates "guilty"; never report both sides.
  if (found.has('innocent') && found.has('confess')) {
    const t = tokens.join(' ')
    if (/\bnot guilty\b/.test(t) && !/\bi did it\b|\bconfess\b|\badmit\b/.test(t)) found.delete('confess')
  }
  return { raw: text, tokens, concepts: [...found] }
}

export interface MatchResult {
  option: ChoiceOption | null
  score: number
  analysis: Analysis
}

/** Score typed text against the options currently on screen. */
export function matchOption(text: string, options: ChoiceOption[], threshold = 2): MatchResult {
  const analysis = analyze(text)
  let best: ChoiceOption | null = null
  let bestScore = 0
  for (const opt of options) {
    let score = 0
    for (const kw of opt.keywords ?? []) {
      const phrase = tokenize(kw)
      if (!phrase.length) continue
      const at = findPhrase(analysis.tokens, phrase)
      if (at >= 0) score += negatedAt(analysis.tokens, at) ? -2 : 3
    }
    for (const c of opt.concepts ?? []) if (analysis.concepts.includes(c)) score += 2
    const labelWords = new Set(tokenize(opt.label).filter((w) => w.length >= 4 && !STOP.has(w)))
    let overlap = 0
    for (const t of new Set(analysis.tokens)) if (labelWords.has(t)) overlap += 0.5
    score += Math.min(overlap, 1.5)
    if (score > bestScore) {
      bestScore = score
      best = opt
    }
  }
  return { option: bestScore >= threshold ? best : null, score: bestScore, analysis }
}
