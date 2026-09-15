import { z } from "zod";

export const contaTipoEnum = z.enum(["CAIXA", "CORRENTE", "POUPANCA", "INVESTIMENTO", "CARTAO"]);
export const tipoLancamentoEnum = z.enum(["ENTRADA", "SAIDA"]);

export const contaSchema = z.object({
  nome: z.string().min(2, "Nome deve ter no mínimo 2 caracteres").max(60),
  tipo: contaTipoEnum.default("CAIXA"),
  instituicao: z.string().max(60).optional().nullable(),
  saldoInicial: z.number().finite().default(0),
  cor: z.string().max(20).optional().nullable(),
});

export const contaUpdateSchema = contaSchema.partial().extend({
  ativa: z.boolean().optional(),
});

export const categoriaSchema = z.object({
  nome: z.string().min(2, "Nome deve ter no mínimo 2 caracteres").max(40),
  tipo: tipoLancamentoEnum,
  cor: z.string().max(20).optional().nullable(),
});

export const lancamentoSchema = z.object({
  contaId: z.string().min(1, "Selecione a conta"),
  // Vem "" do formulário quando o usuário escolhe "Sem categoria" — tratado
  // como null nas rotas, então aqui só precisa aceitar string (vazia ou não).
  categoriaId: z.string().optional().nullable(),
  tipo: tipoLancamentoEnum,
  descricao: z.string().min(2, "Descreva o lançamento").max(200),
  valor: z.number().positive("Valor precisa ser maior que zero"),
  data: z.string().min(1, "Informe a data"),
});

export const lancamentoUpdateSchema = lancamentoSchema.partial();
