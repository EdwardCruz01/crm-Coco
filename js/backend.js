import { config } from "./config.js";
import { connectCrm, crm, startDemo } from "./store.js";
import { authenticateDemo } from "./demo-auth.js";
export let db = null,
  account = null,
  demo = false,
  pending = false;
export async function init() {
  if (!config.url || !config.key) return;
  const { createClient } = await import("/vendor/supabase.js");
  db = createClient(config.url, config.key);
  await refreshAccount();
  db.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT") {
      account = null;
      crm.clear();
      window.dispatchEvent(new Event("account-change"));
    }
    if (event === "PASSWORD_RECOVERY") location.hash = "/reset-password";
  });
}
export async function refreshAccount() {
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user) {
    account = null;
    return;
  }
  const [p, r] = await Promise.all([
    db.from("profiles").select("*").eq("id", user.id).single(),
    db.from("user_roles").select("role").eq("user_id", user.id).maybeSingle(),
  ]);
  if (r.error) throw r.error;
  account = {
    id: user.id,
    name: p.data?.display_name || user.email,
    role: r.data?.role,
    avatar: p.data?.avatar_path || "",
  };
  if (account.avatar) {
    const { data } = await db.storage.from("coco-profiles").createSignedUrl(account.avatar, 3600);
    account.avatarUrl = data?.signedUrl || "";
  }
}
export function enterDemo(username, password) {
  if (db || config.url || config.key)
    throw Error("Los accesos demo están desactivados al configurar Supabase.");
  const next = authenticateDemo(username, password);
  demo = true;
  account = next;
  startDemo(next.role, next.name);
}
export async function logout() {
  if (pending) throw Error("Espera a que finalice el guardado.");
  if (db && !demo) await db.auth.signOut();
  demo = false;
  account = null;
  crm.clear();
}
export async function load() {
  if (demo || !account?.role || pending) return;
  const state = {
    clients: [],
    projects: [],
    advisors: [],
    visits: [],
    followUps: [],
    savedFilters: [],
    templates: {},
  };
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await db
      .from("crm_records")
      .select("kind,id,payload")
      .order("kind")
      .order("id")
      .range(offset, offset + 499);
    if (error) throw error;
    for (const r of data) {
      if (r.kind === "templates") state.templates = r.payload;
      else if (Array.isArray(state[r.kind])) state[r.kind].push(r.payload);
    }
    if (data.length < 500) break;
  }
  connectCrm(state, account.name, account.role, async (before, after) => {
    if (pending) throw Error("Hay un guardado en curso. Inténtalo de nuevo.");
    pending = true;
    try {
      const changes = [];
      for (const kind of Object.keys(after)) {
        const rows = (s) =>
          kind === "templates"
            ? [{ id: "default", payload: s.templates }]
            : s[kind].map((x) => ({ id: x.id || x.name, payload: x }));
        const old = rows(before),
          next = rows(after);
        for (const r of next)
          if (JSON.stringify(old.find((x) => x.id === r.id)?.payload) !== JSON.stringify(r.payload))
            changes.push({ kind, ...r, operation: "save" });
        for (const r of old)
          if (!next.some((x) => x.id === r.id))
            changes.push({ kind, id: r.id, operation: "delete" });
      }
      const { error } = await db.rpc("apply_crm_changes", { changes });
      if (error) throw error;
    } finally {
      pending = false;
    }
  });
}
export async function invoke(name, body) {
  if (demo) throw Error("Esta operación requiere conectar Supabase.");
  const { data, error } = await db.functions.invoke(name, { body });
  if (error) throw error;
  if (data?.error) throw Error(data.error);
  return data;
}
