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

// Use REST calls to Finnhub with the API key supplied from .env (FINNHUB_API_KEY).
// This avoids relying on the finnhub SDK module shape and keeps server code simple.

async function fetchQuote(symbol) {
  try {
    // Properly encode the symbol, preserving special characters like periods
    const encodedSymbol = encodeURIComponent(symbol.trim())
    const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodedSymbol}&token=${FINNHUB_API_KEY}`)
    if (!r.ok) throw new Error('quote fetch failed')
    const quote = await r.json()
    const price = Number(quote?.c)
    if (!Number.isFinite(price) || price <= 0) {
      console.error('finnhub returned invalid price for', symbol, quote)
      return null
    }
    return price
  } catch (e) {
    console.error('finnhub quote error', e && e.message ? e.message : e)
    return null
  }
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

  if (!Number.isFinite(tradePrice)) {
    return res.status(502).json({ error: 'trade price unavailable' })
  }

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
  if (!Number.isFinite(tradePrice)) {
    return res.status(502).json({ error: 'trade price unavailable' })
  }
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

// ===== Stock Quote =====
// GET /stocks/quote?symbol=AAPL (or B.TO, etc)
app.get('/stocks/quote', async (req, res) => {
  // Get the raw symbol and clean it without removing special characters
  const symbol = String(req.query.symbol || '').trim().toUpperCase()
  if (!symbol) return res.status(400).json({ error: 'missing symbol parameter' })

  // SECURITY/PRIVACY: Do not proxy Finnhub quote responses for AAPL. Block it here.
  // This ensures clients cannot retrieve the AAPL quote via our proxy.
  if (symbol === 'AAPL') {
    console.log('Blocked Finnhub quote request for AAPL')
    return res.status(404).json({ error: 'quote unavailable for symbol' })
  }

  try {
    // Properly encode the symbol for the URL, preserving special characters like periods
    const encodedSymbol = encodeURIComponent(symbol)
    const quoteUrl = `https://finnhub.io/api/v1/quote?symbol=${encodedSymbol}&token=${FINNHUB_API_KEY}`
    const r = await fetch(quoteUrl)
    const responseText = await r.text() // Get raw response text
    console.log(`Finnhub quote response for ${symbol}:`, {
      status: r.status,
      statusText: r.statusText,
      headers: Object.fromEntries(r.headers.entries()),
      body: responseText
    })
    
    if (!r.ok) {
      return res.status(502).json({ 
        error: 'quote fetch failed', 
        status: r.status,
        statusText: r.statusText,
        response: responseText
      })
    }
    
    let quote
    try {
      quote = JSON.parse(responseText)
    } catch (e) {
      console.error('Failed to parse quote response:', e)
      return res.status(502).json({ 
        error: 'invalid quote response',
        raw: responseText
      })
    }
    
    // Validate required fields
    if (typeof quote?.c !== 'number') {
      return res.status(502).json({ 
        error: 'invalid quote data',
        quote: quote
      })
    }
    
    return res.json({
      currentPrice: quote.c,
      change: quote.d,
      percentChange: quote.dp,
      highPrice: quote.h,
      lowPrice: quote.l,
      openPrice: quote.o,
      previousClose: quote.pc,
      timestamp: quote.t
    })
  } catch (e) {
    console.error('quote fetch error', e && e.message ? e.message : e)
    return res.status(500).json({ error: 'quote fetch failed' })
  }
})

// ===== Stocks search =====
// GET /stocks/search?q=TERM
app.get('/stocks/search', async (req, res) => {
  const q = String(req.query.q || '').trim()
  if (!q) return res.status(400).json({ error: 'missing query parameter q' })

  try {
    // Search across all exchanges
    const searchUrl = `https://finnhub.io/api/v1/search?q=${encodeURIComponent(q)}&token=${FINNHUB_API_KEY}`
    const response = await fetch(searchUrl)
    const responseText = await response.text()
    
    console.log(`Finnhub search response for ${q}:`, {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      body: responseText
    })
    
    if (!response.ok) {
      return res.status(502).json({ 
        error: 'symbol search failed', 
        status: response.status,
        statusText: response.statusText,
        response: responseText
      })
    }
    
    let results
    try {
      results = JSON.parse(responseText)
    } catch (e) {
      console.error('Failed to parse search response:', e)
      return res.status(502).json({ 
        error: 'invalid search response',
        raw: responseText
      })
    }
    
    // Ensure we're returning both count and result array
    if (results && typeof results === 'object') {
      return res.json({
        count: results.count || 0,
        result: Array.isArray(results.result) ? results.result : []
      })
    }
    
    return res.status(502).json({ 
      error: 'invalid response structure',
      response: results
    })
  } catch (e) {
    console.error('stocks search error', e && e.message ? e.message : e)
    return res.status(500).json({ error: 'stocks search failed' })
  }
})

// ===== News =====
// GET /news?category=general
const newsCache = {} // category -> { ts: number, data: any }
const NEWS_CACHE_TTL = 60 * 1000 // 60 seconds

app.get('/news', async (req, res) => {
  const category = String(req.query.category || 'general')
  try {
    const cached = newsCache[category]
    if (cached && (Date.now() - cached.ts) < NEWS_CACHE_TTL) {
      return res.json(cached.data)
    }

    const url = `https://finnhub.io/api/v1/news?category=${encodeURIComponent(category)}&token=${FINNHUB_API_KEY}`
    const r = await fetch(url)
    if (!r.ok) return res.status(502).json({ error: 'news fetch failed' })
    const j = await r.json()
    // Cache the response (Finnhub returns an array of articles)
    newsCache[category] = { ts: Date.now(), data: j }
    return res.json(j)
  } catch (e) {
    console.error('news fetch error', e && e.message ? e.message : e)
    return res.status(500).json({ error: 'news fetch failed' })
  }
})

// ===== Start =====
app.listen(PORT, () => {
  console.log(`API on http://localhost:${PORT}`)
})
