import "server-only";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { supabaseAdmin } from "@/lib/supabase";
import { env } from "../env";

/** Armazenamento de arquivos: pasta local em desenvolvimento, Supabase Storage (bucket privado) na Vercel. */
export interface StorageProvider {
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
}

class LocalStorage implements StorageProvider {
  constructor(private readonly root: string) {}

  private resolve(key: string): string {
    // Chaves são geradas pelo sistema, mas nunca se confia nelas: impede sair da pasta raiz.
    const full = path.resolve(/*turbopackIgnore: true*/ this.root, key);
    if (!full.startsWith(this.root + path.sep)) throw new Error("Chave de armazenamento inválida.");
    return full;
  }

  async put(key: string, data: Buffer) {
    const full = this.resolve(key);
    await mkdir(path.dirname(/*turbopackIgnore: true*/ full), { recursive: true });
    await writeFile(full, data, { flag: "wx" });
  }

  async get(key: string) {
    return readFile(this.resolve(key));
  }

  async remove(key: string) {
    await rm(this.resolve(key), { force: true });
  }
}

const BUCKET = "fin-anexos";

class SupabaseStorage implements StorageProvider {
  private ready: Promise<void> | null = null;

  /** Cria o bucket privado na primeira gravação (idempotente). */
  private ensureBucket(): Promise<void> {
    this.ready ??= (async () => {
      const { error } = await supabaseAdmin.storage.createBucket(BUCKET, { public: false });
      if (error && !/already exists|duplicate/i.test(error.message)) throw new Error(error.message);
    })().catch((e) => {
      this.ready = null;
      throw e;
    });
    return this.ready;
  }

  async put(key: string, data: Buffer) {
    await this.ensureBucket();
    const { error } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(key, data, { upsert: false, contentType: "application/octet-stream" });
    if (error) throw new Error(error.message);
  }

  async get(key: string) {
    const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(key);
    if (error || !data) throw new Error(error?.message ?? "Arquivo não encontrado.");
    return Buffer.from(await data.arrayBuffer());
  }

  async remove(key: string) {
    const { error } = await supabaseAdmin.storage.from(BUCKET).remove([key]);
    if (error) throw new Error(error.message);
  }
}

let instance: StorageProvider | null = null;

export function storage(): StorageProvider {
  instance ??=
    env.STORAGE_DRIVER === "supabase"
      ? new SupabaseStorage()
      : new LocalStorage(path.resolve(/*turbopackIgnore: true*/ process.cwd(), env.STORAGE_DIR));
  return instance;
}
