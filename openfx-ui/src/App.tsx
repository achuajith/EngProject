import React, { useMemo, useState, useEffect } from "react";
import { fetchPortfolio, downloadPortfolioCSV, login, register, portfolioBuy, portfolioSell, type PortfolioResponse } from "@/lib/api";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  TrendingUp,
  LogIn,
  UserPlus,
  KeyRound,
  Settings,
  Shield,
  Wallet,
  CandlestickChart,
  BarChart3,
  Activity,
  Search,
  Bell,
  PlusCircle,
  MinusCircle,
  Users,
  Layers,
  Coins,
  AlertTriangle,
  Sun,
  Moon,
  MoreHorizontal,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

// —— Demo / helper data —–
const samplePrices = Array.from({ length: 30 }).map((_, i) => ({
  day: `D${i + 1}`,
  price: Math.round(90 + 20 * Math.sin(i / 4) + Math.random() * 8),
  volume: Math.round(100 + 50 * Math.cos(i / 5) + Math.random() * 20),
}));

const defaultHoldings: Array<{ symbol: string; qty: number; avg: number; last: number }> = [];

const watchlistDefault = ["MSFT", "AMZN", "META", "GOOGL", "TSLA", "QQQ", "SPY"];

function format(n, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);
}

// Note: password hashing is done server-side. Do NOT pre-hash in the client for this demo.

const COLORS = ["#06b6d4", "#3b82f6", "#10b981", "#f59e0b", "#ef4444"];

// —— Top Navigation ——
function TopNav({ route, setRoute, role, setRole, isAuthed, onLogout, onLogin, dark, setDark }) {
  useEffect(() => {
    // apply dark mode to html/body for Tailwind dark variants
    if (dark) document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }, [dark]);

  return (
    <div className="w-full sticky top-0 z-50 backdrop-blur bg-gradient-to-r from-white/80 to-slate-50/60 dark:from-slate-900/80 dark:to-slate-900/60 border-b">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl p-2 bg-gradient-to-br from-sky-500 to-emerald-400 text-white shadow-md">
            <CandlestickChart className="h-5 w-5" />
          </div>
          <div className="text-lg font-semibold">OpenFx<span className="text-muted-foreground ml-1 text-sm">Beta</span></div>
        </div>

        <div className="hidden md:flex gap-2 ml-6">
          {[["portfolio", "Portfolio"], ["trade", "Trade"], ["preferences", "Preferences"], ["admin", "Admin"]].map(([r, label]) => (
            <Button key={r} variant={route === r ? "default" : "ghost"} onClick={() => setRoute(r)}>
              {label}
            </Button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-2">
            <Search className="h-4 w-4" />
            <Input placeholder="Search symbols, users…" className="w-[220px]" />
          </div>

          <button aria-label="Notifications" className="relative p-2 rounded-md hover:bg-muted/30">
            <Bell className="h-5 w-5" />
            <span className="absolute -top-0.5 -right-0.5 text-[11px] bg-rose-500 text-white rounded-full px-1">3</span>
          </button>

          <button onClick={() => setDark(!dark)} className="p-2 rounded-md hover:bg-muted/30">
            {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-2 rounded-md hover:bg-muted/30 flex items-center gap-2">
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setRole(role === "user" ? "admin" : "user")}>
                Switch role ({role})
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setRoute("preferences")}>Preferences</DropdownMenuItem>
              {isAuthed ? (
                <DropdownMenuItem onClick={onLogout}>Logout</DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={onLogin}>Login</DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}

// —— Auth Screens ——
function LoginScreen({ onSuccess, onForgot, goRegister, loading, serverError }: { onSuccess: (u:string,p:string)=>void; onForgot: ()=>void; goRegister: ()=>void; loading?: boolean; serverError?: string | null }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function tryLogin() {
    if (!username || !password) return setErr("Username and password required");
    setErr(null);
    // Pass plaintext password to server (server will hash)
    onSuccess(username.trim(), password);
  }

  return (
    <div className="max-w-md mx-auto pt-8">
      <Card className="shadow-xl rounded-2xl">
        <CardHeader>
          <CardTitle className="text-2xl">Welcome back</CardTitle>
          <CardDescription>Sign in to view your portfolio and alerts.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
    {err && <div className="text-sm text-rose-600">{err}</div>}
    {serverError && <div className="text-sm text-rose-600">{serverError}</div>}
          <div className="grid gap-2">
            <Label htmlFor="username">Username</Label>
            <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="your username" required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
          </div>
          <div className="flex items-center justify-between">
            <Button className="w-full" onClick={tryLogin} disabled={!!loading}><LogIn className="h-4 w-4 mr-1" />{loading ? 'Logging in…' : 'Login'}</Button>
          </div>
          <div className="flex justify-between text-sm">
            <Button variant="link" className="px-0" onClick={onForgot}>Forgot password?</Button>
            <Button variant="link" className="px-0" onClick={goRegister}>Create account</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function RegisterScreen({ goLogin }) {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (!username || !email || !password || !name) return setErr('All fields required');
    setErr(null);
    setLoading(true);
    try {
      await register(username.trim(), email.trim(), name.trim(), password);
      // After successful register, redirect to login screen
      goLogin();
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto pt-8">
      <Card className="shadow-xl rounded-2xl">
        <CardHeader>
          <CardTitle className="text-2xl">Create your account</CardTitle>
          <CardDescription>Start tracking and learning today.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {err && <div className="text-sm text-rose-600">{err}</div>}
          <div className="grid gap-2">
            <Label htmlFor="fullName">Full name</Label>
            <Input id="fullName" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="username">Username</Label>
            <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="your username" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimum 8 characters" />
          </div>
          <div className="flex items-center gap-2">
            <Switch id="tos" />
            <Label htmlFor="tos" className="text-sm">I agree to the Terms</Label>
          </div>
          <Button onClick={submit} disabled={loading}><UserPlus className="h-4 w-4 mr-1" />{loading ? 'Registering…' : 'Register'}</Button>
          <Button variant="link" className="px-0" onClick={goLogin}>Have an account? Login</Button>
        </CardContent>
      </Card>
    </div>
  );
}

function ForgotPasswordScreen({ goLogin }) {
  return (
    <div className="max-w-md mx-auto pt-8">
      <Card className="shadow-xl rounded-2xl">
        <CardHeader>
          <CardTitle className="text-2xl">Reset your password</CardTitle>
          <CardDescription>We’ll email you a reset link.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="you@example.com" />
          </div>
          <Button onClick={goLogin}><KeyRound className="h-4 w-4 mr-1" />Send reset link</Button>
          <Button variant="link" className="px-0" onClick={goLogin}>Back to login</Button>
        </CardContent>
      </Card>
    </div>
  );
}

// —— Portfolio Page ——
function PortfolioPage({ holdings, setHoldings, currency, setCurrency, watchlist, setWatchlist, onLoadFromApi, onDownloadApi, loading, error }: { holdings:any; setHoldings:any; currency:any; setCurrency:any; watchlist:any; setWatchlist:any; onLoadFromApi: ()=>void; onDownloadApi: ()=>void; loading?: boolean; error?: string | null }) {
  const totals = useMemo(() => {
    const mv = holdings.reduce((s, h) => s + h.qty * h.last, 0);
    const cost = holdings.reduce((s, h) => s + h.qty * h.avg, 0);
    return { mv, cost, pl: mv - cost, plPct: cost ? ((mv - cost) / cost) * 100 : 0 };
  }, [holdings]);

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

  const pieData = holdings.map((h) => ({ name: h.symbol, value: h.qty * h.last }));

  return (
    <div className="max-w-7xl mx-auto p-4 grid gap-4">
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>Portfolio Value</CardTitle>
            <CardDescription>Market value today</CardDescription>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{format(totals.mv, currency)}</CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>P/L</CardTitle>
            <CardDescription>Unrealized</CardDescription>
          </CardHeader>
          <CardContent className={`text-3xl font-semibold ${totals.pl >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
            {format(totals.pl, currency)} <Badge variant={totals.pl >= 0 ? "default" : "destructive"}>{totals.plPct.toFixed(2)}%</Badge>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>Currency</CardTitle>
            <CardDescription>Display preference</CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="USD" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="CAD">CAD</SelectItem>
                <SelectItem value="EUR">EUR</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Holdings</CardTitle>
            <CardDescription>Your positions and performance</CardDescription>
          </div>
          <div className="flex gap-2 items-center">
            <Input placeholder="Filter symbol…" className="w-[200px]" />
            <Button variant="outline" onClick={exportCSV}><Activity className="h-4 w-4 mr-1" />Export CSV</Button>
            <Button variant="outline" onClick={onLoadFromApi}><Activity className="h-4 w-4 mr-1" />Load from API</Button>
            <Button variant="outline" onClick={onDownloadApi}><Activity className="h-4 w-4 mr-1" />Download API CSV</Button>
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
                      <td>{format(h.avg)}</td>
                      <td>{format(h.last)}</td>
                      <td>{format(value)}</td>
                      <td className={pl >= 0 ? "text-emerald-600" : "text-rose-600"}>{format(pl)}</td>
                      <td className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button variant="outline" size="sm"><PlusCircle className="h-4 w-4 mr-1" />Buy</Button>
                          <Button variant="outline" size="sm"><MinusCircle className="h-4 w-4 mr-1" />Sell</Button>
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

      <div className="grid md:grid-cols-3 gap-4">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>Performance</CardTitle>
            <CardDescription>Last 30 days</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={samplePrices}>
                <defs>
                  <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Area type="monotone" dataKey="price" stroke="#16a34a" fillOpacity={1} fill="url(#grad)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="rounded-2xl col-span-2">
          <CardHeader>
            <CardTitle>Allocation</CardTitle>
            <CardDescription>Portfolio distribution</CardDescription>
          </CardHeader>
          <CardContent className="h-64 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={40} outerRadius={80} paddingAngle={4}>
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Watchlist</CardTitle>
          <CardDescription>Personalize by adding tickers</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {watchlist.map((s) => (
              <Badge key={s} variant="secondary" className="px-3 py-1">{s}</Badge>
            ))}
            <Input placeholder="Add symbol…" className="w-[160px]" />
            <Button variant="outline"><PlusCircle className="h-4 w-4 mr-1" />Add</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// —— Trade Page ——
function TradePage({ authToken, authUsername, authPassword, refreshPortfolio }: { authToken: string | null; authUsername: string | null; authPassword: string | null; refreshPortfolio: (u?: string|null,p?: string|null,t?: string|null)=>Promise<void> }) {
  const [side, setSide] = useState<'buy'|'sell'>('buy');
  const [symbol, setSymbol] = useState("");
  const [qty, setQty] = useState("");
  const [orderType, setOrderType] = useState("market");
  const [confirm, setConfirm] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const estimatedCost = useMemo(() => {
    const price = samplePrices[samplePrices.length - 1].price;
    const q = Number(qty || 0);
    return q * price;
  }, [qty]);

  async function executeTrade(which: 'buy' | 'sell') {
    if (!symbol || Number(qty) <= 0) return setConfirm({ ok: false, msg: "Please enter a symbol and quantity" });
    setLoading(true)
    setConfirm(null)
    try {
      const q = Number(qty)
      const token = authToken ?? null
      let res
      if (which === 'buy') {
        res = await portfolioBuy(symbol, q, authUsername ?? undefined, authPassword ?? undefined, token ?? undefined)
      } else {
        res = await portfolioSell(symbol, q, authUsername ?? undefined, authPassword ?? undefined, token ?? undefined)
      }
      // Show success and refresh portfolio
      const tradePrice = res?.tradePrice ?? res?.portfolio?.holdings?.find((h:any)=>h.symbol===symbol)?.currentPrice
      setConfirm({ ok: true, msg: `${which.toUpperCase()} ${q} ${symbol} executed @ ${tradePrice}` })
      // refresh portfolio using token if present
      await refreshPortfolio(undefined, undefined, token ?? undefined)
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
            <CardTitle>Place Order</CardTitle>
            <CardDescription>Live trade ticket — calls backend endpoints</CardDescription>
          </div>
          <Badge variant={side === "buy" ? "default" : "destructive"} className="text-base capitalize">{side}</Badge>
        </CardHeader>
        <CardContent className="grid md:grid-cols-3 gap-6">
          <div className="grid gap-3">
            <Label>Symbol</Label>
            <Input placeholder="AAPL" value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} />
            <Label>Quantity</Label>
            <Input type="number" placeholder="10" value={qty} onChange={(e) => setQty(e.target.value)} />
            <Label>Order Type</Label>
            <Select value={orderType} onValueChange={setOrderType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="market">Market</SelectItem>
                <SelectItem value="limit">Limit</SelectItem>
                <SelectItem value="stop">Stop</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex gap-2 mt-2">
              <Button onClick={() => { setSide('buy'); executeTrade('buy') }} disabled={!symbol || !qty || loading}><PlusCircle className="h-4 w-4 mr-1" />Buy</Button>
              <Button variant="destructive" onClick={() => { setSide('sell'); executeTrade('sell') }} disabled={!symbol || !qty || loading}><MinusCircle className="h-4 w-4 mr-1" />Sell</Button>
            </div>
            <div className="text-sm text-muted-foreground mt-2">Estimated cost: <span className="font-medium">{format(estimatedCost)}</span></div>
            <div className="flex gap-2 mt-2">
              <Button onClick={() => executeTrade(side)} disabled={!symbol || !qty || loading}>{loading ? 'Working…' : 'Submit Order'}</Button>
            </div>
            {confirm && (
              <div className={`mt-3 p-3 rounded-md ${confirm.ok ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}>{confirm.msg}</div>
            )}
          </div>

          <div className="md:col-span-2">
            <Card className="border-dashed rounded-2xl">
              <CardHeader>
                <CardTitle className="text-base">Price Chart</CardTitle>
                <CardDescription>Last 30 days (demo)</CardDescription>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={samplePrices}>
                    <XAxis dataKey="day" /><YAxis /><Tooltip />
                    <Line type="monotone" dataKey="price" stroke="#3b82f6" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Recent Orders</CardTitle>
          <CardDescription>Demo entries</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2">Time</th>
                  <th>Side</th>
                  <th>Symbol</th>
                  <th>Qty</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {[{ t: "10:24", side: "Buy", s: "AAPL", q: 10, st: "Filled" }, { t: "10:27", side: "Sell", s: "NVDA", q: 2, st: "Filled" }, { t: "10:31", side: "Buy", s: "MSFT", q: 5, st: "Pending" }].map((o, i) => (
                  <tr key={i} className="border-b">
                    <td className="py-2">{o.t}</td>
                    <td>{o.side}</td>
                    <td>{o.s}</td>
                    <td>{o.q}</td>
                    <td>{o.st}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// —— Preferences ——
function PreferencesPage({ currency, setCurrency }) {
  return (
    <div className="max-w-3xl mx-auto p-4 grid gap-4">
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Personalization</CardTitle>
          <CardDescription>Tailor the app to your style</CardDescription>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label>Display currency</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="CAD">CAD</SelectItem>
                <SelectItem value="EUR">EUR</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Price alerts</Label>
            <div className="flex items-center gap-3"><Switch id="alerts" defaultChecked /><Label htmlFor="alerts">Enable notifications</Label></div>
          </div>
          <div className="md:col-span-2 grid gap-2">
            <Label>Watchlist notes</Label>
            <Textarea placeholder="Add personal notes about your strategy…" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// —— Admin Dashboard ——
function AdminDashboard() {
  const stats = [{ title: "Active Users", value: "1,248", icon: <Users className="h-4 w-4" /> }, { title: "Total Portfolios", value: "982", icon: <Wallet className="h-4 w-4" /> }, { title: "Tracked Symbols", value: "3,760", icon: <Layers className="h-4 w-4" /> }, { title: "Alerts Today", value: "214", icon: <Bell className="h-4 w-4" /> }];
  return (
    <div className="max-w-7xl mx-auto p-4 grid gap-4">
      <div className="grid md:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Stat key={s.title} title={s.title} value={s.value} icon={s.icon} />
        ))}
      </div>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>System Health</CardTitle>
          <CardDescription>Latency & request volume (demo)</CardDescription>
        </CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={samplePrices}>
              <XAxis dataKey="day" /><YAxis /><Tooltip />
              <Line type="monotone" dataKey="price" stroke="#10b981" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Recent Signups</CardTitle>
          <CardDescription>Demo table for admin overview</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2">User</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Created</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {[{ u: "Jane D.", e: "jane@example.com", r: "user", c: "Oct 1", s: "Active" }, { u: "Alex Q.", e: "alex@example.com", r: "user", c: "Oct 2", s: "Active" }, { u: "Sam P.", e: "sam@example.com", r: "admin", c: "Oct 3", s: "Invited" }].map((row, i) => (
                  <tr key={i} className="border-b">
                    <td className="py-2">{row.u}</td>
                    <td>{row.e}</td>
                    <td><Badge variant={row.r === "admin" ? "default" : "secondary"}>{row.r}</Badge></td>
                    <td>{row.c}</td>
                    <td>{row.s}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Admin Notes</CardTitle>
          <CardDescription>Changelog / incidents</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea placeholder="e.g., 10:22am price provider timeout; cache increased to 60s…" />
          <div className="text-xs text-muted-foreground mt-2 flex items-center gap-2"><AlertTriangle className="h-3 w-3" />Remember: do not paste secrets here.</div>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ title, value, icon }) {
  return (
    <Card className="rounded-2xl">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className="text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}

// —— Root App ——
export default function App() {
  const [route, setRoute] = useState("login");
  const [role, setRole] = useState("user");
  const [isAuthed, setAuthed] = useState(false);
  const [currency, setCurrency] = useState("USD");
  const [holdings, setHoldings] = useState(defaultHoldings);
  const [watchlist, setWatchlist] = useState(watchlistDefault);
  const [dark, setDark] = useState(false);
  const [apiPortfolio, setApiPortfolio] = useState<PortfolioResponse | null>(null);
  const [authUsername, setAuthUsername] = useState<string | null>(null);
  const [authPassword, setAuthPassword] = useState<string | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [portfolioLoading, setPortfolioLoading] = useState(false);
  const [portfolioError, setPortfolioError] = useState<string | null>(null);

  // On mount, restore session from localStorage if present
  useEffect(() => {
    const token = localStorage.getItem('authToken')
    const username = localStorage.getItem('authUsername')
    if (token) {
      setAuthToken(token)
      setAuthed(true)
      setRoute('portfolio')
      // load portfolio using token directly to avoid state update race
      void loadPortfolioFromApi(undefined, undefined, token)
    } else if (username) {
      // username can be remembered, but password must be re-entered for security
      setAuthUsername(username)
    }
  }, [])

  const onLoginSuccess = async (username: string, password: string) => {
    setAuthError(null);
    setAuthLoading(true);
    try {
      // Try token-based login first
      const resp = await login(username, password).catch((e) => { throw e })
      // resp may contain a token field; otherwise backend might just return user info
      const token = resp?.token || resp?.accessToken || null
      if (token) {
        setAuthToken(token)
        localStorage.setItem('authToken', token)
      } else {
        // fallback: store creds (note: storing hashes in localStorage has security implications)
        setAuthUsername(username)
        setAuthPassword(password)
        localStorage.setItem('authUsername', username)
      }

      setAuthed(true)
      setRoute('portfolio')
      // load portfolio using token if available — pass token explicitly to avoid race with state updates
      if (token) {
        await loadPortfolioFromApi(undefined, undefined, token)
      } else {
        await loadPortfolioFromApi(username, password, undefined)
      }
    } catch (e: any) {
      const msg = e?.message || String(e)
      setAuthError(msg)
      setAuthed(false)
    } finally {
      setAuthLoading(false)
    }
  };
  const onLogout = () => {
    setAuthed(false);
    setRoute("login");
    setAuthToken(null);
    setAuthUsername(null);
    setAuthPassword(null);
    localStorage.removeItem('authToken');
    localStorage.removeItem('authUsername');
  };
  const onLogin = () => setRoute("login");

  const showAdmin = role === "admin";

  async function loadPortfolioFromApi(usernameArg?: string | null, passwordArg?: string | null, tokenArg?: string | null) {
    const username = usernameArg ?? authUsername;
    const password = passwordArg ?? authPassword;
    const token = tokenArg ?? authToken ?? undefined;
    if (!token && (!username || !password)) return setPortfolioError('Missing credentials: please login first');
    setPortfolioError(null)
    setPortfolioLoading(true)
    try {
      const p = await fetchPortfolio(username ?? '', password ?? '', token)
      setApiPortfolio(p)
      // Map API holdings -> UI holdings shape
      const mapped = p.holdings.map((h) => ({ symbol: h.symbol, qty: h.quantity, avg: h.buyPrice, last: h.currentPrice }))
      setHoldings(mapped)
    } catch (e: any) {
      setPortfolioError(e?.message || String(e))
    } finally {
      setPortfolioLoading(false)
    }
  }

  function downloadApiCSV() {
    if (!apiPortfolio) return window.alert("No API portfolio loaded. Load first using 'Load from API'.");
    downloadPortfolioCSV(apiPortfolio);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-100">
      <TopNav route={route} setRoute={setRoute} role={role} setRole={setRole} isAuthed={isAuthed} onLogout={onLogout} onLogin={onLogin} dark={dark} setDark={setDark} />

      {!isAuthed && (route === "login" || route === "register" || route === "forgot") && (
        <main className="py-8">
          {route === "login" && <LoginScreen onSuccess={onLoginSuccess} onForgot={() => setRoute("forgot")} goRegister={() => setRoute("register")} loading={authLoading} serverError={authError} />}
          {route === "register" && <RegisterScreen goLogin={() => setRoute("login")} />}
          {route === "forgot" && <ForgotPasswordScreen goLogin={() => setRoute("login")} />}
        </main>
      )}

      {isAuthed && (
        <main className="py-6">
          <Tabs value={route} onValueChange={setRoute} className="max-w-7xl mx-auto px-4">
            <TabsList>
              <TabsTrigger value="portfolio"><BarChart3 className="h-4 w-4 mr-1" />Portfolio</TabsTrigger>
              <TabsTrigger value="trade"><TrendingUp className="h-4 w-4 mr-1" />Trade</TabsTrigger>
              <TabsTrigger value="preferences"><Settings className="h-4 w-4 mr-1" />Preferences</TabsTrigger>
              {showAdmin && (<TabsTrigger value="admin"><Shield className="h-4 w-4 mr-1" />Admin</TabsTrigger>)}
            </TabsList>
            <TabsContent value="portfolio"><PortfolioPage holdings={holdings} setHoldings={setHoldings} currency={currency} setCurrency={setCurrency} watchlist={watchlist} setWatchlist={setWatchlist} onLoadFromApi={loadPortfolioFromApi} onDownloadApi={downloadApiCSV} loading={portfolioLoading} error={portfolioError} /></TabsContent>
            <TabsContent value="trade"><TradePage authToken={authToken} authUsername={authUsername} authPassword={authPassword} refreshPortfolio={loadPortfolioFromApi} /></TabsContent>
            <TabsContent value="preferences"><PreferencesPage currency={currency} setCurrency={setCurrency} /></TabsContent>
            {showAdmin && (<TabsContent value="admin"><AdminDashboard /></TabsContent>)}
          </Tabs>
        </main>
      )}

      {!isAuthed && !(route === "login" || route === "register" || route === "forgot") && (
        <div className="max-w-3xl mx-auto p-8">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" />You are not logged in</CardTitle>
              <CardDescription>Use the Login/Register buttons in the top right.</CardDescription>
            </CardHeader>
          </Card>
        </div>
      )}

      <footer className="text-xs text-muted-foreground max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center gap-2"><Coins className="h-3 w-3" /> Demo UI only — wire to your APIs for real data.</div>
      </footer>
    </div>
  );
}
