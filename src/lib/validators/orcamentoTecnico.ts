import { z } from "zod";

export const itemOrcamentoTecnicoSchema = z.object({
  produtoId: z.string().min(1, "Produto é obrigatório"),
  varianteId: z.string().optional().nullable(),
  larguraMm: z.number().int().positive().optional().nullable(),
  alturaMm: z.number().int().positive().optional().nullable(),
  comprimentoMm: z.number().int().positive().optional().nullable(),
  quantidade: z.number().int().min(1).default(1),
  ambienteInstalacao: z.string().optional(),
  descricao: z.string().optional(),
  acrescimoValor: z.number().min(0).default(0),
  ordem: z.number().default(0),
});

export const orcamentoTecnicoSchema = z.object({
  clienteId: z.string().optional().nullable(),
  responsavelId: z.string().optional().nullable(),
  bairroInstalacao: z.string().optional(),
  enderecoInstalacao: z.string().optional(),
  observacoes: z.string().optional(),
  descontoPercentual: z.number().min(0).max(100).optional().nullable(),
  descontoValor: z.number().min(0).optional().nullable(),
  itens: z.array(itemOrcamentoTecnicoSchema).default([]),
}).refine(
  data => !(data.descontoPercentual != null && data.descontoValor != null),
  { message: "Escolha desconto por percentual OU por valor, não os dois", path: ["descontoValor"] }
);

export type OrcamentoTecnicoInput = z.infer<typeof orcamentoTecnicoSchema>;
export type ItemOrcamentoTecnicoInput = z.infer<typeof itemOrcamentoTecnicoSchema>;
