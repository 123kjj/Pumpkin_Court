# Pumpkin Supreme Court 🎃⚖️

A courtroom comedy where you defend yourself against ridiculous crimes against pumpkins before **Judge Jack O'Lantern**, who remembers everything you say, notices when you contradict yourself, and has a candle where his patience should be.

**No AI.** Every reaction comes from a deterministic, rule-based trial engine written in TypeScript. No API calls, no backend, no keys.

## Run it

```bash
npm install
npm run dev          # local dev server
npm test             # 35 engine tests (vitest)
npm run build        # type-check + production build → dist/
npm run preview      # serve the production build
npm run build:single # optional: one self-contained HTML file → dist-single/index.html
```

**Deploy to Vercel:** import the repo; Vercel auto-detects Vite (build `npm run build`, output `dist`). No environment variables needed. Fonts are self-hosted via `@fontsource`, so the game makes zero external requests.

## The docket

| # | Case | Unique mechanic |
|---|------|-----------------|
| 1 | First-Degree Pumpkin Neglect | **The Alibi Calendar**: nine unaccounted days; every claim about where you were is cross-checked |
| 2 | Unauthorized Pumpkin Haircut | **Forensic Hair Lab**: the cut is zigzag, and your scissors are straight |
| 3 | The Broccoli Conspiracy | **The Pie Clock**: the court runs on pie; say "pie" or contradict yourself and the judge eats a slice. At zero, everyone loses. Also: a spelling test |
| 4 | Calling a Pumpkin a Vegetable | **The Botany Debate**: push Botanical Truth high enough and the judge realises he is a berry |
| 5 | Destruction of an Influencer Career | **The Livestream**: live chat approval swings with every move; a raccoon paparazzo guards his camera roll |
| 6 | Fridge Without a Blanket | **The Fridge Light Problem**: the star witness only saw what happened while the door was open |

Every case has its own witnesses, evidence (helpful, harmful and misleading-until-context), three adaptive cross-examination rounds, closings, sentences and 1–3 secret endings. 19 achievements in total.

## How the engine works

```
src/
  engine/
    types.ts         All data shapes: cases, conditions, effects, trial state
    engine.ts        Pure reducer: reduce(state, action, case) → state
    conditions.ts    Serialisable condition DSL (claims, flags, evidence, meters…)
    nlp.ts           Phrase matcher: normalise → stem → concepts (with negation) → option scoring
    dialogue.ts      Template pools + mood-wrapped judge lines
    verdict.ts       Deterministic verdict ladder, explanation, roast
    achievements.ts  Achievement definitions with explicit conditions + profile recording
    persistence.ts   Guarded localStorage (profile + in-progress trial)
    validate.ts      Static checks for case data (dangling IDs, unreachable evidence…)
    simulate.ts      Automated playthroughs used by the tests
  cases/             One data file per case. No case-specific code anywhere.
  components/        React UI: Judge (6 SVG expressions), Trial, Verdict, Title, Art
  test/              Unit + reachability tests
```

**State.** `TrialState` tracks claims, flags, examined/presented evidence, witness questions asked, contradictions (resolved or not), credibility, prosecution strength, judge patience, judicial pettiness, a per-case meter, the transcript, a score ledger and memorable moments. The reducer never mutates its input.

**Claims and contradictions.** Choices add *claims* (`absent`, `present`, `confessed`, `watered_daily`…). Contradiction rules pair claims; when both are on record the judge interrupts, credibility drops, and you must answer before the trial moves on. If you have examined the right exhibit, you can explain it away.

**Typed input.** Your words are normalised (contractions expanded), stemmed, and matched against a concept lexicon with negation ("I did *not* forget" → innocent). The result is scored against the options on screen. Matches are labelled honestly ("The court interprets this as…"); unknown input gets a joke and costs patience. Insults, flattery, pie and bribery trigger asides that move the pettiness and patience meters.

**Verdicts are explainable.** No randomness touches the outcome (the seed only picks joke templates; a test replays every playthrough with a different seed and checks the verdict is identical). The ladder:

1. A matching secret ending (by priority)
2. Pettiness ≥ 100 → judge removed from the bench
3. Raccoon incident → mistrial
4. Prosecution ≤ 15 → dismissed for prosecutorial incompetence
5. Margin = credibility − prosecution − 10 × unexplained contradictions − contempt + case-meter bonus. ≥ +10 not guilty, ≥ −12 lesser offense, otherwise guilty

The judgment screen prints the biggest helps and hurts from the ledger and the final math.

## Add a case

Write `src/cases/your-case.ts` exporting a `CaseDef` (see any existing case) and add it to `src/cases/index.ts`. Then run `npm test`: the validator checks every flag, claim and evidence ID you reference, and the reachability test confirms every verdict and secret ending can actually be reached.
