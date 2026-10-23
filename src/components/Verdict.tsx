import { useEffect, useRef, useState } from 'react'
import type { AchievementDef } from '../engine/achievements'
import { SHARE_TEMPLATE, fill } from '../engine/dialogue'
import type { CaseDef, TrialState } from '../engine/types'
import { t } from './text'

interface Props {
  def: CaseDef
  state: TrialState
  earned: AchievementDef[]
  fresh: string[]
  onRetry: () => void
  onDocket: () => void
  onBack: () => void
}

const longDate = () => {
  try {
    return new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  } catch {
    return ''
  }
}

export function Verdict({ def, state, earned, fresh, onRetry, onDocket, onBack }: Props) {
  const r = state.result!
  const [shared, setShared] = useState<string | null>(null)
  const head = useRef<HTMLHeadingElement>(null)
  useEffect(() => head.current?.focus(), [])

  const caption = t(def.title, def, state).split(':')[0]
  const [plaintiff, defendant] = caption.split(' v. ')
  const tone = r.kind === 'not_guilty' || r.kind === 'dismissed' ? 'win' : r.kind === 'guilty' ? 'loss' : 'odd'

  const share = async () => {
    const text = fill(SHARE_TEMPLATE, {
      name: state.defendant,
      victim: def.victim.name,
      prosecutor: def.prosecutor.name,
      charge: def.charge,
      case: def.shortTitle,
      verdict: r.title,
      sentence: r.sentence,
      cred: state.cred,
      contradictions: state.contradictions.length,
      roast: r.roast,
    })
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Pumpkin Supreme Court', text })
        setShared('Shared.')
        return
      } catch {
        /* refused or cancelled: fall back to the clipboard */
      }
    }
    try {
      await navigator.clipboard.writeText(text)
      setShared('Judgment copied to your clipboard.')
    } catch {
      setShared('Copying was blocked here. Select the judgment text to copy it.')
    }
  }

  const findings: [string, string][] = [
    ['Credibility', `${state.cred} out of 100. ${r.credibilityLabel}`],
    ['Strongest evidence', r.strongestEvidence],
    ['Biggest mistake', r.biggestMistake],
    [
      'Contradictions',
      state.contradictions.length === 0
        ? 'None. Suspiciously consistent.'
        : `${state.contradictions.length} on the record, ${state.contradictions.filter((c) => !c.resolved).length} left unexplained.`,
    ],
  ]

  return (
    <main className="verdict-wrap">
      <article className={`order paper order--${tone}`} aria-labelledby="verdict-title">
        <p className="order__court">In the Pumpkin Supreme Court</p>
        <div className="order__caption">
          <div className="order__parties">
            <p>
              {plaintiff},<br />
              <i>Plaintiff,</i>
            </p>
            <p>v.</p>
            <p>
              {defendant},<br />
              <i>Defendant.</i>
            </p>
          </div>
          <div className="order__paren" aria-hidden="true">
            {')\n)\n)\n)\n)\n)\n)'}
          </div>
          <div className="order__meta">
            <p>Case No. PSC-26-{String(def.number).padStart(4, '0')}</p>
            <p>
              Charge: {def.charge}
              <br />
              {def.statute}
            </p>
          </div>
        </div>

        <h1 className="order__title">Order and judgment</h1>

        <p>The Court, having heard the defendant, the witnesses and the exhibits, and having lost patience at the rate recorded below, finds as follows.</p>
        {r.narration.map((n, i) => (
          <p key={i}>{n}</p>
        ))}

        <div className="order__ruling">
          <p>{['guilty', 'not_guilty', 'lesser'].includes(r.kind) ? 'It is hereby ordered that the defendant is found' : 'It is hereby ordered'}</p>
          <h2 id="verdict-title" ref={head} tabIndex={-1} className="stamp">
            {r.title}
          </h2>
        </div>

        <h3>Sentence</h3>
        <p className="order__sentence">{r.sentence}</p>

        <h3>Findings</h3>
        <ol className="order__findings">
          {findings.map(([k, v]) => (
            <li key={k}>
              <b>{k}.</b> {v}
            </li>
          ))}
        </ol>

        <h3>Remarks from the bench</h3>
        <blockquote className="order__remarks">{r.roast}</blockquote>

        <h3>How the Court reached this</h3>
        <ul className="order__reasons">
          {r.explanation.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>

        {earned.length > 0 && (
          <>
            <h3>Commendations entered into the record</h3>
            <ul className="order__reasons">
              {earned.map((a) => (
                <li key={a.id}>
                  <b>{a.title}.</b> {a.description}
                  {fresh.includes(a.id) && <span className="order__new"> New.</span>}
                </li>
              ))}
            </ul>
          </>
        )}

        <div className="order__sign">
          <p>So ordered, {longDate()}.</p>
          <div className="order__signature">
            <span className="order__scrawl">Jack O’Lantern</span>
            <span className="order__line">Hon. Jack O’Lantern, Presiding Judge</span>
          </div>
          <div className="wax" aria-hidden="true">
            <span>JOL</span>
          </div>
        </div>
      </article>

      <div className="verdict-actions">
        <button className="stamp-btn" onClick={share}>
          Share the judgment
        </button>
        <button className="ink-btn ink-btn--light" onClick={onRetry}>
          Retry this case
        </button>
        <button className="ink-btn ink-btn--light" onClick={onDocket}>
          Back to the calendar
        </button>
        <button className="text-btn" onClick={onBack}>
          Reread the trial
        </button>
        {shared && (
          <p className="share-note" role="status">
            {shared}
          </p>
        )}
      </div>
    </main>
  )
}
