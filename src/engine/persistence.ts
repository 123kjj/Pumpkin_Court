// localStorage persistence. Every access is guarded: private windows, blocked
// storage and quota errors must never break the game.
import { emptyProfile, type Profile } from './achievements'
import type { TrialState } from './types'

const PROFILE_KEY = 'psc:v1:profile'
const TRIAL_KEY = 'psc:v1:trial'

function read<T>(key: string): T | null {
  try {
    const raw = globalThis.localStorage?.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function write(key: string, value: unknown) {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(value))
  } catch {
    /* storage unavailable: play on without saving */
  }
}

export function loadProfile(): Profile {
  const p = read<Profile>(PROFILE_KEY)
  if (!p || p.version !== 1 || !Array.isArray(p.achievements)) return emptyProfile()
  return { ...emptyProfile(), ...p }
}

export const saveProfile = (p: Profile) => write(PROFILE_KEY, p)

export function loadTrial(): TrialState | null {
  const t = read<TrialState>(TRIAL_KEY)
  if (!t || t.version !== 1 || typeof t.caseId !== 'string' || !Array.isArray(t.transcript)) return null
  return { ...t, evidenceImpact: t.evidenceImpact ?? {} }
}

export const saveTrial = (t: TrialState) => write(TRIAL_KEY, t)

export function clearTrial() {
  try {
    globalThis.localStorage?.removeItem(TRIAL_KEY)
  } catch {
    /* ignore */
  }
}

export function resetProfile() {
  try {
    globalThis.localStorage?.removeItem(PROFILE_KEY)
  } catch {
    /* ignore */
  }
}
