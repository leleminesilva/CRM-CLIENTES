# Integração WhatsApp ↔ CRM + camada de IA

> Roteiro de evolução do módulo WhatsApp. Complementa [`whatsapp.md`](./whatsapp.md)
> (arquitetura do gateway/mensageria). Aqui é sobre **ligar o módulo no resto do
> CRM** (Clientes, Leads, Oportunidades, Tarefas, Dashboard) e sobre **onde a IA
> entra**. Referência de UI: template em `scratchpad/whatsapp-crm-template.html`
> (Callbell / Pipedrive / Zendesk como base).

## Princípio

O módulo já **mora dentro** do mesmo app Next.js e do mesmo banco (Prisma /
Supabase), com o mesmo login e o mesmo RBAC. "Integrar" não é API‑para‑API — são
três costuras: **modelo de dados** (FKs de vínculo), **eventos** (o pipeline
`emit`/`on` como barramento) e **UI** (cada lado aparecendo no outro).

---

## Parte 1 · Integração com o CRM principal

### 1.1 Modelo de dados — pontos de junção

`WhatsAppConversa` já tem `clienteId`. Acrescentar:

| Campo novo | Para quê |
|---|---|
| `WhatsAppConversa.leadId` (FK → `Lead`, opcional) | conversa ↔ Lead no pipeline |
| `WhatsAppConversa.oportunidadeId` (FK → `Oportunidade`, opcional) | conversa ↔ negócio (valor, etapa) — alimenta os cards "Negócio vinculado" e "Orçamento" |
| `Cliente.telefone` / `Lead.telefone` **normalizado e indexado** | chave natural de match (se ainda não existir num formato único) |

Serviço central **`resolverContato(telefoneBruto)`** (usa o
`normalizeWhatsAppPhone` de [`src/lib/utils/phone`](../../src/lib/utils/phone.ts)):

```
1. normaliza (só dígitos, DDI/DDD, 9º dígito)
2. Cliente por telefone  → vincula clienteId
3. senão Lead por telefone → vincula leadId
4. senão → desconhecido: bot de triagem / cria Lead novo
```

**Dedup** — casa pelos **últimos 8–9 dígitos**. Se houver mais de um registro:
**não fundir automaticamente**; marcar a conversa com `contatoAmbiguo = true` e
mostrar "2 registros com esse telefone — escolher" pro atendente. Fusão de
cadastro é operação manual e auditável.

### 1.2 Eventos — o barramento

O pipeline `emit`/`on` ([`src/lib/whatsapp/events.ts`](../../src/lib/whatsapp/events.ts))
já existe pra isso. Handlers novos (arquivo `src/lib/whatsapp/handlers.ts` ou
handlers do CRM que fazem `on(...)`):

| Evento | Handler |
|---|---|
| `MessageReceived` de número desconhecido | cria `Lead` (etapa "Contato Inicial"), atribui por rodízio, etiqueta "WhatsApp", vincula `leadId` na conversa |
| `ConversationResolved` com `oportunidadeId` | move a Oportunidade / cria `Tarefa` de follow‑up |
| `LeadStageChanged` (lado CRM) | ponto de extensão para disparo de mensagem de saída (ver Parte 2.3) |
| `ClienteUpdated` (lado CRM) | invalida o card de contato da conversa aberta (via Realtime) |

Regra: o módulo **emite** evento de domínio; o CRM **assina**. Sem acoplamento —
um handler novo não toca rota nem webhook.

### 1.3 UI — cada lado no outro

**Na conversa** (painel de contexto, coluna direita do template):
- card "Registro no CRM" → link pra `/clientes/[id]` ou `/leads/[id]`
- ações: "Criar cliente", "Criar lead", "Vincular a existente" (busca por nome/telefone)
- card "Negócio vinculado": etapa + valor da Oportunidade, editável inline ou link pro deal

**Na ficha do Cliente / Lead:**
- aba (ou bloco na timeline) "Conversas WhatsApp" com as conversas vinculadas
- botão "Abrir no WhatsApp" → deep link `/whatsapp?phone=...` (**já implementado**
  em [`whatsapp/page.tsx`](<../../src/app/(dashboard)/whatsapp/page.tsx>), `phoneParam`)

**No Kanban de Leads:**
- ícone de WhatsApp + contador de não lidas no card que tem conversa ativa
- clique → abre a conversa (`/whatsapp?phone=` ou `?conversa=`)

**No Dashboard:** métricas do WhatsApp (1ª resposta, resolução, conversão
conversa→negócio, por atendente/canal) entram como blocos do painel principal.

**Identidade:** `WhatsAppSessao.atendenteId` e o "responsável" de um Lead são o
mesmo `Usuario`. Ao atribuir uma conversa, oferecer "atribuir também o Lead a
esta pessoa".

### 1.4 Ordem de implementação (Parte 1)

1. Migration: `leadId` / `oportunidadeId` / `contatoAmbiguo` em `WhatsAppConversa`;
   garantir telefone normalizado+indexado em `Cliente` e `Lead`.
2. `resolverContato()` + dedup (com testes de match por sufixo).
3. Handler `MessageReceived` (desconhecido) → cria Lead vinculado.
4. Painel de contexto lendo dado real (cards Registro no CRM / Negócio).
5. Link reverso: bloco "Conversas WhatsApp" na ficha de Cliente/Lead.
6. Badge + deep link no card do Kanban.
7. Blocos de métrica no Dashboard.

---

## Parte 2 · Camada de IA

Três coisas distintas, do mais seguro (humano no loop) pro mais autônomo.
Credencial: `ANTHROPIC_API_KEY` já existe no projeto. Áudio precisa de um serviço
de transcrição à parte (**Whisper** — OpenAI/Groq); Claude não transcreve áudio.

### 2.1 IA que **ajuda a responder** (copiloto — humano envia)

**Pré‑requisito — base de conhecimento.** Um doc estruturado (a princípio um
arquivo curado; catálogo de vidraçaria é finito, não precisa de RAG/embeddings
no começo):
- tabela de preço por **tipo × espessura** de vidro (temperado 8/10mm, comum,
  laminado, espelho, jateado…)
- prazos de produção e instalação, área de entrega + frete
- formas de pagamento, garantias, políticas
- FAQ ("vocês fazem X?", horário, endereço)

Depois, no módulo:

| Recurso | Como | Risco |
|---|---|---|
| Botão **"Sugerir resposta"** no composer | Claude recebe conversa + resumo + Cliente/Lead + base → 1–3 rascunhos; atendente edita e envia | baixo (humano envia) |
| **Respostas rápidas dinâmicas** | "Enviar orçamento" já vem com valor calculado; "Prazo" puxa o prazo real | baixo |
| **Revisão de tom** | "encurtar", "mais formal", "revisar" sobre o rascunho | baixo |
| **Resumo da conversa** | card no topo da ficha (intenção, medidas, produto, orçamento, próximo passo) — já desenhado no template | baixo |

**Travas:** nunca inventar preço — se não está na base, o rascunho diz "vou
confirmar o valor". Logar toda sugestão (`aceita` / `editada` / `rejeitada`) numa
tabela pra ajuste depois. Modelo: Haiku no 1º passe (~R$ 0,01–0,03), Sonnet nos
casos difíceis. Chamadas de IA rodam **fora do webhook** (fila / job), pra um
modelo lento não segurar a resposta `200` pro gateway.

### 2.2 IA que **conduz a conversa** (bot com escape pra humano)

Evoluir o bot de triagem que já existe (`WhatsAppAgentEstado`:
`TRIAGEM / COLETANDO / AGUARDANDO_CONFIRMACAO / CONCLUIDO / HUMANO`):

- **Coleta guiada** pra número novo: pergunta o que precisa, medidas, cidade,
  prazo → preenche campos estruturados → cria o Lead já qualificado.
  **Passa pra humano** quando: precisa de preço, cliente pede uma pessoa, ou
  confiança baixa.
- **FAQ 24/7** da base: horário, endereço, "vocês fazem X?" — bot responde só.
- **Sempre com saída:** "falar com atendente" funciona sempre; humano entra no
  meio da conversa (estado `HUMANO` já modelado).
- **Progressão:** começa conservador (só qualifica + FAQ; humano faz tudo que
  tem preço) e amplia conforme a confiança nos logs.

### 2.3 **Iniciar conversas** (saída / proativo) — a parte que dá ban

Gatilhos vindos do CRM → o bot manda a **1ª mensagem**:
- Lead criado no site/telefone → abertura personalizada ("recebemos seu contato
  sobre o box de canto…")
- Lead parado em "Orçamento enviado" há N dias → follow‑up
- Instalação amanhã → lembrete · pós‑venda → pedido de avaliação

> ⚠️ **Risco central.** No protocolo **não‑oficial** (Evolution) dá pra mandar a
> 1ª mensagem livremente — e é exatamente esse padrão que **bane número**. Sem
> janela de 24h e sem template aprovado como na API oficial, a proteção tem que
> ser de processo:
> - só iniciar pra quem deu **opt‑in** (preencheu formulário, já te mandou
>   mensagem, é cliente) — **nunca lista fria**
> - limite de volume por número, com atraso e variação de texto (parecer humano)
> - número dedicado só pra saída se o volume crescer
> - devolve pra humano assim que o cliente responde

Papel da IA aqui: personalizar a abertura com os dados do Lead, escolher a hora,
escrever o follow‑up. Tudo configurado na aba **Automações** (gatilho → ação:
"enviar mensagem via bot, texto gerado pela IA").

### 2.4 Ordem de implementação (Parte 2)

1. Base de conhecimento (arquivo estruturado).
2. Botão "Sugerir resposta" (copiloto, humano envia) — maior valor, menor risco.
3. Respostas rápidas puxando dado real (orçamento, prazo).
4. Bot de coleta pra número novo → cria Lead, sempre com escape pra humano.
5. FAQ 24/7 da base.
6. Transcrição de áudio (Whisper) + alimenta o resumo.
7. Leitura de foto (Claude vision) → contexto pro orçamento.
8. Saída: follow‑up de orçamento parado (**só opt‑in**).
9. Saída: primeiro contato de Lead do site.

---

## Sequência recomendada juntando as duas partes

| Fase | Entrega |
|---|---|
| A | Aba **Canais** visível (resolve o "excluir escondido"); `resolverContato` + vínculo Lead automático |
| B | Painel de contexto real (Registro no CRM, Negócio) + status da conversa + atribuir |
| C | Base de conhecimento + botão "Sugerir resposta" + respostas rápidas dinâmicas |
| D | Quadro kanban de atendimento + filtros da fila + etiquetas |
| E | Bot de coleta pra número novo (cria Lead qualificado) + FAQ 24/7 |
| F | Áudio (Whisper) + foto (vision) + orçamento assistido + link de pagamento |
| G | Automações (UI de regras) + Dashboard de métricas |
| H | Saída proativa (follow‑up, primeiro contato) — só com opt‑in e limites |
