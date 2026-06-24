"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";
import { toast } from "sonner";
import { ArrowLeft, Loader2, ClipboardList, FileText, CheckCircle, User2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { clienteSchema, type ClienteInput } from "@/lib/validators/cliente";
import { maskCpfCnpj, maskPhone, maskCep } from "@/lib/utils/masks";
import type { User } from "@/types";

const ORIGENS = [
  { value: "INDICACAO", label: "Indicação" },
  { value: "SITE", label: "Site" },
  { value: "REDES_SOCIAIS", label: "Redes Sociais" },
  { value: "GOOGLE_ADS", label: "Google Ads" },
  { value: "EVENTO", label: "Evento" },
  { value: "LIGACAO_ATIVA", label: "Ligação Ativa" },
  { value: "PARCEIRO", label: "Parceiro" },
  { value: "OUTROS", label: "Outros" },
];

const SERVICOS = [
  "Box de banheiro", "Espelho", "Janela de vidro", "Porta de vidro",
  "Fachada", "Guarda-corpo", "Pergolado de vidro", "Vitrine", "Divisória", "Outros",
];

// ─── Formulário exclusivo para Gestor/Admin (todos os campos) ───────────────
function FormGestor({ cliente, usuarios, onSuccess }: {
  cliente: Record<string, unknown>;
  usuarios: User[];
  onSuccess: () => void;
}) {
  const { id } = useParams<{ id: string }>();
  const [buscandoCep, setBuscandoCep] = useState(false);

  const { register, handleSubmit, setValue, watch, reset } = useForm<ClienteInput>({
    resolver: zodResolver(clienteSchema),
    defaultValues: { origem: "OUTROS", statusOrcamento: "PENDENTE", temperatura: "MORNO" },
  });

  useEffect(() => {
    const clean = Object.fromEntries(
      Object.entries(cliente).map(([k, v]) => [k, v === null ? undefined : v])
    );
    reset({
      ...clean,
      dataInscricao: (cliente.dataInscricao as string | undefined)?.split("T")[0],
      prazoOrcamento: (cliente.prazoOrcamento as string | undefined)?.split("T")[0],
      valorOrcamento: cliente.valorOrcamento ? Number(cliente.valorOrcamento) : undefined,
    } as ClienteInput);
  }, [cliente, reset]);

  async function buscarCep(cepValue: string) {
    const clean = cepValue.replace(/\D/g, "");
    if (clean.length !== 8) return;
    setBuscandoCep(true);
    try {
      const resp = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const data = await resp.json();
      if (!data.erro) {
        setValue("logradouro", data.logradouro);
        setValue("bairro", data.bairro);
        setValue("cidade", data.localidade);
        setValue("estado", data.uf);
      }
    } finally { setBuscandoCep(false); }
  }

  const mutation = useMutation({
    mutationFn: (data: ClienteInput) => axios.put(`/api/clientes/${id}`, data),
    onSuccess: () => { toast.success("Cliente atualizado!"); onSuccess(); },
    onError: () => toast.error("Erro ao atualizar"),
  });

  const cpfCnpjVal = watch("cpfCnpj") ?? "";
  const telefoneVal = watch("telefone") ?? "";
  const whatsappVal = watch("whatsapp") ?? "";
  const cepVal = watch("cep") ?? "";

  return (
    <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-6">
      {/* Etapa 1 */}
      <div className="flex items-center gap-3 pt-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white shrink-0">1</div>
        <div><p className="font-semibold">Dados do Cliente</p><p className="text-xs text-muted-foreground">Informações básicas</p></div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><User2 className="w-4 h-4" />Dados Pessoais</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2 space-y-1.5"><Label>Nome *</Label><Input {...register("nome")} /></div>
          <div className="space-y-1.5"><Label>CPF / CNPJ</Label><Input value={cpfCnpjVal} onChange={e => setValue("cpfCnpj", maskCpfCnpj(e.target.value))} placeholder="000.000.000-00" /></div>
          <div className="space-y-1.5"><Label>Data de Inscrição</Label><Input type="date" {...register("dataInscricao")} /></div>
          <div className="space-y-1.5"><Label>Telefone</Label><Input value={telefoneVal} onChange={e => setValue("telefone", maskPhone(e.target.value))} placeholder="(47) 3456-7890" /></div>
          <div className="space-y-1.5"><Label>WhatsApp</Label><Input value={whatsappVal} onChange={e => setValue("whatsapp", maskPhone(e.target.value))} placeholder="(47) 98765-4321" /></div>
          <div className="space-y-1.5"><Label>E-mail</Label><Input {...register("email")} type="email" /></div>
          <div className="space-y-1.5">
            <Label>Origem</Label>
            <Select onValueChange={v => setValue("origem", v as ClienteInput["origem"])} value={watch("origem")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{ORIGENS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Endereço</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label>Tipo de Imóvel</Label>
            <Select onValueChange={v => setValue("tipoResidencia", v as ClienteInput["tipoResidencia"])} value={watch("tipoResidencia") ?? ""}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="CASA">🏠 Casa</SelectItem>
                <SelectItem value="APARTAMENTO">🏢 Apartamento</SelectItem>
                <SelectItem value="COMERCIAL">🏪 Comercial</SelectItem>
                <SelectItem value="OUTROS">📍 Outros</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>CEP</Label>
            <div className="relative">
              <Input value={cepVal} placeholder="00000-000" onChange={e => { const m = maskCep(e.target.value); setValue("cep", m); buscarCep(m); }} />
              {buscandoCep && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />}
            </div>
          </div>
          <div className="space-y-1.5"><Label>Logradouro</Label><Input {...register("logradouro")} /></div>
          <div className="space-y-1.5"><Label>Número</Label><Input {...register("numero")} /></div>
          <div className="space-y-1.5"><Label>Complemento</Label><Input {...register("complemento")} placeholder="Apto 201, Bloco B..." /></div>
          <div className="space-y-1.5"><Label>Bairro</Label><Input {...register("bairro")} /></div>
          <div className="space-y-1.5"><Label>Cidade</Label><Input {...register("cidade")} /></div>
          <div className="space-y-1.5"><Label>Estado</Label><Input {...register("estado")} maxLength={2} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><ClipboardList className="w-4 h-4" />Atendimento</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Vendedor Responsável</Label>
            <Select onValueChange={v => setValue("responsavelId", v)} value={watch("responsavelId") ?? ""}>
              <SelectTrigger><SelectValue placeholder="Selecione o vendedor" /></SelectTrigger>
              <SelectContent>{usuarios.map(u => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Serviço Buscado</Label>
            <Select onValueChange={v => setValue("servicoBuscado", v)} value={watch("servicoBuscado") ?? ""}>
              <SelectTrigger><SelectValue placeholder="Selecione o serviço" /></SelectTrigger>
              <SelectContent>{SERVICOS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Etapas 2 e 3 */}
      <div className="flex items-center gap-3 pt-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500 text-sm font-bold text-white shrink-0">2</div>
        <div><p className="font-semibold">Orçamento</p></div>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><FileText className="w-4 h-4" />Dados do Orçamento</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5"><Label>Número do Orçamento</Label><Input {...register("numeroOrcamento")} placeholder="ORC-001" /></div>
          <div className="space-y-1.5"><Label>Valor (R$)</Label><Input type="number" step="0.01" {...register("valorOrcamento")} placeholder="0,00" /></div>
          <div className="space-y-1.5"><Label>Prazo da Proposta</Label><Input type="date" {...register("prazoOrcamento")} /></div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3 pt-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white shrink-0">3</div>
        <div><p className="font-semibold">Acompanhamento</p></div>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><CheckCircle className="w-4 h-4" />Status e Observações</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Status do Orçamento</Label>
            <Select onValueChange={v => setValue("statusOrcamento", v as ClienteInput["statusOrcamento"])} value={watch("statusOrcamento")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PENDENTE">⏳ Pendente</SelectItem>
                <SelectItem value="APROVADO">✅ Aprovado</SelectItem>
                <SelectItem value="NAO_APROVADO">❌ Não Aprovado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Temperatura</Label>
            <Select onValueChange={v => setValue("temperatura", v as ClienteInput["temperatura"])} value={watch("temperatura")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="QUENTE">🔥 Quente</SelectItem>
                <SelectItem value="MORNO">➖ Morno</SelectItem>
                <SelectItem value="FRIO">❄️ Frio</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2 space-y-1.5"><Label>Observações</Label><Textarea {...register("observacoes")} rows={4} placeholder="Observações sobre o atendimento..." /></div>
        </CardContent>
      </Card>

      <div className="flex gap-3 justify-end pb-8">
        <Button type="button" variant="outline" onClick={onSuccess}>Cancelar</Button>
        <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 min-w-[160px]" disabled={mutation.isPending}>
          {mutation.isPending ? "Salvando..." : "Salvar Alterações"}
        </Button>
      </div>
    </form>
  );
}

// ─── Página principal ────────────────────────────────────────────────────────
export default function EditarClientePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: cliente, isLoading } = useQuery({
    queryKey: ["cliente", id],
    queryFn: async () => {
      const { data } = await axios.get(`/api/clientes/${id}`);
      return data.data as Record<string, unknown>;
    },
  });

  const { data: usuarios } = useQuery({
    queryKey: ["usuarios-select"],
    queryFn: async () => {
      const { data } = await axios.get("/api/usuarios/ativos");
      return data.data as User[];
    },
  });

  const handleSuccess = () => router.push(`/clientes/${id}`);

  if (isLoading || !cliente) {
    return (
      <div className="space-y-4 animate-pulse max-w-4xl mx-auto">
        <div className="h-8 bg-muted rounded w-1/3" />
        <div className="h-48 bg-muted rounded-xl" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold">Editar Cliente</h2>
          <p className="text-muted-foreground">{cliente.nome as string}</p>
        </div>
      </div>

      <FormGestor cliente={cliente} usuarios={usuarios ?? []} onSuccess={handleSuccess} />
    </div>
  );
}
