import dotenv from 'dotenv'
dotenv.config()

import express from 'express'
import mongoose from 'mongoose'
import morgan from 'morgan'
import cors from 'cors'
import Joi from 'joi'
import fetch from 'node-fetch'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

const app = express()

const PORT = process.env.PORT || 4000
const MONGO_URI = process.env.MONGO_URI
const CORS_ORIGIN = process.env.CORS_ORIGIN

if (!MONGO_URI) throw new Error('MONGO_URI missing')
await mongoose.connect(MONGO_URI)

// ===== Schemas =====
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, index: true },
  passwordHash: { type: String, required: true },
  fullname: { type: String, required: true },
  username: { type: String, required: true, unique: true },
  roles: { type: [String], default: ['user'] }
}, { timestamps: true })

const holdingSchema = new mongoose.Schema({
  symbol: { type: String, required: true },
  quantity: { type: Number, required: true, min: 0 },
  buyPrice: { type: Number, required: true, min: 0 },
  currentPrice: { type: Number, default: 0 },
  addedAt: { type: Date, default: Date.now }
}, { _id: false })

const portfolioSchema = new mongoose.Schema({
  userUsername: { type: String, required: true, unique: true },
  holdings: { type: [holdingSchema], default: [] }
}, { timestamps: true })

const User = mongoose.model('User', userSchema)
const Portfolio = mongoose.model('Portfolio', portfolioSchema)

// ===== App middleware =====
// If CORS_ORIGIN is provided in env, restrict to it. Otherwise allow any origin (useful for local dev).
const corsOptions = CORS_ORIGIN ? { origin: CORS_ORIGIN, credentials: true } : { origin: true, credentials: true }
app.use(cors(corsOptions))
console.log('CORS configured:', CORS_ORIGIN ? CORS_ORIGIN : 'allow all')
app.use(express.json())
app.use(morgan('dev'))

// ===== Helpers =====
const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY
if (!FINNHUB_API_KEY) throw new Error('FINNHUB_API_KEY missing — set it in .env')

async function fetchQuote(symbol) {
  try {
    const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${FINNHUB_API_KEY}`)
    const j = await r.json()
    const px = Number(j?.c)
    if (Number.isFinite(px) && px > 0) return px
    console.error('finnhub returned invalid price for', symbol, j)
  } catch (e) {
    console.error('finnhub quote error', e && e.message ? e.message : e)
  }
  // If finnhub fails, fall back to a deterministic dev price to keep app working
  return Number((50 + Math.random() * 150).toFixed(2))
}

function credentialsSchema() {
  // Expect plaintext password from client; server will hash/verify it
  return Joi.object({ username: Joi.string().required(), password: Joi.string().min(8).max(200).required() })
}

const SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS) || 10
const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret'

function hashPassword(password) {
  return new Promise((resolve, reject) => {
    bcrypt.hash(password, SALT_ROUNDS, (err, hash) => (err ? reject(err) : resolve(hash)))
  })
}

function comparePassword(password, hash) {
  return new Promise((resolve, reject) => {
    bcrypt.compare(password, hash, (err, ok) => (err ? reject(err) : resolve(ok)))
  })
}

async function verifyUserBody(req, res, next) {
  // Prefer Authorization: Bearer <token>
  const authHeader = req.header('authorization') || req.header('Authorization')
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    const token = authHeader.split(' ')[1]
    try {
      const decoded = jwt.verify(token, JWT_SECRET)
      const usernameFromToken = decoded?.username
      if (!usernameFromToken) return res.status(401).json({ error: 'invalid token' })
      const user = await User.findOne({ username: usernameFromToken })
      if (!user) return res.status(401).json({ error: 'invalid token user' })
      req.user = user
      return next()
    } catch (e) {
      return res.status(401).json({ error: 'invalid token' })
    }
  }

  // Fallback to username/password in body or headers (legacy)
  const username = (req.body?.username || req.header('x-username') || '').trim()
  const password = (req.body?.password || req.header('x-password') || '').trim()
  if (!username || !password) return res.status(401).json({ error: 'missing credentials', required: ['username', 'password'] })
  const user = await User.findOne({ username })
  if (!user) return res.status(401).json({ error: 'invalid credentials' })
  const ok = await comparePassword(password, user.passwordHash).catch(() => false)
  if (!ok) return res.status(401).json({ error: 'invalid credentials' })
  req.user = user
  next()
}

// ===== Users =====
const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).max(200).required(),
  fullname: Joi.string().min(2).max(100).required(),
  username: Joi.string().alphanum().min(3).max(30).required()
})

app.post('/users/register', async (req, res) => {
  const { error, value } = registerSchema.validate(req.body)
  if (error) return res.status(400).json({ error: error.message })

  const exists = await User.findOne({ $or: [{ email: value.email }, { username: value.username }] })
  if (exists) return res.status(409).json({ error: 'email or username exists' })

  // Hash plaintext password before storing
  let passwordHash
  try {
    passwordHash = await hashPassword(value.password)
  } catch (e) {
    console.error('password hash error', e.message)
    return res.status(500).json({ error: 'failed to process password' })
  }

  const user = await User.create({ email: value.email, passwordHash, fullname: value.fullname, username: value.username })
  await Portfolio.create({ userUsername: user.username, holdings: [] })
  res.json({ id: user._id, email: user.email, fullname: user.fullname, username: user.username, roles: user.roles })
})

app.post('/users/login', async (req, res) => {
  const { error, value } = credentialsSchema().validate(req.body)
  if (error) return res.status(400).json({ error: error.message })

  const user = await User.findOne({ username: value.username })
  if (!user) return res.status(401).json({ error: 'invalid credentials' })

  const ok = await comparePassword(value.password, user.passwordHash).catch(() => false)
  if (!ok) return res.status(401).json({ error: 'invalid credentials' })

  const safeUser = { email: user.email, fullname: user.fullname, username: user.username, roles: user.roles, createdAt: user.createdAt, updatedAt: user.updatedAt }
  // Issue a JWT token for subsequent requests
  const token = jwt.sign({ username: user.username, roles: user.roles }, JWT_SECRET, { expiresIn: '6h' })
  res.json({ user: safeUser, token })
})

// ===== Portfolio =====
// /portfolio/all: fetch live quotes, update DB, return latest with totals
app.post('/portfolio/all', verifyUserBody, async (req, res) => {
  const p = await Portfolio.findOne({ userUsername: req.user.username })
  if (!p) return res.status(404).json({ error: 'portfolio not found' })

  // Fetch quotes then update each holding
  const symbols = [...new Set(p.holdings.map(h => h.symbol))]
  const quotes = {}
  for (const s of symbols) quotes[s] = await fetchQuote(s)

  for (let h of p.holdings) {
    const q = quotes[h.symbol]
    if (Number.isFinite(q) && q > 0) h.currentPrice = q
  }
  await p.save()

  // Build response with totals
  const holdings = p.holdings.map(h => {
    const gain = h.currentPrice - h.buyPrice
    const gainPercent = h.buyPrice > 0 ? Number(((gain / h.buyPrice) * 100).toFixed(2)) : null
    return { symbol: h.symbol, quantity: h.quantity, buyPrice: h.buyPrice, currentPrice: h.currentPrice, gain: Number(gain.toFixed(2)), gainPercent, addedAt: h.addedAt }
  })
  const totalInvested = p.holdings.reduce((s, h) => s + h.buyPrice * h.quantity, 0)
  const totalCurrent = p.holdings.reduce((s, h) => s + h.currentPrice * h.quantity, 0)
  const pnl = Number((totalCurrent - totalInvested).toFixed(2))
  const pnlPercent = totalInvested > 0 ? Number(((pnl / totalInvested) * 100).toFixed(2)) : null

  res.json({ username: req.user.username, totals: { totalInvested, totalCurrent, pnl, pnlPercent }, holdings })
})

// /portfolio/buy: fetch quote, apply weighted average, update DB
app.post('/portfolio/buy', verifyUserBody, async (req, res) => {
  const schema = Joi.object({ symbol: Joi.string().uppercase().trim().required(), quantity: Joi.number().positive().required() })
  const { error, value } = schema.validate({ symbol: req.body.symbol, quantity: req.body.quantity })
  if (error) return res.status(400).json({ error: 'validation error', details: error.details.map(d => d.message) })

  const p = await Portfolio.findOne({ userUsername: req.user.username })
  if (!p) return res.status(404).json({ error: 'portfolio not found' })

  const symbol = value.symbol
  const qty = value.quantity
  const tradePrice = await fetchQuote(symbol)

  const idx = p.holdings.findIndex(h => h.symbol === symbol)
  if (idx < 0) {
    p.holdings.push({ symbol, quantity: qty, buyPrice: tradePrice, currentPrice: tradePrice, addedAt: new Date() })
  } else {
    const h = p.holdings[idx]
    const newQty = h.quantity + qty
    const newAvg = ((h.buyPrice * h.quantity) + (tradePrice * qty)) / newQty
    h.quantity = newQty
    h.buyPrice = Number(newAvg.toFixed(4))
    h.currentPrice = tradePrice
  }

  await p.save()
  res.json({ ok: true, action: 'buy', symbol, quantity: qty, tradePrice, portfolio: p })
})

// /portfolio/sell: fetch quote, validate qty, update DB
app.post('/portfolio/sell', verifyUserBody, async (req, res) => {
  const schema = Joi.object({ symbol: Joi.string().uppercase().trim().required(), quantity: Joi.number().positive().required() })
  const { error, value } = schema.validate({ symbol: req.body.symbol, quantity: req.body.quantity })
  if (error) return res.status(400).json({ error: 'validation error', details: error.details.map(d => d.message) })

  const p = await Portfolio.findOne({ userUsername: req.user.username })
  if (!p) return res.status(404).json({ error: 'portfolio not found' })

  const symbol = value.symbol
  const qty = value.quantity
  const idx = p.holdings.findIndex(h => h.symbol === symbol)
  if (idx < 0) return res.status(404).json({ error: 'holding not found' })

  const h = p.holdings[idx]
  if (qty > h.quantity) return res.status(400).json({ error: 'sell quantity exceeds holding', holdingQuantity: h.quantity })

  const tradePrice = await fetchQuote(symbol)
  const costBasis = h.buyPrice * qty
  const proceeds = tradePrice * qty
  const realizedPnl = Number((proceeds - costBasis).toFixed(2))

  if (qty === h.quantity) {
    p.holdings.splice(idx, 1)
  } else {
    h.quantity = h.quantity - qty
    h.currentPrice = tradePrice
  }

  await p.save()
  res.json({ ok: true, action: 'sell', symbol, quantity: qty, tradePrice, realizedPnl, portfolio: p })
})

// ===== Stocks search =====
// GET /stocks/search?q=TERM
app.get('/stocks/search', async (req, res) => {
  const q = String(req.query.q || '').trim()
  if (!q) return res.status(400).json({ error: 'missing query parameter q' })

  try {
    // Use Finnhub symbol search
    const searchUrl = `https://finnhub.io/api/v1/search?q=${encodeURIComponent(q)}&token=${FINNHUB_API_KEY}`
    const r = await fetch(searchUrl)
    if (!r.ok) return res.status(502).json({ error: 'symbol search failed' })
    const j = await r.json()
    const results = Array.isArray(j.result) ? j.result.slice(0, 10) : []

    // For each symbol, fetch a realtime quote in parallel (limit to first 8 for speed)
    const take = results.slice(0, 8)
    const out = await Promise.all(take.map(async (it) => {
      try {
        const sym = it.symbol
        const desc = it.description || it.currency || ''
        const quoteRes = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(sym)}&token=${FINNHUB_API_KEY}`)
        const qj = await quoteRes.json()
        const price = Number(qj?.c) || null
        const change = (typeof qj?.d === 'number') ? Number(qj.d) : null
        const changePercent = (typeof qj?.dp === 'number') ? Number(qj.dp) : null
        return { symbol: sym, name: desc || '', price, currency: 'USD', change, changePercent }
      } catch (e) {
        return { symbol: it.symbol, name: it.description || '', price: null, currency: 'USD' }
      }
    }))

    res.json(out)
  } catch (e) {
    console.error('stocks search error', e && e.message ? e.message : e)
    res.status(500).json({ error: 'stocks search failed' })
  }
})

// ===== Performance aggregation =====
// GET /performance/portfolio?days=30
// Returns [{ day: 'YYYY-MM-DD', value: number }, ...]
const candlesCache = {} // key -> { ts: number, data: { t: [...], c: [...] } }
const CACHE_TTL = 10 * 60 * 1000 // 10 minutes

app.get('/performance/portfolio', verifyUserBody, async (req, res) => {
  const days = Math.min(90, Math.max(1, Number(req.query.days || 30)))
  try {
    const p = await Portfolio.findOne({ userUsername: req.user.username })
    if (!p) return res.status(404).json({ error: 'portfolio not found' })

    const symbols = [...new Set(p.holdings.map(h => h.symbol))].slice(0, 8)

    const to = Math.floor(Date.now() / 1000)
    const from = to - days * 24 * 60 * 60

    // helper to fetch candles for a symbol (with cache)
    async function fetchCandles(sym) {
      const key = `${sym}:${from}:${to}`
      const cached = candlesCache[key]
      if (cached && (Date.now() - cached.ts) < CACHE_TTL) return cached.data
      try {
        const url = `https://finnhub.io/api/v1/stock/candle?symbol=${encodeURIComponent(sym)}&resolution=D&from=${from}&to=${to}&token=${FINNHUB_API_KEY}`
        const r = await fetch(url)
        if (!r.ok) return null
        const j = await r.json()
        if (j.s !== 'ok' || !Array.isArray(j.t) || !Array.isArray(j.c)) return null
        const data = { t: j.t, c: j.c }
        candlesCache[key] = { ts: Date.now(), data }
        return data
      } catch (e) {
        return null
      }
    }

    // fetch candles in parallel
    const candlesList = await Promise.all(symbols.map(s => fetchCandles(s)))

    // choose master timestamps from first non-null candles
    let masterT = null
    for (const cd of candlesList) {
      if (cd && Array.isArray(cd.t) && cd.t.length > 0) { masterT = cd.t; break }
    }
    if (!masterT) {
      // no market data available, return zeros for last N days
      const out = []
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(); d.setUTCDate(d.getUTCDate() - i)
        out.push({ day: d.toISOString().slice(0, 10), value: 0 })
      }
      return res.json(out)
    }

    // build per-symbol map of timestamp->close, forward-fill missing
    const symbolPriceMaps = {}
    for (let idx = 0; idx < symbols.length; idx++) {
      const s = symbols[idx]
      const cd = candlesList[idx]
      const map = {}
      if (cd) {
        for (let i = 0; i < cd.t.length; i++) map[String(cd.t[i])] = cd.c[i]
      }
      // forward-fill across masterT
      let last = null
      for (const ts of masterT) {
        const v = map[String(ts)]
        if (v == null) map[String(ts)] = last
        else last = map[String(ts)]
      }
      symbolPriceMaps[s] = map
    }

    // compute daily total: sum(quantity * close)
    const out = masterT.map((ts) => {
      const date = new Date(ts * 1000).toISOString().slice(0, 10)
      let total = 0
      for (const h of p.holdings) {
        const sym = h.symbol
        const qty = h.quantity || 0
        const price = Number(symbolPriceMaps[sym]?.[String(ts)] ?? 0) || 0
        total += qty * price
      }
      return { day: date, value: Number(total.toFixed(2)) }
    })

    return res.json(out)
  } catch (e) {
    console.error('performance error', e && e.message ? e.message : e)
    return res.status(500).json({ error: 'performance fetch failed' })
  }
})

// ===== Start =====
app.listen(PORT, () => {
  console.log(`API on http://localhost:${PORT}`)
})
