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
const FormData = require("form-data");
const QRCode = require("qrcode");
const P = require("pino");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  downloadMediaMessage,
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
const HEARTBEAT_INTERVAL_MS = 20000;
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
  timeout: 20000,
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
  return m.conversation || m.extendedTextMessage?.text || null;
}

const MIME_POR_EXTENSAO = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif",
  mp4: "video/mp4", mp3: "audio/mpeg", ogg: "audio/ogg", oga: "audio/ogg", m4a: "audio/mp4", wav: "audio/wav",
  pdf: "application/pdf",
};

function extensaoDeMime(mime) {
  if (!mime) return "bin";
  return (mime.split("/")[1] || "bin").split(";")[0];
}

function tipoDeMidia(m) {
  if (!m) return null;
  if (m.imageMessage) return { tipo: "imagem", chave: "imageMessage" };
  if (m.videoMessage) return { tipo: "video", chave: "videoMessage" };
  if (m.audioMessage) return { tipo: "audio", chave: "audioMessage" };
  if (m.documentMessage) return { tipo: "documento", chave: "documentMessage" };
  if (m.stickerMessage) return { tipo: "figurinha", chave: "stickerMessage" };
  return null;
}

// Repassa uma mensagem (ao vivo ou do histórico) pro CRM — texto ou mídia. waId é usado
// pelo endpoint pra não duplicar: tanto em re-sincronizações de histórico quanto quando
// uma mensagem que o próprio bridge enviou (via /enviar) ecoa de volta.
async function repassarMensagem(instanciaId, msg) {
  if (msg.key.remoteJid?.endsWith("@g.us")) return; // ignora grupos por enquanto
  if (msg.key.remoteJid === "status@broadcast") return;

  const telefone = telefoneDoJid(msg.key.remoteJid);
  const direcao = msg.key.fromMe ? "saida" : "entrada";
  const nome = !msg.key.fromMe ? msg.pushName || undefined : undefined;
  const timestamp = Number(msg.messageTimestamp || 0);
  const enviadaEm = timestamp ? new Date(timestamp * 1000).toISOString() : new Date().toISOString();

  const media = tipoDeMidia(msg.message);
  if (media) {
    try {
      const buffer = await downloadMediaMessage(msg, "buffer", {});
      const detalhes = msg.message[media.chave] || {};
      const mimetype = detalhes.mimetype || "application/octet-stream";
      const fileName = detalhes.fileName || `${media.tipo}.${extensaoDeMime(mimetype)}`;

      const form = new FormData();
      form.append("instanciaId", instanciaId);
      form.append("telefone", telefone);
      if (nome) form.append("nome", nome);
      form.append("conteudo", detalhes.caption || "");
      form.append("tipo", media.tipo);
      form.append("direcao", direcao);
      if (msg.key.id) form.append("waId", msg.key.id);
      form.append("enviadaEm", enviadaEm);
      form.append("file", buffer, { filename: fileName, contentType: mimetype });

      await api.post("/api/whatsapp/bridge/receber-midia", form, { headers: form.getHeaders() });
      console.log(`Mídia (${media.tipo}) repassada — ${direcao === "entrada" ? "de" : "para"} ${nome || telefone}`);
    } catch (e) {
      console.error("Erro ao repassar mídia:", e.message);
    }
    return;
  }

  const conteudo = extrairTexto(msg);
  if (!conteudo) return;

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
    if (direcao === "entrada") console.log(`Mensagem recebida de ${nome || telefone}: ${conteudo.slice(0, 60)}`);
  } catch (e) {
    console.error("Erro ao repassar mensagem:", e.message);
  }
}

function payloadDeEnvio(pendente) {
  if (!pendente.mediaUrl) return { text: pendente.conteudo };
  const ext = (pendente.mediaUrl.split(".").pop() || "").toLowerCase().split("?")[0];
  const mimetype = MIME_POR_EXTENSAO[ext] || "application/octet-stream";
  if (pendente.tipo === "imagem") return { image: { url: pendente.mediaUrl }, caption: pendente.conteudo || undefined };
  if (pendente.tipo === "video") return { video: { url: pendente.mediaUrl }, caption: pendente.conteudo || undefined };
  if (pendente.tipo === "audio") return { audio: { url: pendente.mediaUrl }, mimetype };
  return { document: { url: pendente.mediaUrl }, mimetype, fileName: pendente.conteudo || `arquivo.${ext}` };
}

let pollHandle = null;
let heartbeatHandle = null;

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
    }
  });

  // Recibos de entrega ("✓✓" cinza) e leitura ("✓✓" azul) — casados pelo waId com a
  // mensagem já registrada no CRM.
  sock.ev.on("messages.update", async (updates) => {
    for (const u of updates) {
      const waId = u.key?.id;
      const statusNum = u.update?.status;
      if (!waId || statusNum === undefined || statusNum === null) continue;
      const status = statusNum >= 4 ? "lida" : statusNum === 3 ? "entregue" : null;
      if (!status) continue;
      try {
        await api.post("/api/whatsapp/bridge/status-mensagem", { waId, status });
      } catch (e) {
        console.error("Erro ao repassar recibo:", e.message);
      }
    }
  });

  // Heartbeat: reafirma "conectado" periodicamente pro CRM detectar bridge morto sem
  // aviso (terminal fechado à força, notebook dormiu) e não deixar a tela travada
  // achando que ainda está tudo certo.
  if (heartbeatHandle) clearInterval(heartbeatHandle);
  heartbeatHandle = setInterval(() => {
    if (!conectado) return;
    api.post("/api/whatsapp/bridge/status", { instanciaId, status: "conectado" }).catch((e) => {
      console.error("Erro no heartbeat:", e.message);
    });
  }, HEARTBEAT_INTERVAL_MS);

  // Poll: mensagens (texto ou mídia) digitadas no CRM aguardando entrega de fato via
  // WhatsApp. Limpa o intervalo anterior antes de criar um novo (main() roda de novo a
  // cada reconexão) pra não acumular pollers duplicados enviando a mesma mensagem 2x.
  if (pollHandle) clearInterval(pollHandle);
  pollHandle = setInterval(async () => {
    if (!conectado) return;
    try {
      const { data: pendentes } = await api.get("/api/whatsapp/bridge/pendentes", {
        params: { instanciaId },
      });
      for (const p of pendentes) {
        try {
          const enviada = await sock.sendMessage(jidDoTelefone(p.telefone), payloadDeEnvio(p));
          await api.post("/api/whatsapp/bridge/confirmar-envio", {
            mensagemId: p.mensagemId,
            sucesso: true,
            waId: enviada?.key?.id,
          });
          console.log(`${p.mediaUrl ? "Mídia" : "Mensagem"} enviada para ${p.telefone}${p.mediaUrl ? "" : `: ${p.conteudo.slice(0, 60)}`}`);
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
