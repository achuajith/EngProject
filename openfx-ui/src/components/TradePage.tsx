import React, { useMemo, useState, useEffect } from "react";
import { portfolioBuy, portfolioSell, type StockSearchResult, fetchQuote, type StockQuote, fetchProfile } from "@/lib/api";
import { StockSearch } from "@/components/ui/stock-search";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, MinusCircle } from "lucide-react";

function format(n: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);
}

interface TradePageProps {
  authToken: string | null;
  authUsername: string | null;
  authPassword: string | null;
  refreshPortfolio: (u?: string|null, p?: string|null, t?: string|null) => Promise<void>;
  initialStock?: StockSearchResult | null;
}

export function TradePage({ authToken, authUsername, authPassword, refreshPortfolio, initialStock }: TradePageProps) {
  const [selectedStock, setSelectedStock] = useState<StockSearchResult | null>(null);
  const [profile, setProfile] = useState<any | null>(null)
  const [loadingProfile, setLoadingProfile] = useState(false)
  useEffect(() => {
    if (initialStock) setSelectedStock(initialStock)
  }, [initialStock])
  const [quantity, setQuantity] = useState('')
  const [side, setSide] = useState<'buy'|'sell'>('buy')
  const [loading, setLoading] = useState(false)
  const [loadingQuote, setLoadingQuote] = useState(false)
  const [quote, setQuote] = useState<StockQuote | null>(null)
  const [confirm, setConfirm] = useState<any>(null)

  // Fetch quote when stock is selected
  useEffect(() => {
    if (!selectedStock) {
      setQuote(null)
      setProfile(null)
      return
    }

    let mounted = true
    async function loadQuote() {
      setLoadingQuote(true)
      try {
        const q = await fetchQuote(selectedStock.symbol, authToken)
        if (!mounted) return
        setQuote(q)
        // Update the selected stock's price with the live quote
        setSelectedStock(prev => prev ? { ...prev, price: q.currentPrice } : null)
      } catch (e) {
        console.error('Failed to fetch quote:', e)
        if (!mounted) return
        setQuote(null)
      } finally {
        if (mounted) setLoadingQuote(false)
      }
    }
    void loadQuote()
    
    // Refresh quote every 10 seconds while stock is selected
    const interval = setInterval(loadQuote, 10000)
    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [selectedStock?.symbol, authToken])

  // Load company profile when selected stock changes
  useEffect(() => {
    if (!selectedStock) return
    let mounted = true
    async function run() {
      setLoadingProfile(true)
      try {
        const p = await fetchProfile(selectedStock.symbol, authToken ?? undefined)
        if (!mounted) return
        setProfile(p)
      } catch (e) {
        if (mounted) setProfile(null)
      } finally {
        if (mounted) setLoadingProfile(false)
      }
    }
    run()
    return () => { mounted = false }
  }, [selectedStock?.symbol, authToken])

  async function executeTrade(which: 'buy' | 'sell') {
    if (!selectedStock || !quantity || Number(quantity) <= 0) return setConfirm({ ok: false, msg: "Please select a stock and enter quantity" });
    setLoading(true)
    setConfirm(null)
    try {
      const q = Number(quantity)
      const token = authToken ?? null
      let res
      if (which === 'buy') {
        res = await portfolioBuy(selectedStock.symbol, q, authUsername ?? undefined, authPassword ?? undefined, token ?? undefined)
      } else {
        res = await portfolioSell(selectedStock.symbol, q, authUsername ?? undefined, authPassword ?? undefined, token ?? undefined)
      }
      // Show success and refresh portfolio
      const tradePrice = res?.tradePrice ?? selectedStock.price
      setConfirm({ ok: true, msg: `${which.toUpperCase()} ${q} ${selectedStock.symbol} executed @ ${tradePrice}` })
      // refresh portfolio using token if present
      await refreshPortfolio(undefined, undefined, token ?? undefined)
      // Reset form
      setSelectedStock(null)
      setQuantity('')
    } catch (e:any) {
      setConfirm({ ok: false, msg: e?.message || String(e) })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-4 grid gap-4">
      <Card className="rounded-2xl">
        <CardHeader className="flex items-center justify-between">
          <div>
            <CardTitle>Search & Trade</CardTitle>
            <CardDescription>Search for stocks and place trades</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-6">
            <div className="flex flex-col md:flex-row md:items-start md:gap-6">
              <div className="flex-1 flex flex-col gap-4">
                <StockSearch 
                  onSelect={setSelectedStock}
                  disabled={loading}
                  token={authToken ?? undefined}
                />
                {selectedStock && (
                  <div className="grid gap-4">
                    <div>
                      <h3 className="font-medium">{selectedStock.displaySymbol ?? selectedStock.symbol} - {selectedStock.description}</h3>
                      <p className="text-lg font-semibold mt-1">{selectedStock.price != null ? format(selectedStock.price, selectedStock.currency || 'USD') : '—'}</p>
                      {loadingQuote ? (
                        <div className="text-sm text-muted-foreground mt-1">Loading quote...</div>
                      ) : quote ? (
                        <div className="space-y-1 mt-1">
                          <div className="flex items-center gap-2">
                            <p className="text-lg font-semibold">{format(quote.currentPrice, selectedStock.currency || 'USD')}</p>
                            <Badge variant={quote.change >= 0 ? "default" : "destructive"}>
                              {quote.change >= 0 ? '+' : ''}{quote.percentChange.toFixed(2)}%
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            O: {format(quote.openPrice)} H: {format(quote.highPrice)} L: {format(quote.lowPrice)}
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground mt-1">Quote unavailable</p>
                      )}
                    </div>
                    <div className="grid gap-2 max-w-xs">
                      <Label htmlFor="quantity">Quantity</Label>
                      <Input
                        id="quantity"
                        type="number"
                        min="1"
                        step="1"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        disabled={loading}
                      />
                    </div>
                    {quantity && (
                      <p className="text-sm text-gray-500">
                        Total {side === 'buy' ? 'Cost' : 'Value'}: {(selectedStock.price ?? 0) * Number(quantity)} {selectedStock.currency ?? 'USD'}
                      </p>
                    )}
                    <div className="flex gap-2">
                      <Button 
                        onClick={() => { setSide('buy'); executeTrade('buy'); }}
                        disabled={loading || !quantity || Number(quantity) <= 0}
                      >
                        <PlusCircle className="h-4 w-4 mr-1" />Buy
                      </Button>
                      <Button 
                        variant="destructive"
                        onClick={() => { setSide('sell'); executeTrade('sell'); }}
                        disabled={loading || !quantity || Number(quantity) <= 0}
                      >
                        <MinusCircle className="h-4 w-4 mr-1" />Sell
                      </Button>
                    </div>
                    {confirm && (
                      <div className={`p-3 rounded-md ${confirm.ok ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" : "bg-rose-50 text-rose-800 dark:bg-rose-950 dark:text-rose-200"}`}>
                        {confirm.msg}
                      </div>
                    )}
                  </div>
                )}
              </div>
              {selectedStock && (
                <div className="md:w-80 mt-6 md:mt-0">
                  <div className="border rounded-xl p-4 bg-muted/40 sticky top-24">
                    {loadingProfile && (
                      <div className="animate-pulse flex items-start gap-3">
                        <div className="h-10 w-10 rounded bg-muted/50" />
                        <div className="flex-1 space-y-2">
                          <div className="h-4 bg-muted/50 rounded w-40" />
                          <div className="h-3 bg-muted/40 rounded w-56" />
                          <div className="h-3 bg-muted/40 rounded w-48" />
                        </div>
                      </div>
                    )}
                    {!loadingProfile && profile && (
                      <div className="flex items-start gap-3">
                        {profile.logo && (<img src={profile.logo} alt={profile.name} className="h-10 w-10 object-contain rounded" />)}
                        <div className="grid gap-2 text-sm">
                          <div className="font-medium flex items-center gap-2">{profile.name || selectedStock.symbol}{profile.ticker && (<span className="text-xs px-2 py-0.5 rounded bg-sky-100 dark:bg-sky-900/40 border text-sky-700 dark:text-sky-300">{profile.ticker}</span>)}</div>
                          <div className="grid gap-1 text-xs">
                            {profile.ipo && <div>IPO: {profile.ipo}</div>}
                            {typeof profile.marketCapitalization === 'number' && (
                              <div>Market Cap: { (profile.marketCapitalization).toFixed(2) } M</div>
                            )}
                            {typeof profile.shareOutstanding === 'number' && (
                              <div>Shares Outstanding: { (profile.shareOutstanding).toFixed(2) } M</div>
                            )}
                            {profile.phone && <div>Phone: {profile.phone}</div>}
                          </div>
                        </div>
                      </div>
                    )}
                    {!loadingProfile && !profile && (
                      <div className="text-xs text-muted-foreground">No profile data for {selectedStock.symbol}</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Trade History</CardTitle>
          <CardDescription>Recent trades from your portfolio</CardDescription>
        </CardHeader>
        <CardContent>
          {confirm && (
            <div className={`mb-4 p-3 rounded-md ${confirm.ok ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" : "bg-rose-50 text-rose-800 dark:bg-rose-950 dark:text-rose-200"}`}>
              {confirm.msg}
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2">Time</th>
                  <th>Action</th>
                  <th>Symbol</th>
                  <th>Quantity</th>
                  <th>Price</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {confirm?.ok && (
                  <tr className="border-b bg-muted/20">
                    <td className="py-2">{new Date().toLocaleTimeString()}</td>
                    <td>{side.toUpperCase()}</td>
                    <td>{selectedStock?.symbol}</td>
                    <td>{quantity}</td>
                    <td>{format(selectedStock?.price ?? 0, selectedStock?.currency ?? 'USD')}</td>
                    <td>{format((selectedStock?.price ?? 0) * Number(quantity), selectedStock?.currency ?? 'USD')}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
