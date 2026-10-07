// Atualização automática das telas (React Query). Cada consulta é uma chamada à API, ou seja,
// uma invocação de função na Vercel (mais a do middleware). Por isso os intervalos são longos.
// Depois de salvar algo, as telas continuam se atualizando na hora (invalidateQueries).

/** Intervalo de atualização automática do CRM (inclui chat e WhatsApp). */
export const ATUALIZACAO_MS = 5 * 60_000;

/**
 * Por quanto tempo os dados contam como frescos. Ao voltar para a aba ou reabrir uma tela, só
 * consulta de novo se passou desse tempo — quem alterna entre abas o dia todo não dispara uma
 * rodada de consultas a cada troca.
 */
export const DADOS_FRESCOS_MS = 60_000;

/** Financeiro (Carros e Auditoria) mantém o ritmo anterior: 30 s e consulta ao voltar para a aba. */
export const RITMO_FINANCEIRO = { refetchInterval: 30_000, staleTime: 0 } as const;
