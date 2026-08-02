import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Brand } from "@/components/site/Brand";

const searchSchema = z.object({
  token: z.string().optional(),
});

export const Route = createFileRoute("/reset-password")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Reset Password - BrokeFlex" },
      {
        name: "description",
        content: "Create a new password for your BrokeFlex account using your secure reset link.",
      },
    ],
  }),
  component: ResetPasswordPage,
});

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72)
  .regex(/[A-Z]/, "Password must include an uppercase letter")
  .regex(/[a-z]/, "Password must include a lowercase letter")
  .regex(/[0-9]/, "Password must include a number");

function ResetPasswordPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();

  const [token] = useState<string>(() => search.token ?? "");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const missingToken = !token;

  async function submit(e: React.FormEvent) {
    e.preventDefault();

    if (missingToken) {
      toast.error("This reset link is invalid. Please request a new one.");
      return;
    }

    const parsed = passwordSchema.safeParse(newPassword);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      await apiFetch<{ ok: boolean; message?: string }>("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({
          token,
          new_password: newPassword,
          confirm_password: confirmPassword,
        }),
      });
      setBusy(false);
      setDone(true);
      toast.success("Your password has been reset.");
    } catch (err: any) {
      setBusy(false);
      toast.error(err?.message || "Unable to reset your password. Please try again.");
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
            {missingToken ? (
              <div className="space-y-4 text-center">
                <h1 className="text-xl font-semibold tracking-tight">Invalid reset link</h1>
                <p className="text-sm text-muted-foreground">
                  This password reset link is missing or has expired. Request a new one
                  to continue.
                </p>
                <Button
                  asChild
                  className="w-full"
                  onClick={() => {
                    window.localStorage.removeItem("auth-token");
                  }}
                >
                  <Link to="/auth">Back to login</Link>
                </Button>
              </div>
            ) : done ? (
              <div className="space-y-4 text-center">
                <h1 className="text-xl font-semibold tracking-tight">Password updated</h1>
                <p className="text-sm text-muted-foreground">
                  Your password has been reset. You can now log in with your new
                  password.
                </p>
                <Button
                  asChild
                  className="w-full"
                  onClick={() => {
                    window.localStorage.removeItem("auth-token");
                    navigate({ to: "/auth", replace: true });
                  }}
                >
                  <Link to="/auth">Go to login</Link>
                </Button>
              </div>
            ) : (
              <>
                <h1 className="text-xl font-semibold tracking-tight">Set a new password</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Choose a strong password for your BrokeFlex account.
                </p>

                <form onSubmit={submit} className="mt-6 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">New password</Label>
                    <div className="relative">
                      <Input
                        id="newPassword"
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
                        value={newPassword}
                        maxLength={72}
                        onChange={(e) => setNewPassword(e.target.value)}
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
                    <p className="text-xs text-muted-foreground">
                      Must include an uppercase letter, a lowercase letter, and a number.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm new password</Label>
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

                  <Button type="submit" className="w-full" disabled={busy}>
                    {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                    Reset password
                  </Button>
                </form>
              </>
            )}
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link to="/auth" className="hover:text-foreground">
            ← Back to login
          </Link>
        </p>
      </div>
    </div>
  );
}

