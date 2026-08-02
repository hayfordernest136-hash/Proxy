import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Loader2, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Brand } from "@/components/site/Brand";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Forgot Password - BrokeFlex Data" },
      {
        name: "description",
        content:
          "Request a password reset link for your BrokeFlex account. We will email you a secure, single-use link.",
      },
      { property: "og:title", content: "Forgot Password - BrokeFlex Data" },
      {
        property: "og:description",
        content:
          "Request a secure password reset link for your BrokeFlex account.",
      },
    ],
  }),
  component: ForgotPasswordPage,
});

const emailSchema = z.string().trim().email("Enter a valid email address").max(255);

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();

    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }

    setBusy(true);
    try {
      await apiFetch<{ ok: boolean; message?: string }>("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: parsed.data }),
      });
      setBusy(false);
      setSent(true);
      toast.success("Check your inbox for the reset link.");
    } catch (err: any) {
      setBusy(false);
      toast.error(err?.message || "Unable to request a reset link. Please try again.");
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
            {sent ? (
              <div className="space-y-5 text-center">
                <div className="mx-auto grid size-12 place-items-center rounded-full bg-primary/15">
                  <MailCheck className="size-6 text-primary" />
                </div>
                <div className="space-y-1">
                  <h1 className="text-xl font-semibold tracking-tight">Check your inbox</h1>
                  <p className="text-sm text-muted-foreground">
                    If an account exists for <strong>{email.trim()}</strong>, we have sent
                    a password reset link to it.
                  </p>
                </div>
                <div className="rounded-lg bg-muted/60 px-4 py-3 text-xs text-muted-foreground">
                  The link expires in 30 minutes and can only be used once. If you do not
                  see the email, check your spam or promotions folder.
                </div>
                <div className="space-y-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setSent(false);
                      setEmail("");
                    }}
                  >
                    Send another link
                  </Button>
                  <Button asChild variant="ghost" className="w-full">
                    <Link to="/auth">Back to login</Link>
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <h1 className="text-xl font-semibold tracking-tight">Forgot your password?</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Enter the email address linked to your account and we will send you a
                  secure link to reset your password.
                </p>

                <form onSubmit={submit} className="mt-6 space-y-4">
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

                  <Button type="submit" className="w-full" disabled={busy}>
                    {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                    Send reset link
                    {!busy ? <ArrowRight className="ml-2 size-4" /> : null}
                  </Button>
                </form>

                <div className="mt-4 text-center text-sm text-muted-foreground">
                  Remembered your password?{" "}
                  <Link to="/auth" className="font-medium text-foreground hover:text-primary">
                    Log in
                  </Link>
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

