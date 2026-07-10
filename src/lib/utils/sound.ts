// Sons curtos gerados via Web Audio API — sem depender de nenhum arquivo de áudio externo.

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;
  try {
    return new AudioCtx();
  } catch {
    return null;
  }
}

function tocarTom(ctx: AudioContext, freq: number, inicio: number, duracao: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, ctx.currentTime + inicio);
  gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + inicio + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + inicio + duracao);
  osc.start(ctx.currentTime + inicio);
  osc.stop(ctx.currentTime + inicio + duracao);
}

// Beep único e curto — usado pra avisos genéricos (ex: mensagem nova no chat).
export function tocarBeep() {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    tocarTom(ctx, 880, 0, 0.3);
  } catch {
    // navegador pode bloquear áudio sem interação prévia do usuário — sem problema, é só um extra
  }
}

// Dois tons ascendentes — chime mais "positivo", usado quando um cliente novo entra no CRM.
export function tocarNotificacaoNovoCliente() {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    tocarTom(ctx, 700, 0, 0.12);
    tocarTom(ctx, 1050, 0.1, 0.22);
  } catch {
    // navegador pode bloquear áudio sem interação prévia do usuário — sem problema, é só um extra
  }
}
