"use client";

import { FileIcon, ImageIcon, PaperclipIcon, XIcon } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@fin/components/ui/button";
import { handleActionResult } from "@fin/lib/action-result";
import { deleteAttachmentAction, listAttachmentsAction } from "@fin/modules/attachments/actions";
import type { AttachmentDTO } from "@fin/modules/attachments/service";

const MAX_BYTES = 10 * 1024 * 1024;

function formatSize(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

async function upload(transactionId: string, file: File): Promise<AttachmentDTO | null> {
  const form = new FormData();
  form.set("transactionId", transactionId);
  form.set("file", file);
  const response = await fetch("/api/fin/arquivos", { method: "POST", body: form });
  const body = (await response.json().catch(() => null)) as
    (AttachmentDTO & { message?: string }) | null;
  if (!response.ok) {
    toast.error(body?.message ?? "Não foi possível enviar o arquivo.");
    return null;
  }
  return body;
}

/** Envia anexos de um lançamento já salvo. Fora do formulário principal (não depende do "Salvar"). */
export function ExistingAttachments({ transactionId }: { transactionId: string }) {
  const [items, setItems] = React.useState<AttachmentDTO[] | null>(null);
  const [busy, setBusy] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    let alive = true;
    void listAttachmentsAction({ transactionId }).then((r) => alive && setItems(r?.data ?? []));
    return () => {
      alive = false;
    };
  }, [transactionId]);

  async function add(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    for (const file of Array.from(files)) {
      if (file.size > MAX_BYTES) {
        toast.error(`“${file.name}” passa de 10 MB.`);
        continue;
      }
      const created = await upload(transactionId, file);
      if (created) setItems((cur) => [...(cur ?? []), created]);
    }
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function remove(item: AttachmentDTO) {
    if (handleActionResult(await deleteAttachmentAction({ id: item.id }))) {
      setItems((cur) => (cur ?? []).filter((i) => i.id !== item.id));
      toast.success("Anexo removido");
    }
  }

  return (
    <div className="grid gap-2">
      {items === null ? <p className="text-[13px] text-ink-3">Carregando anexos…</p> : null}
      {items?.length ? (
        <ul className="grid gap-1.5">
          {items.map((a) => (
            <li
              key={a.id}
              className="flex items-center gap-2 rounded-control border border-line px-2.5 py-1.5 text-sm"
            >
              {a.mimeType.startsWith("image/") ? (
                <ImageIcon className="size-4 text-ink-3" />
              ) : (
                <FileIcon className="size-4 text-ink-3" />
              )}
              <a
                href={`/api/fin/arquivos/${a.id}`}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 flex-1 truncate underline-offset-4 hover:underline"
              >
                {a.fileName}
              </a>
              <span className="text-xs text-ink-3 nums">{formatSize(a.sizeBytes)}</span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Remover ${a.fileName}`}
                onClick={() => void remove(a)}
              >
                <XIcon />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      <input
        ref={inputRef}
        type="file"
        multiple
        hidden
        accept="application/pdf,image/png,image/jpeg,image/webp,image/heic"
        onChange={(e) => void add(e.target.files)}
        aria-label="Escolher comprovantes"
      />
      <div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
        >
          <PaperclipIcon /> {busy ? "Enviando…" : "Anexar comprovante"}
        </Button>
        <span className="ml-2 text-xs text-ink-3">PDF, PNG, JPG, WEBP ou HEIC · até 10 MB</span>
      </div>
    </div>
  );
}

/** Arquivos escolhidos antes de salvar (enviados logo depois que o lançamento é criado). */
export function PendingAttachments({
  files,
  onChange,
}: {
  files: File[];
  onChange: (files: File[]) => void;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  return (
    <div className="grid gap-2">
      {files.length ? (
        <ul className="grid gap-1.5">
          {files.map((f, i) => (
            <li
              key={`${f.name}-${i}`}
              className="flex items-center gap-2 rounded-control border border-line px-2.5 py-1.5 text-sm"
            >
              <FileIcon className="size-4 text-ink-3" />
              <span className="min-w-0 flex-1 truncate">{f.name}</span>
              <span className="text-xs text-ink-3 nums">{formatSize(f.size)}</span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Remover ${f.name}`}
                onClick={() => onChange(files.filter((_, j) => j !== i))}
              >
                <XIcon />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      <input
        ref={inputRef}
        type="file"
        multiple
        hidden
        accept="application/pdf,image/png,image/jpeg,image/webp,image/heic"
        aria-label="Escolher comprovantes"
        onChange={(e) => {
          const picked = Array.from(e.target.files ?? []);
          const tooBig = picked.filter((f) => f.size > MAX_BYTES);
          if (tooBig.length)
            toast.error(`${tooBig.map((f) => `“${f.name}”`).join(", ")} passa de 10 MB.`);
          onChange([...files, ...picked.filter((f) => f.size <= MAX_BYTES)].slice(0, 10));
          if (inputRef.current) inputRef.current.value = "";
        }}
      />
      <div>
        <Button variant="secondary" size="sm" onClick={() => inputRef.current?.click()}>
          <PaperclipIcon /> Anexar comprovante
        </Button>
        <span className="ml-2 text-xs text-ink-3">PDF, PNG, JPG, WEBP ou HEIC · até 10 MB</span>
      </div>
    </div>
  );
}

export { upload as uploadAttachment };
