import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { verifyToken } from "@/lib/auth";
import { AppError } from "./errors";
import { resolveFinContext, type FinContext } from "./resolve";

export type { FinContext, ISODate } from "./resolve";

/**
 * Ponte entre o login do CRM (JWT no cookie "token") e o Financeiro novo.
 * O acesso é conferido no banco a cada requisição, como em requireFinanceiroAccess:
 * o token só carrega o cargo e pode estar desatualizado por até 7 dias.
 * null = sem sessão; AppError FORBIDDEN = logado, mas sem acesso ao Financeiro.
 */
export const getFinContext = cache(async (): Promise<FinContext | null> => {
  const token = cookies().get("token")?.value;
  if (!token) return null;
  let userId: string;
  try {
    userId = (await verifyToken(token)).userId;
  } catch {
    return null;
  }
  return resolveFinContext(userId);
});

/** Para server actions e rotas: lança UNAUTHENTICATED sem sessão. */
export async function requireFinContext(): Promise<FinContext> {
  const ctx = await getFinContext();
  if (!ctx) throw new AppError("UNAUTHENTICATED");
  return ctx;
}

/** Para páginas: sem sessão vai para o login; sem acesso volta para o CRM. */
export async function requireFinPageContext(): Promise<FinContext> {
  let ctx: FinContext | null;
  try {
    ctx = await getFinContext();
  } catch (error) {
    if (error instanceof AppError && error.code === "FORBIDDEN") redirect("/");
    throw error;
  }
  if (!ctx) redirect("/login");
  return ctx;
}

// Nomes usados pelos módulos portados do sistema novo (Financeiro/src/lib/context.ts).
export type AppContext = FinContext;
export const getContext = getFinContext;
export const requireContext = requireFinContext;
export const requirePageContext = requireFinPageContext;
