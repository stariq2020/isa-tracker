export type Account = {
  id: string
  name: string
  owner: string
  remainingAllowance: number
}

export type Investment = {
  id: string
  accountId: string
  date: string       // YYYY-MM-DD
  ticker: string     // e.g. VUAG
  amount: number     // £
}

export type AppData = {
  accounts: Account[]
  investments: Investment[]
  lastSynced?: string
}
