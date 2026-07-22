import { z } from "zod";

export const linhaProdutoSchema = z.object({
  nome: z.string().min(2, "Nome deve ter no mínimo 2 caracteres"),
  ordem: z.number().default(0),
  ativo: z.boolean().default(true),
});

export const produtoCatalogoSchema = z.object({
  linhaId: z.string().min(1, "Linha é obrigatória"),
  nome: z.string().min(2, "Nome deve ter no mínimo 2 caracteres"),
  modoCalculo: z.enum(["AREA", "LINEAR", "UNIDADE"]),
  precoBase: z.number().min(0, "Preço deve ser positivo").default(0),
  ordem: z.number().default(0),
  ativo: z.boolean().default(true),
});

export const varianteProdutoSchema = z.object({
  produtoId: z.string().min(1, "Produto é obrigatório"),
  nome: z.string().min(1, "Nome deve ter no mínimo 1 caractere"),
  categoria: z.string().optional(),
  precoUnitario: z.number().min(0, "Preço deve ser positivo").default(0),
  ordem: z.number().default(0),
  ativo: z.boolean().default(true),
});

export type LinhaProdutoInput = z.infer<typeof linhaProdutoSchema>;
export type ProdutoCatalogoInput = z.infer<typeof produtoCatalogoSchema>;
export type VarianteProdutoInput = z.infer<typeof varianteProdutoSchema>;
