"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { ArrowLeft, Globe, Phone, Mail, MapPin, Users, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PORTE_LABELS } from "@/lib/utils/formatters";

export default function EmpresaDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { data: empresa, isLoading } = useQuery({
    queryKey: ["empresa", id],
    queryFn: async () => {
      const { data } = await axios.get(`/api/empresas/${id}`);
      return data.data;
    },
  });

  if (isLoading) {
    return <div className="h-64 bg-muted animate-pulse rounded-xl" />;
  }

  if (!empresa) return <div className="text-muted-foreground">Empresa não encontrada</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900 rounded-xl flex items-center justify-center">
              <Building2 className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">{empresa.nomeFantasia || empresa.razaoSocial}</h2>
              {empresa.nomeFantasia && <p className="text-muted-foreground">{empresa.razaoSocial}</p>}
            </div>
          </div>
        </div>
        {empresa.porte && <Badge variant="secondary">{PORTE_LABELS[empresa.porte]}</Badge>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Informações de Contato</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {empresa.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <a href={`mailto:${empresa.email}`} className="hover:underline">{empresa.email}</a>
              </div>
            )}
            {empresa.telefone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <span>{empresa.telefone}</span>
              </div>
            )}
            {empresa.website && (
              <div className="flex items-center gap-2 text-sm">
                <Globe className="w-4 h-4 text-muted-foreground" />
                <a href={empresa.website} target="_blank" rel="noreferrer" className="hover:underline text-indigo-600">
                  {empresa.website}
                </a>
              </div>
            )}
            {empresa.logradouro && (
              <div className="flex items-start gap-2 text-sm">
                <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <span>{empresa.logradouro}, {empresa.numero} — {empresa.cidade}/{empresa.estado}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4" />
              Contatos ({(empresa.contatos || []).length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(empresa.contatos || []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum contato cadastrado</p>
            ) : (
              empresa.contatos.map((c: { id: string; nome: string; cargo?: string; email?: string; principal?: boolean }) => (
                <div key={c.id} className="flex items-center gap-3">
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="text-xs bg-violet-100 text-violet-600">
                      {c.nome.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-sm">{c.nome}</p>
                    {c.cargo && <p className="text-xs text-muted-foreground">{c.cargo}</p>}
                  </div>
                  {c.principal && <Badge variant="secondary" className="ml-auto text-xs">Principal</Badge>}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {empresa.segmento && (
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Segmento: <span className="font-medium text-foreground">{empresa.segmento}</span></p>
        </Card>
      )}

      {empresa.observacoes && (
        <Card className="p-4">
          <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide font-medium">Observações</p>
          <p className="text-sm">{empresa.observacoes}</p>
        </Card>
      )}
    </div>
  );
}
