import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { bridgeAutenticado } from "@/lib/whatsapp/bridgeAuth";

export const dynamic = "force-dynamic";

// Chamado pelo bridge sempre que o estado da conexão muda (aguardando QR, conectado,
// desconectado) e, periodicamente, como heartbeat enquanto conectado — ultimoPing marca
// a última vez que o processo local deu sinal de vida, pra CRM detectar bridge morto sem
// aviso (terminal fechado à força, notebook dormiu) mesmo que statusConexao ainda diga
// "conectado".
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
      ultimoPing: new Date(),
    },
  });

  return NextResponse.json({ ok: true, instancia });
}
