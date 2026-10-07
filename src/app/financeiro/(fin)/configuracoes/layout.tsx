import type * as React from "react";
import { SubNav } from "@fin/components/layout/sub-nav";

const ITEMS = [
  { href: "/financeiro/configuracoes/categorias", label: "Categorias" },
  { href: "/financeiro/configuracoes/lixeira", label: "Lixeira" },
  { href: "/financeiro/configuracoes/dados", label: "Dados" },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        <h1 className="title-page">Configurações</h1>
        <p className="text-sm text-ink-2">
          Categorias, lixeira e exportação dos dados.
        </p>
      </div>
      <SubNav items={ITEMS} label="Seções de configurações" />
      <div>{children}</div>
    </div>
  );
}
