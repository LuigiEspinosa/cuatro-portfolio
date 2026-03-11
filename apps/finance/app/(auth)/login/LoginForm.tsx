"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  CircleNotchIcon,
  ShieldWarningIcon,
  ArrowRightIcon,
} from "@phosphor-icons/react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

const schema = z.object({
  email: z.email("Invalid email"),
  password: z.string().min(4, "Pasword required"),
});
type FormValues = z.infer<typeof schema>;

export function LoginForm() {
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    setServerError(null);
    const { error } = await authClient.signIn.email({
      email: values.email,
      password: values.password,
      callbackURL: "/dashboard",
    });
    if (error) {
      setServerError(error.message ?? "Authentication failed");
    }
  }

  return (
    <Card className="w-full max-w-m border-border/40 bg-card/80 backdrop-blur-sm">
      <CardHeader className="pb-2 space-y-0.5">
        <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground/60">
          sys://auth
        </p>
        <h2 className="text-sm font-mono font-medium text-foreground">
          Authentication Required
        </h2>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {serverError && (
            <Alert
              variant="destructive"
              className="py-2.5 border-destructive/50 bg-destructive/10"
            >
              <ShieldWarningIcon className="h-3.5 w-3.5 shrink-0" />
              <AlertDescription className="text-xs font-mono ml-2">
                {serverError}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-1.5">
            <Label
              htmlFor="email"
              className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground"
            >
              Email
            </Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              autoFocus
              placeholder="admin@localhost"
              className="font-mono text-sm h-9 bg-background/40 border-border/50 focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary/30"
              {...register("email")}
            />
            {errors.email && (
              <p className="text-[10px] font-mono text-destructive">
                {errors.email.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="password"
              className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground"
            >
              Password
            </Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="****"
              className="font-mono text-sm h-9 bg-background/40 border-border/50 focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary/30"
              {...register("password")}
            />
            {errors.password && (
              <p className="text-[10px] font-mono text-destructive">
                {errors.password.message}
              </p>
            )}
          </div>

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-9 font-mono text-xs uppercase tracking-widest mt-1"
          >
            {isSubmitting ? (
              <>
                <CircleNotchIcon className="h-3.5 w-3.5 animate-spin mr-2" />
                Verifying...
              </>
            ) : (
              <>
                Sign In
                <ArrowRightIcon className="h-3.5 w-3.5 ml-2" />
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
