import type { Investment } from '../types'

export function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export function yesterday(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}

export function startOfMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

export function formatGBP(n: number): string {
  return `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function sumByTicker(investments: Investment[]): Record<string, number> {
  return investments.reduce((acc, inv) => {
    acc[inv.ticker] = (acc[inv.ticker] || 0) + inv.amount
    return acc
  }, {} as Record<string, number>)
}
