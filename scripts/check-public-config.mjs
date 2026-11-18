import { config } from "../js/config.js";
export function validatePublicConfig(value) {
  if (!value.url && !value.key) return;
  const url = new URL(value.url);
  if (url.protocol !== "https:" || url.pathname !== "/" || url.search || url.hash)
    throw Error("Usa la URL raíz HTTPS del proyecto Supabase, sin /rest/v1/.");
  if (value.key.startsWith("sb_publishable_")) return;
  try {
    const claims = JSON.parse(Buffer.from(value.key.split(".")[1], "base64url").toString());
    if (claims.role === "anon") return;
  } catch {
    /* Not an anon JWT. */
  }
  throw Error("La web solo admite una clave publicable o anon. No publiques claves privadas.");
}
validatePublicConfig(config);
