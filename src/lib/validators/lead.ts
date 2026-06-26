import { z } from "zod";

export const leadSchema = z.object({
  titulo: z.string().min(2, "Título deve ter no mínimo 2 caracteres"),
  descricao: z.string().optional(),
  estagio: z
    .enum([
      "NOVO_LEAD",
      "CONTATO_INICIAL",
      "PRIMEIRO_ORCAMENTO",
      "QUALIFICACAO",
      "PROPOSTA_ENVIADA",
      "NEGOCIACAO",
      "FECHADO_GANHO",
      "FECHADO_PERDIDO",
    ])
    .default("NOVO_LEAD"),
  valorEstimado: z.number().min(0).optional(),
  temperatura: z.enum(["QUENTE", "MORNO", "FRIO"]).default("MORNO"),
  origem: z
    .enum([
      "INDICACAO",
      "SITE",
      "REDES_SOCIAIS",
      "GOOGLE_ADS",
      "EVENTO",
      "LIGACAO_ATIVA",
      "PARCEIRO",
      "OUTROS",
    ])
    .default("OUTROS"),
  responsavelId: z.string().optional(),
  clienteId: z.string().optional(),
  empresaId: z.string().optional(),
  contatoId: z.string().optional(),
  dataFechamento: z.string().optional(),
  motivoPerda: z.string().optional(),
});

export type LeadInput = z.infer<typeof leadSchema>;
