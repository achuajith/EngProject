// (moved currency logic into PortfolioPage below)
import React, { useMemo, useState, useEffect } from "react";
import { fetchPortfolio, downloadPortfolioCSV, login, register, type PortfolioResponse, type StockSearchResult, searchStocks } from "@/lib/api";
import { TradePage } from "@/components/TradePage";

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
  Shield,
  Wallet,
  CandlestickChart,
  BarChart3,
  Activity,
  Search,
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
import { NewsList } from "@/components/ui/news-list";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const defaultHoldings: Array<{ symbol: string; qty: number; avg: number; last: number }> = [];

function format(n, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);
}
// Note: password hashing is done server-side. Do NOT pre-hash in the client for this demo.

const COLORS = ["#06b6d4", "#3b82f6", "#10b981", "#f59e0b", "#ef4444"];

// —— Top Navigation ——
function TopNav({ route, setRoute, role, setRole, isAuthed, onLogout, onLogin, dark, setDark, onQuickSearch }) {
  const [quickQuery, setQuickQuery] = useState('')
  useEffect(() => {
    // apply dark mode to html/body for Tailwind dark variants
    if (dark) document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }, [dark]);

  const navItems: Array<[string, string]> = useMemo(() => {
    const base: Array<[string, string]> = [["portfolio", "Portfolio"], ["trade", "Trade"]]
    if (role === 'admin') base.push(["admin", "Admin"])
    return base
  }, [role])

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
          {navItems.map(([r, label]) => (
            <Button key={r} variant={route === r ? "default" : "ghost"} onClick={() => setRoute(r)}>
              {label}
            </Button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-2">
            <Input
              placeholder="Search Symbol"
              className="w-[220px]"
              value={quickQuery}
              onChange={(e) => setQuickQuery(e.target.value)}
              onKeyPress={(e) => { if (e.key === 'Enter') onQuickSearch?.(quickQuery) }}
            />
            <Button onClick={() => onQuickSearch?.(quickQuery)} className="cursor-pointer transition-all hover:scale-105">
              <Search className="h-4 w-4" />
            </Button>
          </div>

          <button onClick={() => setDark(!dark)} className="p-2 rounded-md hover:bg-muted/30 cursor-pointer transition-all hover:scale-105">
            {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-2 rounded-md hover:bg-muted/30 flex items-center gap-2 cursor-pointer transition-all hover:scale-105">
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
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
function LoginScreen({ onSuccess, goRegister, loading, serverError }: { onSuccess: (u:string,p:string)=>void; goRegister: ()=>void; loading?: boolean; serverError?: string | null }) {
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
        <CardContent>
          <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); tryLogin(); }}>
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
              <Button type="submit" className="w-full  cursor-pointer transition-all hover:scale-105" disabled={!!loading}><LogIn className="h-4 w-4 mr-1" />{loading ? 'Logging in…' : 'Login'}</Button>
            </div>
            <div className="flex justify-between text-sm">
              <Button type="button" variant="link" className="px-0  cursor-pointer transition-all hover:scale-105" onClick={goRegister}>Create account</Button>
            </div>
          </form>
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
          <Button onClick={submit} disabled={loading}><UserPlus className="h-4 w-4 mr-1  cursor-pointer transition-all hover:scale-105" />{loading ? 'Registering…' : 'Register'}</Button>
          <Button variant="link" className="px-0  cursor-pointer transition-all hover:scale-105" onClick={goLogin}>Have an account? Login</Button>
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
          <Button onClick={goLogin}><KeyRound className="h-4 w-4 mr-1  cursor-pointer transition-all hover:scale-105" />Send reset link</Button>
          <Button variant="link" className="px-0  cursor-pointer transition-all hover:scale-105" onClick={goLogin}>Back to login</Button>
        </CardContent>
      </Card>
    </div>
  );
}

// —— Portfolio Page ——
function PortfolioPage({ holdings, currency, setCurrency, onLoadFromApi, onDownloadApi, loading, error, setTradeStock, setRoute }: { holdings:any; currency:any; setCurrency:any; onLoadFromApi: ()=>void; onDownloadApi: ()=>void; loading?: boolean; error?: string | null; setTradeStock: any; setRoute: any }) {
  const totals = useMemo(() => {
    const mv = holdings.reduce((s, h) => s + h.qty * h.last, 0);
    const cost = holdings.reduce((s, h) => s + h.qty * h.avg, 0);
    return { mv, cost, pl: mv - cost, plPct: cost ? ((mv - cost) / cost) * 100 : 0 };
  }, [holdings]);

  // Currency conversion logic (local to PortfolioPage)
  const [rates, setRates] = useState<{ USD: number; CAD: number; EUR: number }>({ USD: 1, CAD: 1, EUR: 1 });
  useEffect(() => {
    import("@/lib/currency").then(({ fetchExchangeRates, extractCoreRates }) => {
      const envAny = (import.meta as any);
      const key = envAny?.env?.VITE_OpenExchangeRate_API_KEY || "ca2e6e010a704e71a81b1594664ecf27";
      fetchExchangeRates(key)
        .then((resp) => setRates(extractCoreRates(resp)))
        .catch(() => setRates({ USD: 1, CAD: 1.4, EUR: 0.86 }));
    });
  }, []);
  function formatConverted(n: number, cur: string) {
    // compute via USD base math using loaded rates
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

      {/* News list (proxied via backend) */}
      <NewsList limit={6} />
    </div>
  );
}

// —— Admin Dashboard ——
function AdminPage({ token }: { token: string }) {
  const [users, setUsers] = useState<Array<{ email: string; fullname: string; username: string; roles: string[] }>>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [form, setForm] = useState({ email: '', fullname: '', username: '', password: '', admin: false })
  const [selected, setSelected] = useState<string | null>(null)
  const [holdings, setHoldings] = useState<Array<{ symbol: string; quantity: number; buyPrice: number; currentPrice?: number }>>([])
  const [hForm, setHForm] = useState({ symbol: '', quantity: 0, buyPrice: 0 })

  async function loadUsers() {
    setLoading(true); setErr(null)
    try {
      const { adminListUsers } = await import('@/lib/api')
      const u = await adminListUsers(token)
      setUsers(u)
    } catch (e: any) { setErr(e?.message || String(e)) } finally { setLoading(false) }
  }
  useEffect(() => { void loadUsers() }, [])

  async function createUser() {
    setErr(null)
    try {
      const { adminCreateUser } = await import('@/lib/api')
      const roles = form.admin ? ['admin'] : ['user']
      await adminCreateUser({ email: form.email.trim(), fullname: form.fullname.trim(), username: form.username.trim(), password: form.password, roles }, token)
      setForm({ email: '', fullname: '', username: '', password: '', admin: false })
      await loadUsers()
    } catch (e: any) { setErr(e?.message || String(e)) }
  }

  async function deleteUser(username: string) {
    if (!confirm(`Delete user ${username}?`)) return
    try {
      const { adminDeleteUser } = await import('@/lib/api')
      await adminDeleteUser(username, token)
      if (selected === username) { setSelected(null); setHoldings([]) }
      await loadUsers()
    } catch (e: any) { setErr(e?.message || String(e)) }
  }

  async function loadPortfolio(username: string) {
    setSelected(username)
    try {
      const { adminGetPortfolio } = await import('@/lib/api')
      const ph = await adminGetPortfolio(username, token)
      setHoldings(ph as any)
    } catch (e: any) { setErr(e?.message || String(e)) }
  }

  async function upsertHolding() {
    if (!selected) return
    try {
      const { adminUpsertHolding } = await import('@/lib/api')
      await adminUpsertHolding(selected, { symbol: hForm.symbol.trim().toUpperCase(), quantity: Number(hForm.quantity), buyPrice: Number(hForm.buyPrice) }, token)
      setHForm({ symbol: '', quantity: 0, buyPrice: 0 })
      await loadPortfolio(selected)
    } catch (e: any) { setErr(e?.message || String(e)) }
  }

  async function removeHolding(symbol: string) {
    if (!selected) return
    try {
      const { adminDeleteHolding } = await import('@/lib/api')
      await adminDeleteHolding(selected, symbol, token)
      await loadPortfolio(selected)
    } catch (e: any) { setErr(e?.message || String(e)) }
  }

  return (
    <div className="max-w-7xl mx-auto p-4 grid gap-6">
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardDescription>Manage users and roles</CardDescription>
        </CardHeader>
        <CardContent>
          {err && <div className="mb-3 text-sm text-rose-600">{err}</div>}
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2">Username</th>
                  <th>Email</th>
                  <th>Full name</th>
                  <th>Roles</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.username} className="border-b">
                    <td className="py-2 font-medium">{u.username}</td>
                    <td>{u.email}</td>
                    <td>{u.fullname}</td>
                    <td>{u.roles?.join(', ')}</td>
                    <td className="text-right flex gap-2 justify-end">
                      <Button size="sm" variant="outline" onClick={() => loadPortfolio(u.username)}>Manage</Button>
                      <Button size="sm" variant="destructive" onClick={() => deleteUser(u.username)}>Delete</Button>
                    </td>
                  </tr>
                ))}
                {!users.length && (
                  <tr><td colSpan={5} className="py-4 text-center text-muted-foreground">No users found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Create User</CardTitle>
          <CardDescription>Admins can create new users</CardDescription>
        </CardHeader>
        <CardContent className="grid md:grid-cols-5 gap-3 items-end">
          <div className="grid gap-1"><Label>Email</Label><Input value={form.email} onChange={e=>setForm({ ...form, email: e.target.value })} /></div>
          <div className="grid gap-1"><Label>Full name</Label><Input value={form.fullname} onChange={e=>setForm({ ...form, fullname: e.target.value })} /></div>
          <div className="grid gap-1"><Label>Username</Label><Input value={form.username} onChange={e=>setForm({ ...form, username: e.target.value })} /></div>
          <div className="grid gap-1"><Label>Password</Label><Input type="password" value={form.password} onChange={e=>setForm({ ...form, password: e.target.value })} /></div>
          <div className="flex items-center gap-3"><Switch id="isAdmin" checked={form.admin} onCheckedChange={(v)=>setForm({ ...form, admin: !!v })} /><Label htmlFor="isAdmin">Admin</Label></div>
          <div className="md:col-span-5"><Button onClick={createUser}>Create</Button></div>
        </CardContent>
      </Card>

      {selected && (
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>Manage Portfolio: {selected}</CardTitle>
            <CardDescription>Add, modify, or remove holdings for the selected user</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-2">Symbol</th>
                    <th>Quantity</th>
                    <th>Buy Price</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {holdings.map(h => (
                    <tr key={h.symbol} className="border-b">
                      <td className="py-2 font-medium">{h.symbol}</td>
                      <td>{h.quantity}</td>
                      <td>{h.buyPrice}</td>
                      <td className="text-right"><Button size="sm" variant="destructive" onClick={()=>removeHolding(h.symbol)}>Delete</Button></td>
                    </tr>
                  ))}
                  {!holdings.length && (<tr><td colSpan={4} className="py-4 text-center text-muted-foreground">No holdings</td></tr>)}
                </tbody>
              </table>
            </div>
            <div className="grid md:grid-cols-4 gap-3 items-end">
              <div className="grid gap-1"><Label>Symbol</Label><Input value={hForm.symbol} onChange={e=>setHForm({ ...hForm, symbol: e.target.value })} placeholder="AAPL" /></div>
              <div className="grid gap-1"><Label>Quantity</Label><Input type="number" value={String(hForm.quantity)} onChange={e=>setHForm({ ...hForm, quantity: Number(e.target.value) })} /></div>
              <div className="grid gap-1"><Label>Buy Price</Label><Input type="number" value={String(hForm.buyPrice)} onChange={e=>setHForm({ ...hForm, buyPrice: Number(e.target.value) })} /></div>
              <div><Button onClick={upsertHolding}>Add/Update</Button></div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
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
  // Quick search handler for TopNav
  const handleQuickSearch = async (query: string) => {
    if (!query) return;
    try {
      const results = await searchStocks(query, authToken ?? undefined);
      if (results && results.length > 0) {
        setTradeStock(results[0]);
        setRoute('trade');
      } else {
        alert('No results found for "' + query + '"');
      }
    } catch (e: any) {
      alert('Search failed: ' + (e?.message || String(e)));
    }
  };
  const [route, setRoute] = useState("login");
  const [role, setRole] = useState("user");
  const [isAuthed, setAuthed] = useState(false);
  const [currency, setCurrency] = useState("USD");
  const [apiPortfolio, setApiPortfolio] = useState<PortfolioResponse | null>(null);
  const [holdings, setHoldings] = useState(defaultHoldings);
  const [dark, setDark] = useState(false);
  const [authUsername, setAuthUsername] = useState<string | null>(null);
  const [authPassword, setAuthPassword] = useState<string | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [portfolioLoading, setPortfolioLoading] = useState(false);
  const [portfolioError, setPortfolioError] = useState<string | null>(null);
  const [tradeStock, setTradeStock] = useState(null);

  const onLoginSuccess = async (username: string, password: string) => {
    setAuthError(null);
    setAuthLoading(true);
    try {
      // Try token-based login first
      const resp = await login(username, password).catch((e) => { throw e })
      // resp may contain a token field; otherwise backend might just return user info
  const token = resp?.token || resp?.accessToken || null
  const roles = Array.isArray(resp?.user?.roles) ? resp.user.roles : []
  if (roles.includes('admin')) setRole('admin')
  else setRole('user')
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
    setRole('user');
    setAuthToken(null);
    setAuthUsername(null);
    setAuthPassword(null);
    localStorage.removeItem('authToken');
    localStorage.removeItem('authUsername');
  };
  const onLogin = () => setRoute("login");

  const showAdmin = role === "admin";

  // Move function definition here so it can access state
  const loadPortfolioFromApi = async (usernameArg?: string | null, passwordArg?: string | null, tokenArg?: string | null) => {
    const username = usernameArg ?? authUsername ?? '';
    const password = passwordArg ?? authPassword ?? '';
    const token = tokenArg ?? authToken ?? undefined;
    if (!token && (!username || !password)) return setPortfolioError('Missing credentials: please login first');
    setPortfolioError(null)
    setPortfolioLoading(true)
    try {
      const p = await fetchPortfolio(username, password, token)
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-100">
  <TopNav route={route} setRoute={setRoute} role={role} setRole={setRole} isAuthed={isAuthed} onLogout={onLogout} onLogin={onLogin} dark={dark} setDark={setDark} onQuickSearch={handleQuickSearch} />

      {!isAuthed && (route === "login" || route === "register") && (
        <main className="py-8">
          {route === "login" && <LoginScreen onSuccess={onLoginSuccess} goRegister={() => setRoute("register")} loading={authLoading} serverError={authError} />}
          {route === "register" && <RegisterScreen goLogin={() => setRoute("login")} />}
        </main>
      )}

      {isAuthed && (
        <main className="py-6">
          <Tabs value={route} onValueChange={setRoute} className="max-w-7xl mx-auto px-4">
            <TabsList>
              <TabsTrigger value="portfolio"><BarChart3 className="h-4 w-4 mr-1" />Portfolio</TabsTrigger>
              <TabsTrigger value="trade"><TrendingUp className="h-4 w-4 mr-1" />Trade</TabsTrigger>
              {showAdmin && (<TabsTrigger value="admin"><Shield className="h-4 w-4 mr-1" />Admin</TabsTrigger>)}
            </TabsList>
            <TabsContent value="portfolio">
              <PortfolioPage 
                holdings={holdings} 
                currency={currency} 
                setCurrency={setCurrency} 
                onLoadFromApi={loadPortfolioFromApi} 
                onDownloadApi={() => apiPortfolio && downloadPortfolioCSV(apiPortfolio)} 
                loading={portfolioLoading} 
                error={portfolioError}
                setTradeStock={setTradeStock}
                setRoute={setRoute}
              />
            </TabsContent>
            <TabsContent value="trade">
              <TradePage 
                authToken={authToken} 
                authUsername={authUsername} 
                authPassword={authPassword} 
                refreshPortfolio={loadPortfolioFromApi}
                initialStock={tradeStock}
              />
            </TabsContent>
            {showAdmin && (
              <TabsContent value="admin">
                {authToken ? <AdminPage token={authToken} /> : <div className="p-4 text-sm text-muted-foreground">Login required.</div>}
              </TabsContent>
            )}
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
        <div className="flex items-center gap-2"><Coins className="h-3 w-3" />4FD3 - Final Project - OPENFx</div>
      </footer>
    </div>
  );
}
