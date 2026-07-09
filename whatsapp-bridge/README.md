# WhatsApp Bridge (temporário — QR Code)

Conector local que liga um número de WhatsApp ao CRM via QR Code, enquanto a API
oficial da Meta não está configurada. **Use só como solução temporária** — é uma
automação não-oficial (viola os Termos de Uso do WhatsApp) e traz risco real de o
número ser suspenso.

## Como usar

1. Copie `.env.example` para `.env` e preencha `WHATSAPP_BRIDGE_SECRET` (o mesmo
   valor cadastrado na Vercel).
2. `npm install`
3. `npm start`
4. Abra o CRM → aba **Whats** (ícone vermelho) e escaneie o QR Code que aparecer lá.
5. Deixe este terminal aberto enquanto quiser manter o WhatsApp conectado (ex: das
   7:30 às 18h). Fechar o terminal desconecta o número — não desliga o CRM nem
   afeta a aba WhatsApp oficial.
6. Pra reconectar depois de fechar, só rode `npm start` de novo — não precisa
   escanear o QR outra vez (a sessão fica salva em `./sessao`).

## Encerrar de vez

Quando a API oficial da Meta estiver pronta, é só parar de rodar este script.
Nenhuma configuração do CRM depende dele — a aba "WhatsApp" (oficial) continua
funcionando normalmente em paralelo.
