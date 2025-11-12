export const API_BASE = (import.meta as any).env?.VITE_API_URL

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

//Login using username + passwordHash.
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

// Register a new user using plaintext password
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

// Portfolio trade endpoints: buy and sell
export async function portfolioBuy(symbol: string, quantity: number, username?: string, password?: string, token?: string): Promise<any> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  let body: string | undefined
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
    body = JSON.stringify({ symbol, quantity })
  } else {
    body = JSON.stringify({ username, password, symbol, quantity })
  }

  const res = await fetch(`${API_BASE}/portfolio/buy`, { method: 'POST', headers, body })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err?.error || res.statusText)
  }
  return res.json()
}

export async function portfolioSell(symbol: string, quantity: number, username?: string, password?: string, token?: string): Promise<any> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  let body: string | undefined
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
    body = JSON.stringify({ symbol, quantity })
  } else {
    body = JSON.stringify({ username, password, symbol, quantity })
  }

  const res = await fetch(`${API_BASE}/portfolio/sell`, { method: 'POST', headers, body })
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

// Stock search API
export type StockSearchResult = {
  symbol: string
  displaySymbol?: string
  description?: string
  type?: string
  // optional live data
  price?: number | null
  currency?: string
  change?: number | null
  changePercent?: number | null
}

export async function searchStocks(query: string, token?: string): Promise<StockSearchResult[]> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${API_BASE}/stocks/search?q=${encodeURIComponent(query)}`, {
    method: 'GET',
    headers
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err?.error || res.statusText)
  }

  // finnhub symbolSearch returns
  const j = await res.json()
  const results = Array.isArray(j?.result) ? j.result : []
  // Map into our frontend StockSearchResult shape
  return results.map((it: any) => ({
    symbol: it.symbol,
    displaySymbol: it.displaySymbol,
    description: it.description,
    type: it.type,
    price: null,
    currency: 'USD'  // Default to USD
  }))
}

// Fetch single-symbol quote from backend
export type StockQuote = {
  currentPrice: number
  change: number
  percentChange: number
  highPrice: number
  lowPrice: number
  openPrice: number
  previousClose: number
  timestamp: number
}

export async function fetchQuote(symbol: string, token?: string): Promise<StockQuote> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${API_BASE}/stocks/quote?symbol=${encodeURIComponent(symbol)}`, {
    method: 'GET',
    headers
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err?.error || res.statusText)
  }

  return res.json()
}

// Fetch company profile
export type CompanyProfile = {
  country?: string
  currency?: string
  estimateCurrency?: string
  exchange?: string
  finnhubIndustry?: string
  ipo?: string
  logo?: string
  marketCapitalization?: number
  name?: string
  phone?: string
  shareOutstanding?: number
  ticker?: string
  weburl?: string
}

export async function fetchProfile(symbol: string, token?: string): Promise<CompanyProfile | null> {
  const headers: Record<string,string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${API_BASE}/stocks/profile?symbol=${encodeURIComponent(symbol)}`, { method: 'GET', headers })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err?.error || res.statusText)
  }
  const j = await res.json().catch(() => null)
  return j && Object.keys(j).length ? j : null
}

// ===== Admin APIs =====
export type AdminUser = { email: string; fullname: string; username: string; roles: string[] }

export async function adminListUsers(token: string): Promise<AdminUser[]> {
  const res = await fetch(`${API_BASE}/admin/users`, { method: 'GET', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` } })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err?.error || res.statusText)
  }
  const j = await res.json()
  return Array.isArray(j?.users) ? j.users : []
}

export async function adminCreateUser(payload: { email: string; fullname: string; username: string; password: string; roles?: string[] }, token: string): Promise<AdminUser> {
  const res = await fetch(`${API_BASE}/admin/users`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(payload) })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err?.error || res.statusText)
  }
  const j = await res.json()
  return j?.user
}

export async function adminDeleteUser(username: string, token: string): Promise<void> {
  const res = await fetch(`${API_BASE}/admin/users/${encodeURIComponent(username)}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` } })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err?.error || res.statusText)
  }
}

export async function adminGetPortfolio(username: string, token: string): Promise<Holding[]> {
  const res = await fetch(`${API_BASE}/admin/users/${encodeURIComponent(username)}/portfolio`, { method: 'GET', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` } })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err?.error || res.statusText)
  }
  const j = await res.json()
  const h = Array.isArray(j?.holdings) ? j.holdings : []
  // Map server holding shape to front-end Holding type if needed
  return h.map((it: any) => ({ symbol: it.symbol, quantity: it.quantity, buyPrice: it.buyPrice, currentPrice: it.currentPrice }))
}

export async function adminUpsertHolding(username: string, payload: { symbol: string; quantity: number; buyPrice: number }, token: string): Promise<void> {
  const res = await fetch(`${API_BASE}/admin/users/${encodeURIComponent(username)}/holdings`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(payload) })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err?.error || res.statusText)
  }
}

export async function adminDeleteHolding(username: string, symbol: string, token: string): Promise<void> {
  const res = await fetch(`${API_BASE}/admin/users/${encodeURIComponent(username)}/holdings/${encodeURIComponent(symbol)}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` } })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err?.error || res.statusText)
  }
}
