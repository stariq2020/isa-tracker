import type { AppData } from '../types'

const SCOPE = 'https://www.googleapis.com/auth/drive.appdata'
const FILE_NAME = 'isa-tracker-backup.json'

declare global {
  interface Window {
    google?: any
    gapi?: any
  }
}

let tokenClient: any = null
let accessToken: string | null = null

export function isGoogleReady(): boolean {
  return !!(window.google && window.gapi)
}

export function loadGoogleScripts(clientId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (isGoogleReady()) { resolve(undefined); return }

    let loaded = 0
    const done = () => { if (++loaded === 2) resolve() }

    const gsi = document.createElement('script')
    gsi.src = 'https://accounts.google.com/gsi/client'
    gsi.onload = done
    gsi.onerror = reject
    document.head.appendChild(gsi)

    const gapi = document.createElement('script')
    gapi.src = 'https://apis.google.com/js/api.js'
    gapi.onload = () => {
      window.gapi.load('client', async () => {
        await window.gapi.client.init({})
        done()
      })
    }
    gapi.onerror = reject
    document.head.appendChild(gapi)
  }).then(() => {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      callback: (resp: any) => {
        if (resp.access_token) accessToken = resp.access_token
      },
    })
  })
}

async function getToken(): Promise<string> {
  if (accessToken) return accessToken
  return new Promise((resolve, reject) => {
    tokenClient.callback = (resp: any) => {
      if (resp.error) { reject(resp); return }
      accessToken = resp.access_token
      resolve(accessToken!)
    }
    tokenClient.requestAccessToken({ prompt: 'consent' })
  })
}

async function findFile(): Promise<string | null> {
  const token = await getToken()
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name='${FILE_NAME}'&fields=files(id)`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const json = await res.json()
  return json.files?.[0]?.id ?? null
}

export async function driveBackup(data: AppData): Promise<void> {
  const token = await getToken()
  const body = JSON.stringify({ ...data, lastSynced: new Date().toISOString() })
  const existingId = await findFile()

  if (existingId) {
    await fetch(`https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=media`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body,
    })
  } else {
    const meta = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: FILE_NAME, parents: ['appDataFolder'] }),
    })
    const { id } = await meta.json()
    await fetch(`https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=media`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body,
    })
  }
}

export async function driveRestore(): Promise<AppData | null> {
  const token = await getToken()
  const id = await findFile()
  if (!id) return null
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return res.json()
}
