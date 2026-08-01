import { z } from "zod";

export const vendaSchema = z.object({
  numeroOrcamento: z.string().min(1, "Número do orçamento é obrigatório"),
  valor: z.coerce.number().positive("Valor deve ser maior que zero"),
  data: z.string().min(1, "Data da venda é obrigatória"),
  leadId: z.string().nullable().optional(),
});

export type VendaInput = z.infer<typeof vendaSchema>;

export const vendaPosVendaSchema = z.object({
  statusPosVenda: z.enum(["AGUARDANDO_VIDRO", "VIDRO_CHEGOU", "AGENDADO", "CONCLUIDO"]).optional(),
  ordemKanban: z.number().optional(),
  vidroChegou: z.boolean().optional(),
  vidroChegouEm: z.string().nullable().optional(), // YYYY-MM-DD
  dataAgendamento: z.string().nullable().optional(), // YYYY-MM-DD
  horarioAgendamento: z.string().nullable().optional(),
  observacoesPosVenda: z.string().nullable().optional(),
});

export type VendaPosVendaInput = z.infer<typeof vendaPosVendaSchema>;
