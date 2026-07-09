import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { bridgeAutenticado } from "@/lib/whatsapp/bridgeAuth";

export const dynamic = "force-dynamic";

// Chamado pelo bridge local no start-up: garante que existe uma WhatsAppInstancia tipo
// QRCODE para essa sessão (cria na primeira vez, reaproveita nas próximas), e devolve o id.
export async function POST(request: NextRequest) {
  if (!bridgeAutenticado(request)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { nome, sessaoId } = await request.json();
  if (!sessaoId) {
    return NextResponse.json({ error: "sessaoId obrigatório" }, { status: 400 });
  }

  const instancia = await prisma.whatsAppInstancia.upsert({
    where: { sessaoId },
    create: {
      nome: nome || "WhatsApp (QR temporário)",
      tipo: "QRCODE",
      sessaoId,
      statusConexao: "desconectado",
    },
    update: {},
  });

  return NextResponse.json({ instanciaId: instancia.id });
}
