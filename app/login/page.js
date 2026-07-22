"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn, UserPlus, ShieldCheck, UserCheck } from "lucide-react";
import { apiFetch, setToken } from "@/lib/apiClient";

export default function LoginPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [hasAdmin, setHasAdmin] = useState(true);
  const [mode, setMode] = useState("signin"); // "signin" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [divisionCode, setDivisionCode] = useState("");
  const [signupDone, setSignupDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch("/api/team/exists")
      .then((r) => r.json())
      .then((d) => setHasAdmin(!!d.hasAdmin))
      .catch(() => setHasAdmin(true))
      .finally(() => setChecking(false));
  }, []);

  // Built-in admin shortcut: typing "admin" / "1234" signs into the
  // predefined admin@scheduler.local seat.
  const ADMIN_ALIAS = { username: "admin", password: "1234" };
  const ADMIN_ACCOUNT = { email: "admin@scheduler.local", password: "Sched-Admin-1234-Internal!" };

  async function signInAndRedirect(emailValue, passwordValue) {
    let finalEmail = emailValue;
    let finalPassword = passwordValue;
    if (emailValue.trim().toLowerCase() === ADMIN_ALIAS.username && passwordValue === ADMIN_ALIAS.password) {
      finalEmail = ADMIN_ACCOUNT.email;
      finalPassword = ADMIN_ACCOUNT.password;
    }
    const res = await apiFetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: finalEmail, password: finalPassword }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Invalid email or password.");
    setToken(data.token);
    router.push("/app");
    router.refresh();
  }

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await signInAndRedirect(email, password);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleSignup(e) {
    e.preventDefault();
    setError("");
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    setBusy(true);
    try {
      const res = await apiFetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, displayName, divisionCode })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed.");
      setSignupDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleBootstrap(e) {
    e.preventDefault();
    setError("");
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    setBusy(true);
    try {
      const res = await apiFetch("/api/team/bootstrap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, displayName })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Setup failed.");
      await signInAndRedirect(email, password);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (checking) {
    return <div className="flex min-h-screen items-center justify-center bg-[#f8f9fa] dark:bg-gray-950 text-sm text-slate-400 dark:text-gray-500">Loading…</div>;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f8f9fa] dark:bg-gray-950 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm">
        <div className="mb-5 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
            <LogIn size={22} />
          </div>
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">SocialPilot</p>
          <h1 className="text-lg font-bold text-slate-800 dark:text-white">Scheduler</h1>
        </div>

        {!hasAdmin ? (
          <>
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 px-3 py-2.5 text-sm text-indigo-700 dark:text-indigo-300">
              <ShieldCheck size={16} className="shrink-0" />
              First time here — set up the admin account.
            </div>
            <form onSubmit={handleBootstrap} className="space-y-3">
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" required
                className="w-full rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm text-slate-800 dark:text-gray-100 placeholder:text-slate-400 dark:placeholder:text-gray-500 outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" />
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required
                className="w-full rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm text-slate-800 dark:text-gray-100 placeholder:text-slate-400 dark:placeholder:text-gray-500 outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" />
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password (8+ characters)" required
                className="w-full rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm text-slate-800 dark:text-gray-100 placeholder:text-slate-400 dark:placeholder:text-gray-500 outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" />
              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
              <button type="submit" disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50">
                <UserPlus size={15} /> {busy ? "Setting up…" : "Create admin account"}
              </button>
            </form>
          </>
        ) : mode === "signup" ? (
          signupDone ? (
            <div className="space-y-3 text-center">
              <div className="flex items-center gap-2 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 px-3 py-2.5 text-sm text-indigo-700 dark:text-indigo-300">
                <UserCheck size={16} className="shrink-0" />
                Request submitted — your Group Head or admin needs to approve it before you can sign in.
              </div>
              <button
                onClick={() => { setMode("signin"); setSignupDone(false); setPassword(""); setDisplayName(""); setDivisionCode(""); }}
                className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Back to sign in
              </button>
            </div>
          ) : (
            <form onSubmit={handleSignup} className="space-y-3">
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" required
                className="w-full rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm text-slate-800 dark:text-gray-100 placeholder:text-slate-400 dark:placeholder:text-gray-500 outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" />
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required
                className="w-full rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm text-slate-800 dark:text-gray-100 placeholder:text-slate-400 dark:placeholder:text-gray-500 outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" />
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password (8+ characters)" required
                className="w-full rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm text-slate-800 dark:text-gray-100 placeholder:text-slate-400 dark:placeholder:text-gray-500 outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" />
              <input value={divisionCode} onChange={(e) => setDivisionCode(e.target.value)} placeholder="Division code (e.g. NBA, or GH_NBA if you're the Group Head)" required
                className="w-full rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm text-slate-800 dark:text-gray-100 placeholder:text-slate-400 dark:placeholder:text-gray-500 outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" />
              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
              <button type="submit" disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50">
                <UserCheck size={15} /> {busy ? "Submitting…" : "Request access"}
              </button>
              <button type="button" onClick={() => { setMode("signin"); setError(""); }} className="w-full text-center text-xs text-slate-400 dark:text-gray-500 transition-colors hover:text-slate-600 dark:hover:text-gray-300">
                Back to sign in
              </button>
            </form>
          )
        ) : (
          <form onSubmit={handleLogin} className="space-y-3">
            <input type="text" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email or username" required autoFocus
              className="w-full rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm text-slate-800 dark:text-gray-100 placeholder:text-slate-400 dark:placeholder:text-gray-500 outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" required
              className="w-full rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm text-slate-800 dark:text-gray-100 placeholder:text-slate-400 dark:placeholder:text-gray-500 outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" />
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            <button type="submit" disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50">
              <LogIn size={15} /> {busy ? "Signing in…" : "Sign in"}
            </button>
            <button type="button" onClick={() => { setMode("signup"); setError(""); }} className="w-full text-center text-xs text-slate-400 dark:text-gray-500 transition-colors hover:text-slate-600 dark:hover:text-gray-300">
              New here? Request access with your division code
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
