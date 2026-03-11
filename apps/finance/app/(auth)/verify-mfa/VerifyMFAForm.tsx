"use client";

import { type SubmitEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CircleNotchIcon,
  ShieldWarningIcon,
  KeyIcon,
} from "@phosphor-icons/react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

export function VerifyMFAForm() {
  const router = useRouter();
  const [totpCode, setTotpCode] = useState<string>("");
  const [backupCode, setBackupCode] = useState<string>("");
  const [useBackup, setUseBackup] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  async function handleTOTPSubmit() {
    if (totpCode.length !== 6) return;
    setError(null);
    setLoading(true);

    const { error: err } = await authClient.twoFactor.verifyTotp({
      code: totpCode,
    });
    setLoading(false);

    if (err) {
      setError(err.message ?? "Invalid Code.");
      setTotpCode("");
      return;
    }

    router.push("/dashboard");
  }

  async function handleBackupSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!backupCode.trim()) return;
    setError(null);
    setLoading(true);

    const { error: err } = await authClient.twoFactor.verifyBackupCode({
      code: backupCode.trim(),
    });
    setLoading(false);

    if (err) {
      setError(err.message ?? "Invalid backup code");
      return;
    }

    router.push("/dashboard");
  }

  function toggleMode() {
    setUseBackup((v) => !v);
    setError(null);
    setTotpCode("");
    setBackupCode("");
  }

  return (
    <Card className="w-full max-w-lg border-border/40 bg-card/80 backdrop-blur-sm">
      <CardHeader className="pb-2 space-y-0.5">
        <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground/60">
          sys://mfa/verify
        </p>
        <h2 className="text-sm font-mono font-medium text-foreground">
          {useBackup ? "Backup Code" : "Two-Factor Auth"}
        </h2>
        <p className="text-xs font-mono text-muted-foreground pt-1">
          {useBackup
            ? "Enter one of your saved backup codes."
            : "Enter the 6-digit code from your authenticator app."}
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {error && (
          <Alert
            variant="destructive"
            className="py-2.5 border-destructive/50 bg-destructive/10"
          >
            <ShieldWarningIcon className="h-3.5 w-3.5 shrink-0" weight="bold" />
            <AlertDescription className="text-xs font-mono ml-2">
              {error}
            </AlertDescription>
          </Alert>
        )}

        {useBackup ? (
          <form onSubmit={handleBackupSubmit} className="space-y-3">
            <Input
              type="text"
              autoFocus
              placeholder="XXXX-XXXX-XXXX"
              value={backupCode}
              onChange={(e) => setBackupCode(e.target.value)}
              className="font-mono text-sm h-9 bg-backgrond/40 border-border/50 focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary/30 text-center tracking-widest"
            />
            <Button
              type="submit"
              disabled={loading || !backupCode.trim()}
              className="w-full h-9 font-mono text-xs uppercase tracking-widest"
            >
              {loading ? (
                <>
                  <CircleNotchIcon className="h-3.5 w-3.5 animate-spin mr-2" />
                  Verifying...
                </>
              ) : (
                "Verify Backup Code"
              )}
            </Button>
          </form>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <InputOTP
              maxLength={6}
              value={totpCode}
              onChange={setTotpCode}
              onComplete={handleTOTPSubmit}
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>

            <Button
              onClick={handleTOTPSubmit}
              disabled={loading || totpCode.length !== 6}
              className="w-full h-9 font-mono text-xs uppercase tracking-widest"
            >
              {loading ? (
                <>
                  <CircleNotchIcon className="h-3.5 w-3.5 animate-spin mr-2" />
                  Verifying...
                </>
              ) : (
                "Verify"
              )}
            </Button>
          </div>
        )}

        <button
          type="button"
          onClick={toggleMode}
          className="w-full text-[10px] font-mono text-muted-foreground hover:text-primary flex items-center justify-center gap-1.5 transition-colors pt-1"
        >
          <KeyIcon className="h-3 w-3" />
          {useBackup ? "Use authenticator app instead." : "Ue a backup code."}
        </button>
      </CardContent>
    </Card>
  );
}
