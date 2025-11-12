import React, { useMemo, useState, useEffect } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Activity,
  PlusCircle,
  MinusCircle,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NewsList } from "@/components/ui/news-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const COLORS = ["#06b6d4", "#3b82f6", "#10b981", "#f59e0b", "#ef4444"];

function format(n, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);
}

export function PortfolioPage({ holdings, currency, setCurrency, onLoadFromApi, onDownloadApi, loading, error, setTradeStock, setRoute }: { holdings:any; currency:any; setCurrency:any; onLoadFromApi: ()=>void; onDownloadApi: ()=>void; loading?: boolean; error?: string | null; setTradeStock: any; setRoute: any }) {
  const totals = useMemo(() => {
    const mv = holdings.reduce((s, h) => s + h.qty * h.last, 0);
    const cost = holdings.reduce((s, h) => s + h.qty * h.avg, 0);
    return { mv, cost, pl: mv - cost, plPct: cost ? ((mv - cost) / cost) * 100 : 0 };
  }, [holdings]);

  // Currency conversion logic
  const [rates, setRates] = useState<{ USD: number; CAD: number; EUR: number }>({ USD: 1, CAD: 1, EUR: 1 });
  useEffect(() => {
    import("@/lib/currency").then(({ fetchExchangeRates, extractCoreRates }) => {
      const envAny = (import.meta as any);
      const key = envAny?.env?.VITE_OpenExchangeRate_API_KEY;
      fetchExchangeRates(key)
        .then((resp) => setRates(extractCoreRates(resp)))
        .catch(() => setRates({ USD: 1, CAD: 1.4, EUR: 0.86 }));
    });
  }, []);
  function formatConverted(n: number, cur: string) {
    const get = (c: string) => (rates as any)[c];
    try {
      if (!(get('USD') && get(cur))) throw new Error('missing rates');
      const amountInTarget = cur === 'USD' ? n : (n / get('USD')) * get(cur);
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur }).format(amountInTarget);
    } catch {
      return n.toFixed(2) + ' ' + cur;
    }
  }

  function exportCSV() {
    const headers = ["symbol", "qty", "avg", "last", "value"];
    const rows = holdings.map((h) => [h.symbol, h.qty, h.avg, h.last, (h.qty * h.last).toFixed(2)].join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `portfolio_${new Date().toISOString()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const pieData = holdings.map((h) => ({ 
    name: h.symbol, 
    value: Number((h.qty * h.last).toFixed(2))
  }));

  return (
    <div className="max-w-7xl mx-auto p-4 grid gap-4">
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>Portfolio Value</CardTitle>
            <CardDescription>Market value today</CardDescription>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{formatConverted(totals.mv, currency)}</CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>P/L</CardTitle>
            <CardDescription>Unrealized</CardDescription>
          </CardHeader>
          <CardContent className={`text-3xl font-semibold ${totals.pl >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
            {formatConverted(totals.pl, currency)} <Badge variant={totals.pl >= 0 ? "default" : "destructive"}>{totals.plPct.toFixed(2)}%</Badge>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>Currency</CardTitle>
            <CardDescription>Display preference</CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger className="w-[160px] bg-white dark:bg-slate-800 opacity-100"><SelectValue placeholder="USD" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="CAD">CAD</SelectItem>
                <SelectItem value="EUR">EUR</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card className="rounded-2xl md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Holdings</CardTitle>
              <CardDescription>Your positions and performance</CardDescription>
            </div>
            <div className="flex gap-2 items-center">
              <Input placeholder="Filter symbol…" className="w-[200px]" />
              <Button variant="outline" onClick={exportCSV}><Activity className="h-4 w-4 mr-1  cursor-pointer transition-all hover:scale-105" />Export CSV</Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading && <div className="mb-3 text-sm text-muted-foreground">Loading portfolio…</div>}
            {error && <div className="mb-3 text-sm text-rose-600">{error}</div>}
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-2">Symbol</th>
                    <th>Qty</th>
                    <th>Avg</th>
                    <th>Last</th>
                    <th>Value</th>
                    <th>P/L</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {holdings.map((h) => {
                    const value = h.qty * h.last;
                    const pl = h.qty * (h.last - h.avg);
                    return (
                      <tr key={h.symbol} className="border-b hover:bg-muted/30">
                        <td className="py-2 font-medium">{h.symbol}</td>
                        <td>{h.qty}</td>
                        <td>{formatConverted(h.avg, currency)}</td>
                        <td>{formatConverted(h.last, currency)}</td>
                        <td>{formatConverted(value, currency)}</td>
                        <td className={pl >= 0 ? "text-emerald-600" : "text-rose-600"}>{formatConverted(pl, currency)}</td>
                        <td className="text-right">
                          <div className="flex gap-2 justify-end">
                              <React.Fragment>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="cursor-pointer transition-all hover:scale-105"
                                onClick={() => {
                                  setTradeStock({ symbol: h.symbol, price: h.last, description: h.symbol });
                                  setRoute('trade');
                                }}
                              >
                                <PlusCircle className="h-4 w-4 mr-1" />Buy
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="cursor-pointer transition-all hover:scale-105"
                                onClick={() => {
                                  setTradeStock({ symbol: h.symbol, price: h.last, description: h.symbol });
                                  setRoute('trade');
                                }}
                              >
                                <MinusCircle className="h-4 w-4 mr-1" />Sell
                              </Button>
                              </React.Fragment>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>Allocation</CardTitle>
            <CardDescription>Portfolio distribution</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie 
                  data={pieData} 
                  dataKey="value" 
                  nameKey="name" 
                  innerRadius={40} 
                  outerRadius={80} 
                  paddingAngle={4}
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value) => format(Number(value), currency)} 
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
      <NewsList limit={6} />
    </div>
  );
}
