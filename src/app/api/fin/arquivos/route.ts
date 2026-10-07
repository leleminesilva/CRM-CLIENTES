import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getContext } from "@fin/lib/context";
import { isAppError, normalizeError } from "@fin/lib/errors";
import { logger } from "@fin/lib/logger";
import { assertCan } from "@fin/lib/permissions";
import { MAX_ATTACHMENT_BYTES } from "@fin/modules/attachments/domain/sniff";
import { addTransactionAttachment } from "@fin/modules/attachments/service";

/** Upload de comprovante (multipart: file + transactionId). */
export async function POST(request: Request) {
  // Só aceita envios feitos pelo próprio app (defesa extra contra CSRF, além do cookie SameSite).
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ message: "Origem não permitida." }, { status: 403 });
  }
  const ctx = await getContext();
  if (!ctx)
    return NextResponse.json({ message: "Sessão expirada. Entre novamente." }, { status: 401 });
  try {
    assertCan(ctx, "write");
    const length = Number.parseInt(request.headers.get("content-length") ?? "0", 10);
    if (length > MAX_ATTACHMENT_BYTES + 64 * 1024) {
      return NextResponse.json({ message: "O arquivo passa de 10 MB." }, { status: 413 });
    }
    const form = await request.formData();
    const transactionId = z.string().uuid().parse(form.get("transactionId"));
    const file = form.get("file");
    if (!(file instanceof File))
      return NextResponse.json({ message: "Nenhum arquivo enviado." }, { status: 400 });
    const attachment = await addTransactionAttachment(ctx, {
      transactionId,
      fileName: file.name,
      data: Buffer.from(await file.arrayBuffer()),
    });
    revalidatePath("/", "layout");
    return NextResponse.json(attachment, { status: 201 });
  } catch (error) {
    const e = normalizeError(error);
    if (isAppError(e)) {
      const status = e.code === "NOT_FOUND" ? 404 : e.code === "FORBIDDEN" ? 403 : 422;
      return NextResponse.json({ message: e.message }, { status });
    }
    if (error instanceof z.ZodError)
      return NextResponse.json({ message: "Lançamento inválido." }, { status: 400 });
    logger.error({ err: error }, "Falha no upload de anexo");
    return NextResponse.json({ message: "Não foi possível enviar o arquivo." }, { status: 500 });
  }
}
