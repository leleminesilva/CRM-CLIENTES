import "server-only";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "../env";

/** Armazenamento de arquivos. Local hoje; S3/Supabase Storage implementam a mesma interface. */
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

let instance: StorageProvider | null = null;

export function storage(): StorageProvider {
  instance ??= new LocalStorage(path.resolve(/*turbopackIgnore: true*/ process.cwd(), env.STORAGE_DIR));
  return instance;
}
