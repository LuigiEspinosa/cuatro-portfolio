import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Cuatro Finance
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Personal Finances</p>
      </div>
      {children}
    </div>
  );
}
