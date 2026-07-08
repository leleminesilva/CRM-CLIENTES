"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import axios from "axios";
import { toast } from "sonner";
import { ArrowLeft, Loader2, ClipboardList, User2, X, Plus, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { type ClienteInput } from "@/lib/validators/cliente";
import { maskCpfCnpj, maskPhone, maskCep } from "@/lib/utils/masks";
import { useAuth } from "@/contexts/AuthContext";
import { SERVICOS } from "@/lib/constants";
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

// ─── Formulário ─────────────────────────────────────────────────────────────
function FormGestor({ cliente, usuarios, onSuccess, userRole }: {
  cliente: Record<string, unknown>;
  usuarios: User[];
  onSuccess: () => void;
  userRole: string;
}) {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [servicosSelecionados, setServicosSelecionados] = useState<string[]>([]);
  const [servicoCustom, setServicoCustom] = useState("");

  const isGestor = userRole === "ADMINISTRADOR" || userRole === "GESTOR";

  const { register, handleSubmit, setValue, watch, reset } = useForm<ClienteInput>({
    defaultValues: { origem: "OUTROS", statusOrcamento: "PENDENTE", temperatura: "MORNO" },
  });

  // Popula o form apenas na primeira carga — refetches automáticos não resetam campos em edição
  const hasPopulated = useRef(false);
  useEffect(() => {
    if (hasPopulated.current) return;
    hasPopulated.current = true;
    const clean = Object.fromEntries(
      Object.entries(cliente).map(([k, v]) => [k, v === null ? undefined : v])
    );
    reset({
      ...clean,
      dataInscricao: (cliente.dataInscricao as string | undefined)?.split("T")[0],
      prazoOrcamento: (cliente.prazoOrcamento as string | undefined)?.split("T")[0],
      valorOrcamento: cliente.valorOrcamento ? Number(cliente.valorOrcamento) : undefined,
    } as ClienteInput);
    const servicos = (cliente.servicoBuscado as string | null) ?? "";
    setServicosSelecionados(servicos ? servicos.split(",").map(s => s.trim()).filter(Boolean) : []);
  }, [cliente, reset]);

  function adicionarServico(servico: string) {
    const s = servico.trim();
    if (!s || servicosSelecionados.includes(s)) return;
    const novo = [...servicosSelecionados, s];
    setServicosSelecionados(novo);
    setValue("servicoBuscado", novo.join(","));
  }

  function removerServico(servico: string) {
    const novo = servicosSelecionados.filter(s => s !== servico);
    setServicosSelecionados(novo);
    setValue("servicoBuscado", novo.join(",") || undefined);
  }

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
    onSuccess: () => {
      toast.success("Cliente atualizado!");
      qc.invalidateQueries({ queryKey: ["clientes"] });
      qc.invalidateQueries({ queryKey: ["cliente", id] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      onSuccess();
    },
    onError: (err) => {
      const msg = axios.isAxiosError(err)
        ? err.response?.data?.error ?? "Erro ao salvar"
        : "Erro ao salvar";
      toast.error(msg);
    },
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
          {/* Vendedor Responsável — só Gestor/Admin pode alterar */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              Vendedor Responsável
              {!isGestor && <Lock className="w-3 h-3 text-muted-foreground" />}
            </Label>
            {isGestor ? (
              <Select onValueChange={v => setValue("responsavelId", v)} value={watch("responsavelId") ?? ""}>
                <SelectTrigger><SelectValue placeholder="Selecione o vendedor" /></SelectTrigger>
                <SelectContent>{usuarios.map(u => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}</SelectContent>
              </Select>
            ) : (
              <div className="flex h-9 w-full items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground">
                {usuarios.find(u => u.id === watch("responsavelId"))?.nome ?? "Não atribuído"}
              </div>
            )}
          </div>

          {/* Serviços Buscados — multi-tag */}
          <div className="space-y-1.5">
            <Label>Serviços Buscados</Label>
            {servicosSelecionados.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pb-1">
                {servicosSelecionados.map(s => (
                  <Badge key={s} variant="secondary" className="gap-1 pr-1">
                    {s}
                    <button type="button" onClick={() => removerServico(s)} className="ml-0.5 rounded hover:bg-destructive/20">
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            <Select onValueChange={v => adicionarServico(v)} value="">
              <SelectTrigger><SelectValue placeholder="Adicionar serviço..." /></SelectTrigger>
              <SelectContent>
                {SERVICOS.filter(s => !servicosSelecionados.includes(s)).map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Input
                placeholder="Outro serviço..."
                value={servicoCustom}
                onChange={e => setServicoCustom(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); adicionarServico(servicoCustom); setServicoCustom(""); } }}
              />
              <Button type="button" size="icon" variant="outline" onClick={() => { adicionarServico(servicoCustom); setServicoCustom(""); }}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <ClipboardList className="w-4 h-4" />Observações
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5">
            <Label>Medidas, detalhes do ambiente, referências e outras observações</Label>
            <Textarea
              {...register("observacoes")}
              placeholder="Ex: Janela 1,20m x 0,90m, ambiente úmido, cliente quer vidro fumê, acesso pelo fundo..."
              rows={5}
            />
          </div>
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
  const { user } = useAuth();
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
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in pb-12">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold">Editar Cliente</h2>
          <p className="text-muted-foreground">{cliente.nome as string}</p>
        </div>
      </div>

      <FormGestor cliente={cliente} usuarios={usuarios ?? []} onSuccess={handleSuccess} userRole={user?.role ?? "COMERCIAL"} />
    </div>
  );
}
