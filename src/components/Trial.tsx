import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { check, unresolvedCount } from '../engine/conditions'
import {
  availableQuestions,
  availableWitnesses,
  getPrompt,
  presentLimit,
  unlockedEvidence,
  witnessBudget,
} from '../engine/engine'
import type { Action, CaseDef, Evidence, Mood, Portrait as PortraitKind, Prompt, Stage, TrialState, TranscriptLine } from '../engine/types'
import { STAGE_ORDER } from '../engine/types'
import { EvidenceIcon, Portrait } from './Art'
import { Scene, type Speaker } from './Scene'
import { prefersReducedMotion, t } from './text'

const STAGE_LABEL: Record<Stage, string> = {
  opening: 'Opening',
  defense: 'Plea',
  cross: 'Cross-examination',
  witnesses: 'Witnesses',
  evidence: 'Exhibits',
  closing: 'Closing',
  verdict: 'Verdict',
}

interface Props {
  def: CaseDef
  state: TrialState
  act: (a: Action) => void
  onExit: () => void
  onShowVerdict: () => void
}

const typingKeys = (el: EventTarget | null) => {
  const n = el as HTMLElement | null
  return !!n && (n.tagName === 'INPUT' || n.tagName === 'TEXTAREA' || n.isContentEditable)
}

export function Trial({ def, state, act, onExit, onShowVerdict }: Props) {
  // A "beat" is everything the court said since the player's last move. It plays line by line.
  const [beatStart, setBeatStart] = useState(() => {
    const tr = state.transcript
    if (tr.length <= 8) return 0
    const lastYou = [...tr].reverse().find((l) => l.speaker === 'defendant')
    return lastYou ? lastYou.id : Math.max(0, tr.length - 3)
  })
  const resumed = useRef(state.transcript.length > 8)
  const [cursor, setCursor] = useState(() => (resumed.current ? Number.MAX_SAFE_INTEGER : 0))
  const [typed, setTyped] = useState(() => (resumed.current ? Number.MAX_SAFE_INTEGER : 0))
  const [modal, setModal] = useState<null | 'record' | 'exhibits'>(null)
  const speechRef = useRef<HTMLButtonElement>(null)

  const fresh = state.transcript.slice(beatStart)
  const beat = fresh.length ? fresh : state.transcript.slice(-1)
  const idx = Math.min(cursor, beat.length - 1)
  const line = beat[idx]
  const shown = Math.min(typed, line.text.length)
  const typing = shown < line.text.length
  const done = idx === beat.length - 1 && !typing

  // typewriter
  useEffect(() => {
    if (!typing) return
    if (prefersReducedMotion()) {
      setTyped(Number.MAX_SAFE_INTEGER)
      return
    }
    const id = window.setTimeout(() => setTyped((n) => n + 2), 18)
    return () => window.clearTimeout(id)
  }, [typing, shown])

  const advance = useCallback(() => {
    if (typing) setTyped(Number.MAX_SAFE_INTEGER)
    else if (idx < beat.length - 1) {
      setCursor(idx + 1)
      setTyped(0)
    }
  }, [typing, idx, beat.length])

  const skipBeat = () => {
    setCursor(Number.MAX_SAFE_INTEGER)
    setTyped(Number.MAX_SAFE_INTEGER)
  }

  const doAct = useCallback(
    (a: Action) => {
      setBeatStart(state.transcript.length)
      setCursor(0)
      setTyped(0)
      act(a)
      requestAnimationFrame(() => speechRef.current?.scrollIntoView({ block: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' }))
    },
    [act, state.transcript.length],
  )

  // Enter or Space anywhere (outside inputs and dialogs) moves the court along.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (modal || done || typingKeys(e.target)) return
      if ((e.target as HTMLElement)?.tagName === 'BUTTON' && e.target !== speechRef.current) return
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        advance()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [advance, done, modal])

  // What the scene shows depends on the line being read, not on the final state.
  const absolute = beatStart + idx
  const mood: Mood = useMemo(() => {
    for (let i = absolute; i >= 0; i--) {
      const l = state.transcript[i]
      if (l?.speaker === 'judge' && l.tag !== 'system' && l.mood) return l.mood
    }
    return state.mood
  }, [absolute, state.transcript, state.mood])
  const witness: PortraitKind | null = useMemo(() => {
    for (let i = absolute; i >= 0; i--) {
      const l = state.transcript[i]
      if (l?.speaker === 'witness') return def.witnesses.find((w) => w.name === l.name)?.portrait ?? null
    }
    return null
  }, [absolute, state.transcript, def])
  const gavelKey = useMemo(
    () => state.transcript.slice(0, absolute + 1).filter((l) => l.tag === 'contradiction' || (l.tag === 'system' && l.speaker === 'judge')).length,
    [absolute, state.transcript],
  )

  const prompt = getPrompt(state, def)
  const caption = t(def.title, def, state).split(':')[0]

  return (
    <div className="trial">
      <header className="trial__top">
        <button className="text-btn" onClick={onExit}>
          Leave the courtroom
        </button>
        <Proceedings stage={state.stage} />
        <div className="trial__tools">
          <button className="text-btn" onClick={() => setModal('record')}>
            Transcript
          </button>
          <button className="text-btn" onClick={() => setModal('exhibits')}>
            Exhibits ({state.unlocked.length})
          </button>
        </div>
      </header>

      <div className="trial__grid">
        <div className="trial__main">
          <p className="caption">
            <span>No. PSC-26-{String(def.number).padStart(4, '0')}</span>
            <span>{caption}</span>
          </p>
          <Scene
            mood={mood}
            speaker={line.speaker as Speaker}
            witness={witness}
            patience={state.patience}
            cred={state.cred}
            pros={state.pros}
            gavelKey={gavelKey}
          />
          <SpeechBox
            ref={speechRef}
            line={line}
            text={line.text.slice(0, shown)}
            full={line.text}
            typing={typing}
            more={!done}
            def={def}
            state={state}
            onAdvance={advance}
          />
          <Tally def={def} state={state} />
        </div>

        <aside className="trial__side" aria-label="Your move">
          {!done ? (
            <Pad title={STAGE_LABEL[state.stage]}>
              <p className="pad__note">The court has the floor. Click the speech box or press Enter to hear the next line.</p>
              <button className="ink-btn" onClick={skipBeat}>
                Skip to the end of this exchange
              </button>
            </Pad>
          ) : state.result ? (
            <Pad title="Verdict">
              <p className="pad__note">The court has reached a verdict.</p>
              <button className="stamp-btn" onClick={onShowVerdict} autoFocus>
                Read the judgment
              </button>
            </Pad>
          ) : prompt ? (
            <PromptPad key={`${state.stage}-${state.round}-${prompt.kind}-${state.transcript.length}`} prompt={prompt} def={def} state={state} act={doAct} />
          ) : state.stage === 'opening' ? (
            <CaseBrief def={def} state={state} onBegin={() => doAct({ type: 'advance' })} />
          ) : state.stage === 'witnesses' ? (
            <WitnessPad def={def} state={state} act={doAct} openExhibits={() => setModal('exhibits')} />
          ) : state.stage === 'evidence' ? (
            <ExhibitTable def={def} state={state} act={doAct} />
          ) : null}
        </aside>
      </div>

      {modal === 'record' && <TranscriptModal def={def} state={state} upTo={absolute} onClose={() => setModal(null)} />}
      {modal === 'exhibits' && <ExhibitModal def={def} state={state} act={doAct} onClose={() => setModal(null)} />}
    </div>
  )
}

// ─────────── pieces ───────────

function Proceedings({ stage }: { stage: Stage }) {
  const now = STAGE_ORDER.indexOf(stage)
  return (
    <ol className="proceedings" aria-label="Order of proceedings">
      {STAGE_ORDER.map((s, i) => (
        <li key={s} className={i < now ? 'is-past' : i === now ? 'is-now' : ''} aria-current={i === now ? 'step' : undefined}>
          {STAGE_LABEL[s]}
        </li>
      ))}
    </ol>
  )
}

function speakerName(line: TranscriptLine, state: TrialState) {
  if (line.speaker === 'defendant') return `${state.defendant} (you)`
  if (line.speaker === 'clerk') return 'Clerk of the Court'
  return line.name
}

function portraitFor(line: TranscriptLine, def: CaseDef) {
  if (line.speaker === 'witness') return def.witnesses.find((w) => w.name === line.name)?.portrait ?? 'gourd'
  if (line.speaker === 'prosecutor') return 'prosecutor'
  if (line.speaker === 'defendant') return 'defendant'
  return null
}

interface SpeechProps {
  line: TranscriptLine
  text: string
  full: string
  typing: boolean
  more: boolean
  def: CaseDef
  state: TrialState
  onAdvance: () => void
  ref: React.Ref<HTMLButtonElement>
}

function SpeechBox({ line, text, full, typing, more, def, state, onAdvance, ref }: SpeechProps) {
  const portrait = portraitFor(line, def)
  return (
    <section className={`speech speech--${line.speaker} ${line.tag ? `speech--tag-${line.tag}` : ''}`} aria-label="Courtroom dialogue">
      <div className="speech__plate" key={`${line.speaker}-${line.name}`}>
        {portrait && <Portrait kind={portrait} size={30} />}
        <span>{speakerName(line, state)}</span>
      </div>
      <button ref={ref} className="speech__box" onClick={onAdvance} aria-label={more || typing ? 'Continue' : 'End of exchange'}>
        <span className="speech__text" aria-hidden="true">
          {text}
          {typing && <span className="speech__caret" />}
        </span>
        <span className="sr-only" aria-live="polite">
          {speakerName(line, state)}: {full}
        </span>
        {!typing && more && <span className="speech__more" aria-hidden="true" />}
      </button>
    </section>
  )
}

function Tally({ def, state }: { def: CaseDef; state: TrialState }) {
  const m = def.meter
  const unresolved = unresolvedCount(state)
  const rows: { label: string; value: number; shown: string; pct: number; good: 'up' | 'down'; tone?: string }[] = [
    { label: 'Your credibility', value: state.cred, shown: String(state.cred), pct: state.cred, good: 'up' },
    { label: 'Case against you', value: state.pros, shown: String(state.pros), pct: state.pros, good: 'down' },
    { label: 'Judge’s patience', value: state.patience, shown: String(state.patience), pct: state.patience, good: 'up' },
    { label: 'Judicial pettiness', value: state.petty, shown: String(Math.min(state.petty, 100)), pct: Math.min(100, state.petty), good: 'down' },
  ]
  if (m) {
    rows.push({
      label: m.label,
      value: state.meter,
      shown: `${state.meter}${m.unit === '%' ? '%' : ` ${m.unit ?? ''}`}`,
      pct: ((state.meter - m.min) / (m.max - m.min)) * 100,
      good: m.lowIsGood ? 'down' : 'up',
      tone: 'case',
    })
  }
  return (
    <section className="tally" aria-label="Clerk's tally">
      <h2 className="tally__h">Clerk’s tally</h2>
      <dl className="tally__rows">
        {rows.map((r) => (
          <div key={r.label} className={`tally__row ${r.tone ? `tally__row--${r.tone}` : ''}`}>
            <dt>{r.label}</dt>
            <dd>
              <span className="tally__num">{r.shown}</span>
              <span className="tally__bar" aria-hidden="true">
                <span style={{ width: `${Math.max(0, Math.min(100, r.pct))}%` }} />
              </span>
              <span className="tally__dir" title={r.good === 'up' ? 'Higher helps you' : 'Lower helps you'}>
                {r.good === 'up' ? '▲' : '▼'}
                <span className="sr-only">{r.good === 'up' ? 'higher helps you' : 'lower helps you'}</span>
              </span>
            </dd>
          </div>
        ))}
      </dl>
      <p className="tally__note">
        {m && (
          <>
            <b>{def.mechanic.name}.</b> {def.mechanic.description}{' '}
          </>
        )}
        Arrows show which way helps you. At 100 pettiness the judge is removed.{' '}
        <span className={unresolved ? 'is-red' : ''}>
          {state.contradictions.length === 0
            ? 'No contradictions on the record.'
            : `${state.contradictions.length} contradiction${state.contradictions.length > 1 ? 's' : ''} on the record, ${unresolved} unexplained.`}
        </span>
      </p>
    </section>
  )
}

function Pad({ title, tone, children }: { title: string; tone?: 'red'; children: React.ReactNode }) {
  return (
    <div className={`pad ${tone === 'red' ? 'pad--red' : ''}`}>
      <h2 className="pad__h">{title}</h2>
      {children}
    </div>
  )
}

function CaseBrief({ def, state, onBegin }: { def: CaseDef; state: TrialState; onBegin: () => void }) {
  return (
    <Pad title="Case notes">
      <dl className="brief">
        <div>
          <dt>Charge</dt>
          <dd>
            {def.charge}, {def.statute}
          </dd>
        </div>
        <div>
          <dt>Victim</dt>
          <dd>
            {def.victim.name}. {def.victim.description}
          </dd>
        </div>
        <div>
          <dt>Prosecuting</dt>
          <dd>
            {def.prosecutor.name}, {def.prosecutor.title}
          </dd>
        </div>
        <div>
          <dt>Watch out for</dt>
          <dd>{t(def.mechanic.description, def, state)}</dd>
        </div>
      </dl>
      <button className="stamp-btn" onClick={onBegin} autoFocus>
        Begin the trial
      </button>
    </Pad>
  )
}

function PromptPad({ prompt, def, state, act }: { prompt: Prompt; def: CaseDef; state: TrialState; act: (a: Action) => void }) {
  const [text, setText] = useState('')
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (typingKeys(e.target) || (e.target as HTMLElement)?.closest?.('[role=dialog]')) return
      const n = Number(e.key)
      if (n >= 1 && n <= prompt.options.length) {
        e.preventDefault()
        act({ type: 'choose', optionId: prompt.options[n - 1].id })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [prompt, act])

  const title =
    prompt.kind === 'contradiction'
      ? 'Explain yourself'
      : prompt.kind === 'closing'
        ? 'Closing argument'
        : prompt.kind === 'defense'
          ? 'Your defense'
          : `Question ${state.round} of 3`

  return (
    <Pad title={title} tone={prompt.kind === 'contradiction' ? 'red' : undefined}>
      <ol className="pad__choices">
        {prompt.options.map((o, i) => (
          <li key={o.id}>
            <button className="pad__choice" onClick={() => act({ type: 'choose', optionId: o.id })} autoFocus={i === 0}>
              <span className="pad__num" aria-hidden="true">
                {i + 1}
              </span>
              <span>{t(o.label, def, state)}</span>
            </button>
          </li>
        ))}
      </ol>
      {prompt.allowTyping && (
        <form
          className="pad__write"
          onSubmit={(e) => {
            e.preventDefault()
            if (!text.trim()) return
            act({ type: 'type', text })
            setText('')
          }}
        >
          <label htmlFor="say-input">Or put it in your own words</label>
          <div className="pad__write-row">
            <input
              id="say-input"
              value={text}
              maxLength={280}
              autoComplete="off"
              onChange={(e) => setText(e.target.value)}
              placeholder={prompt.kind === 'contradiction' ? 'I misspoke, Your Honor…' : 'It was the squirrel…'}
            />
            <button className="ink-btn" type="submit" disabled={!text.trim()}>
              Say it
            </button>
          </div>
          <p className="pad__hint">The court listens for known arguments. It is a pumpkin, not a mind reader.</p>
        </form>
      )}
    </Pad>
  )
}

function TallyMarks({ n }: { n: number }) {
  const groups = Array.from({ length: Math.ceil(n / 5) }, (_, g) => Math.min(5, n - g * 5))
  return (
    <span className="marks" aria-hidden="true">
      {groups.map((c, g) => (
        <svg key={g} viewBox="0 0 34 22" width="34" height="22">
          {Array.from({ length: Math.min(c, 4) }, (_, i) => (
            <line key={i} x1={5 + i * 7} y1="3" x2={4 + i * 7} y2="20" />
          ))}
          {c === 5 && <line x1="1" y1="17" x2="30" y2="5" />}
        </svg>
      ))}
    </span>
  )
}

function WitnessPad({ def, state, act, openExhibits }: { def: CaseDef; state: TrialState; act: (a: Action) => void; openExhibits: () => void }) {
  const witnesses = availableWitnesses(state, def)
  const [active, setActive] = useState(witnesses[0]?.id ?? '')
  const w = witnesses.find((x) => x.id === active) ?? witnesses[0]
  const left = witnessBudget(def) - state.asked.length
  const qs = w ? availableQuestions(state, w) : []
  const absent = def.witnesses.length - witnesses.length
  return (
    <Pad title="Witnesses">
      <p className="pad__count">
        Questions left: {left} <TallyMarks n={left} />
      </p>
      <div className="subpoenas" role="tablist" aria-label="Witnesses">
        {witnesses.map((x) => (
          <button key={x.id} role="tab" aria-selected={x.id === w?.id} className="subpoena" onClick={() => setActive(x.id)}>
            <Portrait kind={x.portrait} size={38} />
            <span>
              <b>{x.name}</b>
              <small>{x.title}</small>
            </span>
          </button>
        ))}
      </div>
      {absent > 0 && <p className="pad__hint">One witness hasn’t been called. Something in the evidence or your story has to point to them.</p>}
      {w && (
        <div role="tabpanel">
          <p className="pad__aside">{w.personality}</p>
          {left > 0 ? (
            qs.length ? (
              <ul className="pad__choices">
                {qs.map((q) => (
                  <li key={q.id}>
                    <button className="pad__choice" onClick={() => act({ type: 'ask', witnessId: w.id, questionId: q.id })}>
                      <span className="pad__num" aria-hidden="true">
                        Q
                      </span>
                      <span>{t(q.label, def, state)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="pad__note">{w.name} has nothing more to say, unless new evidence turns up.</p>
            )
          ) : (
            <p className="pad__note">You’ve used every question.</p>
          )}
        </div>
      )}
      <p className="pad__hint">
        Some questions only appear after you examine the right exhibit.{' '}
        <button className="text-btn text-btn--ink" onClick={openExhibits}>
          Look at the exhibits
        </button>
      </p>
      <button className="stamp-btn" onClick={() => act({ type: 'advance' })}>
        Done with witnesses
      </button>
    </Pad>
  )
}

function exhibitNumber(state: TrialState, id: string) {
  return state.unlocked.indexOf(id) + 1
}

function ExhibitCard({ ev, state, def, act, canPresent }: { ev: Evidence; state: TrialState; def: CaseDef; act: (a: Action) => void; canPresent: boolean }) {
  const examined = state.examined.includes(ev.id)
  const presented = state.presented.includes(ev.id)
  const rethink = !!ev.contextInspect && examined && !state.flags.includes(`ctx:${ev.id}`) && check(ev.contextInspect.when, state)
  return (
    <li className={`exhibit ${examined ? 'is-examined' : ''} ${presented ? 'is-admitted' : ''}`}>
      <span className="exhibit__sticker">Exhibit {exhibitNumber(state, ev.id)}</span>
      <EvidenceIcon art={ev.art} />
      <h3>{ev.name}</h3>
      <p>{t(ev.summary, def, state)}</p>
      {presented && <span className="exhibit__admitted">Admitted</span>}
      <div className="exhibit__actions">
        {!examined && (
          <button className="ink-btn ink-btn--small" onClick={() => act({ type: 'examine', evidenceId: ev.id })}>
            Examine
          </button>
        )}
        {rethink && (
          <button className="ink-btn ink-btn--small" onClick={() => act({ type: 'examine', evidenceId: ev.id })} title="Something you learned changes how this reads">
            Look again
          </button>
        )}
        {canPresent && !presented && (
          <button className="ink-btn ink-btn--small ink-btn--fill" onClick={() => act({ type: 'present', evidenceId: ev.id })}>
            Present
          </button>
        )}
      </div>
    </li>
  )
}

function ExhibitTable({ def, state, act }: { def: CaseDef; state: TrialState; act: (a: Action) => void }) {
  const ev = unlockedEvidence(state, def)
  const left = presentLimit(def) - state.presented.length
  const hidden = def.evidence.length - ev.length
  return (
    <div className="table-top">
      <h2 className="table-top__h">Defense table</h2>
      <p className="table-top__note">
        Examine the exhibits, then present up to {presentLimit(def)} to the court ({left} left). Some of these help the prosecution.
      </p>
      <ul className="exhibits">
        {ev.map((e) => (
          <ExhibitCard key={e.id} ev={e} state={state} def={def} act={act} canPresent={left > 0} />
        ))}
      </ul>
      {hidden > 0 && (
        <p className="table-top__note">
          {hidden} exhibit{hidden > 1 ? 's' : ''} never surfaced this time. Different answers turn up different evidence.
        </p>
      )}
      <button className="stamp-btn" onClick={() => act({ type: 'advance' })}>
        Rest your case
      </button>
    </div>
  )
}

function useDialog(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    ref.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      prev?.focus?.()
    }
  }, [onClose])
  return ref
}

function transcriptName(l: TranscriptLine, def: CaseDef) {
  if (l.speaker === 'judge') return 'THE COURT'
  if (l.speaker === 'clerk') return 'THE CLERK'
  if (l.speaker === 'defendant') return 'THE DEFENDANT'
  if (l.speaker === 'prosecutor') return `PROSECUTOR ${def.prosecutor.name.split(' ').pop()?.toUpperCase()}`
  return `THE WITNESS (${l.name.toUpperCase()})`
}

function TranscriptModal({ def, state, upTo, onClose }: { def: CaseDef; state: TrialState; upTo: number; onClose: () => void }) {
  const ref = useDialog(onClose)
  const listRef = useRef<HTMLOListElement>(null)
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [])
  const lines = state.transcript.slice(0, upTo + 1)
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label="Transcript of proceedings" onClick={onClose}>
      <div className="modal__sheet transcript" ref={ref} tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h2>Transcript of proceedings</h2>
          <button className="text-btn text-btn--ink" onClick={onClose}>
            Close
          </button>
        </div>
        <ol className="transcript__lines" ref={listRef}>
          {lines.map((l) => (
            <li key={l.id} className={l.tag === 'contradiction' ? 'is-contra' : ''}>
              <b>{transcriptName(l, def)}:</b> {l.text}
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}

function ExhibitModal({ def, state, act, onClose }: { def: CaseDef; state: TrialState; act: (a: Action) => void; onClose: () => void }) {
  const ref = useDialog(onClose)
  const ev = unlockedEvidence(state, def)
  const latest = [...state.transcript].reverse().find((l) => l.tag === 'evidence' && l.speaker === 'judge')
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label="Exhibits" onClick={onClose}>
      <div className="modal__sheet table-top" ref={ref} tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h2 className="table-top__h">Exhibits</h2>
          <button className="text-btn" onClick={onClose}>
            Close
          </button>
        </div>
        <p className="table-top__note">You can examine exhibits at any point. Presenting them happens at the exhibits stage.</p>
        {state.pending && <p className="table-top__note is-red">Answer the court about your contradiction first.</p>}
        {latest && !state.pending && <p className="exhibit-remark">“{latest.text}”</p>}
        <ul className="exhibits">
          {ev.map((e) => (
            <ExhibitCard key={e.id} ev={e} state={state} def={def} act={act} canPresent={false} />
          ))}
        </ul>
      </div>
    </div>
  )
}
