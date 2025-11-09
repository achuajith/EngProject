import React, { useMemo, useState, useEffect } from "react";
import {
  CandlestickChart,
  Search,
  Sun,
  Moon,
  MoreHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export function TopNav({ route, setRoute, role, setRole, isAuthed, onLogout, onLogin, dark, setDark, onQuickSearch }) {
  const [quickQuery, setQuickQuery] = useState('')
  useEffect(() => {
    // apply dark mode to html/body for Tailwind dark variants
    const root = document.documentElement;
    if (dark) {
      root.classList.add("dark");
      document.body.style.backgroundColor = 'rgb(15, 23, 42)'; // slate-900
      document.body.style.color = 'rgb(248, 250, 252)'; // slate-50
    } else {
      root.classList.remove("dark");
      document.body.style.backgroundColor = 'rgb(248, 250, 252)'; // slate-50
      document.body.style.color = 'rgb(15, 23, 42)'; // slate-900
    }
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
