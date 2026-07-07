import { z } from "zod";

const nullToUndefined = (v: unknown) => (v === null || v === "" ? undefined : v);

export const clienteSchema = z.object({
  nome: z.string().min(2, "Nome deve ter no mínimo 2 caracteres"),
  razaoSocial: z.string().optional(),
  nomeFantasia: z.string().optional(),
  cpfCnpj: z.string().optional(),
  telefone: z.string().optional(),
  whatsapp: z.string().optional(),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  cep: z.string().optional(),
  logradouro: z.string().optional(),
  numero: z.string().optional(),
  complemento: z.string().optional(),
  tipoResidencia: z.preprocess(
    nullToUndefined,
    z.enum(["CASA", "APARTAMENTO", "COMERCIAL", "OUTROS"]).optional()
  ),
  bairro: z.string().optional(),
  cidade: z.string().optional(),
  estado: z.string().optional(),
  segmento: z.string().optional(),
  porte: z.preprocess(
    nullToUndefined,
    z.enum(["MICRO", "PEQUENO", "MEDIO", "GRANDE", "ENTERPRISE"]).optional()
  ),
  origem: z
    .enum(["INDICACAO", "SITE", "REDES_SOCIAIS", "GOOGLE_ADS", "EVENTO", "LIGACAO_ATIVA", "PARCEIRO", "OUTROS"])
    .default("OUTROS"),
  responsavelId: z.preprocess(nullToUndefined, z.string().optional()),
  empresaId: z.preprocess(nullToUndefined, z.string().optional()),
  contatoId: z.preprocess(nullToUndefined, z.string().optional()),
  observacoes: z.string().optional(),
  // Fluxo de atendimento
  dataInscricao: z.preprocess(nullToUndefined, z.string().optional()),
  servicoBuscado: z.preprocess(nullToUndefined, z.string().optional()),
  numeroOrcamento: z.preprocess(nullToUndefined, z.string().optional()),
  valorOrcamento: z.preprocess(
    v => (v === null || v === "" ? undefined : v),
    z.coerce.number().optional()
  ),
  prazoOrcamento: z.preprocess(nullToUndefined, z.string().optional()),
  statusOrcamento: z.enum(["PENDENTE", "APROVADO", "NAO_APROVADO"]).default("PENDENTE"),
  temperatura: z.enum(["QUENTE", "MORNO", "FRIO"]).default("MORNO"),
}).refine(
  (data) => {
    const temTelefone = !!(data.telefone && data.telefone.trim() !== "");
    const temWhatsapp = !!(data.whatsapp && data.whatsapp.trim() !== "");
    const temEmail = !!(data.email && data.email.trim() !== "");
    return temTelefone || temWhatsapp || temEmail;
  },
  {
    message: "Pelo menos um meio de contato deve ser fornecido (Telefone, WhatsApp ou E-mail)",
    path: ["telefone"],
  }
);

export type ClienteInput = z.infer<typeof clienteSchema>;

// Schema exclusivo para vendedores (Etapas 2 e 3)
export const orcamentoSchema = z.object({
  numeroOrcamento: z.preprocess(nullToUndefined, z.string().optional()),
  valorOrcamento: z.preprocess(
    v => (v === null || v === "" ? undefined : v),
    z.coerce.number().optional()
  ),
  prazoOrcamento: z.preprocess(nullToUndefined, z.string().optional()),
  statusOrcamento: z.enum(["PENDENTE", "APROVADO", "NAO_APROVADO"]).default("PENDENTE"),
  temperatura: z.enum(["QUENTE", "MORNO", "FRIO"]).default("MORNO"),
  observacoes: z.preprocess(nullToUndefined, z.string().optional()),
});

export type OrcamentoInput = z.infer<typeof orcamentoSchema>;
