import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { bridgeAutenticado } from "@/lib/whatsapp/bridgeAuth";

export const dynamic = "force-dynamic";

// Chamado pelo bridge sempre que o estado da conexão muda: aguardando QR (com a imagem em
// base64 pra CRM exibir), conectado (limpa o QR), ou desconectado.
export async function POST(request: NextRequest) {
  if (!bridgeAutenticado(request)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { instanciaId, status, qrCode, phoneNumber } = await request.json();
  if (!instanciaId || !status) {
    return NextResponse.json({ error: "instanciaId e status obrigatórios" }, { status: 400 });
  }

  const instancia = await prisma.whatsAppInstancia.update({
    where: { id: instanciaId },
    data: {
      statusConexao: status,
      qrCode: status === "aguardando_qr" ? qrCode ?? null : null,
      phoneNumber: phoneNumber || undefined,
    },
  });

  return NextResponse.json({ ok: true, instancia });
}
