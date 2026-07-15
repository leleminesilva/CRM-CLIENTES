"use client";

import { useRef, useState } from "react";
import { useTheme } from "next-themes";
import { AvatarCropDialog } from "@/components/ui/avatar-crop-dialog";
import { Moon, Sun, Monitor, Bell, User, Building2, Lock, Eye, EyeOff, Download, Upload, Database, Camera } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/AuthContext";
import { ROLE_LABELS } from "@/lib/utils/formatters";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import * as XLSX from "xlsx";

interface Prefs {
  leadNovo: boolean;
  tarefaVencendo: boolean;
  oportunidadeParada: boolean;
  clienteSemContato: boolean;
}

const NOTIF_OPTIONS: { key: keyof Prefs; label: string; desc: string }[] = [
  { key: "leadNovo", label: "Novo lead atribuído", desc: "Quando um lead é atribuído a você" },
  { key: "tarefaVencendo", label: "Tarefa vencendo", desc: "1 dia antes do vencimento" },
  { key: "oportunidadeParada", label: "Oportunidade parada", desc: "Sem movimentação por 7 dias" },
  { key: "clienteSemContato", label: "Cliente sem contato", desc: "Há mais de 30 dias sem contato" },
];

export default function ConfiguracoesPage() {
  const { theme, setTheme } = useTheme();
  const { user, refreshUser } = useAuth();
  const qc = useQueryClient();

  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [mostrarSenhas, setMostrarSenhas] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [periodoDE, setPeriodoDE] = useState("");
  const [periodoATE, setPeriodoATE] = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const isAdmin = user?.role === "ADMINISTRADOR" || user?.role === "DESENVOLVEDOR";

  function handleAvatarSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setCropSrc(url);
    if (avatarInputRef.current) avatarInputRef.current.value = "";
  }

  async function handleCropConfirm(blob: Blob) {
    setAvatarUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", new File([blob], "avatar.jpg", { type: "image/jpeg" }));
      await axios.post("/api/usuarios/avatar", fd);
      await refreshUser();
      toast.success("Foto atualizada!");
      setCropSrc(null);
    } catch (err) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error ?? "Erro ao enviar foto" : "Erro ao enviar foto";
      toast.error(msg);
    } finally {
      setAvatarUploading(false);
    }
  }

  async function handleExport(de?: string, ate?: string) {
    setExportando(true);
    try {
      const params = new URLSearchParams();
      if (de) params.set("de", de);
      if (ate) params.set("ate", ate);
      const { data } = await axios.get(`/api/admin/backup?${params}`);
      const ws = XLSX.utils.json_to_sheet(data.data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Clientes");
      const suffix = de && ate ? `${de}_${ate}` : de ? `a-partir-${de}` : ate ? `ate-${ate}` : new Date().toISOString().split("T")[0];
      XLSX.writeFile(wb, `clientes-${suffix}.xlsx`);
      toast.success(`${data.total} clientes exportados com sucesso`);
    } catch {
      toast.error("Erro ao exportar dados");
    } finally {
      setExportando(false);
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportando(true);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: "" });

      if (rows.length === 0) { toast.error("Arquivo vazio ou formato inválido"); return; }

      const { data } = await axios.post("/api/admin/backup", { rows });
      toast.success(`Importação concluída: ${data.criados} criados, ${data.ignorados} ignorados`);
      if (data.erros?.length > 0) toast.error(`${data.erros.length} erro(s) ao importar`);
    } catch {
      toast.error("Erro ao importar arquivo");
    } finally {
      setImportando(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const mudarSenhaMutation = useMutation({
    mutationFn: () => axios.post("/api/usuarios/mudar-senha", { senhaAtual, novaSenha }),
    onSuccess: () => {
      toast.success("Senha alterada com sucesso!");
      setSenhaAtual("");
      setNovaSenha("");
      setConfirmarSenha("");
    },
    onError: (err) => {
      const msg = axios.isAxiosError(err)
        ? err.response?.data?.error ?? "Erro ao alterar senha"
        : "Erro ao alterar senha";
      toast.error(msg);
    },
  });

  // Notification prefs
  const { data: prefs } = useQuery<Prefs>({
    queryKey: ["prefs-notificacoes"],
    queryFn: async () => {
      const { data } = await axios.get("/api/configuracoes/notificacoes");
      return data.data as Prefs;
    },
  });

  const prefsMutation = useMutation({
    mutationFn: (newPrefs: Prefs) => axios.put("/api/configuracoes/notificacoes", newPrefs),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prefs-notificacoes"] });
      toast.success("Preferências salvas");
    },
    onError: () => toast.error("Erro ao salvar preferências"),
  });

  function togglePref(key: keyof Prefs, value: boolean) {
    const updated: Prefs = {
      leadNovo: true,
      tarefaVencendo: true,
      oportunidadeParada: true,
      clienteSemContato: true,
      ...(prefs ?? {}),
      [key]: value,
    };
    prefsMutation.mutate(updated);
  }

  function handleMudarSenha(e: React.FormEvent) {
    e.preventDefault();
    if (novaSenha.length < 6) return toast.error("A nova senha deve ter pelo menos 6 caracteres");
    if (novaSenha !== confirmarSenha) return toast.error("As senhas não coincidem");
    mudarSenhaMutation.mutate();
  }

  const themes = [
    { value: "light", label: "Claro", icon: Sun },
    { value: "dark", label: "Escuro", icon: Moon },
    { value: "system", label: "Sistema", icon: Monitor },
  ];

  return (
    <div className="max-w-3xl space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold">Configurações</h2>
        <p className="text-muted-foreground">Gerencie suas preferências</p>
      </div>

      {/* Perfil */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="w-4 h-4" />
            Meu Perfil
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div
              className="relative group cursor-pointer shrink-0"
              onClick={() => avatarInputRef.current?.click()}
              title="Clique para alterar foto"
            >
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.nome}
                  className="w-16 h-16 rounded-full object-cover"
                />
              ) : (
                <div className="w-16 h-16 bg-indigo-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                  {user?.nome?.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                {avatarUploading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Camera className="w-5 h-5 text-white" />
                )}
              </div>
            </div>
            <div>
              <p className="font-semibold text-lg">{user?.nome}</p>
              <p className="text-muted-foreground">{user?.email}</p>
              <p className="text-sm text-indigo-600 font-medium">{ROLE_LABELS[user?.role || ""]}</p>
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors mt-0.5"
                disabled={avatarUploading}
              >
                {avatarUploading ? "Enviando..." : "Alterar foto"}
              </button>
            </div>
          </div>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarSelect}
          />
        </CardContent>
      </Card>

      {/* Alterar Senha */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Lock className="w-4 h-4" />
            Alterar Senha
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleMudarSenha} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Senha atual</Label>
              <div className="relative">
                <Input
                  type={mostrarSenhas ? "text" : "password"}
                  placeholder="Digite sua senha atual"
                  value={senhaAtual}
                  onChange={e => setSenhaAtual(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenhas(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {mostrarSenhas ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Nova senha</Label>
              <Input
                type={mostrarSenhas ? "text" : "password"}
                placeholder="Mínimo 6 caracteres"
                value={novaSenha}
                onChange={e => setNovaSenha(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Confirmar nova senha</Label>
              <Input
                type={mostrarSenhas ? "text" : "password"}
                placeholder="Repita a nova senha"
                value={confirmarSenha}
                onChange={e => setConfirmarSenha(e.target.value)}
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700"
              disabled={!senhaAtual || !novaSenha || !confirmarSenha || mudarSenhaMutation.isPending}
            >
              {mudarSenhaMutation.isPending ? "Alterando..." : "Alterar Senha"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Aparência */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Monitor className="w-4 h-4" />
            Aparência
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Label className="mb-3 block">Tema</Label>
          <div className="grid grid-cols-3 gap-3">
            {themes.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-colors ${
                  theme === value
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-sm font-medium">{label}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Notificações */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="w-4 h-4" />
            Notificações
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {NOTIF_OPTIONS.map((item) => (
            <div key={item.key} className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
              <Switch
                checked={prefs ? prefs[item.key] : true}
                onCheckedChange={(v) => togglePref(item.key, v)}
                disabled={prefsMutation.isPending}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Backup — Admin only */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="w-4 h-4" />
              Backup de Dados
            </CardTitle>
            <CardDescription>
              Exporte clientes para Excel ou importe uma planilha para cadastrar em lote.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">

            {/* Exportar completo */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Exportar tudo</p>
              <Button
                className="w-full bg-indigo-600 hover:bg-indigo-700"
                onClick={() => handleExport()}
                disabled={exportando}
              >
                <Download className="w-4 h-4 mr-2" />
                {exportando ? "Exportando..." : "Baixar cópia completa (Excel)"}
              </Button>
            </div>

            <Separator />

            {/* Exportar por período */}
            <div className="space-y-3">
              <p className="text-sm font-medium">Exportar por período</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">De</Label>
                  <Input
                    type="date"
                    value={periodoDE}
                    onChange={(e) => setPeriodoDE(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Até</Label>
                  <Input
                    type="date"
                    value={periodoATE}
                    onChange={(e) => setPeriodoATE(e.target.value)}
                  />
                </div>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => handleExport(periodoDE || undefined, periodoATE || undefined)}
                disabled={exportando || (!periodoDE && !periodoATE)}
              >
                <Download className="w-4 h-4 mr-2" />
                {exportando ? "Exportando..." : "Baixar período selecionado"}
              </Button>
            </div>

            <Separator />

            {/* Importar */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Importar planilha</p>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => fileInputRef.current?.click()}
                disabled={importando}
              >
                <Upload className="w-4 h-4 mr-2" />
                {importando ? "Importando..." : "Selecionar arquivo (.xlsx / .csv)"}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleImport}
              />
              <p className="text-xs text-muted-foreground">
                Use o mesmo formato da exportação. Clientes com mesmo nome + telefone serão ignorados automaticamente.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {cropSrc && (
        <AvatarCropDialog
          open={!!cropSrc}
          imageSrc={cropSrc}
          onClose={() => setCropSrc(null)}
          onConfirm={handleCropConfirm}
          loading={avatarUploading}
        />
      )}

      {/* Sistema */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            Sobre o Sistema
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <div className="flex justify-between">
            <span>Versão</span>
            <span className="font-medium text-foreground">1.0.0</span>
          </div>
          <Separator />
          <div className="flex justify-between">
            <span>Stack</span>
            <span className="font-medium text-foreground">Next.js 14 + Prisma + Supabase</span>
          </div>
          <Separator />
          <div className="flex justify-between">
            <span>Ambiente</span>
            <span className="font-medium text-foreground">{process.env.NODE_ENV}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
