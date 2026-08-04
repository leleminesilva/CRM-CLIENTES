"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { Shield, Filter } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDateTime } from "@/lib/utils/formatters";
import type { AuditLog } from "@/types";

const ACAO_COLORS: Record<string, string> = {
  CREATE: "success",
  UPDATE: "warning",
  DELETE: "destructive",
};

export default function AuditoriaPage() {
  const [page, setPage] = useState(1);
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [entidade, setEntidade] = useState("");
  const [acao, setAcao] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["auditoria", page, de, ate, entidade, acao],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (de) params.set("de", de);
      if (ate) params.set("ate", ate);
      if (entidade) params.set("entidade", entidade);
      if (acao) params.set("acao", acao);
      const { data } = await axios.get(`/api/auditoria?${params}`);
      return data;
    },
  });

  const logs: AuditLog[] = data?.data || [];
  const totalPages = data?.totalPages || 1;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="w-6 h-6" />
          Auditoria
        </h2>
        <p className="text-muted-foreground">Registro completo de alterações no sistema</p>
      </div>

      {/* Filtros */}
      <Card className="p-4">
        <div className="flex items-end gap-3 flex-wrap">
          <div className="space-y-1.5">
            <Label>Entidade</Label>
            <Input value={entidade} onChange={e => setEntidade(e.target.value)} placeholder="Ex: Cliente, Lead" className="w-40" />
          </div>
          <div className="space-y-1.5">
            <Label>Ação</Label>
            <Select value={acao || "TODAS"} onValueChange={(v) => setAcao(v === "TODAS" ? "" : v)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TODAS">Todas</SelectItem>
                <SelectItem value="CREATE">Criação</SelectItem>
                <SelectItem value="UPDATE">Edição</SelectItem>
                <SelectItem value="DELETE">Exclusão</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Data inicial</Label>
            <Input type="date" value={de} onChange={e => setDe(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Data final</Label>
            <Input type="date" value={ate} onChange={e => setAte(e.target.value)} />
          </div>
          <Button variant="outline" size="sm">
            <Filter className="w-4 h-4 mr-2" />
            Filtrar
          </Button>
        </div>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-4 font-medium text-muted-foreground">Usuário</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Entidade</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Ação</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Data/Hora</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [...Array(10)].map((_, i) => (
                  <tr key={i} className="border-b">
                    {[...Array(4)].map((_, j) => (
                      <td key={j} className="p-4">
                        <div className="h-4 bg-muted animate-pulse rounded" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-12 text-center text-muted-foreground">
                    <Shield className="w-8 h-8 mx-auto mb-3 opacity-40" />
                    <p>Nenhum log encontrado</p>
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="border-b hover:bg-muted/30">
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <Avatar className="w-7 h-7">
                          <AvatarFallback className="text-xs bg-indigo-100 text-indigo-600">
                            {log.user?.nome?.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{log.user?.nome}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div>
                        <p className="font-medium">{log.entidade}</p>
                        <p className="text-xs text-muted-foreground font-mono truncate max-w-[120px]">
                          {log.entidadeId}
                        </p>
                      </div>
                    </td>
                    <td className="p-4">
                      <Badge variant={ACAO_COLORS[log.acao] as "default" | "success" | "warning" | "destructive"}>
                        {log.acao}
                      </Badge>
                    </td>
                    <td className="p-4 text-muted-foreground">
                      {formatDateTime(log.createdAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t">
            <p className="text-sm text-muted-foreground">Página {page} de {totalPages}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
              <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Próxima</Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
