"use client";

import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import axios from "axios";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const schema = z.object({
  titulo: z.string().min(2),
  descricao: z.string().optional(),
  valor: z.coerce.number().min(0),
  probabilidade: z.coerce.number().min(0).max(100).default(50),
  dataPrevisao: z.string().optional(),
  clienteId: z.string().optional(),
  responsavelId: z.string().optional(),
  status: z.string().default("ABERTA"),
});
type FormData = z.infer<typeof schema>;

export default function NovaOportunidadePage() {
  const router = useRouter();

  const { data: clientes } = useQuery({
    queryKey: ["clientes-select"],
    queryFn: async () => {
      const { data } = await axios.get("/api/clientes?limit=100");
      return data.data as Array<{ id: string; nome: string }>;
    },
  });

  const { data: usuarios } = useQuery({
    queryKey: ["usuarios-select"],
    queryFn: async () => {
      const { data } = await axios.get("/api/usuarios");
      return data.data as Array<{ id: string; nome: string }>;
    },
  });

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { probabilidade: 50, status: "ABERTA" },
  });

  const probabilidade = watch("probabilidade");

  const mutation = useMutation({
    mutationFn: (data: FormData) => axios.post("/api/oportunidades", data),
    onSuccess: () => { toast.success("Oportunidade criada!"); router.push("/oportunidades"); },
    onError: () => toast.error("Erro ao criar oportunidade"),
  });

  return (
    <div className="max-w-2xl space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold">Nova Oportunidade</h2>
          <p className="text-muted-foreground">Cadastre uma nova oportunidade de venda</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Informações Gerais</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Título *</Label>
              <Input {...register("titulo")} placeholder="Ex: Proposta de software para empresa X" />
              {errors.titulo && <p className="text-xs text-destructive">{errors.titulo.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Textarea {...register("descricao")} rows={3} placeholder="Detalhe a oportunidade..." />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Valor (R$) *</Label>
                <Input {...register("valor")} type="number" step="0.01" min="0" placeholder="0,00" />
                {errors.valor && <p className="text-xs text-destructive">{errors.valor.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label>Previsão de Fechamento</Label>
                <Input {...register("dataPrevisao")} type="date" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Probabilidade de Fechamento: {probabilidade}%</Label>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={probabilidade}
                onChange={e => setValue("probabilidade", Number(e.target.value))}
                className="w-full accent-indigo-600"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>0%</span>
                <span>50%</span>
                <span>100%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Vínculos</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Cliente</Label>
              <Select onValueChange={v => setValue("clienteId", v)}>
                <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  {(clientes || []).map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Responsável</Label>
              <Select onValueChange={v => setValue("responsavelId", v)}>
                <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  {(usuarios || []).map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select defaultValue="ABERTA" onValueChange={v => setValue("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ABERTA">Aberta</SelectItem>
                  <SelectItem value="GANHA">Ganha</SelectItem>
                  <SelectItem value="PERDIDA">Perdida</SelectItem>
                  <SelectItem value="SUSPENSA">Suspensa</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3 justify-end">
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancelar</Button>
          <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700" disabled={mutation.isPending}>
            {mutation.isPending ? "Criando..." : "Criar Oportunidade"}
          </Button>
        </div>
      </form>
    </div>
  );
}
