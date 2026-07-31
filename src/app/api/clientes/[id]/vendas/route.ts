import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { requirePermission, canViewAll as canViewAllRole } from "@/lib/rbac";
import { createAuditLog } from "@/lib/audit";
import prisma from "@/lib/prisma";
import { vendaSchema } from "@/lib/validators/venda";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getCurrentUser(request);
    if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    requirePermission(payload.role, "clientes:read");

    const canViewAll = canViewAllRole(payload.role);
    const cliente = await prisma.cliente.findFirst({
      where: { id: params.id, deletedAt: null, ...(canViewAll ? {} : { responsavelId: payload.userId }) },
    });
    if (!cliente) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });

    const vendas = await prisma.venda.findMany({
      where: { clienteId: params.id, deletedAt: null },
      orderBy: { data: "desc" },
    });

    return NextResponse.json({ data: vendas });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro ao buscar vendas" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getCurrentUser(request);
    if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    requirePermission(payload.role, "clientes:update");

    const canViewAll = canViewAllRole(payload.role);
    const cliente = await prisma.cliente.findFirst({
      where: { id: params.id, deletedAt: null, ...(canViewAll ? {} : { responsavelId: payload.userId }) },
    });
    if (!cliente) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });

    const body = await request.json();
    const data = vendaSchema.parse(body);

    const venda = await prisma.venda.create({
      data: {
        clienteId: params.id,
        leadId: data.leadId || null,
        responsavelId: cliente.responsavelId,
        numeroOrcamento: data.numeroOrcamento,
        valor: data.valor,
        data: new Date(`${data.data}T12:00:00`),
      },
    });

    await createAuditLog({
      userId: payload.userId,
      entidade: "Venda",
      entidadeId: venda.id,
      acao: "CREATE",
      dadosNovos: { clienteId: params.id, ...data },
    });

    return NextResponse.json({ data: venda }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro ao registrar venda" }, { status: 500 });
  }
}
