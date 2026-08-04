# Roteiro: provisionar a VPS do gateway WhatsApp (Fase 5)

> Guia operacional passo a passo — complementa `docs/architecture/whatsapp.md` (decisões de arquitetura). Este documento é sobre **o que fazer na prática** pra colocar a Evolution API no ar. Os comandos exatos da Evolution API (nomes de variável de ambiente, endpoints) podem ter mudado desde a escrita — se algo não bater, confira a documentação oficial em [github.com/EvolutionAPI/evolution-api](https://github.com/EvolutionAPI/evolution-api) antes de adaptar.

## Antes de começar — o que você precisa ter em mãos

- [ ] Um cartão pra pagar a VPS (~US$20-25/mês na configuração recomendada)
- [ ] Um domínio ou subdomínio que você controla (ex: `whatsapp.suaempresa.com.br`, ou um domínio novo de uns R$40/ano). Necessário porque HTTPS com certificado válido exige um domínio apontando pro servidor — sem isso o gateway não fica acessível com segurança pela internet.
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

Cole (ajuste `SUA_API_KEY_FORTE_AQUI` pra uma string aleatória longa — é a credencial que vai pro `EVOLUTION_API_KEY` do CRM depois, e `SENHA_POSTGRES_FORTE` pra uma senha só dessa instância, não relacionada a nenhuma outra):

```yaml
version: "3.8"
services:
  evolution-api:
    image: atendai/evolution-api:latest
    restart: always
    ports:
      - "127.0.0.1:8080:8080"   # só localhost — o Nginx é quem expõe pra internet
    environment:
      AUTHENTICATION_API_KEY: "SUA_API_KEY_FORTE_AQUI"
      DATABASE_ENABLED: "true"
      DATABASE_PROVIDER: "postgresql"
      DATABASE_CONNECTION_URI: "postgresql://evolution:SENHA_POSTGRES_FORTE@postgres:5432/evolution"
      CACHE_REDIS_ENABLED: "true"
      CACHE_REDIS_URI: "redis://redis:6379"
      WEBHOOK_GLOBAL_URL: "https://SEU-CRM.vercel.app/api/whatsapp/webhook"
      WEBHOOK_GLOBAL_ENABLED: "true"
      WEBHOOK_GLOBAL_WEBHOOK_BASE64: "true"   # essencial — é o que o código do CRM espera pra mídia
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:16-alpine
    restart: always
    environment:
      POSTGRES_USER: evolution
      POSTGRES_PASSWORD: "SENHA_POSTGRES_FORTE"
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
docker compose ps   # confirma os 3 containers "Up"
curl http://localhost:8080   # deve responder algo (não erro de conexão)
```

> ⚠️ `WEBHOOK_GLOBAL_URL` acima aponta pro domínio de **produção** do CRM (main). Se você quiser testar contra o ambiente local primeiro, vai precisar expor seu `localhost:3000` pra internet temporariamente (ex: `ngrok http 3000`) e trocar essa URL — não dá pra apontar direto pra `localhost` da VPS, que não enxerga seu Mac.

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

## 7. Configurar as credenciais no CRM

**Local** (`.env.local`):
```bash
echo 'EVOLUTION_API_URL="https://whatsapp.suaempresa.com.br"' >> "/Users/leandromedeiros/Desktop/CRM Clientes/.env.local"
echo 'EVOLUTION_API_KEY="SUA_API_KEY_FORTE_AQUI"' >> "/Users/leandromedeiros/Desktop/CRM Clientes/.env.local"
```
(mesma chave que você colocou em `AUTHENTICATION_API_KEY` no `docker-compose.yml` da VPS).

**Produção (Vercel)**:
```bash
cd "/Users/leandromedeiros/Desktop/CRM Clientes"
npx vercel env add EVOLUTION_API_URL production
npx vercel env add EVOLUTION_API_KEY production
```
(cola os valores quando o terminal pedir — nunca aparece no histórico).

## 8. Teste de ponta a ponta

1. Reinicia o dev server local (ou espera o redeploy da Vercel se for testar em produção).
2. Loga no CRM como Desenvolvedor → WhatsApp → Nova sessão → dá um nome.
3. O QR Code deve aparecer ao vivo no modal (via Realtime — sem precisar dar refresh).
4. Escaneia com o WhatsApp do celular (Aparelhos conectados → Conectar um aparelho).
5. Modal fecha sozinho e a sessão aparece **ONLINE**.
6. Manda uma mensagem de teste pro número conectado a partir de outro celular — deve aparecer na conversa do CRM em poucos segundos, sem precisar atualizar a página.
7. Responde pelo CRM — deve chegar no WhatsApp de verdade.

Se algo não funcionar, os pontos mais prováveis de checar primeiro: `docker compose logs evolution-api` na VPS, e os logs da função `/api/whatsapp/webhook` na Vercel (ou no terminal do `npm run dev` local).

## 9. Manutenção contínua

- **Atualizar a Evolution API**: `cd ~/evolution && docker compose pull && docker compose up -d` — a sessão autenticada sobrevive (fica no volume do Postgres), só grandes saltos de versão arriscam pedir novo QR.
- **Backup**: configure snapshot automático da VPS no painel da Vultr (diário), e periodicamente `docker compose exec postgres pg_dump -U evolution evolution > backup.sql` pra ter uma cópia à parte do estado de autenticação.
- **Monitoramento básico**: `docker compose ps` de vez em quando, ou um healthcheck simples (`curl -f https://whatsapp.suaempresa.com.br` num cron) — o CRM já mostra `healthStatus` (`STALE` se uma sessão parar de receber mensagem por muito tempo) direto na tela de gerenciamento.
