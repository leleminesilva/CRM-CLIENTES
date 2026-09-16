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

// ── Carros (frota) ──
export const carroSchema = z.object({
  numero: z.string().min(1, "Informe o número/identificação").max(20),
  modelo: z.string().min(2, "Informe o modelo").max(60),
  ano: z.number().int("Ano inválido").min(1950).max(new Date().getFullYear() + 1),
  placa: z.string().min(6, "Placa inválida").max(10),
  cor: z.string().max(30).optional().nullable(),
});

export const carroUpdateSchema = carroSchema.partial().extend({
  ativo: z.boolean().optional(),
});

export const motoristaSchema = z.object({
  nome: z.string().min(2, "Informe o nome").max(80),
  telefone: z.string().max(20).optional().nullable(),
});

export const motoristaUpdateSchema = motoristaSchema.partial().extend({
  ativo: z.boolean().optional(),
});

export const carroUsoSaidaSchema = z.object({
  carroId: z.string().min(1, "Selecione o carro"),
  motoristaId: z.string().min(1, "Selecione o motorista"),
  kmSaida: z.number().int("Quilometragem inválida").nonnegative(),
  observacoes: z.string().max(300).optional().nullable(),
  // Quem registra costuma chegar depois do horário real de saída do carro — sem isso,
  // o carimbo ficaria sempre com o horário do registro em vez do da saída de verdade.
  saidaEm: z.string().optional(),
  // Valor entregue ao motorista pra gasolina — opcional; quando informado, precisa da
  // conta de onde esse dinheiro sai pra gerar o lançamento automático no Caixa.
  valorCombustivel: z.number().positive("Valor precisa ser maior que zero").optional(),
  contaCombustivelId: z.string().optional(),
}).refine((d) => !d.valorCombustivel || !!d.contaCombustivelId, {
  message: "Selecione de qual conta sai o valor da gasolina",
  path: ["contaCombustivelId"],
});

// Registrar (ou corrigir) o valor de gasolina depois que a saída já foi criada.
export const carroUsoCombustivelSchema = z.object({
  valorCombustivel: z.number().positive("Valor precisa ser maior que zero"),
  contaCombustivelId: z.string().min(1, "Selecione a conta"),
});

export const carroUsoChegadaSchema = z.object({
  kmChegada: z.number().int("Quilometragem inválida").nonnegative(),
  observacoes: z.string().max(300).optional().nullable(),
});
