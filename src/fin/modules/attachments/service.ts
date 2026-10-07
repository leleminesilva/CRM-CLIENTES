import { createHash, randomUUID } from "node:crypto";
import { audit } from "@fin/lib/audit";
import { prisma } from "@fin/lib/db";
import { AppError } from "@fin/lib/errors";
import { assertCan, type ServiceContext } from "@fin/lib/permissions";
import { storage } from "@fin/lib/storage";
import { EXTENSIONS, MAX_ATTACHMENT_BYTES, safeFileName, sniffMime } from "./domain/sniff";

const MAX_PER_TRANSACTION = 10;

export interface AttachmentDTO {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

function toDTO(a: {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
}): AttachmentDTO {
  return {
    id: a.id,
    fileName: a.fileName,
    mimeType: a.mimeType,
    sizeBytes: a.sizeBytes,
    createdAt: a.createdAt.toISOString(),
  };
}

/** Anexa um comprovante a um lançamento. O tipo é conferido pelos bytes, não pela extensão. */
export async function addTransactionAttachment(
  ctx: ServiceContext,
  input: { transactionId: string; fileName: string; data: Buffer },
): Promise<AttachmentDTO> {
  assertCan(ctx, "write");
  const transaction = await prisma.transaction.findFirst({
    where: { id: input.transactionId, workspaceId: ctx.workspaceId, deletedAt: null },
    include: { _count: { select: { attachments: true } } },
  });
  if (!transaction) throw new AppError("NOT_FOUND");
  if (transaction._count.attachments >= MAX_PER_TRANSACTION) {
    throw new AppError("VALIDATION", `Cada lançamento aceita até ${MAX_PER_TRANSACTION} anexos.`);
  }
  if (input.data.byteLength === 0) throw new AppError("VALIDATION", "O arquivo está vazio.");
  if (input.data.byteLength > MAX_ATTACHMENT_BYTES)
    throw new AppError("VALIDATION", "O arquivo passa de 10 MB.");
  const mime = sniffMime(input.data.subarray(0, 32));
  if (!mime)
    throw new AppError("VALIDATION", "Formato não aceito. Envie PDF, PNG, JPG, WEBP ou HEIC.");

  const now = new Date();
  const key = `${ctx.workspaceId}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${randomUUID()}.${EXTENSIONS[mime]}`;
  await storage().put(key, input.data);
  try {
    const created = await prisma.attachment.create({
      data: {
        workspaceId: ctx.workspaceId,
        transactionId: transaction.id,
        fileName: safeFileName(input.fileName),
        mimeType: mime,
        sizeBytes: input.data.byteLength,
        storageKey: key,
        checksumSha256: createHash("sha256").update(input.data).digest("hex"),
        uploadedById: ctx.userId,
      },
    });
    await audit(prisma, ctx, {
      action: "attachment.create",
      entityType: "Attachment",
      entityId: created.id,
      after: { fileName: created.fileName, transactionId: transaction.id },
    });
    return toDTO(created);
  } catch (error) {
    await storage().remove(key);
    throw error;
  }
}

export async function listTransactionAttachments(
  ctx: ServiceContext,
  transactionId: string,
): Promise<AttachmentDTO[]> {
  const rows = await prisma.attachment.findMany({
    where: { workspaceId: ctx.workspaceId, transactionId, deletedAt: null },
    orderBy: { createdAt: "asc" },
  });
  return rows.map(toDTO);
}

export async function readAttachment(ctx: ServiceContext, id: string) {
  const a = await prisma.attachment.findFirst({
    where: { id, workspaceId: ctx.workspaceId, deletedAt: null },
  });
  if (!a) throw new AppError("NOT_FOUND");
  return { fileName: a.fileName, mimeType: a.mimeType, data: await storage().get(a.storageKey) };
}

export async function deleteAttachment(ctx: ServiceContext, id: string): Promise<void> {
  assertCan(ctx, "write");
  const a = await prisma.attachment.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!a) throw new AppError("NOT_FOUND");
  await prisma.attachment.delete({ where: { id } });
  await storage().remove(a.storageKey);
  await audit(prisma, ctx, {
    action: "attachment.delete",
    entityType: "Attachment",
    entityId: id,
    before: { fileName: a.fileName },
  });
}
