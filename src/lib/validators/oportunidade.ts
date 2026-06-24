import { z } from "zod";

export const oportunidadeSchema = z.object({
  titulo: z.string().min(2, "Título deve ter no mínimo 2 caracteres"),
  descricao: z.string().optional(),
  valor: z.number().min(0, "Valor deve ser positivo"),
  probabilidade: z.number().min(0).max(100).default(50),
  status: z
    .enum(["ABERTA", "GANHA", "PERDIDA", "SUSPENSA"])
    .default("ABERTA"),
  dataPrevisao: z.string().optional(),
  dataFechamento: z.string().optional(),
  responsavelId: z.string().optional(),
  clienteId: z.string().optional(),
  empresaId: z.string().optional(),
  contatoId: z.string().optional(),
  leadId: z.string().optional(),
  motivoPerda: z.string().optional(),
});

export const tarefaSchema = z.object({
  titulo: z.string().min(2, "Título deve ter no mínimo 2 caracteres"),
  descricao: z.string().optional(),
  tipo: z
    .enum(["REUNIAO", "LIGACAO", "VISITA", "FOLLOW_UP", "EMAIL", "TAREFA"])
    .default("TAREFA"),
  prioridade: z.enum(["ALTA", "MEDIA", "BAIXA"]).default("MEDIA"),
  dataVencimento: z.string(),
  dataInicio: z.string().optional(),
  responsavelId: z.string().optional(),
  clienteId: z.string().optional(),
  leadId: z.string().optional(),
  oportunidadeId: z.string().optional(),
});

export const empresaSchema = z.object({
  razaoSocial: z.string().min(2, "Razão social deve ter no mínimo 2 caracteres"),
  nomeFantasia: z.string().optional(),
  cnpj: z.string().optional(),
  segmento: z.string().optional(),
  porte: z
    .enum(["MICRO", "PEQUENO", "MEDIO", "GRANDE", "ENTERPRISE"])
    .default("PEQUENO"),
  website: z.string().url("URL inválida").optional().or(z.literal("")),
  telefone: z.string().optional(),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  cep: z.string().optional(),
  logradouro: z.string().optional(),
  numero: z.string().optional(),
  bairro: z.string().optional(),
  cidade: z.string().optional(),
  estado: z.string().optional(),
  observacoes: z.string().optional(),
});

export const contatoSchema = z.object({
  nome: z.string().min(2, "Nome deve ter no mínimo 2 caracteres"),
  cargo: z.string().optional(),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  telefone: z.string().optional(),
  whatsapp: z.string().optional(),
  cpf: z.string().optional(),
  principal: z.boolean().default(false),
  observacoes: z.string().optional(),
  empresaId: z.string().optional(),
});

export type OportunidadeInput = z.infer<typeof oportunidadeSchema>;
export type TarefaInput = z.infer<typeof tarefaSchema>;
export type EmpresaInput = z.infer<typeof empresaSchema>;
export type ContatoInput = z.infer<typeof contatoSchema>;
