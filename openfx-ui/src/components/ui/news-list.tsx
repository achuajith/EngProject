import React, { useEffect, useState } from 'react'
import { NewsItem, fetchNews } from '@/lib/api'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export function NewsList({ limit = 6 }: { limit?: number }) {
  const [items, setItems] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const data = await fetchNews('general')
        if (!mounted) return
        setItems(Array.isArray(data) ? data.slice(0, limit) : [])
      } catch (e: any) {
        if (!mounted) return
        setError(e?.message || String(e))
        setItems([])
      } finally {
        if (!mounted) return
        setLoading(false)
      }
    }
    void load()
    return () => { mounted = false }
  }, [limit])

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <div>
          <CardTitle>News</CardTitle>
          <CardDescription>Latest headlines</CardDescription>
        </div>
        <div>
          <Button size="sm" variant="outline" onClick={() => void fetchNews('general').then((d) => setItems(Array.isArray(d) ? d.slice(0, limit) : [])).catch((e) => setError(e?.message || String(e)))}>
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading news…</div>
        ) : error ? (
          <div className="text-sm text-rose-600">{error}</div>
        ) : items.length === 0 ? (
          <div className="text-sm text-muted-foreground">No news available</div>
        ) : (
          <ul className="space-y-3">
            {items.map((it) => (
              <li key={it.id} className="flex gap-3">
                {it.image ? <img src={it.image} alt={it.headline} className="w-20 h-12 object-cover rounded-md" /> : <div className="w-20 h-12 bg-muted rounded-md" />}
                <div className="flex-1">
                  <a href={it.url} target="_blank" rel="noopener noreferrer" className="font-medium hover:underline">{it.headline}</a>
                  <div className="text-xs text-muted-foreground">{it.source} • {new Date(it.datetime * 1000).toLocaleString()}</div>
                  <div className="text-sm text-muted-foreground mt-1">{it.summary}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
