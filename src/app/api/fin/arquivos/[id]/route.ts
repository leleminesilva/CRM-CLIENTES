import { NextResponse } from "next/server";
import { z } from "zod";
import { getContext } from "@fin/lib/context";
import { isAppError } from "@fin/lib/errors";
import { readAttachment } from "@fin/modules/attachments/service";

/** Download autenticado de anexo: só membros do workspace, sem cache compartilhado. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getContext();
  if (!ctx) return new NextResponse("Sessão expirada.", { status: 401 });
  const id = z.string().uuid().safeParse((await params).id);
  if (!id.success) return new NextResponse("Não encontrado.", { status: 404 });
  try {
    const file = await readAttachment(ctx, id.data);
    return new NextResponse(new Uint8Array(file.data), {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
        "Content-Length": String(file.data.byteLength),
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (isAppError(error) && error.code === "NOT_FOUND")
      return new NextResponse("Não encontrado.", { status: 404 });
    throw error;
  }
}
