"use client";

import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { User, Users } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils/cn";

export interface AtribuicaoState {
  modo: "individual" | "compartilhado";
  submodo: "especificas" | "todos";
  pessoaIds: string[];
}

export const ATRIBUICAO_INICIAL: AtribuicaoState = {
  modo: "individual",
  submodo: "especificas",
  pessoaIds: [],
};

interface Usuario {
  id: string;
  nome: string;
  email: string;
  role: string;
}

// Converte o estado do seletor no payload extra esperado por POST /api/tarefas.
// Individual: nada extra (backend usa o responsável padrão). Compartilhado: ids específicos
// ou paraTodos — o backend cria uma cópia independente da tarefa por pessoa.
export function payloadAtribuicao(v: AtribuicaoState): { responsavelIds?: string[]; paraTodos?: boolean } {
  if (v.modo === "individual") return {};
  if (v.submodo === "todos") return { paraTodos: true };
  return { responsavelIds: v.pessoaIds };
}

export function atribuicaoValida(v: AtribuicaoState): boolean {
  if (v.modo === "individual") return true;
  if (v.submodo === "todos") return true;
  return v.pessoaIds.length > 0;
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-3 py-1 text-xs rounded-md font-medium transition-colors flex items-center gap-1",
        active ? "bg-background shadow-sm" : "text-muted-foreground"
      )}
    >
      {children}
    </button>
  );
}

export function SeletorAtribuicao({ value, onChange }: { value: AtribuicaoState; onChange: (v: AtribuicaoState) => void }) {
  const { data: usuarios } = useQuery({
    queryKey: ["usuarios-atribuicao"],
    queryFn: async () => {
      const { data } = await axios.get("/api/usuarios/ativos");
      return data.data as Usuario[];
    },
    enabled: value.modo === "compartilhado" && value.submodo === "especificas",
    staleTime: 5 * 60 * 1000,
  });

  function toggle(id: string) {
    const set = new Set(value.pessoaIds);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    onChange({ ...value, pessoaIds: Array.from(set) });
  }

  return (
    <div className="space-y-2">
      <Label>Atribuição</Label>
      <div className="flex items-center gap-1 bg-muted p-1 rounded-lg w-fit">
        <TabButton active={value.modo === "individual"} onClick={() => onChange({ ...value, modo: "individual" })}>
          Individual
        </TabButton>
        <TabButton active={value.modo === "compartilhado"} onClick={() => onChange({ ...value, modo: "compartilhado" })}>
          Compartilhado
        </TabButton>
      </div>

      {value.modo === "compartilhado" && (
        <div className="space-y-2 pl-3 border-l-2 border-muted ml-1">
          <div className="flex items-center gap-1 bg-muted p-1 rounded-lg w-fit">
            <TabButton active={value.submodo === "especificas"} onClick={() => onChange({ ...value, submodo: "especificas" })}>
              <User className="w-3 h-3" /> Pessoas específicas
            </TabButton>
            <TabButton active={value.submodo === "todos"} onClick={() => onChange({ ...value, submodo: "todos" })}>
              <Users className="w-3 h-3" /> Todos
            </TabButton>
          </div>

          {value.submodo === "especificas" && (
            <div className="max-h-36 overflow-y-auto space-y-0.5 border rounded-lg p-1.5">
              {!usuarios && <p className="text-xs text-muted-foreground px-1.5 py-1">Carregando...</p>}
              {usuarios?.length === 0 && <p className="text-xs text-muted-foreground px-1.5 py-1">Nenhum usuário ativo</p>}
              {usuarios?.map((u) => (
                <label key={u.id} className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-muted cursor-pointer text-sm">
                  <Checkbox checked={value.pessoaIds.includes(u.id)} onCheckedChange={() => toggle(u.id)} />
                  {u.nome}
                </label>
              ))}
            </div>
          )}
          {value.submodo === "todos" && (
            <p className="text-xs text-muted-foreground">Cria uma cópia da tarefa para todos os usuários ativos.</p>
          )}
        </div>
      )}
    </div>
  );
}
