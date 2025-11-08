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

  // finnhub symbolSearch returns { count, result: [{ description, displaySymbol, symbol, type }, ...] }
  const j = await res.json()
  const results = Array.isArray(j?.result) ? j.result : []
  // Map into our frontend StockSearchResult shape; live price is fetched separately when needed
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

// Fetch aggregated portfolio performance from the server
// Performance aggregation endpoint was removed from the server.
// Keep a client-side stub so callers don't throw — it returns an empty series.
export type PerformancePoint = { day: string; value: number }
export async function fetchPerformance(_days = 30, _username?: string, _password?: string, _token?: string): Promise<PerformancePoint[]> {
  // The server-side `/performance/portfolio` endpoint was intentionally removed.
  // Returning an empty array keeps the UI stable. If you want live performance
  // data later, I can reintroduce a cached server implementation and re-enable this.
  console.warn('fetchPerformance: server endpoint removed; returning empty data')
  return []
}

// Fetch daily candles for a single symbol (proxied through backend)
// Note: candle proxy and direct quote helper removed; frontend uses symbolSearch (and backend handles trade pricing).

// News proxy (server-side endpoint: GET /news?category=...)
export type NewsItem = {
  category: string
  datetime: number
  headline: string
  id: number
  image?: string
  related?: string
  source?: string
  summary?: string
  url?: string
}

export async function fetchNews(category = 'general') : Promise<NewsItem[]> {
  const res = await fetch(`${API_BASE}/news?category=${encodeURIComponent(category)}`, { method: 'GET', headers: { 'Content-Type': 'application/json' } })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err?.error || res.statusText)
  }
  return res.json()
}
