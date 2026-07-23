"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Recycle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils/cn";

type TipoSobra = "ALUMINIO" | "VIDRO" | "OUTRO";

const TIPO_LABELS: Record<TipoSobra, string> = {
  ALUMINIO: "Alumínio",
  VIDRO: "Vidro",
  OUTRO: "Outro",
};

interface Sobra {
  id: string;
  tipo: TipoSobra;
  descricao: string | null;
  larguraMm: number | null;
  alturaMm: number | null;
  comprimentoMm: number | null;
  disponivel: boolean;
}

const emptyForm = { tipo: "ALUMINIO" as TipoSobra, descricao: "", larguraMm: "", alturaMm: "", comprimentoMm: "", disponivel: true };

function SobraFormDialog({
  trigger, title, defaultValues, onSubmit, isPending,
}: {
  trigger: React.ReactNode;
  title: string;
  defaultValues?: Partial<typeof emptyForm>;
  onSubmit: (values: typeof emptyForm) => void;
  isPending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm, ...defaultValues });

  const handleOpen = (v: boolean) => {
    if (v) setForm({ ...emptyForm, ...defaultValues });
    setOpen(v);
  };

  const valid = form.tipo === "VIDRO" ? !!form.larguraMm && !!form.alturaMm : !!form.comprimentoMm;

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Tipo *</Label>
            <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v as TipoSobra }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(TIPO_LABELS) as TipoSobra[]).map(t => <SelectItem key={t} value={t}>{TIPO_LABELS[t]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {form.tipo === "VIDRO" ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Largura (mm) *</Label><Input type="number" min={0} value={form.larguraMm} onChange={e => setForm(f => ({ ...f, larguraMm: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Altura (mm) *</Label><Input type="number" min={0} value={form.alturaMm} onChange={e => setForm(f => ({ ...f, alturaMm: e.target.value }))} /></div>
            </div>
          ) : (
            <div className="space-y-1.5"><Label>Comprimento (mm) *</Label><Input type="number" min={0} value={form.comprimentoMm} onChange={e => setForm(f => ({ ...f, comprimentoMm: e.target.value }))} /></div>
          )}

          <div className="space-y-1.5">
            <Label>Descrição (opcional)</Label>
            <Input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Ex: Perfil branco 25mm" />
          </div>

          <div className="flex items-center justify-between">
            <Label>Disponível para reaproveitar</Label>
            <Switch checked={form.disponivel} onCheckedChange={v => setForm(f => ({ ...f, disponivel: v }))} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => { onSubmit(form); setOpen(false); }} disabled={!valid || isPending}>
              {isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function SobrasMaterialPage() {
  const qc = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<Sobra | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["sobras-material"],
    queryFn: async () => { const { data } = await axios.get("/api/orcamentos-tecnicos/sobras-material"); return data.data as Sobra[]; },
  });

  const sobras = data ?? [];

  const createMutation = useMutation({
    mutationFn: (values: typeof emptyForm) => axios.post("/api/orcamentos-tecnicos/sobras-material", {
      ...values,
      larguraMm: values.larguraMm ? Number(values.larguraMm) : null,
      alturaMm: values.alturaMm ? Number(values.alturaMm) : null,
      comprimentoMm: values.comprimentoMm ? Number(values.comprimentoMm) : null,
    }),
    onSuccess: () => { toast.success("Sobra cadastrada"); qc.invalidateQueries({ queryKey: ["sobras-material"] }); },
    onError: () => toast.error("Erro ao cadastrar sobra"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...values }: { id: string } & Partial<typeof emptyForm>) => axios.put(`/api/orcamentos-tecnicos/sobras-material/${id}`, {
      ...values,
      larguraMm: values.larguraMm !== undefined ? (values.larguraMm ? Number(values.larguraMm) : null) : undefined,
      alturaMm: values.alturaMm !== undefined ? (values.alturaMm ? Number(values.alturaMm) : null) : undefined,
      comprimentoMm: values.comprimentoMm !== undefined ? (values.comprimentoMm ? Number(values.comprimentoMm) : null) : undefined,
    }),
    onSuccess: () => { toast.success("Sobra atualizada"); qc.invalidateQueries({ queryKey: ["sobras-material"] }); },
    onError: () => toast.error("Erro ao atualizar sobra"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => axios.delete(`/api/orcamentos-tecnicos/sobras-material/${id}`),
    onSuccess: () => { toast.success("Sobra removida"); qc.invalidateQueries({ queryKey: ["sobras-material"] }); setDeleteTarget(null); },
    onError: () => toast.error("Erro ao remover sobra"),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold">Sobras de Material</h2>
          <p className="text-sm text-muted-foreground">Cadastro manual de sobras de alumínio e retalhos de vidro pra reaproveitar</p>
        </div>
        <SobraFormDialog
          title="Nova sobra"
          trigger={<Button size="sm"><Plus className="w-4 h-4 mr-2" />Nova sobra</Button>}
          onSubmit={values => createMutation.mutate(values)}
          isPending={createMutation.isPending}
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-32 bg-muted animate-pulse rounded-xl" />)}
        </div>
      ) : sobras.length === 0 ? (
        <Card className="p-12 text-center">
          <Recycle className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
          <p className="font-medium text-muted-foreground">Nenhuma sobra cadastrada</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sobras.map(s => (
            <Card key={s.id} className={cn("p-4", !s.disponivel && "opacity-50")}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{TIPO_LABELS[s.tipo]}</Badge>
                    {!s.disponivel && <Badge variant="secondary" className="text-xs">Usada</Badge>}
                  </div>
                  <p className="text-sm font-medium mt-1 truncate">{s.descricao || "Sem descrição"}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {s.tipo === "VIDRO" ? `${s.larguraMm}×${s.alturaMm}mm` : s.comprimentoMm ? `${s.comprimentoMm}mm` : "—"}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <SobraFormDialog
                    title="Editar sobra"
                    defaultValues={{
                      tipo: s.tipo,
                      descricao: s.descricao ?? "",
                      larguraMm: s.larguraMm ? String(s.larguraMm) : "",
                      alturaMm: s.alturaMm ? String(s.alturaMm) : "",
                      comprimentoMm: s.comprimentoMm ? String(s.comprimentoMm) : "",
                      disponivel: s.disponivel,
                    }}
                    trigger={<Button variant="ghost" size="icon" className="h-7 w-7"><Pencil className="w-3.5 h-3.5" /></Button>}
                    onSubmit={values => updateMutation.mutate({ id: s.id, ...values })}
                    isPending={updateMutation.isPending}
                  />
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600" onClick={() => setDeleteTarget(s)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t">
                <span className="text-xs text-muted-foreground">Disponível</span>
                <Switch
                  checked={s.disponivel}
                  onCheckedChange={v => updateMutation.mutate({ id: s.id, disponivel: v })}
                />
              </div>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={v => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover sobra?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}>
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
