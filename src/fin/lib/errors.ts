/**
 * Portado de Financeiro/src/lib/errors.ts.
 * Erros de negócio com código estável e mensagem em pt-BR.
 * O código serve a testes e integrações; a mensagem é o que o usuário lê.
 */
export const errorMessages = {
  UNAUTHENTICATED: "Sua sessão expirou. Entre novamente.",
  FORBIDDEN: "Você não tem permissão para fazer isso no Financeiro.",
  NOT_FOUND: "Não encontramos este registro. Ele pode ter sido excluído.",
  VALIDATION: "Revise os campos destacados.",
  CONFLICT: "Já existe um registro com estes dados.",
  IN_USE: "Este registro está em uso por outros dados e não pode ser excluído.",
  WORKSPACE_REQUIRED: "O Financeiro ainda não foi configurado. Peça a um administrador para acessá-lo uma vez.",
  ACCOUNT_NAME_TAKEN: "Já existe uma conta com este nome.",
  ACCOUNT_HAS_TRANSACTIONS:
    "Esta conta tem lançamentos e não pode ser excluída. Arquive-a para escondê-la sem perder o histórico.",
  CATEGORY_NAME_TAKEN: "Já existe uma categoria com este nome neste nível.",
  CATEGORY_SYSTEM: "Categorias do sistema não podem ser excluídas, arquivadas nem mescladas.",
  CATEGORY_IN_USE:
    "Esta categoria tem lançamentos, orçamentos ou recorrências. Use “Mesclar” para movê-los para outra categoria.",
  CATEGORY_INVALID_PARENT:
    "Escolha um grupo do mesmo tipo (receita ou despesa) e que não seja uma subcategoria.",
  CATEGORY_HAS_CHILDREN:
    "Este grupo tem subcategorias. Mova ou arquive as subcategorias antes de continuar.",
  CATEGORY_MERGE_KIND: "Só é possível mesclar categorias do mesmo tipo.",
  ACCOUNT_ARCHIVED: "A conta escolhida está arquivada. Reative-a ou escolha outra.",
  CATEGORY_ARCHIVED: "A categoria escolhida está arquivada. Reative-a ou escolha outra.",
  CATEGORY_KIND_MISMATCH:
    "A categoria escolhida não corresponde ao tipo do lançamento (receita ou despesa).",
  ACCOUNT_REQUIRED: "Escolha a conta para registrar o pagamento ou recebimento.",
  TRANSACTION_TYPE_LOCKED:
    "Não é possível mudar o tipo de um lançamento que faz parte de uma série ou de um parcelamento.",
  TRANSACTION_LOCKED: "Este lançamento é gerenciado por outro módulo e não pode ser alterado aqui.",
  NOTHING_TO_ADJUST:
    "O saldo informado já é igual ao saldo calculado. Nenhum ajuste foi necessário.",
  CARD_NAME_TAKEN: "Já existe um cartão com este nome.",
  CARD_HAS_HISTORY:
    "Este cartão tem compras ou faturas e não pode ser excluído. Arquive-o para escondê-lo sem perder o histórico.",
  CARD_ARCHIVED: "O cartão escolhido está arquivado. Reative-o ou escolha outro.",
  INVOICE_NOT_FOUND: "Fatura não encontrada.",
  INVOICE_PAID: "Esta fatura já está paga. Desfaça o pagamento para alterá-la.",
  PAYMENT_TOO_HIGH: "O valor passa do que falta pagar nesta fatura.",
  INVOICE_EMPTY: "Esta fatura não tem compras para pagar.",
  PLAN_FINISHED: "Este parcelamento não tem parcelas pendentes.",
  EMERGENCY_FUND_EXISTS:
    "Você já tem uma reserva de emergência ativa. Edite a existente ou arquive-a antes de criar outra.",
  GOAL_LINKED: "Esta meta acompanha o saldo de uma conta; o valor atual vem dela.",
  INTERNAL: "Não foi possível concluir a operação. Tente novamente em instantes.",
} as const;

export type ErrorCode = keyof typeof errorMessages;

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: ErrorCode, message?: string, details?: Record<string, unknown>) {
    super(message ?? errorMessages[code]);
    this.name = "AppError";
    this.code = code;
    this.details = details;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

interface PrismaKnownError {
  name: string;
  code: string;
  meta?: Record<string, unknown>;
}

function isPrismaKnownError(error: unknown): error is PrismaKnownError {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { name?: unknown }).name === "PrismaClientKnownRequestError" &&
    typeof (error as { code?: unknown }).code === "string"
  );
}

/** Traduz erros conhecidos do Prisma/Postgres em erros de negócio; o resto segue como está. */
export function normalizeError(error: unknown): unknown {
  if (isAppError(error) || !isPrismaKnownError(error)) return error;
  switch (error.code) {
    case "P2002":
      return new AppError("CONFLICT", undefined, { target: error.meta?.target });
    case "P2003":
      return new AppError("IN_USE");
    case "P2025":
      return new AppError("NOT_FOUND");
    default:
      return error;
  }
}
