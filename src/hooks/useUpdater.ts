import { check, type Update } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'
import { useEffect } from 'react'
import { useStore } from '../store'

const SKIP_KEY = 'pcfixai_skipped_update_version'
const RECHECK_MS = 4 * 60 * 60 * 1000

let pendingUpdate: Update | null = null

export async function checkForUpdate(opts: { silent?: boolean } = {}) {
  const store = useStore.getState()
  store.setUpdater({ status: 'checking', error: null })
  try {
    const update = await check()
    if (!update) {
      pendingUpdate = null
      store.setUpdater({ status: 'up_to_date', version: null, currentVersion: null, body: null })
      return
    }
    pendingUpdate = update
    const skipped = localStorage.getItem(SKIP_KEY)
    if (opts.silent && skipped === update.version) {
      store.setUpdater({ status: 'idle' })
      return
    }
    store.setUpdater({
      status: 'available',
      version: update.version,
      currentVersion: update.currentVersion,
      body: update.body ?? '',
    })
  } catch (err) {
    store.setUpdater({ status: 'error', error: String(err) })
  }
}

export async function installUpdate() {
  const store = useStore.getState()
  if (!pendingUpdate) return
  try {
    let contentLength = 0
    let downloaded = 0
    store.setUpdater({ status: 'downloading', progress: 0 })
    await pendingUpdate.downloadAndInstall((event) => {
      if (event.event === 'Started') {
        contentLength = event.data.contentLength ?? 0
      } else if (event.event === 'Progress') {
        downloaded += event.data.chunkLength
        const pct = contentLength > 0 ? Math.min(100, Math.round((downloaded / contentLength) * 100)) : 0
        useStore.getState().setUpdater({ progress: pct })
      } else if (event.event === 'Finished') {
        useStore.getState().setUpdater({ progress: 100 })
      }
    })
    store.setUpdater({ status: 'ready_to_restart' })
    await relaunch()
  } catch (err) {
    store.setUpdater({ status: 'error', error: String(err) })
  }
}

export function skipUpdate(version: string) {
  localStorage.setItem(SKIP_KEY, version)
  useStore.getState().setUpdater({ status: 'idle' })
}

export function dismissUpdaterBanner() {
  useStore.getState().setUpdater({ status: 'idle' })
}

export function useUpdaterAutoCheck() {
  useEffect(() => {
    const initial = setTimeout(() => checkForUpdate({ silent: true }), 4000)
    const interval = setInterval(() => checkForUpdate({ silent: true }), RECHECK_MS)
    return () => {
      clearTimeout(initial)
      clearInterval(interval)
    }
  }, [])
}
