import type { AppData } from '../types'

const KEY = 'isa-tracker-data'

const DEFAULT: AppData = {
  accounts: [
    { id: 'mine', name: 'My Stocks ISA (T212)', owner: 'Me', remainingAllowance: 20000 },
    { id: 'wife', name: "Wife's Stocks ISA", owner: 'Wife', remainingAllowance: 20000 },
  ],
  investments: [],
}

export function loadData(): AppData {
  if (typeof window === 'undefined') return DEFAULT
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return DEFAULT
    return JSON.parse(raw) as AppData
  } catch {
    return DEFAULT
  }
}

export function saveData(data: AppData): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(KEY, JSON.stringify(data))
}

export function exportJSON(data: AppData): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `isa-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export function importJSON(file: File): Promise<AppData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const data = JSON.parse(e.target?.result as string) as AppData
        resolve(data)
      } catch {
        reject(new Error('Invalid backup file'))
      }
    }
    reader.readAsText(file)
  })
}
