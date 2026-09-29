"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { BankAccount } from "@/generated/prisma/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

const FormSchema = z.object({
  name: z.string().min(1, "Required"),
  institution: z.string().min(1, "Required"),
});

type FormValues = z.infer<typeof FormSchema>;

interface EditAccountModalProps {
  account: BankAccount;
  open: boolean;
  onClose: () => void;
}

export function EditAccountModal({
  account,
  open,
  onClose,
}: EditAccountModalProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // Delete confirmation state
  const [deletePhase, setDeletePhase] = useState<null | "confirm">(null);
  const [deleteInput, setDeleteInput] = useState("");

  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      name: account.name,
      institution: account.institution,
    },
  });

  async function onSubmit(values: FormValues) {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/accounts/${account.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Error al actualizar la cuenta");
        return;
      }
      onClose();
      router.refresh();
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    setLoading(true);
    try {
      const res = await fetch(`/api/accounts/${account.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Error al eliminar la cuenta");
        return;
      }
      onClose();
      router.push("/accounts");
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
          <DialogTitle>Editar cuenta</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-1">
            <Label>Nombre</Label>
            <Input {...form.register("name")} />
          </div>
          <div className="space-y-1">
            <Label>Institución</Label>
            <Input {...form.register("institution")} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="submit" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </form>

        <div className="border-t border-border pt-4 mt-2">
          {deletePhase === null ? (
            <Button
              variant="ghost"
              size="sm"
              className="text-red-500 hover:text-red-400 hover:bg-red-950/30"
              onClick={() => setDeletePhase("confirm")}
            >
              Eliminar cuenta
            </Button>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Escribe{" "}
                <span className="font-semibold text-foreground">
                  {account.name}
                </span>{" "}
                para confirmar.
              </p>
              <Input
                value={deleteInput}
                onChange={(e) => setDeleteInput(e.target.value)}
                placeholder={account.name}
              />
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setDeletePhase(null);
                    setDeleteInput("");
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={deleteInput !== account.name || loading}
                  onClick={handleDelete}
                >
                  {loading ? "Eliminando..." : "Eliminar"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
