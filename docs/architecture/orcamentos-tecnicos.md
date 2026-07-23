# Arquitetura do módulo Orçamentos Técnicos

> Documento vivo — atualizar a cada fase implementada.
>
> **Status: Fases 0-4 implementadas e publicadas em produção** (schema, RBAC, navegação, guarda de acesso, seed estrutural do catálogo, CRUD de catálogo, motor de orçamento, ordens de serviço, sobras de material). Todas testadas ponta a ponta no navegador antes de publicar. Ver plano original em `~/.claude/plans/silly-watching-octopus.md` no ambiente de quem construiu isso, ou a seção [Plano de fases](#plano-de-fases) abaixo.

## Visão geral

Módulo interno que recria, dentro do próprio CRM, o motor de orçamento técnico usado por ERPs verticais de serralheria/vidraçaria (mapeado a partir do Alumy/manageasy.com.br). **Restrito ao cargo `DESENVOLVEDOR`** — nem `ADMINISTRADOR` tem acesso, tanto no menu quanto em toda rota de API.

Fora de escopo deliberadamente: Notas Fiscais, Estoque completo, Markup automático (no produto de referência são add-ons pagos separados, nunca inspecionados de fato) e Mapa de Clientes/geocodificação (adiado a pedido do usuário).

## Modelo de cálculo

Cada item de orçamento pertence a um `ProdutoCatalogo` dentro de uma `LinhaProduto`. O produto tem um `modoCalculo`:

- **AREA** — largura × altura do vão (mm) → m² × `VarianteProduto.precoUnitario`.
- **LINEAR** — comprimento (mm) → metros × `VarianteProduto.precoUnitario`.
- **UNIDADE** — `ProdutoCatalogo.precoBase` fixo, sem dimensão.

Cada `VarianteProduto` é um SKU já combinado (ex.: "6mm Temperado Liso"), com preço próprio — não uma faceta somável com outras. Um item escolhe no máximo uma variante.

```
precoCalculado = (área_m² | metros) × variante.precoUnitario   [ou produtoBase, se sem variante]
totalItem      = (precoCalculado × quantidade) + acrescimoValor   // acréscimo é flat, não escala com quantidade
subtotal       = soma(itens.totalItem)
desconto       = descontoValor ?? (subtotal × descontoPercentual / 100)
valorTotal     = subtotal - desconto
```

Uma vez salvo, `precoCalculado`/`totalItem` de um item **não são recalculados** se o catálogo mudar depois — o mesmo princípio de uma nota já emitida.

"Atrasado" (Ordem de Serviço) não é um status persistido — é derivado comparando `previsaoEntrega` com a data atual, calculado em tempo de renderização na UI, nunca cacheado pela API.

## Modelo de dados

`LinhaProduto` 1—N `ProdutoCatalogo` 1—N `VarianteProduto`. `OrcamentoTecnico` (opcionalmente ligado a `Cliente` e a um `User` responsável) 1—N `ItemOrcamentoTecnico` (cada um aponta pra um `ProdutoCatalogo` + opcionalmente uma `VarianteProduto`), e 1—1 opcional com `OrdemServico` (criada só via aprovação do orçamento). `SobraMaterial` é um cadastro manual de reaproveitamento, sem algoritmo de otimização de corte nesta versão.

Ver `prisma/schema.prisma` (seção "ORÇAMENTOS TÉCNICOS") para os campos exatos.

## Acesso

- `src/lib/rbac.ts`: permissões `catalogo:*`, `orcamentos_tecnicos:*`, `ordens_servico:*`, `sobras_material:*` adicionadas **somente** ao array de `DESENVOLVEDOR`, deliberadamente fora de `ADMIN_PERMISSIONS` — mesmo padrão do `whatsapp:*`.
- `src/components/layout/Sidebar.tsx`: item "Orçamentos Técnicos" com `roles: ["DESENVOLVEDOR"]`.
- `src/app/(dashboard)/orcamentos-tecnicos/layout.tsx`: guarda de acesso client-side (mostra "Acesso restrito" pra quem não é Desenvolvedor) — mais forte que o padrão do resto do CRM, onde a maioria das páginas confia só no menu escondido + API 403.
- Toda rota de API do módulo deve checar `hasPermission(role, "...")` explicitamente e devolver 403 — não usar `requirePermission` dentro de try/catch genérico (existe um bug conhecido em `oportunidades/route.ts` onde isso vira 500).

## Seed

`prisma/seedOrcamentosTecnicos.ts` (rodar com `npm run prisma:seed:orcamentos-tecnicos`) — script separado do `prisma/seed.ts` principal porque aquele é dado de demonstração não-idempotente (não seguro de rodar contra produção). Este aqui só faz upsert da estrutura de catálogo (`prisma/seedData/catalogoAlumy.ts`: as 23 linhas reais mapeadas do Alumy, com produtos só nas 2 linhas que foram de fato inspecionadas — VIDROS e CORRIMÃO), preço sempre zerado, seguro de rodar mais de uma vez.

## Plano de fases

0. Schema + RBAC + navegação + guarda de acesso + seed estrutural (**feito**).
1. Catálogo — CRUD de linhas/produtos/variantes (**feito**).
2. Motor de orçamento — `calc.ts` + `OrcamentoForm.tsx` (lista de itens como estado local, dialog de item com preview ao vivo) + cálculo ao vivo (**feito**).
3. Ordens de Serviço — rota `aprovar` (transação: orçamento vira APROVADO + cria OS), lista com progresso e atraso calculado em tempo de renderização (**feito**).
4. Sobras de Material — CRUD simples, sem otimização de corte (**feito**).

## Próximos passos possíveis (fora do escopo original)

- Preencher preços reais do catálogo (o usuário tem acesso administrador ao Alumy pra conferir a tabela de preços real).
- Mapa de Clientes/geocodificação — adiado a pedido do usuário na Fase 0.
- Otimização de corte automática em Sobras de Material (o "Conferir otimização" do Alumy) — deliberadamente fora de escopo por complexidade.
- Integração "sugerir sobra disponível" ao adicionar um item de orçamento — hoje Sobras de Material é independente do motor de orçamento.
