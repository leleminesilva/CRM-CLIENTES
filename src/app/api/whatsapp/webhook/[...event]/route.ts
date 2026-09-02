// A Evolution API v2.3+ entrega o webhook global em {url}/{evento-kebab}
// (ex: /api/whatsapp/webhook/qrcode-updated), mesmo com
// WEBHOOK_GLOBAL_WEBHOOK_BY_EVENTS=false. O corpo é idêntico ao do endpoint
// único (event em dot-notation, data, instance) — então este catch-all só
// reaproveita o mesmo handler. Ver docs/architecture/whatsapp.md.
export { POST } from "../route";

export const dynamic = "force-dynamic";
