import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSession } from "@/hooks/useSession";
import { Brand } from "@/components/site/Brand";

const searchSchema = z.object({
  mode: z.enum(["login", "register"]).optional(),
  referral_code: z.string().optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Log in or Create an Account — BrokeFlex" },
      {
        name: "description",
        content:
          "Sign in to track your proxy orders, collect CD keys and manage account refills.",
      },
      { property: "og:title", content: "Log in — BrokeFlex" },
      {
        property: "og:description",
        content: "Sign in to track your proxy orders and collect CD keys.",
      },
    ],
  }),
  component: AuthPage,
});

const credsSchema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
});

function AuthPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { user, loading } = useSession();
  const [mode, setMode] = useState<"login" | "register">(search.mode ?? "login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sentConfirmation, setSentConfirmation] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      navigate({ to: user.role === "admin" ? "/admin" : "/dashboard", replace: true });
    }
  }, [user, loading, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = credsSchema.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    if (mode === "register" && fullName.trim().length < 2) {
      toast.error("Please enter your name.");
      return;
    }

    if (mode === "register" && confirmPassword !== password) {
      toast.error("Passwords do not match.");
      return;
    }

    setBusy(true);
    if (mode === "register") {
      try {
        const data = await apiFetch<{ ok: boolean; user?: { role?: string } }>('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify({
            full_name: fullName.trim().slice(0, 120),
            email: parsed.data.email,
            password: parsed.data.password,
            confirm_password: confirmPassword,
            referral_code: search.referral_code ?? null,
          }),
        });
        setBusy(false);
        toast.success('Welcome to BrokeFlex!');
        navigate({ to: data?.user?.role === 'admin' ? '/admin' : '/dashboard', replace: true });
      } catch (err: any) {
        setBusy(false);
        toast.error(err?.message || 'Registration failed');
      }
    } else {
      try {
        const data = await apiFetch<{ ok: boolean; user?: { role?: string } }>('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email: parsed.data.email, password: parsed.data.password }),
        });
        setBusy(false);
        toast.success('Welcome back!');
        navigate({ to: data?.user?.role === 'admin' ? '/admin' : '/dashboard', replace: true });
      } catch (err: any) {
        setBusy(false);
        toast.error(err?.message || 'Login failed');
      }
    }
  }


  return (
    <div className="hero-glow flex min-h-screen items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-center">
          <Brand />
        </div>

        <Card className="border-border/70">
          <CardContent className="p-7">
            {sentConfirmation ? (
              <div className="space-y-4 text-center">
                <h1 className="text-xl font-semibold tracking-tight">Confirm your email</h1>
                <p className="text-sm text-muted-foreground">
                  We sent a confirmation link to <strong>{email}</strong>. Click it to
                  activate your account, then come back and log in.
                </p>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setSentConfirmation(false);
                    setMode("login");
                  }}
                >
                  Back to login
                </Button>
              </div>
            ) : (
              <>
                <div className="mb-6 grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
                  {(["login", "register"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMode(m)}
                      className={
                        "rounded-md px-3 py-2 text-sm font-medium transition-colors " +
                        (mode === m
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground")
                      }
                    >
                      {m === "login" ? "Log in" : "Create account"}
                    </button>
                  ))}
                </div>

                <h1 className="text-xl font-semibold tracking-tight">
                  {mode === "login" ? "Welcome back" : "Create your account"}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {mode === "login"
                    ? "Log in to view your orders and CD keys."
                    : "An account is required before you can purchase."}
                </p>

                <form onSubmit={submit} className="mt-6 space-y-4">
                  {mode === "register" ? (
                    <div className="space-y-2">
                      <Label htmlFor="name">Full name</Label>
                      <Input
                        id="name"
                        value={fullName}
                        maxLength={120}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="John Doe"
                      />
                    </div>
                  ) : null}

                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      maxLength={255}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      autoComplete={mode === "login" ? "current-password" : "new-password"}
                      value={password}
                      maxLength={72}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 8 characters"
                    />
                  </div>

                  {mode === "register" ? (
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Confirm Password</Label>
                      <Input
                        id="confirmPassword"
                        type="password"
                        autoComplete="new-password"
                        value={confirmPassword}
                        maxLength={72}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter your password"
                      />
                    </div>
                  ) : null}

                  <Button type="submit" className="w-full" disabled={busy}>
                    {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                    {mode === "login" ? "Log in" : "Create account"}
                  </Button>
                </form>

                <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="h-px flex-1 bg-border" />
                  <span>Or continue with your email and password</span>
                  <span className="h-px flex-1 bg-border" />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link to="/" className="hover:text-foreground">
            ← Back to site
          </Link>
        </p>
      </div>
    </div>
  );
}
