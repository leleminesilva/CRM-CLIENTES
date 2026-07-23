// "Atrasado" nunca é persistido — é derivado comparando previsaoEntrega com a
// data atual, sempre no momento da renderização (nunca cacheado pela API).
// Ver docs/architecture/orcamentos-tecnicos.md.
export function isOrdemAtrasada(previsaoEntrega: string | Date, status: string): boolean {
  if (status !== "EM_PRODUCAO") return false;
  return new Date(previsaoEntrega).getTime() < Date.now();
}
