import React, { useState, useEffect } from "react";
import { fetchPortfolio, downloadPortfolioCSV, login, type PortfolioResponse, type StockSearchResult, searchStocks } from "@/lib/api";
import { TradePage } from "@/components/TradePage";
import { LoginScreen, RegisterScreen } from "@/components/AuthScreens";
import { PortfolioPage } from "@/components/PortfolioPage";
import { AdminPage } from "@/components/AdminPage";
import { TopNav } from "@/components/TopNav";

import {
  BarChart3,
  Shield,
  TrendingUp,
  Activity,
  Coins,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const defaultHoldings: Array<{ symbol: string; qty: number; avg: number; last: number }> = [];

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
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    if (saved !== null) return saved === 'true';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const [authUsername, setAuthUsername] = useState<string | null>(null);
  const [authPassword, setAuthPassword] = useState<string | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [portfolioLoading, setPortfolioLoading] = useState(false);
  const [portfolioError, setPortfolioError] = useState<string | null>(null);
  const [tradeStock, setTradeStock] = useState(null);

  useEffect(() => {
    localStorage.setItem('darkMode', String(dark));
  }, [dark]);

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
        setAuthUsername(username)
        setAuthPassword(password)
        localStorage.setItem('authUsername', username)
      }

  setAuthed(true)
      setRoute('portfolio')
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
      const mapped = p.holdings.map((h) => ({ symbol: h.symbol, qty: h.quantity, avg: h.buyPrice, last: h.currentPrice }))
      setHoldings(mapped)
    } catch (e: any) {
      setPortfolioError(e?.message || String(e))
    } finally {
      setPortfolioLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-50 transition-colors">
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
