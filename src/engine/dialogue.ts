// ─────────────────────────────────────────────────────────────
//  Dialogue templates. Case-authored replies are wrapped with mood-specific
//  openers/closers, and generic events (contradictions, unrecognised input,
//  flattery…) draw from pools. Pools × case lines × moods → hundreds of
//  distinct judge utterances, all reacting to state rather than random chance.
// ─────────────────────────────────────────────────────────────
import type { Mood } from './types'
import { pick } from './rng'

export const JUDGE = "Judge Jack O'Lantern"

export interface FillCtx {
  name: string
  victim: string
  prosecutor: string
  charge: string
  [k: string]: string | number
}

export function fill(template: string, ctx: FillCtx): string {
  return template.replace(/\{(\w+)\}/g, (m, key: string) => (key in ctx ? String(ctx[key]) : m))
}

export const MOOD_PREFIX: Record<Mood, string[]> = {
  neutral: ['Hmm.', 'Noted.', 'Very well.', 'The court observes.', 'Let the record reflect this.', 'I see.', 'Proceeding.', 'The court is listening, reluctantly.'],
  suspicious: ['*narrows carved eyes*', 'Interesting. Suspiciously interesting.', 'Hm. HMM.', 'The court smells a rat. Possibly a literal one.', 'Curious.', 'Oh, is THAT so.', 'The bench leans forward.', 'Bailiff, watch this one.'],
  furious: ['ORDER!', 'OUTRAGEOUS!', '*gavel strikes so hard a seed falls out*', 'HOW DARE—', 'I am VIBRATING with rage.', 'Absolutely not.', 'My candle is flickering with fury!', 'Somebody hold my stem.'],
  shocked: ['*gasp*', 'Good gourd!', '*drops gavel*', 'Well I never.', 'By the Great Vine!', 'The court needs a moment.', 'Merciful mulch!', '*candle flares up*'],
  smug: ['Ah yes, exactly as I predicted.', '*adjusts tiny wig*', 'Heh.', 'As expected of the defendant.', 'The court is unsurprised.', 'Delicious.', 'I love being right.', 'Mm-hmm. Mm-HMM.'],
  laughing: ['HA!', 'Hohoho!', '*wheezes through carved mouth*', 'Pfft—sorry—ORDER—pfft.', 'Stenographer, write down that I laughed.', 'Oh, that is rich.', 'HAHA—ahem.', '*cackles in gourd*'],
}

export const MOOD_SUFFIX: Record<Mood, string[]> = {
  neutral: ['Continue.', 'Moving on.', 'The stenographer has written that down. Badly.', 'Next.', 'The court will allow it. For now.'],
  suspicious: ['I am watching you.', 'Every word is being remembered.', 'The court has a very long memory and no other hobbies.', 'Proceed carefully.', 'I will be checking that later.'],
  furious: ['I need a moment and a cold compress.', 'This is going in my diary.', 'My patience is not infinite. It is a pumpkin. It rots.', 'Do not test me.', 'I am writing your name on my list.'],
  shocked: ['I did not have this on my bingo card.', 'Unprecedented.', 'The court is reconsidering several life choices.', 'Someone fetch my smelling salts.', 'This will be in the law textbooks.'],
  smug: ['I am, as always, magnificent.', 'Write that down: the judge was right.', 'Thank you, thank you.', 'Another victory for the bench.', 'Consider yourself lightly roasted.'],
  laughing: ['I will allow it purely for comedic value.', 'That is going in the blooper reel.', 'The court is having a wonderful time.', 'Ten out of ten. Still guilty, possibly.', 'Encore. No. Wait. Order.'],
}

export const UNRECOGNIZED = [
  'The court has received your argument. The court has absolutely no idea what that means, but the stenographer looks concerned.',
  'I have consulted every law book in this courtroom and none of them contain whatever that was.',
  'Was that a legal argument or did a cat walk across your keyboard? Please choose from the options, like a civilised gourd.',
  'The court does not speak that dialect of nonsense. Try again, or pick one of the very helpful buttons.',
  'Interesting words. Wrong order. Possibly wrong words.',
  'The stenographer has typed "???" and then quietly wept.',
  'I am a pumpkin, not a mind reader. A very wise pumpkin. But not a mind reader.',
  'Objection, says the court, to whatever that was.',
  'The court will treat that as a sneeze. Bless you. Now answer the question.',
  'Counsel for the defense appears to be freestyling. The court did not request freestyle.',
  'That statement has been entered into the record under "Mysteries".',
  'I understood every single word individually and none of them together.',
]

export const INTERPRET = [
  'The court interprets this as: “{label}”',
  'Translated from defendant-ese: “{label}”',
  'The stenographer records this as: “{label}”',
  'For the record, the court hears: “{label}”',
  'Paraphrasing generously: “{label}”',
]

export const CONTRADICTION_OPEN = [
  'HOLD IT.',
  'WAIT. Wait wait wait.',
  'Stenographer, read that back. Slowly. Dramatically.',
  'Objection from the BENCH.',
  '*the candle inside the judge flares crimson*',
  'Oh, the court REMEMBERS.',
  'Excuse me?',
  'The court has a memory like a steel gourd-trap.',
]

export const CONTRADICTION_RESOLVED = [
  'Hm. That actually explains it. The court is annoyed at how reasonable that was.',
  'The contradiction is resolved. The court withdraws its gasp.',
  'Fine. FINE. That checks out. I had a whole speech prepared.',
  'Very well, the record is corrected. Stenographer, un-gasp.',
]

export const ASIDES = {
  flattery: [
    'Flattery will get you… somewhere, actually. Continue.',
    'The court is not swayed by compliments. *blushes orange*',
    'Did you hear that, bailiff? WISE. Write down "wise".',
    'Stop. No. Go on.',
  ],
  insult: [
    'Did the defendant just insult the BENCH? I will remember this when I sentence you.',
    'I have been carved, scooped, and set on fire, and THAT is what hurts.',
    'Contempt! Contempt of gourd!',
    'Rude. Petty retribution is now being scheduled.',
  ],
  pie: [
    'Do not say that word in this courtroom. Half the gallery are pumpkins. The other half are hungry.',
    'Pie. You said pie. In front of me. A pumpkin. Bold.',
    'The court will pretend you did not mention pie. The court is now thinking only about pie.',
  ],
  bribe: [
    'Is the defendant attempting to bribe the court? With WHAT? I have no pockets.',
    'Bribery! The court is shocked. The court also accepts compost, for the record. NO. Strike that.',
  ],
  silence: [
    'The defendant pleads the Fifth. The court pleads the Fifth Slice of pie. Neither is a defense.',
    'You have the right to remain silent. You do not have the right to remain interesting while doing so.',
  ],
  fruit: [
    'Did you just say "fruit"? Careful. That is a very dangerous word in this courtroom.',
    'Botany. The defendant is bringing BOTANY into my courtroom.',
  ],
  sorry: ['An apology. How quaint. The court notes it and is unmoved. Mostly.', 'Apology noted. The victim is sobbing too loudly to hear it.'],
}

export const PATIENCE_WARN = {
  half: [
    "The court's patience is at half. That is like a pumpkin on November 3rd.",
    'Patience: dwindling. Gourd: twitching.',
  ],
  low: [
    'I am ONE bad answer away from holding you in contempt of gourd.',
    'My patience has gone soft and slightly furry. Choose your next words very carefully.',
  ],
  zero: [
    'That is IT. The court has no patience left. I am running on spite and candle wax.',
  ],
}

export const STAGE_INTRO: Record<string, string[]> = {
  defense: ['The defendant will now enter a defense. Choose wisely, or at least loudly.', 'How do you plead? And please, make it entertaining.'],
  cross: ['We proceed to cross-examination. I will be asking the questions. All of them.', 'Cross-examination! My favourite part. I get to be suspicious professionally.'],
  evidence: ['The evidence locker is open. Examine the exhibits. Present the ones that help you. Do not lick them.', 'Exhibits! Inspect them carefully. The raccoon bailiff has promised not to touch anything.'],
  witnesses: ['Witnesses may now be questioned. They are under oath, which for a squirrel means very little.', 'Call your witnesses. They have sworn on the Great Gourd to tell the truth. Mostly.'],
  closing: ['Closing arguments. Make them count. The court is getting hungry.', 'This is your final chance to convince me. Make me feel something. Ideally not indigestion.'],
}

export const PRESENT_LIMIT = [
  'The court has seen enough exhibits. Any more and I will need a bigger bench.',
  'You have presented your limit. The raccoon bailiff is confiscating the rest.',
]

export const BUDGET_DONE = [
  'Witness time is over. They have places to be. Mostly trees.',
  'No more questions. The witnesses are unionising.',
]

export const CRED_LABELS: [number, string][] = [
  [85, 'Saint-like. The court suspects witchcraft.'],
  [70, 'Remarkably believable, for someone accused of gourd crimes.'],
  [55, 'Mostly credible, with a light dusting of nonsense.'],
  [40, 'Shaky. Like a jack-o’-lantern on a windy porch.'],
  [25, 'Deeply unconvincing. The stenographer stopped writing.'],
  [0, 'Credibility of a raccoon claiming it was just "looking" at the trash.'],
]

export const ROAST = [
  '{name}, you came into my courtroom with {cred} points of credibility and the confidence of a pumpkin who has never seen a knife. Your biggest mistake: you {mistake}.',
  'In my many seasons on this bench, I have seen geniuses and I have seen squash. {name}, you {mistake}. I will be telling that story at parties.',
  '{name}, the court has a single question: why? Why did you {mistake}? The court will be thinking about it during every candle-lighting for the rest of my life.',
  'Let history record that {name} {mistake}, and still had the audacity to look me in my carved eyes.',
  'You {mistake}, {name}. Even the raccoon bailiff, who eats garbage, thought that was a poor choice.',
]

export const ROAST_CLEAN = [
  '{name}, you ran a disgustingly clean defense. No contradictions, no nonsense. I hate it. I respect it. I hate that I respect it.',
  'I came here to roast someone, {name}, and you gave me nothing. Your biggest weakness was being too competent. Disgusting.',
]

export const SHARE_TEMPLATE =
  '🎃⚖️ PUMPKIN SUPREME COURT ⚖️🎃\n{case}\nDefendant: {name}\nVerdict: {verdict}\nSentence: {sentence}\nCredibility: {cred}/100 · Contradictions: {contradictions}\n“{roast}”'

export function decorate(reply: string, mood: Mood, r: () => number): string {
  const parts: string[] = []
  if (r() < 0.45) parts.push(pick(MOOD_PREFIX[mood], r))
  parts.push(reply)
  if (r() < 0.3) parts.push(pick(MOOD_SUFFIX[mood], r))
  return parts.join(' ')
}
