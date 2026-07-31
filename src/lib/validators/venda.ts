import { z } from "zod";

export const vendaSchema = z.object({
  numeroOrcamento: z.string().min(1, "Número do orçamento é obrigatório"),
  valor: z.coerce.number().positive("Valor deve ser maior que zero"),
  data: z.string().min(1, "Data da venda é obrigatória"),
  leadId: z.string().nullable().optional(),
});

export type VendaInput = z.infer<typeof vendaSchema>;
