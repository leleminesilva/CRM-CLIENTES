import type { DbClient } from "./db";
import type { ServiceContext } from "./permissions";

type Snapshot = Record<string, unknown> | null | undefined;

/** Converte Decimal, Date e afins em valores JSON estáveis para comparação e gravação. */
function normalize(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    if ("toFixed" in value && typeof (value as { toFixed: unknown }).toFixed === "function") {
      return String(value);
    }
    if (Array.isArray(value)) return value.map(normalize);
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, normalize(v)]));
  }
  return value;
}

/** Só os campos que mudaram: { campo: { before, after } }. */
export function diffSnapshots(before: Snapshot, after: Snapshot) {
  const b = (normalize(before ?? {}) ?? {}) as Record<string, unknown>;
  const a = (normalize(after ?? {}) ?? {}) as Record<string, unknown>;
  const ignored = new Set(["updatedAt", "createdAt"]);
  const changes: Record<string, { before: unknown; after: unknown }> = {};
  for (const key of new Set([...Object.keys(b), ...Object.keys(a)])) {
    if (ignored.has(key)) continue;
    if (JSON.stringify(b[key]) !== JSON.stringify(a[key])) {
      changes[key] = { before: b[key] ?? null, after: a[key] ?? null };
    }
  }
  return changes;
}

export interface AuditEntry {
  action: string;
  entityType?: string;
  entityId?: string;
  before?: Snapshot;
  after?: Snapshot;
}

export async function audit(db: DbClient, ctx: ServiceContext, entry: AuditEntry): Promise<void> {
  const changes = diffSnapshots(entry.before, entry.after);
  await db.finAuditLog.create({
    data: {
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      action: entry.action,
      entityType: entry.entityType ?? null,
      entityId: entry.entityId ?? null,
      changes: Object.keys(changes).length > 0 ? (changes as object) : undefined,
    },
  });
}
