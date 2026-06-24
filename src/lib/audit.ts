import prisma from "./prisma";
import { Prisma } from "@prisma/client";

interface AuditOptions {
  userId: string;
  entidade: string;
  entidadeId: string;
  acao: string;
  dadosAntigos?: Record<string, unknown> | null;
  dadosNovos?: Record<string, unknown> | null;
  ip?: string;
  userAgent?: string;
}

export async function createAuditLog(options: AuditOptions) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: options.userId,
        entidade: options.entidade,
        entidadeId: options.entidadeId,
        acao: options.acao,
        dadosAntigos: options.dadosAntigos != null
          ? (options.dadosAntigos as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        dadosNovos: options.dadosNovos != null
          ? (options.dadosNovos as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        ip: options.ip,
        userAgent: options.userAgent,
      },
    });
  } catch (error) {
    console.error("Audit log error:", error);
  }
}

export function sanitizeForAudit(
  data: Record<string, unknown>
): Record<string, unknown> {
  const { senha, password, ...rest } = data;
  void senha;
  void password;
  return rest;
}
