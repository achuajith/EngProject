import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export function AdminPage({ token }: { token: string }) {
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
