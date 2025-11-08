import React, { useState } from 'react'
import { StockSearch } from '@/components/ui/stock-search'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { portfolioBuy, portfolioSell, type StockSearchResult } from '@/lib/api'

export interface TradePageProps {
  token?: string
  username?: string
  password?: string
  onSuccess?: () => void
}

export function TradePage({ token, username, password, onSuccess }: TradePageProps) {
  const [selectedStock, setSelectedStock] = useState<StockSearchResult | null>(null)
  // no frontend live-price fetch; trade uses backend quote for execution
  const [quantity, setQuantity] = useState('')
  const [isBuying, setIsBuying] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleTrade = async () => {
    if (!selectedStock || !quantity || Number(quantity) <= 0) return

    setLoading(true)
    setError(null)

    try {
      const tradeFunc = isBuying ? portfolioBuy : portfolioSell
      await tradeFunc(
        selectedStock.symbol,
        Number(quantity),
        username,
        password,
        token
      )
      setSelectedStock(null)
      setQuantity('')
      onSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Trade failed')
    } finally {
      setLoading(false)
    }
  }

  // previously fetched live price here; removed in favor of server-side pricing

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold mb-4">Trade Stocks</h1>
        <StockSearch
          onSelect={setSelectedStock}
          disabled={loading}
          token={token}
        />
      </div>

      {selectedStock && (
        <Card className="p-6 space-y-6">
          <div>
            <h2 className="text-xl font-semibold mb-2">
              {selectedStock.symbol} - {selectedStock.description}
            </h2>
            <p className="text-lg">
              Current Price: {selectedStock.price != null ? selectedStock.price : '—'} {selectedStock.currency ?? 'USD'}
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex gap-4">
              <Button
                onClick={() => setIsBuying(true)}
                variant={isBuying ? 'default' : 'outline'}
              >
                Buy
              </Button>
              <Button
                onClick={() => setIsBuying(false)}
                variant={!isBuying ? 'default' : 'outline'}
              >
                Sell
              </Button>
            </div>

            <div className="grid gap-2">
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
                Total {isBuying ? 'Cost' : 'Value'}: {(selectedStock.price ?? 0) * Number(quantity)} {selectedStock.currency ?? 'USD'}
              </p>
            )}

            <Button
              onClick={handleTrade}
              disabled={loading || !quantity || Number(quantity) <= 0}
              className="w-full"
            >
              {loading ? 'Processing...' : `${isBuying ? 'Buy' : 'Sell'} ${selectedStock.symbol}`}
            </Button>

            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}
          </div>
        </Card>
      )}
    </div>
  )
}