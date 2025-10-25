// Lightweight API helpers for calling the backend and downloading CSVs
// Usage:
// import { fetchPortfolio, downloadPortfolioCSV } from '@/lib/api'
// const data = await fetchPortfolio(username, passwordHash)
// downloadPortfolioCSV(data)

export const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:4000'

export type Holding = {
  symbol: string
  quantity: number
  buyPrice: number
  currentPrice: number
  gain?: number
  gainPercent?: number | null
  addedAt?: string
}

export type PortfolioTotals = {
  totalInvested: number
  totalCurrent: number
  pnl: number
  pnlPercent: number | null
}

export type PortfolioResponse = {
  username: string
  totals: PortfolioTotals
  holdings: Holding[]
}

// If a token is provided, use it as a Bearer token. Otherwise send credentials in the body.
export async function fetchPortfolio(username: string, password: string, token?: string): Promise<PortfolioResponse> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  let body: string | undefined
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  } else {
    body = JSON.stringify({ username, password })
  }

  const res = await fetch(`${API_BASE}/portfolio/all`, {
    method: 'POST',
    headers,
    body
  })

  if (!res.ok) {
    // Try to parse JSON error, fallback to status text
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err?.error || res.statusText)
  }

  return res.json()
}

// Attempt to login using username + passwordHash. Backend may return a token or user object.
export async function login(username: string, password: string): Promise<any> {
  const res = await fetch(`${API_BASE}/users/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err?.error || res.statusText)
  }
  return res.json()
}

// Register a new user using plaintext password (server hashes it)
export async function register(username: string, email: string, fullname: string, password: string): Promise<any> {
  const res = await fetch(`${API_BASE}/users/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, fullname, password })
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err?.error || res.statusText)
  }
  return res.json()
}

// Build and download a CSV file for a PortfolioResponse
export function downloadPortfolioCSV(portfolio: PortfolioResponse, filename?: string) {
  const headers = ['symbol', 'quantity', 'buyPrice', 'currentPrice', 'value', 'gain', 'gainPercent', 'addedAt']
  const rows = portfolio.holdings.map((h) => {
    const value = (h.quantity * h.currentPrice).toFixed(2)
    return [h.symbol, String(h.quantity), String(h.buyPrice), String(h.currentPrice), value, String(h.gain ?? ''), String(h.gainPercent ?? ''), h.addedAt ?? ''].map(csvSafe).join(',')
  })

  const csv = [headers.join(','), ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename || `portfolio_${new Date().toISOString()}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function csvSafe(v: any) {
  if (v == null) return ''
  const s = String(v)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`
  return s
}
