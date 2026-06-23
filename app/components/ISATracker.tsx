'use client'
import { useState, useEffect, useCallback } from 'react'
import type { AppData, Investment, Account } from '../types'
import { loadData, saveData, exportJSON, importJSON } from '../lib/storage'
import { loadGoogleScripts, driveBackup, driveRestore, isGoogleReady } from '../lib/googleDrive'
import { today, yesterday, startOfMonth, formatGBP, formatDate, sumByTicker } from '../lib/utils'

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ''
const ISA_LIMIT = 20000

type View = 'dashboard' | 'add' | 'history' | 'settings'

export default function ISATracker() {
  const [data, setData] = useState<AppData>({ accounts: [], investments: [] })
  const [view, setView] = useState<View>('dashboard')
  const [activeAccount, setActiveAccount] = useState<string>('mine')
  const [driveReady, setDriveReady] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')
  const [form, setForm] = useState({ date: today(), ticker: '', amount: '' })
  const [editingAllowance, setEditingAllowance] = useState<string | null>(null)
  const [allowanceInput, setAllowanceInput] = useState('')

  useEffect(() => {
    const stored = loadData()
    setData(stored)
    if (GOOGLE_CLIENT_ID) {
      loadGoogleScripts(GOOGLE_CLIENT_ID).then(() => setDriveReady(true)).catch(() => {})
    }
  }, [])

  const persist = useCallback((next: AppData) => {
    setData(next)
    saveData(next)
    if (driveReady) {
      driveBackup(next).catch(() => {})
    }
  }, [driveReady])

  const account = data.accounts.find(a => a.id === activeAccount) ?? data.accounts[0]

  const accountInvestments = data.investments.filter(i => i.accountId === activeAccount)

  const todayInvs = accountInvestments.filter(i => i.date === today())
  const yesterdayInvs = accountInvestments.filter(i => i.date === yesterday())
  const monthInvs = accountInvestments.filter(i => i.date >= startOfMonth())
  const tickerTotals = sumByTicker(accountInvestments)

  function addInvestment() {
    if (!form.ticker.trim() || !form.amount || !account) return
    const amount = parseFloat(form.amount)
    if (isNaN(amount) || amount <= 0) return
    const inv: Investment = {
      id: `${Date.now()}`,
      accountId: activeAccount,
      date: form.date,
      ticker: form.ticker.trim().toUpperCase(),
      amount,
    }
    const updatedAccounts = data.accounts.map(a =>
      a.id === activeAccount
        ? { ...a, remainingAllowance: Math.max(0, a.remainingAllowance - amount) }
        : a
    )
    persist({ ...data, accounts: updatedAccounts, investments: [inv, ...data.investments] })
    setForm({ date: today(), ticker: '', amount: '' })
    setView('dashboard')
  }

  function deleteInvestment(id: string) {
    const inv = data.investments.find(i => i.id === id)
    if (!inv) return
    const updatedAccounts = data.accounts.map(a =>
      a.id === inv.accountId
        ? { ...a, remainingAllowance: a.remainingAllowance + inv.amount }
        : a
    )
    persist({ ...data, accounts: updatedAccounts, investments: data.investments.filter(i => i.id !== id) })
  }

  function saveAllowance(accountId: string) {
    const val = parseFloat(allowanceInput)
    if (isNaN(val)) return
    const updatedAccounts = data.accounts.map(a =>
      a.id === accountId ? { ...a, remainingAllowance: val } : a
    )
    persist({ ...data, accounts: updatedAccounts })
    setEditingAllowance(null)
  }

  async function handleDriveRestore() {
    setSyncing(true)
    setSyncMsg('')
    try {
      const restored = await driveRestore()
      if (restored) {
        setData(restored)
        saveData(restored)
        setSyncMsg('Restored from Google Drive!')
      } else {
        setSyncMsg('No backup found on Drive.')
      }
    } catch {
      setSyncMsg('Restore failed. Please try again.')
    }
    setSyncing(false)
  }

  async function handleDriveBackup() {
    setSyncing(true)
    setSyncMsg('')
    try {
      await driveBackup(data)
      setSyncMsg('Backed up to Google Drive!')
    } catch {
      setSyncMsg('Backup failed. Please try again.')
    }
    setSyncing(false)
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    importJSON(file).then(imported => {
      setData(imported)
      saveData(imported)
      setSyncMsg('Data imported!')
    }).catch(() => setSyncMsg('Invalid file.'))
  }

  const usedPct = account ? ((ISA_LIMIT - account.remainingAllowance) / ISA_LIMIT) * 100 : 0

  return (
    <div className="min-h-screen bg-gray-950 text-white max-w-md mx-auto">
      {/* Header */}
      <div className="bg-gray-900 px-4 py-4 sticky top-0 z-10 border-b border-gray-800">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-bold text-emerald-400">ISA Tracker</h1>
          <div className="flex gap-1">
            {data.accounts.map(a => (
              <button
                key={a.id}
                onClick={() => setActiveAccount(a.id)}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                  activeAccount === a.id
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {a.owner}
              </button>
            ))}
          </div>
        </div>
        {/* ISA Allowance Bar */}
        {account && (
          <div>
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>ISA Allowance Left</span>
              <span className={account.remainingAllowance < 2000 ? 'text-red-400' : 'text-emerald-400'}>
                {formatGBP(account.remainingAllowance)} / {formatGBP(ISA_LIMIT)}
              </span>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${usedPct > 90 ? 'bg-red-500' : usedPct > 70 ? 'bg-yellow-500' : 'bg-emerald-500'}`}
                style={{ width: `${Math.min(100, usedPct)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="px-4 py-4">

        {/* DASHBOARD */}
        {view === 'dashboard' && (
          <div className="space-y-4">
            {/* Today */}
            <Section title="Today" total={todayInvs.reduce((s, i) => s + i.amount, 0)}>
              {todayInvs.length === 0
                ? <p className="text-gray-500 text-sm">No investments today</p>
                : todayInvs.map(i => <InvRow key={i.id} inv={i} onDelete={deleteInvestment} />)
              }
            </Section>

            {/* Yesterday */}
            <Section title="Yesterday" total={yesterdayInvs.reduce((s, i) => s + i.amount, 0)}>
              {yesterdayInvs.length === 0
                ? <p className="text-gray-500 text-sm">No investments yesterday</p>
                : yesterdayInvs.map(i => <InvRow key={i.id} inv={i} onDelete={deleteInvestment} />)
              }
            </Section>

            {/* This Month */}
            <Section title="This Month" total={monthInvs.reduce((s, i) => s + i.amount, 0)}>
              {monthInvs.length === 0
                ? <p className="text-gray-500 text-sm">Nothing this month yet</p>
                : monthInvs.map(i => <InvRow key={i.id} inv={i} onDelete={deleteInvestment} />)
              }
            </Section>

            {/* By ETF */}
            {Object.keys(tickerTotals).length > 0 && (
              <div className="bg-gray-900 rounded-xl p-4">
                <h2 className="text-sm font-semibold text-gray-400 mb-3">By ETF / Stock</h2>
                <div className="space-y-2">
                  {Object.entries(tickerTotals)
                    .sort((a, b) => b[1] - a[1])
                    .map(([ticker, total]) => (
                      <div key={ticker} className="flex justify-between items-center">
                        <span className="font-mono text-sm font-medium text-white">{ticker}</span>
                        <span className="text-emerald-400 text-sm font-semibold">{formatGBP(total)}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ADD INVESTMENT */}
        {view === 'add' && (
          <div className="space-y-4">
            <h2 className="text-base font-semibold">Add Investment — {account?.name}</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Date</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Ticker (e.g. VUAG, VWRP)</label>
                <input
                  type="text"
                  value={form.ticker}
                  onChange={e => setForm(f => ({ ...f, ticker: e.target.value.toUpperCase() }))}
                  placeholder="VUAG"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500 uppercase"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Amount (£)</label>
                <input
                  type="number"
                  value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>
              <button
                onClick={addInvestment}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3 rounded-xl transition-colors"
              >
                Add Investment
              </button>
              <button
                onClick={() => setView('dashboard')}
                className="w-full bg-gray-800 text-gray-400 py-2 rounded-xl text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* HISTORY */}
        {view === 'history' && (
          <div className="space-y-3">
            <h2 className="text-base font-semibold">All Investments — {account?.name}</h2>
            {accountInvestments.length === 0
              ? <p className="text-gray-500 text-sm">No investments yet</p>
              : accountInvestments.map(i => <InvRow key={i.id} inv={i} onDelete={deleteInvestment} showDate />)
            }
          </div>
        )}

        {/* SETTINGS */}
        {view === 'settings' && (
          <div className="space-y-6">
            <h2 className="text-base font-semibold">Settings</h2>

            {/* Allowance adjustments */}
            <div className="bg-gray-900 rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-400">ISA Remaining Allowance</h3>
              {data.accounts.map(a => (
                <div key={a.id} className="flex items-center gap-2">
                  <span className="text-sm flex-1">{a.name}</span>
                  {editingAllowance === a.id ? (
                    <>
                      <input
                        type="number"
                        value={allowanceInput}
                        onChange={e => setAllowanceInput(e.target.value)}
                        className="w-28 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-emerald-500"
                      />
                      <button onClick={() => saveAllowance(a.id)} className="text-emerald-400 text-sm font-medium">Save</button>
                      <button onClick={() => setEditingAllowance(null)} className="text-gray-500 text-sm">Cancel</button>
                    </>
                  ) : (
                    <>
                      <span className="text-emerald-400 text-sm">{formatGBP(a.remainingAllowance)}</span>
                      <button
                        onClick={() => { setEditingAllowance(a.id); setAllowanceInput(String(a.remainingAllowance)) }}
                        className="text-gray-400 text-xs underline"
                      >Edit</button>
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* Google Drive */}
            {GOOGLE_CLIENT_ID && (
              <div className="bg-gray-900 rounded-xl p-4 space-y-3">
                <h3 className="text-sm font-semibold text-gray-400">Google Drive Backup</h3>
                {!driveReady
                  ? <p className="text-xs text-gray-500">Loading Google Drive...</p>
                  : (
                    <div className="flex gap-2">
                      <button
                        onClick={handleDriveBackup}
                        disabled={syncing}
                        className="flex-1 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white text-sm py-2 rounded-lg"
                      >
                        {syncing ? 'Working...' : 'Back Up Now'}
                      </button>
                      <button
                        onClick={handleDriveRestore}
                        disabled={syncing}
                        className="flex-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white text-sm py-2 rounded-lg"
                      >
                        Restore
                      </button>
                    </div>
                  )
                }
                {syncMsg && <p className="text-xs text-emerald-400">{syncMsg}</p>}
                {data.lastSynced && (
                  <p className="text-xs text-gray-500">Last synced: {new Date(data.lastSynced).toLocaleString('en-GB')}</p>
                )}
              </div>
            )}

            {/* Manual backup */}
            <div className="bg-gray-900 rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-400">Manual Backup</h3>
              <button
                onClick={() => exportJSON(data)}
                className="w-full bg-gray-700 hover:bg-gray-600 text-white text-sm py-2 rounded-lg"
              >
                Export JSON
              </button>
              <label className="block w-full bg-gray-700 hover:bg-gray-600 text-white text-sm py-2 rounded-lg text-center cursor-pointer">
                Import JSON
                <input type="file" accept=".json" onChange={handleImport} className="hidden" />
              </label>
              {syncMsg && <p className="text-xs text-emerald-400">{syncMsg}</p>}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Nav */}
      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-gray-900 border-t border-gray-800 flex">
        <NavBtn label="Home" icon="🏠" active={view === 'dashboard'} onClick={() => setView('dashboard')} />
        <button
          onClick={() => setView('add')}
          className="flex-1 flex flex-col items-center py-3"
        >
          <span className="text-2xl leading-none">＋</span>
          <span className="text-[10px] text-emerald-400 mt-0.5">Add</span>
        </button>
        <NavBtn label="History" icon="📋" active={view === 'history'} onClick={() => setView('history')} />
        <NavBtn label="Settings" icon="⚙️" active={view === 'settings'} onClick={() => setView('settings')} />
      </div>

      <div className="h-20" />
    </div>
  )
}

function NavBtn({ label, icon, active, onClick }: { label: string; icon: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex-1 flex flex-col items-center py-3">
      <span className="text-xl leading-none">{icon}</span>
      <span className={`text-[10px] mt-0.5 ${active ? 'text-emerald-400' : 'text-gray-500'}`}>{label}</span>
    </button>
  )
}

function Section({ title, total, children }: { title: string; total: number; children: React.ReactNode }) {
  return (
    <div className="bg-gray-900 rounded-xl p-4">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-sm font-semibold text-gray-400">{title}</h2>
        {total > 0 && <span className="text-emerald-400 text-sm font-semibold">{formatGBP(total)}</span>}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function InvRow({ inv, onDelete, showDate }: { inv: Investment; onDelete: (id: string) => void; showDate?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <span className="font-mono text-sm font-semibold text-white">{inv.ticker}</span>
        {showDate && <span className="text-xs text-gray-500 ml-2">{formatDate(inv.date)}</span>}
      </div>
      <div className="flex items-center gap-3">
        <span className="text-emerald-400 text-sm font-semibold">{formatGBP(inv.amount)}</span>
        <button
          onClick={() => onDelete(inv.id)}
          className="text-gray-600 hover:text-red-400 text-xs transition-colors"
        >✕</button>
      </div>
    </div>
  )
}
