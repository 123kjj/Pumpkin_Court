import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CASES, getCase } from './cases'
import { Title } from './components/Title'
import { Trial } from './components/Trial'
import { Verdict } from './components/Verdict'
import { textureVars } from './components/textures'
import { earnedThisTrial, emptyProfile, recordTrial, type AchievementDef, type Profile } from './engine/achievements'
import { createTrial, reduce } from './engine/engine'
import { clearTrial, loadProfile, loadTrial, resetProfile, saveProfile, saveTrial } from './engine/persistence'
import type { Action, TrialState } from './engine/types'

type Screen = 'title' | 'trial' | 'verdict'

const NAME_KEY = 'psc:v1:name'

export default function App() {
  const [profile, setProfile] = useState<Profile>(() => loadProfile())
  const [trial, setTrial] = useState<TrialState | null>(() => loadTrial())
  const [screen, setScreen] = useState<Screen>('title')
  const [name, setName] = useState(() => {
    try {
      return localStorage.getItem(NAME_KEY) ?? ''
    } catch {
      return ''
    }
  })
  const [fresh, setFresh] = useState<AchievementDef[]>([])
  const [toast, setToast] = useState<AchievementDef[]>([])
  const recorded = useRef<string | null>(null)

  const def = trial ? getCase(trial.caseId) : undefined

  useEffect(() => {
    try {
      localStorage.setItem(NAME_KEY, name)
    } catch {
      /* storage blocked */
    }
  }, [name])

  // Persist the trial on every change so a refresh never loses progress.
  useEffect(() => {
    if (trial && !trial.result) saveTrial(trial)
    if (trial?.result) clearTrial()
  }, [trial])

  // Record finished trials exactly once.
  useEffect(() => {
    if (!trial?.result || !def) return
    const key = `${trial.caseId}:${trial.seed}`
    if (recorded.current === key) return
    recorded.current = key
    const { profile: next, unlocked } = recordTrial(profile, trial, def, CASES.length)
    saveProfile(next)
    setProfile(next)
    setFresh(unlocked)
    if (unlocked.length) setToast(unlocked)
  }, [trial, def, profile])

  useEffect(() => {
    if (!toast.length) return
    const id = window.setTimeout(() => setToast([]), 4200)
    return () => window.clearTimeout(id)
  }, [toast])

  const act = useCallback(
    (a: Action) => {
      if (!def) return
      setTrial((s) => (s ? reduce(s, a, def) : s))
    },
    [def],
  )

  const start = (caseId: string) => {
    const d = getCase(caseId)
    if (!d) return
    recorded.current = null
    setFresh([])
    setTrial(createTrial(d, name, (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0))
    setScreen('trial')
    window.scrollTo({ top: 0 })
  }

  const earned = useMemo(() => (trial?.result && def ? earnedThisTrial(trial, def, profile, CASES.length) : []), [trial, def, profile])

  const resume = trial && !trial.result && def ? { caseId: trial.caseId, title: def.shortTitle } : null

  return (
    <div className="app" style={textureVars}>
      {screen === 'title' || !trial || !def ? (
        <Title
          cases={CASES}
          profile={profile}
          name={name}
          setName={setName}
          onStart={start}
          resume={resume}
          onResume={() => setScreen('trial')}
          onReset={() => {
            resetProfile()
            setProfile(emptyProfile())
          }}
        />
      ) : screen === 'verdict' && trial.result ? (
        <Verdict
          def={def}
          state={trial}
          earned={earned}
          fresh={fresh.map((f) => f.id)}
          onRetry={() => start(def.id)}
          onDocket={() => setScreen('title')}
          onBack={() => setScreen('trial')}
        />
      ) : (
        <Trial key={`${trial.caseId}-${trial.seed}`} def={def} state={trial} act={act} onExit={() => setScreen('title')} onShowVerdict={() => setScreen('verdict')} />
      )}
      {toast.length > 0 && (
        <div className="toast" role="status">
          {toast.map((a) => (
            <p key={a.id}>
              Commendation entered: <b>{a.title}</b>
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
