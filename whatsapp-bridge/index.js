// Conector temporário de WhatsApp via QR Code (Baileys), enquanto a API oficial
// da Meta não fica pronta. Roda local, nesta máquina, enquanto você quiser manter
// o número conectado (ex: das 7:30 às 18h). Ao fechar este processo, o WhatsApp
// desconecta — basta rodar `npm start` de novo pra reconectar (sem precisar
// escanear o QR de novo, a sessão fica salva em ./sessao-<instancia>).
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
// Nome usado pra rodar vários números ao mesmo tempo: cada valor de INSTANCIA usa sua
// própria pasta de sessão e arquivo de config, então dá pra abrir um terminal por número
// (ex: `INSTANCIA=comercial npm start` num, `INSTANCIA=suporte npm start` noutro).
const INSTANCIA_KEY = (process.env.INSTANCIA || "padrao").replace(/[^a-z0-9_-]/gi, "_");
const NOME_INSTANCIA = process.env.NOME_INSTANCIA || `WhatsApp (QR temporário${INSTANCIA_KEY !== "padrao" ? ` - ${INSTANCIA_KEY}` : ""})`;
const CONFIG_PATH = path.join(__dirname, `bridge-config.${INSTANCIA_KEY}.json`);
const SESSAO_DIR = path.join(__dirname, `sessao-${INSTANCIA_KEY}`);
const POLL_INTERVAL_MS = 2000;
// Histórico sincronizado ao conectar pela 1ª vez: só traz mensagens de até N dias atrás,
// pra não tentar importar o histórico inteiro de anos de conversa de uma vez.
const HISTORICO_MAX_DIAS = Number(process.env.HISTORICO_MAX_DIAS || 30);

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

// Repassa uma mensagem (ao vivo ou do histórico) pro CRM. waId é usado pelo endpoint pra
// não duplicar: tanto em re-sincronizações de histórico quanto quando uma mensagem que o
// próprio bridge enviou (via /enviar) ecoa de volta pelo evento messages.upsert.
async function repassarMensagem(instanciaId, msg) {
  if (msg.key.remoteJid?.endsWith("@g.us")) return; // ignora grupos por enquanto
  if (msg.key.remoteJid === "status@broadcast") return;
  const conteudo = extrairTexto(msg);
  if (!conteudo) return;

  const telefone = telefoneDoJid(msg.key.remoteJid);
  const direcao = msg.key.fromMe ? "saida" : "entrada";
  const nome = !msg.key.fromMe ? msg.pushName || undefined : undefined;
  const timestamp = Number(msg.messageTimestamp || 0);
  const enviadaEm = timestamp ? new Date(timestamp * 1000).toISOString() : new Date().toISOString();

  try {
    await api.post("/api/whatsapp/bridge/receber", {
      instanciaId,
      telefone,
      nome,
      conteudo,
      direcao,
      waId: msg.key.id || undefined,
      enviadaEm,
    });
  } catch (e) {
    console.error("Erro ao repassar mensagem:", e.message);
  }
}

let pollHandle = null;

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

  let conectado = false; // marcador confiável de "socket pronto pra enviar" — não depender de sock.ws interno

  const sock = makeWASocket({
    auth: state,
    logger: P({ level: "silent" }),
    syncFullHistory: true,
    shouldSyncHistoryMessage: () => true,
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
      conectado = true;
      const phoneNumber = telefoneDoJid(sock.user?.id);
      console.log("✅ Conectado ao WhatsApp:", phoneNumber);
      await api.post("/api/whatsapp/bridge/status", {
        instanciaId,
        status: "conectado",
        phoneNumber,
      });
    }

    if (connection === "close") {
      conectado = false;
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const deveReconectar = statusCode !== DisconnectReason.loggedOut;
      console.log("Conexão fechada. Reconectar?", deveReconectar);
      try {
        await api.post("/api/whatsapp/bridge/status", { instanciaId, status: "desconectado" });
      } catch {}
      if (deveReconectar) {
        setTimeout(main, 3000);
      } else {
        console.log(`Sessão deslogada no celular. Apague a pasta ${SESSAO_DIR} e rode de novo pra reconectar.`);
      }
    }
  });

  // Disparado (normalmente uma vez, logo após conectar pela 1ª vez) com o histórico de
  // conversas do celular. Importa só o que estiver dentro da janela HISTORICO_MAX_DIAS.
  sock.ev.on("messaging-history.set", async ({ messages, isLatest }) => {
    if (!messages?.length) return;
    const corte = Date.now() / 1000 - HISTORICO_MAX_DIAS * 24 * 60 * 60;
    const relevantes = messages.filter((m) => Number(m.messageTimestamp || 0) >= corte);
    console.log(`Sincronizando histórico: ${relevantes.length} mensagem(ns) dos últimos ${HISTORICO_MAX_DIAS} dias...`);
    for (const msg of relevantes) {
      await repassarMensagem(instanciaId, msg);
    }
    if (isLatest) console.log("Histórico sincronizado.");
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    for (const msg of messages) {
      await repassarMensagem(instanciaId, msg);
      if (!msg.key.fromMe) {
        const conteudo = extrairTexto(msg);
        if (conteudo) console.log(`Mensagem recebida de ${msg.pushName || telefoneDoJid(msg.key.remoteJid)}: ${conteudo.slice(0, 60)}`);
      }
    }
  });

  // Poll: mensagens digitadas no CRM aguardando entrega de fato via WhatsApp.
  // Limpa o intervalo anterior antes de criar um novo (main() roda de novo a cada
  // reconexão) pra não acumular pollers duplicados enviando a mesma mensagem 2x.
  if (pollHandle) clearInterval(pollHandle);
  pollHandle = setInterval(async () => {
    if (!conectado) return;
    try {
      const { data: pendentes } = await api.get("/api/whatsapp/bridge/pendentes", {
        params: { instanciaId },
      });
      for (const p of pendentes) {
        try {
          const enviada = await sock.sendMessage(jidDoTelefone(p.telefone), { text: p.conteudo });
          await api.post("/api/whatsapp/bridge/confirmar-envio", {
            mensagemId: p.mensagemId,
            sucesso: true,
            waId: enviada?.key?.id,
          });
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
