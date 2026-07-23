import { z } from "zod";

export const aprovarOrcamentoSchema = z.object({
  previsaoEntrega: z.string().min(1, "Previsão de entrega é obrigatória"),
  vendedorId: z.string().optional().nullable(),
});

export const ordemServicoUpdateSchema = z.object({
  vendedorId: z.string().optional().nullable(),
  previsaoEntrega: z.string().optional(),
  progresso: z.number().int().min(0).max(100).optional(),
  status: z.enum(["EM_PRODUCAO", "CONCLUIDO", "CANCELADO"]).optional(),
});

export type AprovarOrcamentoInput = z.infer<typeof aprovarOrcamentoSchema>;
export type OrdemServicoUpdateInput = z.infer<typeof ordemServicoUpdateSchema>;
