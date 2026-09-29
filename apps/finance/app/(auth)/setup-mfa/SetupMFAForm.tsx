"use client";

import { type SubmitEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import {
  CircleNotchIcon,
  ShieldWarningIcon,
  ShieldCheckIcon,
  QrCodeIcon,
  KeyIcon,
  CopySimpleIcon,
} from "@phosphor-icons/react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

type Stage = "password" | "provision";

export function SetupMFAFom() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("password");
  const [password, setPassword] = useState<string>("");
  const [totpUri, setTotpUri] = useState<string>("");
  const [backupCodes, setBackupCode] = useState<string[]>([]);
  const [otpCode, setOtpCode] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  async function handlePasswordSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!password) return;
    setError(null);
    setLoading(true);

    const { data, error: err } = await authClient.twoFactor.enable({
      password,
    });
    setLoading(false);

    if (err || !data) {
      setError(
        err?.message ?? "Failed to initialize MFA. Check your password.",
      );
      return;
    }

    setTotpUri(data.totpURI);
    setBackupCode(data.backupCodes);
    setStage("provision");
  }

  async function handleOTPSubmit() {
    if (otpCode.length !== 6) return;
    setError(null);
    setLoading(true);

    const { error: err } = await authClient.twoFactor.verifyTotp({
      code: otpCode,
    });
    setLoading(false);

    if (err) {
      setError(err?.message ?? "Invalid code. Try again.");
      setOtpCode("");
      return;
    }

    router.push("/dashboard");
  }

  function copyBackupCode() {
    void navigator.clipboard.writeText(backupCodes.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const manualKey = totpUri
    ? (new URLSearchParams(totpUri.split("?")[1]).get("secret") ?? "")
    : "";

  if (stage === "password") {
    return (
      <Card className="w-full max-w-lg border-border/40 bg-card/80 backdrop-blur-sm">
        <CardHeader className="pb-2 space-y-0.5">
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground/60">
            sys://mfa/setup
          </p>
          <h2 className="text-sm font-mono font-medium text-foreground">
            Set up Two-Factor Auth
          </h2>
          <p className="text-xs font-mono font-medium text-foreground pt-1">
            Confirm your password to generate your authenticator key.
          </p>
        </CardHeader>

        <CardContent>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            {error && (
              <Alert
                variant="destructive"
                className="py-2.5 border-destructive/50 bg-destructive/10"
              >
                <ShieldWarningIcon
                  className="h-3.5 w-3.5 shrink-0"
                  weight="bold"
                />
                <AlertDescription className="text-xs font-mono ml-2">
                  {error}
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-1.5">
              <Label
                htmlFor="setup-password"
                className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground"
              >
                Password
              </Label>
              <Input
                id="setup-password"
                type="password"
                autoFocus
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="font-mono text-sm h-9 bg-background/40 border-border/50 focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary/30"
              />
            </div>

            <Button
              type="submit"
              disabled={loading || !password}
              className="w-full h-9 font-mono text-xs uppercase tracking-widest mt-1"
            >
              {loading ? (
                <>
                  <CircleNotchIcon className="h-3.5 w-3.5 animate-spin mr-2" />
                  Generating...
                </>
              ) : (
                <>
                  <QrCodeIcon className="h-3.5 w-3.5 mr-2" />
                  Generate QR Code
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-lg border-border/40 bg-card/80 backdrop-blur-sm">
      <CardHeader className="pb-2 space-y-0.5">
        <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground/60">
          sys://mfa/provision
        </p>
        <h2 className="text-sm font-mono font-medium text-foreground">
          Scan and Confirm
        </h2>
      </CardHeader>

      <CardContent>
        {/* QR Code */}
        <div className="flex flex-col items-center gap-3">
          <div className="p-3 bg-white rounded-md">
            <QRCodeSVG value={totpUri} size={160} />
          </div>
          <div className="w-full">
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">
              Manual Key
            </p>
            <p className="font-mono text-xs text-foreground/80 break-all bg-background/40 border border-border/40 rounded p-2 select-all">
              {manualKey}
            </p>
          </div>
        </div>

        {/* Backup Codes */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
              <KeyIcon className="h-3 w-3" />
              Backup Codes
            </p>
            <button
              type="button"
              onClick={copyBackupCode}
              className="text-[10px] font-mono text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
            >
              <CopySimpleIcon className="h-3 w-3" />
              {copied ? "Copied!" : "Copy all"}
            </button>
          </div>
          <div className="bg-background/40 border border-border/40 rounded p-2 grid grid-cols-2 gap-y-1 gap-x-2">
            {backupCodes.map((code) => (
              <p
                key={code}
                className="font-mono text-xs text-foreground/60 select-all"
              >
                {code}
              </p>
            ))}
          </div>
          <p className="text-[10px] font-mono text-destructive/80 mt-1.5">
            Save these now. They will not be shown again.
          </p>
        </div>

        {/* OTP Confirmation */}
        <div className="space-y-2">
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            Enter Code to Activate
          </p>
          {error && (
            <Alert
              variant="destructive"
              className="py-2 border-destructive/50 bg-destructive/10"
            >
              <ShieldWarningIcon
                className="h-3.5 w-3.5 shrink-0"
                weight="bold"
              />
              <AlertDescription className="text-sm font-mono ml-2">
                {error}
              </AlertDescription>
            </Alert>
          )}
          <div className="flex flex-col items-center gap-3">
            <InputOTP
              maxLength={6}
              value={otpCode}
              onChange={setOtpCode}
              onComplete={handleOTPSubmit}
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
              onClick={handleOTPSubmit}
              disabled={loading || otpCode.length !== 6}
              className="w-full h-9 font-mono text-xs uppercase tracking-widest"
            >
              {loading ? (
                <>
                  <CircleNotchIcon className="h-3.5 w-3.5 animate-spin mr-2" />
                  Activating...
                </>
              ) : (
                <>
                  <ShieldCheckIcon className="h-3.5 w-3.5 mr-2" />
                  Enable 2FA
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
