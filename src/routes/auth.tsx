import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSession } from "@/hooks/useSession";
import { Brand } from "@/components/site/Brand";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';
const GOOGLE_CALLBACK_URL = import.meta.env.VITE_GOOGLE_CALLBACK_URL ?? `${window.location.origin}/auth`;

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
    scripts: GOOGLE_CLIENT_ID
      ? [
          {
            src: "https://accounts.google.com/gsi/client",
            async: true,
            defer: true,
          },
        ]
      : [],
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
  const [googleBusy, setGoogleBusy] = useState(false);
  const [googleClient, setGoogleClient] = useState<any | null>(null);
  const [sentConfirmation, setSentConfirmation] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      navigate({ to: user.role === "admin" ? "/admin" : "/dashboard", replace: true });
    }
  }, [user, loading, navigate]);

  async function handleGoogleCredential(response: { credential?: string; code?: string; error?: string; error_description?: string }) {
    if (response.error) {
      toast.error(response.error_description || 'Google sign-in was cancelled. Please try again.');
      return;
    }

    setGoogleBusy(true);
    try {
      const data = await apiFetch<{ ok: boolean; token?: string; user?: { role?: string } }>('/api/auth/google', {
        method: 'POST',
        body: JSON.stringify({
          ...(response.credential ? { credential: response.credential } : {}),
          ...(response.code ? { code: response.code } : {}),
        }),
      });
      if (data?.token) {
        window.localStorage.setItem('auth-token', data.token);
      }
      toast.success('Welcome!');
      navigate({ to: data?.user?.role === 'admin' ? '/admin' : '/dashboard', replace: true });
    } catch (err: any) {
      toast.error(err?.message || 'Google sign-in failed. Please try again.');
    } finally {
      setGoogleBusy(false);
    }
  }

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || typeof window === 'undefined') return;

    let initInterval: number | undefined;
    const tryInit = () => {
      const google = (window as any).google;
      if (!google?.accounts?.oauth2?.initCodeClient) return;

      const client = google.accounts.oauth2.initCodeClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: 'openid email profile',
        ux_mode: 'popup',
        redirect_uri: 'postmessage',
        callback: (response: any) => {
          handleGoogleCredential(response);
        },
      });
      setGoogleClient(client);
      if (initInterval) {
        window.clearInterval(initInterval);
      }
    };

    tryInit();
    if (!googleClient) {
      initInterval = window.setInterval(tryInit, 250);
    }

    return () => {
      if (initInterval) {
        window.clearInterval(initInterval);
      }
    };
  }, [googleClient]);

  async function startGoogleFlow() {
    if (!GOOGLE_CLIENT_ID) {
      toast.error('Google sign-in is not configured yet.');
      return;
    }

    if (typeof window === 'undefined') {
      toast.error('Google sign-in is unavailable right now.');
      return;
    }

    const google = (window as any).google;
    if (!google?.accounts) {
      toast.error('Google sign-in is unavailable right now.');
      return;
    }

    if (googleClient) {
      googleClient.requestCode();
      return;
    }

    if (google?.accounts?.oauth2?.initCodeClient) {
      const client = google.accounts.oauth2.initCodeClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: 'openid email profile',
        ux_mode: 'popup',
        redirect_uri: 'postmessage',
        callback: (response: any) => {
          handleGoogleCredential(response);
        },
      });
      setGoogleClient(client);
      client.requestCode();
      return;
    }

    if (!google?.accounts?.id) {
      toast.error('Google sign-in is still loading. Please try again in a moment.');
      return;
    }

    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: (response: any) => handleGoogleCredential(response),
      auto_select: false,
      cancel_on_tap_outside: false,
    });

    google.accounts.id.prompt((notification: any) => {
      if (notification?.getNotDisplayedReason?.()) {
        toast.error('Google sign-in could not be shown. Please try again.');
      }
    });
  }

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
        const data = await apiFetch<{ ok: boolean; token?: string; user?: { role?: string } }>('/api/auth/register', {
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
        if (data?.token) {
          window.localStorage.setItem('auth-token', data.token);
        }
        toast.success('Welcome to BrokeFlex!');
        navigate({ to: data?.user?.role === 'admin' ? '/admin' : '/dashboard', replace: true });
      } catch (err: any) {
        setBusy(false);
        toast.error(err?.message || 'Registration failed');
      }
    } else {
      try {
        const data = await apiFetch<{ ok: boolean; token?: string; user?: { role?: string } }>('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email: parsed.data.email, password: parsed.data.password }),
        });
        setBusy(false);
        if (data?.token) {
          window.localStorage.setItem('auth-token', data.token);
        }
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

                {GOOGLE_CLIENT_ID ? (
                  <div className="mt-6">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={startGoogleFlow}
                      disabled={googleBusy}
                    >
                      {googleBusy ? (
                        <Loader2 className="mr-2 size-4 animate-spin" />
                      ) : null}
                      Continue with Google
                    </Button>
                  </div>
                ) : null}

                <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="h-px flex-1 bg-border" />
                  <span>Or continue with your email and password</span>
                  <span className="h-px flex-1 bg-border" />
                </div>

                <form onSubmit={submit} className="space-y-4">
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
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        autoComplete={mode === "login" ? "current-password" : "new-password"}
                        value={password}
                        maxLength={72}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="At least 8 characters"
                        className="pr-11"
                      />
                      <button
                        type="button"
                        className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground"
                        onClick={() => setShowPassword((value) => !value)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>

                  {mode === "register" ? (
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Confirm Password</Label>
                      <div className="relative">
                        <Input
                          id="confirmPassword"
                          type={showConfirmPassword ? "text" : "password"}
                          autoComplete="new-password"
                          value={confirmPassword}
                          maxLength={72}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Re-enter your password"
                          className="pr-11"
                        />
                        <button
                          type="button"
                          className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground"
                          onClick={() => setShowConfirmPassword((value) => !value)}
                          aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                        >
                          {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                      </div>
                    </div>
                  ) : null}

                  <Button type="submit" className="w-full" disabled={busy}>
                    {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                    {mode === "login" ? "Log in" : "Create account"}
                  </Button>
                </form>
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
