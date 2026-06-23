import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ISA Tracker',
  description: 'Track your Stocks & Shares ISA investments',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-gray-950">{children}</body>
    </html>
  )
}
