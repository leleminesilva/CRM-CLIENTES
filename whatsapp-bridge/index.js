// Conector temporário de WhatsApp via QR Code (Baileys), enquanto a API oficial
// da Meta não fica pronta. Roda local, nesta máquina, enquanto você quiser manter
// o número conectado (ex: das 7:30 às 18h). Ao fechar este processo, o WhatsApp
// desconecta — basta rodar `npm start` de novo pra reconectar (sem precisar
// escanear o QR de novo, a sessão fica salva em ./sessao).
//
// AVISO: isso usa uma biblioteca não-oficial que simula o WhatsApp Web. Viola os
// Termos de Uso do WhatsApp e traz risco real de suspensão do número. Use só
// como solução temporária.

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const axios = require("axios");
const QRCode = require("qrcode");
const P = require("pino");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
} = require("@whiskeysockets/baileys");

const CRM_BASE_URL = (process.env.CRM_BASE_URL || "").replace(/\/$/, "");
const BRIDGE_SECRET = process.env.WHATSAPP_BRIDGE_SECRET;
const NOME_INSTANCIA = process.env.NOME_INSTANCIA || "WhatsApp (QR temporário)";
const CONFIG_PATH = path.join(__dirname, "bridge-config.json");
const SESSAO_DIR = path.join(__dirname, "sessao");
const POLL_INTERVAL_MS = 4000;

if (!CRM_BASE_URL || !BRIDGE_SECRET) {
  console.error("Faltando CRM_BASE_URL ou WHATSAPP_BRIDGE_SECRET no .env — veja .env.example");
  process.exit(1);
}

const api = axios.create({
  baseURL: CRM_BASE_URL,
  headers: { "x-bridge-secret": BRIDGE_SECRET },
  timeout: 15000,
});

function carregarConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
  } catch {
    return {};
  }
}

function salvarConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

function telefoneDoJid(jid) {
  return (jid || "").split("@")[0].split(":")[0];
}

function jidDoTelefone(telefone) {
  const digits = telefone.replace(/\D/g, "");
  return `${digits}@s.whatsapp.net`;
}

function extrairTexto(msg) {
  const m = msg.message;
  if (!m) return null;
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    (m.imageMessage ? "[Imagem]" : null) ||
    (m.videoMessage ? "[Vídeo]" : null) ||
    (m.audioMessage ? "[Áudio]" : null) ||
    (m.documentMessage ? `[Documento] ${m.documentMessage.fileName || ""}`.trim() : null) ||
    (m.stickerMessage ? "[Figurinha]" : null) ||
    null
  );
}

async function main() {
  let config = carregarConfig();
  if (!config.sessaoId) {
    config.sessaoId = crypto.randomUUID();
    salvarConfig(config);
  }

  console.log("Registrando instância no CRM...");
  const { data: registro } = await api.post("/api/whatsapp/bridge/registrar", {
    nome: NOME_INSTANCIA,
    sessaoId: config.sessaoId,
  });
  const instanciaId = registro.instanciaId;
  console.log("Instância registrada:", instanciaId);

  const { state, saveCreds } = await useMultiFileAuthState(SESSAO_DIR);

  const sock = makeWASocket({
    auth: state,
    logger: P({ level: "silent" }),
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("Novo QR Code gerado — escaneie pela aba \"Whats\" no CRM.");
      try {
        const qrDataUrl = await QRCode.toDataURL(qr);
        await api.post("/api/whatsapp/bridge/status", {
          instanciaId,
          status: "aguardando_qr",
          qrCode: qrDataUrl,
        });
      } catch (e) {
        console.error("Erro ao gerar/enviar QR:", e.message);
      }
    }

    if (connection === "open") {
      const phoneNumber = telefoneDoJid(sock.user?.id);
      console.log("✅ Conectado ao WhatsApp:", phoneNumber);
      await api.post("/api/whatsapp/bridge/status", {
        instanciaId,
        status: "conectado",
        phoneNumber,
      });
    }

    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const deveReconectar = statusCode !== DisconnectReason.loggedOut;
      console.log("Conexão fechada. Reconectar?", deveReconectar);
      try {
        await api.post("/api/whatsapp/bridge/status", { instanciaId, status: "desconectado" });
      } catch {}
      if (deveReconectar) {
        setTimeout(main, 3000);
      } else {
        console.log("Sessão deslogada no celular. Apague a pasta ./sessao e rode de novo pra reconectar.");
      }
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    for (const msg of messages) {
      if (msg.key.fromMe) continue;
      if (msg.key.remoteJid?.endsWith("@g.us")) continue; // ignora grupos por enquanto
      const conteudo = extrairTexto(msg);
      if (!conteudo) continue;

      const telefone = telefoneDoJid(msg.key.remoteJid);
      const nome = msg.pushName || undefined;

      try {
        await api.post("/api/whatsapp/bridge/receber", {
          instanciaId,
          telefone,
          nome,
          conteudo,
        });
        console.log(`Mensagem recebida de ${nome || telefone}: ${conteudo.slice(0, 60)}`);
      } catch (e) {
        console.error("Erro ao repassar mensagem recebida:", e.message);
      }
    }
  });

  // Poll: mensagens digitadas no CRM aguardando entrega de fato via WhatsApp
  setInterval(async () => {
    if (sock.ws?.readyState !== 1) return; // só envia se realmente conectado
    try {
      const { data: pendentes } = await api.get("/api/whatsapp/bridge/pendentes", {
        params: { instanciaId },
      });
      for (const p of pendentes) {
        try {
          await sock.sendMessage(jidDoTelefone(p.telefone), { text: p.conteudo });
          await api.post("/api/whatsapp/bridge/confirmar-envio", { mensagemId: p.mensagemId, sucesso: true });
          console.log(`Mensagem enviada para ${p.telefone}: ${p.conteudo.slice(0, 60)}`);
        } catch (e) {
          console.error("Erro ao enviar mensagem pendente:", e.message);
          await api.post("/api/whatsapp/bridge/confirmar-envio", { mensagemId: p.mensagemId, sucesso: false }).catch(() => {});
        }
      }
    } catch (e) {
      console.error("Erro ao buscar pendentes:", e.message);
    }
  }, POLL_INTERVAL_MS);
}

main().catch((e) => {
  console.error("Erro fatal no bridge:", e);
  process.exit(1);
});
