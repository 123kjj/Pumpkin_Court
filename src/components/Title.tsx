import { useEffect, useState } from 'react'
import { ACHIEVEMENTS, type Profile } from '../engine/achievements'
import type { CaseDef, Mood } from '../engine/types'
import { Scene } from './Scene'

interface Props {
  cases: CaseDef[]
  profile: Profile
  name: string
  setName: (n: string) => void
  onStart: (caseId: string) => void
  resume: { caseId: string; title: string } | null
  onResume: () => void
  onReset: () => void
}

const VERDICT_SHORT: Record<string, string> = {
  guilty: 'Guilty',
  not_guilty: 'Not guilty',
  lesser: 'Lesser offense',
  dismissed: 'Dismissed',
  mistrial_raccoon: 'Raccoon mistrial',
  judge_removed: 'Judge removed',
}

const IDLE: Mood[] = ['neutral', 'suspicious', 'neutral', 'smug', 'neutral', 'laughing']

const today = () => {
  try {
    return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  } catch {
    return ''
  }
}

export function Title({ cases, profile, name, setName, onStart, resume, onResume, onReset }: Props) {
  const [mood, setMood] = useState<Mood>('neutral')
  const [showRecord, setShowRecord] = useState(false)
  const [confirmErase, setConfirmErase] = useState(false)

  useEffect(() => {
    let i = 0
    const id = window.setInterval(() => setMood(IDLE[++i % IDLE.length]), 3200)
    return () => window.clearInterval(id)
  }, [])

  const caption = (c: CaseDef) => c.title.split(':')[0].replace('{name}', name.trim() || 'You')

  return (
    <main className="title">
      <h1 className="title__name">Pumpkin Supreme Court</h1>
      <Scene mood={mood} speaker="judge" witness={null} patience={100} cred={50} pros={50} gavelKey={0} />
      <div className="speech speech--clerk title__speech">
        <div className="speech__plate">
          <span>Clerk of the Court</span>
        </div>
        <div className="speech__box speech__box--static">
          <span className="speech__text">
            All rise. The Pumpkin Supreme Court is now in session, the Honorable Jack O’Lantern presiding. He takes every case personally, remembers everything you say, and
            has a candle where his patience should be.
          </span>
        </div>
      </div>

      {resume && (
        <div className="resume">
          <p>Your trial in {resume.title} was adjourned mid-session.</p>
          <button className="stamp-btn" onClick={onResume}>
            Return to court
          </button>
        </div>
      )}

      <section className="docket paper" aria-labelledby="docket-h">
        <header className="docket__head">
          <p className="docket__court">Pumpkin Supreme Court, Courtroom 1</p>
          <h2 id="docket-h">Daily calendar</h2>
          <p className="docket__date">{today()}. Hon. Jack O’Lantern presiding.</p>
        </header>

        <div className="docket__name">
          <label htmlFor="defendant-name">Defendant’s name, for the record</label>
          <input id="defendant-name" value={name} maxLength={24} placeholder="Your name" onChange={(e) => setName(e.target.value)} autoComplete="off" />
        </div>

        <ol className="docket__list">
          {cases.map((c) => {
            const reached = profile.completed[c.id] ?? []
            return (
              <li key={c.id} className="docket__row">
                <span className="docket__no">PSC-26-{String(c.number).padStart(4, '0')}</span>
                <div className="docket__case">
                  <b>{caption(c)}</b>
                  <span>{c.charge}</span>
                  <em>{c.tagline}</em>
                </div>
                <span className="docket__status">
                  {reached.length === 0
                    ? 'Not yet heard'
                    : reached.map((k) => (k.startsWith('secret:') ? 'Secret ending' : VERDICT_SHORT[k] ?? k)).join(', ')}
                </span>
                <button className="ink-btn" onClick={() => onStart(c.id)} aria-label={`Call case: ${c.shortTitle}`}>
                  Call case
                </button>
              </li>
            )
          })}
        </ol>

        <footer className="docket__foot">
          <button className="text-btn text-btn--ink" onClick={() => setShowRecord(true)}>
            Your record: {profile.achievements.length} of {ACHIEVEMENTS.length} commendations
          </button>
          <p>All rulings follow the court’s own rulebook. No machines were consulted.</p>
        </footer>
      </section>

      {showRecord && (
        <div className="modal" role="dialog" aria-modal="true" aria-label="Commendations" onClick={() => setShowRecord(false)}>
          <div className="modal__sheet paper" onClick={(e) => e.stopPropagation()}>
            <div className="modal__head">
              <h2>Commendations</h2>
              <button className="text-btn text-btn--ink" onClick={() => setShowRecord(false)} autoFocus>
                Close
              </button>
            </div>
            <ul className="commendations">
              {ACHIEVEMENTS.map((a) => {
                const got = profile.achievements.includes(a.id)
                return (
                  <li key={a.id} className={got ? 'is-got' : ''}>
                    <b>{got || !a.hidden ? a.title : 'Sealed'}</b>
                    <span>{got || !a.hidden ? a.description : 'Do something unusual in court to unseal this.'}</span>
                  </li>
                )
              })}
            </ul>
            {confirmErase ? (
              <p className="erase-confirm">
                Erase all commendations and case records?{' '}
                <button
                  className="text-btn text-btn--red"
                  onClick={() => {
                    onReset()
                    setConfirmErase(false)
                  }}
                >
                  Yes, erase
                </button>{' '}
                <button className="text-btn text-btn--ink" onClick={() => setConfirmErase(false)}>
                  Keep them
                </button>
              </p>
            ) : (
              <button className="text-btn text-btn--red" onClick={() => setConfirmErase(true)}>
                Erase my record
              </button>
            )}
          </div>
        </div>
      )}
    </main>
  )
}
