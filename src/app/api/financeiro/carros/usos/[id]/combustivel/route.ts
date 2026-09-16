import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireFinanceiroAccess } from "@/lib/financeiro/authz";
import { carroUsoCombustivelSchema } from "@/lib/validators/financeiro";
import { criarLancamentoCombustivel } from "@/lib/financeiro/combustivel";
import { createAuditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

const usoInclude = {
  carro: { select: { id: true, numero: true, modelo: true, placa: true } },
  motorista: { select: { id: true, nome: true } },
} as const;

// Registrar (ou corrigir) o valor de gasolina de um uso já criado — não precisa
// esperar a chegada, dá pra usar a qualquer momento depois da saída registrada.
// Rota própria (em vez de PATCH em /usos/[id]) porque também mexe num
// lançamento do Caixa, não só no registro de uso.
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireFinanceiroAccess(request);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const parsed = carroUsoCombustivelSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }

  const uso = await prisma.financeiroCarroUso.findUnique({ where: { id: params.id }, include: usoInclude });
  if (!uso) return NextResponse.json({ error: "Registro não encontrado" }, { status: 404 });

  const conta = await prisma.financeiroConta.findUnique({ where: { id: parsed.data.contaCombustivelId } });
  if (!conta || !conta.ativa) return NextResponse.json({ error: "Conta inválida ou arquivada" }, { status: 400 });

  const valorAntigo = uso.valorCombustivel != null ? Number(uso.valorCombustivel) : null;

  const atualizado = await prisma.$transaction(async (tx) => {
    if (uso.lancamentoCombustivelId) {
      await tx.financeiroLancamento.update({
        where: { id: uso.lancamentoCombustivelId },
        data: { valor: parsed.data.valorCombustivel, contaId: parsed.data.contaCombustivelId },
      });
      return tx.financeiroCarroUso.update({
        where: { id: uso.id },
        data: { valorCombustivel: parsed.data.valorCombustivel },
        include: usoInclude,
      });
    }

    const lancamento = await criarLancamentoCombustivel(tx, {
      contaId: parsed.data.contaCombustivelId,
      valor: parsed.data.valorCombustivel,
      descricao: `Combustível — ${uso.carro.numero} · ${uso.carro.modelo} (${uso.motorista.nome})`,
      criadoPorId: auth.payload.userId,
    });
    return tx.financeiroCarroUso.update({
      where: { id: uso.id },
      data: { valorCombustivel: parsed.data.valorCombustivel, lancamentoCombustivelId: lancamento.id },
      include: usoInclude,
    });
  });

  await createAuditLog({
    userId: auth.payload.userId,
    entidade: "FinanceiroCarroUso",
    entidadeId: params.id,
    acao: "UPDATE",
    dadosAntigos: { valorCombustivel: valorAntigo },
    dadosNovos: { valorCombustivel: parsed.data.valorCombustivel, conta: conta.nome },
  });

  return NextResponse.json({ data: atualizado });
}
