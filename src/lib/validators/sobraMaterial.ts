import { z } from "zod";

export const sobraMaterialSchema = z.object({
  tipo: z.enum(["ALUMINIO", "VIDRO", "OUTRO"]),
  descricao: z.string().optional(),
  larguraMm: z.number().int().positive().optional().nullable(),
  alturaMm: z.number().int().positive().optional().nullable(),
  comprimentoMm: z.number().int().positive().optional().nullable(),
  disponivel: z.boolean().default(true),
});

export type SobraMaterialInput = z.infer<typeof sobraMaterialSchema>;
