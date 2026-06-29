import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Verificação do webhook pela Meta
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_WEBHOOK_TOKEN) {
    return new Response(challenge, { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

// Recebimento de mensagens da Meta
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (body.object !== "whatsapp_business_account") {
      return NextResponse.json({ ok: true });
    }

    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value;
        if (!value?.messages?.length) continue;

        const phoneNumberId = value.metadata?.phone_number_id as string;
        const instancia = await prisma.whatsAppInstancia.findUnique({
          where: { phoneNumberId },
        });
        if (!instancia) continue;

        for (const msg of value.messages) {
          const fromPhone = msg.from as string;
          const waId = msg.id as string;
          const tipo = msg.type as string;
          let conteudo = "";

          if (tipo === "text") {
            conteudo = msg.text?.body ?? "";
          } else if (tipo === "image") {
            conteudo = msg.image?.caption ?? "[Imagem]";
          } else if (tipo === "audio") {
            conteudo = "[Áudio]";
          } else if (tipo === "video") {
            conteudo = msg.video?.caption ?? "[Vídeo]";
          } else if (tipo === "document") {
            conteudo = msg.document?.filename ?? "[Documento]";
          } else {
            conteudo = `[${tipo}]`;
          }

          const profileName =
            (value.contacts?.[0]?.profile?.name as string | undefined) ?? undefined;

          const conversa = await prisma.whatsAppConversa.upsert({
            where: {
              instanciaId_contatoPhone: {
                instanciaId: instancia.id,
                contatoPhone: fromPhone,
              },
            },
            create: {
              instanciaId: instancia.id,
              contatoPhone: fromPhone,
              contatoNome: profileName,
              ultimaMsgEm: new Date(),
              naoLidas: 1,
            },
            update: {
              contatoNome: profileName ?? undefined,
              ultimaMsgEm: new Date(),
              naoLidas: { increment: 1 },
            },
          });

          await prisma.whatsAppMensagem.upsert({
            where: { waId },
            create: {
              conversaId: conversa.id,
              waId,
              direcao: "entrada",
              tipo,
              conteudo,
              enviadaEm: new Date(Number(msg.timestamp) * 1000),
            },
            update: {},
          });
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[WA Webhook]", err);
    return NextResponse.json({ ok: true }); // Sempre responde 200 para Meta
  }
}
