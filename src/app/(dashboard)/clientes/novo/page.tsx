"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import { ArrowLeft, Search, User2, ClipboardList, Info } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export default function NovoClientePage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [buscandoCEP, setBuscandoCEP] = useState(false);

  const { data: usuarios } = useQuery({
    queryKey: ["usuarios-select"],
    queryFn: async () => {
      const { data } = await axios.get("/api/usuarios/ativos");
      return data.data as User[];
    },
  });

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<ClienteInput>({
    resolver: zodResolver(clienteSchema),
    defaultValues: { origem: "OUTROS", statusOrcamento: "PENDENTE", temperatura: "MORNO" },
  });

  const cpfCnpjVal = watch("cpfCnpj") ?? "";
  const telefoneVal = watch("telefone") ?? "";
  const whatsappVal = watch("whatsapp") ?? "";
  const cepVal = watch("cep") ?? "";

  const mutation = useMutation({
    mutationFn: (data: ClienteInput) => axios.post("/api/clientes", data),
    onSuccess: (res) => {
      toast.success("Cliente cadastrado com sucesso!");
      qc.invalidateQueries({ queryKey: ["clientes"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      router.push(`/clientes/${res.data.data.id}`);
    },
    onError: () => toast.error("Erro ao cadastrar cliente"),
  });

  async function buscarCEP(cep: string) {
    const digits = cep.replace(/\D/g, "");
    if (digits.length !== 8) return;
    setBuscandoCEP(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setValue("logradouro", data.logradouro);
        setValue("bairro", data.bairro);
        setValue("cidade", data.localidade);
        setValue("estado", data.uf);
      }
    } catch { /* silent */ } finally {
      setBuscandoCEP(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/clientes">
          <Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button>
        </Link>
        <div>
          <h2 className="text-2xl font-bold">Novo Cliente</h2>
          <p className="text-muted-foreground">Ficha de inscrição — preenchida pela recepcionista</p>
        </div>
      </div>

      {/* Aviso sobre os próximos passos */}
      <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-900 p-4 text-sm text-blue-800 dark:text-blue-300">
        <Info className="w-4 h-4 mt-0.5 shrink-0" />
        <p>
          Preencha os dados do cliente e clique em <strong>Cadastrar</strong>. Após o cadastro, o vendedor abre o perfil do cliente e preenche o orçamento e o acompanhamento.
        </p>
      </div>

      <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="space-y-6">

        {/* Dados pessoais */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <User2 className="w-4 h-4" />Dados do Cliente
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2 space-y-1.5">
              <Label>Nome completo / Razão Social *</Label>
              <Input {...register("nome")} placeholder="Nome ou razão social" />
              {errors.nome && <p className="text-destructive text-sm">{errors.nome.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>CPF / CNPJ</Label>
              <Input
                value={cpfCnpjVal}
                onChange={(e) => setValue("cpfCnpj", maskCpfCnpj(e.target.value))}
                placeholder="000.000.000-00"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Data de Inscrição</Label>
              <Input type="date" {...register("dataInscricao")} />
            </div>

            <div className="space-y-1.5">
              <Label>Telefone</Label>
              <Input
                value={telefoneVal}
                onChange={(e) => setValue("telefone", maskPhone(e.target.value))}
                placeholder="(47) 3456-7890"
              />
            </div>

            <div className="space-y-1.5">
              <Label>WhatsApp</Label>
              <Input
                value={whatsappVal}
                onChange={(e) => setValue("whatsapp", maskPhone(e.target.value))}
                placeholder="(47) 98765-4321"
              />
            </div>

            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <Input {...register("email")} type="email" placeholder="contato@email.com" />
              {errors.email && <p className="text-destructive text-sm">{errors.email.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Origem</Label>
              <Select onValueChange={(v) => setValue("origem", v as ClienteInput["origem"])} defaultValue="OUTROS">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ORIGENS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Endereço */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Endereço</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Tipo de Imóvel</Label>
              <Select onValueChange={(v) => setValue("tipoResidencia", v as ClienteInput["tipoResidencia"])}>
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
                <Input
                  value={cepVal}
                  placeholder="00000-000"
                  onChange={(e) => {
                    const masked = maskCep(e.target.value);
                    setValue("cep", masked);
                    buscarCEP(masked);
                  }}
                />
                {buscandoCEP && <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Logradouro</Label>
              <Input {...register("logradouro")} placeholder="Rua, Av., Praça..." />
            </div>
            <div className="space-y-1.5"><Label>Número</Label><Input {...register("numero")} placeholder="123" /></div>
            <div className="space-y-1.5"><Label>Complemento</Label><Input {...register("complemento")} placeholder="Apto 201, Bloco B..." /></div>
            <div className="space-y-1.5"><Label>Bairro</Label><Input {...register("bairro")} placeholder="Bairro" /></div>
            <div className="space-y-1.5"><Label>Cidade</Label><Input {...register("cidade")} placeholder="Cidade" /></div>
            <div className="space-y-1.5"><Label>Estado</Label><Input {...register("estado")} placeholder="SC" maxLength={2} /></div>
          </CardContent>
        </Card>

        {/* Atendimento */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <ClipboardList className="w-4 h-4" />Atendimento
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Vendedor Responsável</Label>
              <Select onValueChange={(v) => setValue("responsavelId", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione o vendedor" /></SelectTrigger>
                <SelectContent>
                  {(usuarios || []).map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Serviço Buscado</Label>
              <Select onValueChange={(v) => setValue("servicoBuscado", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione o serviço" /></SelectTrigger>
                <SelectContent>
                  {SERVICOS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-3 pb-8">
          <Link href="/clientes">
            <Button variant="outline" type="button">Cancelar</Button>
          </Link>
          <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 min-w-[160px]" disabled={mutation.isPending}>
            {mutation.isPending ? "Cadastrando..." : "Cadastrar Cliente"}
          </Button>
        </div>
      </form>
    </div>
  );
}
