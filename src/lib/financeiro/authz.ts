import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canAccessFinanceiro } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import type { JWTPayload } from "@/types";

// O JWT só carrega { userId, email, role } — acessoFinanceiro é liberado por
// pessoa e pode mudar a qualquer momento (admin revoga na tela de Usuários),
// então cada rota do Financeiro confere fresco no banco em vez de confiar no
// token (que só expira em até 7 dias — ver JWT_EXPIRES_IN).
export async function requireFinanceiroAccess(
  request: NextRequest
): Promise<{ ok: true; payload: JWTPayload } | { ok: false; response: NextResponse }> {
  const payload = await getCurrentUser(request);
  if (!payload) {
    return { ok: false, response: NextResponse.json({ error: "Não autenticado" }, { status: 401 }) };
  }

  const user = await prisma.user.findFirst({
    where: { id: payload.userId, deletedAt: null, ativo: true },
    select: { acessoFinanceiro: true },
  });

  if (!user || !canAccessFinanceiro({ role: payload.role, acessoFinanceiro: user.acessoFinanceiro })) {
    return { ok: false, response: NextResponse.json({ error: "Sem acesso ao Financeiro" }, { status: 403 }) };
  }

  return { ok: true, payload };
}
