import "server-only";
import type { Prisma, PrismaClient } from "@prisma/client";
import crmPrisma from "@/lib/prisma";

/** O Financeiro usa o mesmo cliente Prisma do CRM (um só pool de conexões). */
export const prisma = crmPrisma;

export type Db = PrismaClient;
/** Cliente dentro de uma transação (`prisma.$transaction(async (tx) => ...)`). */
export type Tx = Prisma.TransactionClient;
/** Aceita o cliente normal ou o de transação: repositórios funcionam nos dois contextos. */
export type DbClient = Db | Tx;
