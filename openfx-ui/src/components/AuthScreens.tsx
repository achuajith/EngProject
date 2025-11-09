import React, { useState } from "react";
import { register } from "@/lib/api";
import { LogIn, UserPlus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export function LoginScreen({ onSuccess, goRegister, loading, serverError }: { onSuccess: (u:string,p:string)=>void; goRegister: ()=>void; loading?: boolean; serverError?: string | null }) {
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

export function RegisterScreen({ goLogin }) {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (!username || !email || !password || !name) return setErr('All fields required');
    if (!agreedToTerms) return setErr('You must agree to the Terms');
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
            <Switch id="tos" checked={agreedToTerms} onCheckedChange={setAgreedToTerms} />
            <Label htmlFor="tos" className="text-sm">I agree to the Terms</Label>
          </div>
          <Button onClick={submit} disabled={loading || !agreedToTerms}><UserPlus className="h-4 w-4 mr-1  cursor-pointer transition-all hover:scale-105" />{loading ? 'Registering…' : 'Register'}</Button>
          <Button variant="link" className="px-0  cursor-pointer transition-all hover:scale-105" onClick={goLogin}>Have an account? Login</Button>
        </CardContent>
      </Card>
    </div>
  );
}
