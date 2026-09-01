# Roteiro: provisionar a VPS do gateway WhatsApp (Fase 5)

> Guia operacional passo a passo — complementa `docs/architecture/whatsapp.md` (decisões de arquitetura). Este documento é sobre **o que fazer na prática** pra colocar a Evolution API no ar. Os comandos exatos da Evolution API (nomes de variável de ambiente, endpoints) podem ter mudado desde a escrita — se algo não bater, confira a documentação oficial em [github.com/EvolutionAPI/evolution-api](https://github.com/EvolutionAPI/evolution-api) antes de adaptar.
>
> **Revisão 2026-08-31:** env vars da seção 5 conferidas contra o `.env.example` do `evolution-api` v2 (imagem `evoapicloud/evolution-api:v2.1.1`). Mudanças em relação à 1ª versão deste roteiro: imagem passou de `atendai/evolution-api` → `evoapicloud/evolution-api`; `DATABASE_ENABLED` não existe mais; `WEBHOOK_GLOBAL_WEBHOOK_BASE64` saiu do env global (base64 de mídia virou config por instância — ver nota na seção 5). Primeiro teste será contra o ambiente **local** via túnel ngrok, não produção.

## Antes de começar — o que você precisa ter em mãos

- [ ] Um cartão pra pagar a VPS (~US$20-25/mês na configuração recomendada)
- [ ] Um domínio ou subdomínio que você controla. Necessário porque HTTPS com certificado válido exige um domínio apontando pro servidor — sem isso o gateway não fica acessível com segurança pela internet.
  - **Você vai registrar um novo.** Registro.br (`.com.br`, ~R$40/ano, precisa de CPF/CNPJ) ou, mais rápido pra pagar em cartão internacional, Cloudflare Registrar / Namecheap (`.com`, ~US$10/ano). Depois de registrar, o painel de DNS é onde você cria o registro `A` da seção 4. Se usar Cloudflare como DNS, deixe o registro **"DNS only" (nuvem cinza)** até o Certbot emitir o certificado — o proxy laranja na frente atrapalha a validação HTTP-01.
  - Escolha o nome antes de começar: pode ser um domínio dedicado (`gw-empresa.com`) ou um subdomínio de um que você já vai ter (`whatsapp.empresa.com.br`). O roteiro usa `whatsapp.suaempresa.com.br` como placeholder — troque em todos os lugares.
- [ ] `ngrok` instalado no seu Mac (`brew install ngrok` + `ngrok config add-authtoken <token>` da conta grátis) — o primeiro teste é contra o `localhost:3000`, não produção.
- [ ] ~1h pra fazer tudo com calma na primeira vez.

## 1. Escolher e criar a VPS

**Recomendado: [Vultr](https://www.vultr.com)** — tem região São Paulo, interface simples, cobrança por hora. Alternativas: DigitalOcean (sem região Brasil, mas também simples) ou Hetzner (mais barato, só Europa/EUA — maior latência).

1. Crie uma conta na Vultr.
2. **Deploy New Server** → **Cloud Compute** (não precisa de GPU nem nada especial).
3. **Location**: São Paulo (BR).
4. **Server Image**: Ubuntu 22.04 LTS.
5. **Server Size**: pelo menos 2 vCPU / 4GB RAM / 80GB SSD (plano ~US$20-24/mês na Vultr).
6. **SSH Keys**: adicione sua chave pública SSH (se não tiver uma, gere com `ssh-keygen -t ed25519` no seu Mac e cole o conteúdo de `~/.ssh/id_ed25519.pub`).
7. Deploy. Anote o IP público que aparece.

## 2. Configuração inicial do servidor

```bash
ssh root@SEU_IP_AQUI

# Atualiza pacotes
apt update && apt upgrade -y

# Cria um usuário não-root pra uso do dia a dia (boa prática — evita rodar tudo como root)
adduser deploy
usermod -aG sudo deploy
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy

# Firewall — só abre o essencial (SSH, HTTP, HTTPS)
ufw allow OpenSSH
ufw allow 80
ufw allow 443
ufw enable
```

Daqui pra frente, conecte como `deploy`, não `root`: `ssh deploy@SEU_IP_AQUI`.

## 3. Instalar Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Desconecta e reconecta o SSH pra o grupo docker valer
```

Confirme: `docker --version` e `docker compose version`.

## 4. Apontar o domínio pra VPS

No painel DNS do seu domínio (Registro.br, Cloudflare, etc.), crie um registro:
```
Tipo: A
Nome: whatsapp (ou o subdomínio que preferir)
Valor: SEU_IP_AQUI
TTL: padrão
```
Espera propagar (geralmente minutos, pode levar até 1h). Confirma com `ping whatsapp.suaempresa.com.br` do seu Mac — deve responder o IP da VPS.

## 5. Subir a Evolution API + Postgres + Redis via Docker Compose

Na VPS, como usuário `deploy`:

```bash
mkdir -p ~/evolution && cd ~/evolution
nano docker-compose.yml
```

Crie um `.env` ao lado do compose (segredos ficam fora do YAML) — **use os valores gerados na abertura desta sessão** ou gere os seus com `openssl rand -hex 32` / `openssl rand -hex 24`:

```bash
nano ~/evolution/.env
```

```dotenv
# credencial da Evolution API — a MESMA vai pro EVOLUTION_API_KEY do CRM depois
AUTHENTICATION_API_KEY=<openssl rand -hex 32>
# senha só do Postgres desta instância, não reaproveitar de nada
POSTGRES_PASSWORD=<openssl rand -hex 24>
# preenchido só na hora do teste (seção 8) — a URL pública do ngrok + /api/whatsapp/webhook
WEBHOOK_GLOBAL_URL=
```

```yaml
version: "3.8"
services:
  evolution-api:
    image: evoapicloud/evolution-api:v2.1.1   # namespace oficial atual (o antigo atendai/ está defasado); versão pinada de propósito
    restart: always
    ports:
      - "127.0.0.1:8080:8080"   # só localhost — o Nginx é quem expõe pra internet
    environment:
      AUTHENTICATION_API_KEY: "${AUTHENTICATION_API_KEY}"
      DATABASE_PROVIDER: "postgresql"
      DATABASE_CONNECTION_URI: "postgresql://evolution:${POSTGRES_PASSWORD}@postgres:5432/evolution?schema=public"
      DATABASE_CONNECTION_CLIENT_NAME: "evolution_crm"
      DATABASE_SAVE_DATA_INSTANCE: "true"
      DATABASE_SAVE_DATA_NEW_MESSAGE: "true"
      DATABASE_SAVE_MESSAGE_UPDATE: "true"
      CACHE_REDIS_ENABLED: "true"
      CACHE_REDIS_URI: "redis://redis:6379/0"
      CACHE_REDIS_PREFIX_KEY: "evolution"
      CACHE_LOCAL_ENABLED: "false"
      WEBHOOK_GLOBAL_ENABLED: "true"
      WEBHOOK_GLOBAL_URL: "${WEBHOOK_GLOBAL_URL}"
      WEBHOOK_GLOBAL_WEBHOOK_BY_EVENTS: "false"
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:16-alpine
    restart: always
    environment:
      POSTGRES_USER: evolution
      POSTGRES_PASSWORD: "${POSTGRES_PASSWORD}"
      POSTGRES_DB: evolution
    volumes:
      - postgres-data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    restart: always
    volumes:
      - redis-data:/data

volumes:
  postgres-data:
  redis-data:
```

```bash
docker compose up -d
docker compose ps          # confirma os 3 containers "Up"
curl -s http://localhost:8080 | head   # deve responder um JSON de status, não "connection refused"
docker compose logs -f evolution-api   # acompanhar o boot; Ctrl+C pra sair
```

> **Mídia (base64) — verificar na frente 3.** O CRM ([`src/lib/whatsapp/providers/evolution.ts`](../../src/lib/whatsapp/providers/evolution.ts), `extrairConteudoMensagem`) espera o conteúdo da mídia **decodificado em base64 dentro do payload do webhook**. No v2 atual isso não é mais um env global (`WEBHOOK_GLOBAL_WEBHOOK_BASE64` foi removido) — virou config **por instância**, definida no payload de `/instance/create` ou via `/webhook/set/{instance}`. Enquanto isso não estiver ligado, texto/status/QR funcionam normalmente e mensagens de mídia entram só com tipo + legenda (sem o arquivo). O ajuste é pequeno e fica pra frente 3, quando a instância real existir pra confirmar o shape exato do payload nessa versão — **não bloqueia** subir a VPS nem o teste de texto.

> **`WEBHOOK_GLOBAL_URL` fica vazio agora de propósito.** Ele só é preenchido na seção 8, com a URL pública do `ngrok` apontando pro seu `localhost:3000`. A VPS não enxerga o `localhost` do seu Mac — o túnel é o que faz a ponte. Quando preencher, rode `docker compose up -d` de novo pra aplicar (o Compose recria só o container que mudou).

## 6. Nginx + HTTPS (Certbot)

```bash
sudo apt install -y nginx certbot python3-certbot-nginx

sudo nano /etc/nginx/sites-available/evolution
```

Cole:
```nginx
server {
    listen 80;
    server_name whatsapp.suaempresa.com.br;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/evolution /etc/nginx/sites-enabled/
sudo nginx -t   # testa a config
sudo systemctl reload nginx

# Emite o certificado (troca o domínio pelo seu de verdade)
sudo certbot --nginx -d whatsapp.suaempresa.com.br
```

Certbot já configura renovação automática (via systemd timer). Confirme depois: `curl https://whatsapp.suaempresa.com.br` deve responder sem erro de certificado.

## 7. Configurar as credenciais no CRM (ambiente local)

Produção (Vercel) fica **de fora por enquanto** — o CRM em produção continua com o WhatsApp congelado (`NEXT_PUBLIC_WHATSAPP_STANDBY` ausente = standby ligado) até o fluxo estar validado local. Aqui só mexemos no `.env.local`:

```dotenv
# adicionar / descomentar em .env.local
EVOLUTION_API_URL="https://whatsapp.suaempresa.com.br"   # o domínio da VPS (seção 6), não o ngrok
EVOLUTION_API_KEY="<mesmo AUTHENTICATION_API_KEY do ~/evolution/.env da VPS>"
NEXT_PUBLIC_WHATSAPP_STANDBY="false"                     # destrava o módulo só neste ambiente
```

> `EVOLUTION_API_URL` é o endereço **da Evolution** (VPS) — é o CRM chamando a Evolution pra criar sessão / mandar mensagem. O `ngrok` é o caminho inverso (Evolution → CRM, via webhook) e é configurado na seção 8, na VPS, não aqui.

Depois de salvar, reinicie o `npm run dev` (env var nova não recarrega sozinha).

## 8. Teste de ponta a ponta (local, via ngrok)

1. **Túnel:** num terminal à parte no Mac, `ngrok http 3000`. Copie a URL `https://<algo>.ngrok-free.app`.
2. **Apontar o webhook pra ela:** na VPS, edite `~/evolution/.env` →
   `WEBHOOK_GLOBAL_URL=https://<algo>.ngrok-free.app/api/whatsapp/webhook`, e `cd ~/evolution && docker compose up -d` pra aplicar.
3. `npm run dev` no CRM (com o `.env.local` da seção 7 já salvo).
4. Loga no CRM como Desenvolvedor → **WhatsApp** → não deve mais aparecer "Sistema em standby" → **Nova sessão** → dá um nome.
5. O QR Code deve aparecer ao vivo no modal (via Supabase Realtime — sem refresh). Se não aparecer, `GET /api/whatsapp/sessoes/[id]/qrcode` busca ao vivo.
6. Escaneia com o WhatsApp do celular (Aparelhos conectados → Conectar um aparelho).
7. Modal fecha sozinho e a sessão aparece **ONLINE**.
8. Manda uma mensagem de texto pro número conectado a partir de outro celular — deve aparecer na conversa do CRM em segundos, sem atualizar a página.
9. Responde pelo CRM — deve chegar no WhatsApp de verdade.

**Se algo travar, na ordem:**
- `docker compose logs -f evolution-api` na VPS — a Evolution registrou o evento? tentou chamar o webhook?
- Painel do ngrok (`http://localhost:4040`) — o `POST /api/whatsapp/webhook` chegou? que status voltou?
- Terminal do `npm run dev` — os logs estruturados do módulo (`waLogger`) e erros do handler.
- Erros comuns nesta fase: path/verbo de endpoint da Evolution divergindo do que [`evolution.ts`](../../src/lib/whatsapp/providers/evolution.ts) assume (ajustar **só nesse arquivo**), nome de evento no webhook (`messages.upsert` / `connection.update` / `qrcode.updated`) diferente, ou o header de auth (`apikey`) com outro nome nessa versão.

## 8b. Promover pra produção (só depois do teste local passar)

1. `npx vercel env add EVOLUTION_API_URL production` e `EVOLUTION_API_KEY production` (cola quando pedir).
2. `npx vercel env add NEXT_PUBLIC_WHATSAPP_STANDBY production` → valor `false`.
3. Trocar o `WEBHOOK_GLOBAL_URL` na VPS pro domínio de produção do CRM (`https://crm-clientes-leleminesilvas-projects.vercel.app/api/whatsapp/webhook`) e `docker compose up -d`. O ngrok deixa de ser necessário.
4. Redeploy da Vercel + **repontar o alias** (`vercel alias set <deployment-url> crm-clientes-leleminesilvas-projects.vercel.app` — o alias não segue deploy sozinho neste projeto).
5. Refazer o teste da seção 8 direto em produção.

## 9. Manutenção contínua

- **Atualizar a Evolution API**: `cd ~/evolution && docker compose pull && docker compose up -d` — a sessão autenticada sobrevive (fica no volume do Postgres), só grandes saltos de versão arriscam pedir novo QR.
- **Backup**: configure snapshot automático da VPS no painel da Vultr (diário), e periodicamente `docker compose exec postgres pg_dump -U evolution evolution > backup.sql` pra ter uma cópia à parte do estado de autenticação.
- **Monitoramento básico**: `docker compose ps` de vez em quando, ou um healthcheck simples (`curl -f https://whatsapp.suaempresa.com.br` num cron) — o CRM já mostra `healthStatus` (`STALE` se uma sessão parar de receber mensagem por muito tempo) direto na tela de gerenciamento.
