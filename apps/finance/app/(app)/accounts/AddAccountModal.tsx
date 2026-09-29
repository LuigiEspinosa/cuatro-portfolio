"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { money } from "@/lib/money";
import Decimal from "decimal.js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";

const FormSchema = z.object({
  name: z.string().min(1, "Required"),
  institution: z.string().min(1, "Required"),
  type: z.enum([
    "SAVINGS",
    "CHECKING",
    "CREDIT_CARD",
    "LOAN",
    "MORTGAGE",
    "AFC",
    "INVESTMENT",
    "CRYPTO",
  ]),
  currency: z.enum(["COP", "USD", "EUR", "BTC", "ETH", "USDT", "UVR"]),
  balance: z.string().min(1, "Required"),
  is_afc: z.boolean(),
  is_uvr_mortgage: z.boolean(),
  uvr_balance: z.string().optional(),
});

type FormValues = z.infer<typeof FormSchema>;

interface AddAccountModalProps {
  open: boolean;
  onClose: () => void;
}

export function AddAccountModal({ open, onClose }: AddAccountModalProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      currency: "COP",
      type: "SAVINGS",
      is_afc: false,
      is_uvr_mortgage: false,
    },
  });

  const isUVR = form.watch("is_uvr_mortgage");

  async function onSubmit(values: FormValues) {
    setError(null);
    setLoading(true);

    try {
      const balance_centavos = money.toCentavos(
        new Decimal(
          values.balance.replace(/[.,]/g, (m) => (m === "." ? "" : ".")),
        ),
      );
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name,
          institution: values.institution,
          type: values.type,
          currency: values.currency,
          balance_centavos: balance_centavos.toString(),
          is_afc: values.is_afc,
          is_uvr_mortgage: values.is_uvr_mortgage,
          uvr_balance: values.uvr_balance || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Error al crear la cuenta");
        return;
      }

      form.reset();
      onClose();
      router.refresh();
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Agregar cuenta</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Nombre</Label>
              <Input {...form.register("name")} placeholder="Cuenta ahorros" />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>
            <div className="space-y-1">
              <Label>Entidad</Label>
              <Input
                {...form.register("institution")}
                placeholder="Bancolombia"
              />
              {form.formState.errors.institution && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.institution.message}
                </p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Tipo</Label>
              <Select
                value={form.watch("type")}
                onValueChange={(v) =>
                  form.setValue("type", v as FormValues["type"])
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SAVINGS">Ahorros</SelectItem>
                  <SelectItem value="CHECKING">Corriente</SelectItem>
                  <SelectItem value="CREDIT_CARD">
                    Tarjeta de crédito
                  </SelectItem>
                  <SelectItem value="LOAN">Crédito</SelectItem>
                  <SelectItem value="MORTGAGE">Hipoteca</SelectItem>
                  <SelectItem value="AFC">AFC</SelectItem>
                  <SelectItem value="INVESTMENT">Inversión</SelectItem>
                  <SelectItem value="CRYPTO">Crypto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Moneda</Label>
              <Select
                value={form.watch("currency")}
                onValueChange={(v) =>
                  form.setValue("currency", v as FormValues["currency"])
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="COP">COP</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Saldo inicial (en pesos)</Label>
            <Input {...form.register("balance")} placeholder="4250000" />
          </div>
          {isUVR && (
            <div className="space-y-1">
              <Label>Balance UVR</Label>
              <Input {...form.register("uvr_balance")} placeholder="1842.30" />
            </div>
          )}
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" {...form.register("is_afc")} />
              Cuenta AFC
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" {...form.register("is_uvr_mortgage")} />
              Hipoteca UVR
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
