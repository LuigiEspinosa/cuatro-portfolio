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
  amount: z.string().min(1, "Required"),
  type: z.enum(["DEBIT", "CREDIT"]),
  description: z.string().min(1, "Required").max(500),
  transacted_at: z.string().min(1, "Required"),
  notes: z.string().max(1000).optional(),
});

type FormValues = z.infer<typeof FormSchema>;

interface AddTransactionModalProps {
  accountId: string;
  open: boolean;
  onClose: () => void;
}

export function AddTransactionModal({
  accountId,
  open,
  onClose,
}: AddTransactionModalProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const today = new Date().toISOString().split("T")[0];

  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: { type: "DEBIT", transacted_at: today },
  });

  async function onSubmit(values: FormValues) {
    setError(null);
    setLoading(true);
    try {
      const amount_centavos = money.toCentavos(new Decimal(values.amount));
      const res = await fetch(`/api/accounts/${accountId}/transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount_centavos: amount_centavos.toString(),
          currency: "COP",
          description: values.description,
          type: values.type,
          transacted_at: new Date(values.transacted_at).toISOString(),
          notes: values.notes || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Error al guardar la transacción");
        return;
      }
      form.reset({ type: "DEBIT", transacted_at: today });
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
          <DialogTitle>Agregar transacción</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Monto (pesos)</Label>
              <Input {...form.register("amount")} placeholder="45000" />
            </div>
            <div className="space-y-1">
              <Label>Tipo</Label>
              <Select
                value={form.watch("type")}
                onValueChange={(v) =>
                  form.setValue("type", v as "DEBIT" | "CREDIT")
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DEBIT">Débito (salida)</SelectItem>
                  <SelectItem value="CREDIT">Crédito (entrada)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Description</Label>
            <Input
              {...form.register("description")}
              placeholder="Comida, Nómina..."
            />
          </div>
          <div className="space-y-1">
            <Label>Notas (opcional)</Label>
            <Input {...form.register("notes")} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="button" disabled={loading}>
              {loading ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
