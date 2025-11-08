import React, { useState, useCallback } from 'react'
import { Search as SearchIcon } from 'lucide-react'
import { Input } from './input'
import { Card } from './card'
import { Button } from './button'
import { Badge } from './badge'
import { searchStocks, type StockSearchResult } from '@/lib/api'

export interface StockSearchProps {
  onSelect?: (stock: StockSearchResult) => void
  disabled?: boolean
  token?: string
}

export function StockSearch({ onSelect, disabled, token }: StockSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<StockSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return

    setLoading(true)
    setError(null)

    try {
      const stocks = await searchStocks(query, token)
      setResults(stocks)
      if (stocks.length === 0) {
        setError('No results found in US or Canadian exchanges')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search stocks')
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [query, token])

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  return (
    <div className="w-full space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="Search stocks (e.g. AAPL, MSFT)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={disabled || loading}
          className="flex-1"
        />
        <Button
          onClick={handleSearch}
          disabled={disabled || loading || !query.trim()}
        >
          {loading ? (
            <span className="animate-spin">⌛</span>
          ) : (
            <SearchIcon className="h-4 w-4" />
          )}
        </Button>
      </div>

      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}

      {results.length > 0 && (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((stock) => (
            <Card
              key={stock.symbol}
              className="p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              onClick={() => onSelect?.(stock)}
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-medium">{stock.displaySymbol ?? stock.symbol}</h3>
                  <p className="text-sm text-gray-500">{stock.description}</p>
                  {stock.type && <p className="text-xs text-muted-foreground mt-1">{stock.type}</p>}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}