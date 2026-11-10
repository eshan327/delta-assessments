import Dexie from 'dexie'
import type { Table } from 'dexie'
import { create } from 'zustand'
import { attemptSchema, defaults, settingsSchema } from './session.ts'
import type { Attempt, Settings } from './session.ts'

class LocalStore extends Dexie {
  attempts!: Table<Attempt, string>
  profile!: Table<{ id: string; settings: Settings }, string>
  constructor() {
    super('delta-assessments')
    this.version(1).stores({ attempts: 'id,updatedAt', profile: 'id' })
  }
}

const db = new LocalStore()
type Data = {
  attempts: Attempt[]
  settings: Settings
  ready: boolean
  limited: boolean
  warning: string
}
export const useData = create<Data>(() => ({ attempts: [], settings: defaults, ready: false, limited: false, warning: '' }))
const sortAttempts = (items: Attempt[]) => [...items].sort((a, b) => b.updatedAt - a.updatedAt)
let queue = Promise.resolve()
const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('delta-assessments') : null

function useMemory(message = 'Browser storage is unavailable. Changes will last until you close or reload this page.') {
  useData.setState({ limited: true, warning: message })
}

function persist(write: () => Promise<unknown>, broadcast = true) {
  queue = queue.then(async () => {
    if (useData.getState().limited) return
    try {
      await write()
      if (broadcast) channel?.postMessage('updated')
    } catch {
      useMemory()
    }
  })
  return queue
}

let opening: Promise<void> | undefined
export function openData() {
  opening ??= (async () => {
    try {
      const [rows, profile] = await Promise.all([db.attempts.toArray(), db.profile.get('settings')])
      const attempts = rows.flatMap(row => {
        const result = attemptSchema.safeParse(row)
        return result.success ? [result.data] : []
      })
      const parsed = settingsSchema.safeParse(profile?.settings)
      useData.setState({
        attempts: sortAttempts(attempts), settings: parsed.success ? parsed.data : defaults,
        warning: attempts.length < rows.length || (profile && !parsed.success) ? 'Some saved data could not be read. Valid attempts are still available.' : '',
      })
    } catch {
      useMemory()
    } finally {
      useData.setState({ ready: true })
    }
  })()
  return opening
}

if (channel) channel.onmessage = async () => {
  if (!useData.getState().ready || useData.getState().limited) return
  await queue
  opening = undefined
  await openData()
}

export function saveAttempt(attempt: Attempt) {
  useData.setState(state => ({ attempts: sortAttempts([attempt, ...state.attempts.filter(a => a.id !== attempt.id)]) }))
  return persist(async () => {
    await db.transaction('rw', db.attempts, async () => {
      const current = await db.attempts.get(attempt.id)
      if (!current || current.revision < attempt.revision) await db.attempts.put(attempt)
      else if (current.revision >= attempt.revision && current.updatedAt !== attempt.updatedAt) {
        useData.setState(state => {
          const inMemory = state.attempts.find(a => a.id === attempt.id)
          return inMemory && inMemory.revision <= current.revision ? {
            attempts: sortAttempts([current, ...state.attempts.filter(a => a.id !== attempt.id)]),
            warning: 'This run was updated in another tab.',
          } : state
        })
      }
    })
  })
}
