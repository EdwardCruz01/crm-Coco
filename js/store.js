import { makeProspect, normalizeProspect } from "./prospect-model.js";
const toast = {
  error: (message) => window.dispatchEvent(new CustomEvent("crm-error", { detail: message })),
};
export const STAGES = [
  { key: "nuevo", label: "Nuevo prospecto" },
  { key: "contactado", label: "Contactado" },
  { key: "potencial", label: "Cliente potencial" },
  { key: "calificado", label: "Cliente calificado" },
  { key: "visita_prog", label: "Visita programada" },
  { key: "visita_real", label: "Visita realizada" },
  { key: "negociacion", label: "Negociación" },
  { key: "reserva", label: "Reserva" },
  { key: "cerrada", label: "Venta cerrada" },
  { key: "perdido", label: "Perdido / descartado" },
];
export const stageLabel = (s) => STAGES.find((x) => x.key === s)?.label ?? s;
export const INTEREST = { alto: "🔥 Alto", medio: "🟠 Medio", bajo: "🔵 Bajo" };
export const SOURCES = [
  "Facebook",
  "TikTok",
  "WhatsApp",
  "Instagram",
  "Recomendación",
  "Página web",
  "Otro",
];
export const PURPOSES = ["Vivienda", "Inversión", "Negocio", "Otro"];
export const PAYMENTS = ["Contado", "Cuotas", "Financiamiento"];
export const PROPERTY_TYPES = ["Terreno", "Lote", "Casa", "Departamento", "Local"];
export const FOLLOW_TYPES = [
  "Llamar",
  "Escribir por WhatsApp",
  "Enviar información",
  "Coordinar visita",
  "Seguimiento de propuesta",
  "Confirmar reserva",
];
export const VISIT_STATUS = ["Pendiente", "Confirmada", "Realizada", "Reprogramada", "Cancelada"];
export let CURRENT_USER = "Admin COCO";
let cloudWrite = null;
let currentRole = null;
export function connectCrm(next, name, role, persist) {
  state = next;
  CURRENT_USER = name;
  currentRole = role;
  cloudWrite = persist;
  loaded = true;
  listeners.forEach((l) => l());
}
/* ---------- WhatsApp ---------- */
export function normalizePhone(raw) {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 9 && d.startsWith("9")) d = "51" + d;
  return d;
}
export function isValidPeruMobile(raw) {
  return /^519\d{8}$/.test(normalizePhone(raw));
}
export function waLink(phone, message) {
  const base = `https://wa.me/${normalizePhone(phone)}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
export const DEFAULT_TEMPLATES = {
  "Nuevo prospecto":
    "Hola [nombre], te saluda el equipo de COCO INMOBILIARIA. Gracias por contactarnos. Nos gustaría conocer qué tipo de propiedad estás buscando para ayudarte a encontrar la mejor opción.",
  "Cliente potencial":
    "Hola [nombre], ¿cómo estás? Queríamos conocer si todavía estás interesado en nuestros proyectos inmobiliarios. Podemos ayudarte a revisar las opciones disponibles.",
  Visita:
    "Hola [nombre], te escribimos para confirmar tu visita a nuestro proyecto inmobiliario. ¡Será un gusto recibirte!",
  Negociación:
    "Hola [nombre], queremos ayudarte a resolver cualquier consulta sobre las condiciones de adquisición y financiamiento de la propiedad que te interesó.",
};
export function templateForStage(s) {
  if (s === "nuevo" || s === "contactado") return "Nuevo prospecto";
  if (s === "visita_prog" || s === "visita_real") return "Visita";
  if (s === "negociacion" || s === "reserva") return "Negociación";
  return "Cliente potencial";
}
/* ---------- Duplicates ---------- */
export function findDuplicate(clients, data, ignoreId) {
  const p = normalizePhone(data.phone);
  return clients.find(
    (c) =>
      c.id !== ignoreId &&
      (normalizePhone(c.phone) === p ||
        (!!data.dni && c.dni === data.dni) ||
        (!!data.email && c.email.toLowerCase() === data.email.toLowerCase())),
  );
}
/* ---------- Compatibility ---------- */
export function compatibility(c, p) {
  const pros = [];
  const cons = [];
  let score = 0;
  if (p.price <= c.budget) {
    score += 30;
    pros.push("Precio dentro del presupuesto");
  } else if (p.price <= c.budget * 1.15) {
    score += 15;
    cons.push(`Supera el presupuesto en ${Math.round((p.price / c.budget - 1) * 100)}%`);
  } else cons.push("Precio fuera del presupuesto");
  if (p.area >= c.area) {
    score += 20;
    pros.push("Área suficiente");
  } else cons.push(`Área menor (${p.area} m² vs ${c.area} m²)`);
  if (p.location === c.location) {
    score += 20;
    pros.push("Ubicación preferida");
  } else cons.push(`Ubicación distinta (${p.location})`);
  if (c.payment !== "Financiamiento" || p.financing) {
    score += 15;
    pros.push("Modalidad de pago compatible");
  } else cons.push("No ofrece financiamiento");
  if (p.purposes.includes(c.purpose)) {
    score += 10;
    pros.push(`Apto para ${c.purpose.toLowerCase()}`);
  } else cons.push(`No orientado a ${c.purpose.toLowerCase()}`);
  if (p.type === c.propertyType) {
    score += 5;
    pros.push("Tipo de inmueble buscado");
  }
  return { score, pros, cons };
}
/* ---------- Seed (demo) ---------- */
function rng(seed) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}
const DAY = 86400000;
export const iso = (d) => d.toISOString();
export const dayKey = (d) =>
  [
    new Date(d).getFullYear(),
    String(new Date(d).getMonth() + 1).padStart(2, "0"),
    String(new Date(d).getDate()).padStart(2, "0"),
  ].join("-");
function seed() {
  const r = rng(42);
  const pick = (a) => a[Math.floor(r() * a.length)];
  const today = new Date();
  today.setHours(10, 0, 0, 0);
  const t = today.getTime();
  const advisors = [
    { id: "a1", name: "Lucía Ramos" },
    { id: "a2", name: "Carlos Mendoza" },
    { id: "a3", name: "Valeria Quispe" },
    { id: "a4", name: "Jorge Salazar" },
  ];
  const projects = [
    {
      id: "p1",
      name: "Brisas del Sur",
      type: "Lote",
      price: 45000,
      area: 120,
      location: "Chiclayo",
      services: ["Agua", "Luz", "Pistas"],
      financing: true,
      purposes: ["Vivienda", "Inversión"],
    },
    {
      id: "p2",
      name: "Mirador Pimentel",
      type: "Terreno",
      price: 78000,
      area: 200,
      location: "Pimentel",
      services: ["Agua", "Luz"],
      financing: true,
      purposes: ["Inversión", "Vivienda"],
    },
    {
      id: "p3",
      name: "Residencial Los Álamos",
      type: "Casa",
      price: 165000,
      area: 140,
      location: "Chiclayo",
      services: ["Agua", "Luz", "Desagüe", "Parques"],
      financing: true,
      purposes: ["Vivienda"],
    },
    {
      id: "p4",
      name: "Plaza Comercial Norte",
      type: "Local",
      price: 120000,
      area: 60,
      location: "Lambayeque",
      services: ["Agua", "Luz", "Estacionamiento"],
      financing: false,
      purposes: ["Negocio", "Inversión"],
    },
    {
      id: "p5",
      name: "Torre Santa Victoria",
      type: "Departamento",
      price: 98000,
      area: 85,
      location: "Chiclayo",
      services: ["Ascensor", "Agua", "Luz"],
      financing: true,
      purposes: ["Vivienda", "Inversión"],
    },
    {
      id: "p6",
      name: "Campo Verde Etapa II",
      type: "Lote",
      price: 32000,
      area: 150,
      location: "Lambayeque",
      services: ["Luz"],
      financing: true,
      purposes: ["Inversión"],
    },
  ];
  const names = [
    "María Torres",
    "José Huamán",
    "Ana Castillo",
    "Luis Flores",
    "Rosa Chávez",
    "Pedro Vargas",
    "Carmen Rojas",
    "Miguel Díaz",
    "Patricia León",
    "Ricardo Paredes",
    "Sofía Medina",
    "Fernando Cruz",
    "Gabriela Ruiz",
    "Andrés Silva",
    "Elena Gutiérrez",
    "Diego Morales",
    "Lucero Campos",
    "Raúl Herrera",
    "Daniela Espinoza",
    "Óscar Navarro",
    "Milagros Ortiz",
    "Héctor Ríos",
    "Karina Peña",
    "Javier Sánchez",
    "Natalia Vega",
    "Alberto Ramírez",
  ];
  const stageW = [
    "nuevo",
    "nuevo",
    "nuevo",
    "contactado",
    "contactado",
    "potencial",
    "potencial",
    "calificado",
    "visita_prog",
    "visita_prog",
    "visita_real",
    "negociacion",
    "negociacion",
    "reserva",
    "cerrada",
    "cerrada",
    "perdido",
  ];
  const lostReasons = [
    "Presupuesto insuficiente",
    "Compró con otra inmobiliaria",
    "No respondió",
    "Cambio de planes",
  ];
  const clients = names.map((name, i) => {
    const stage = pick(stageW);
    const created = t - Math.floor(r() * 75) * DAY;
    const pid = pick(projects);
    const order = STAGES.findIndex((s) => s.key === stage);
    const history = [{ date: iso(new Date(created)), user: "Sistema", from: null, to: "nuevo" }];
    const path =
      stage === "perdido"
        ? ["contactado", "perdido"]
        : STAGES.slice(1, order + 1).map((s) => s.key);
    path.forEach((s, k) =>
      history.push({
        date: iso(new Date(created + (k + 1) * 3 * DAY)),
        user: pick(advisors).name,
        from: history[history.length - 1].to,
        to: s,
        reason: s === "perdido" ? pick(lostReasons) : undefined,
      }),
    );
    const lastContact = t - Math.floor(r() * 20) * DAY;
    return {
      id: "c" + (i + 1),
      code: "COCO-" + String(1001 + i),
      name,
      phone: "9" + String(Math.floor(10000000 + r() * 89999999)),
      email:
        name
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(" ", ".") + "@correo.pe",
      dni: r() > 0.4 ? String(Math.floor(40000000 + r() * 39999999)) : "",
      city: pick(["Chiclayo", "Lambayeque", "Piura", "Trujillo", "Lima"]),
      origin: pick(["Perú", "Perú", "Venezuela"]),
      createdAt: iso(new Date(created)),
      propertyType: pid.type,
      projectIds: [pid.id],
      budget: Math.round((pid.price * (0.8 + r() * 0.5)) / 1000) * 1000,
      area: Math.round(pid.area * (0.8 + r() * 0.4)),
      location: r() > 0.3 ? pid.location : pick(["Chiclayo", "Pimentel", "Lambayeque"]),
      purpose: pick(pid.purposes),
      payment: pick(PAYMENTS),
      downPayment: r() > 0.5 ? Math.round(pid.price * 0.2) : undefined,
      notes: pick([
        "Prefiere contacto por la tarde.",
        "Busca cerca de colegios.",
        "Interesado en financiamiento a 5 años.",
        "Viene recomendado por cliente anterior.",
        "",
      ]),
      stage,
      interest:
        stage === "negociacion" || stage === "reserva"
          ? "alto"
          : pick(["alto", "medio", "medio", "bajo"]),
      interestReason: "Clasificación inicial del asesor",
      advisorId: pick(advisors).id,
      nextFollowUp: iso(new Date(t + Math.floor(r() * 12 - 4) * DAY)),
      source: pick(SOURCES),
      lastContact: iso(new Date(lastContact)),
      archived: false,
      lostReason: stage === "perdido" ? history[history.length - 1].reason : undefined,
      history,
      interactions: [
        { date: iso(new Date(created)), type: "Registro", text: "Cliente registrado en el CRM" },
        {
          date: iso(new Date(lastContact)),
          type: "WhatsApp",
          text: "Se envió información del proyecto " + pid.name,
        },
      ],
      proposals:
        order >= 6 && stage !== "perdido"
          ? [
              {
                date: iso(new Date(lastContact)),
                projectId: pid.id,
                amount: pid.price,
                status: stage === "cerrada" ? "Aceptada" : "Enviada",
              },
            ]
          : [],
    };
  });
  const visits = clients
    .filter((c) =>
      ["visita_prog", "visita_real", "negociacion", "reserva", "cerrada"].includes(c.stage),
    )
    .map((c, i) => {
      const future = c.stage === "visita_prog";
      const d = new Date(t + (future ? Math.floor(r() * 10) : -Math.floor(1 + r() * 20)) * DAY);
      d.setHours(9 + Math.floor(r() * 8), 0);
      const p = projects.find((x) => x.id === c.projectIds[0]);
      return {
        id: "v" + (i + 1),
        clientId: c.id,
        projectId: p.id,
        date: iso(d),
        advisorId: c.advisorId,
        location: p.location + " – oficina de ventas",
        notes: "",
        status: future ? pick(["Pendiente", "Confirmada"]) : "Realizada",
      };
    });
  const followUps = clients
    .filter((c) => !["cerrada", "perdido"].includes(c.stage))
    .map((c, i) => ({
      id: "f" + (i + 1),
      clientId: c.id,
      date: c.nextFollowUp,
      type: pick(FOLLOW_TYPES),
      advisorId: c.advisorId,
      priority: pick(["Alta", "Media", "Baja"]),
      notes: "",
      done: false,
    }));
  return {
    advisors,
    projects,
    clients,
    visits,
    followUps,
    savedFilters: [{ name: "Interés alto", filter: { interest: "alto" } }],
    templates: { ...DEFAULT_TEMPLATES },
  };
}
/* ---------- Store ---------- */
const KEY = "coco-crm-demo-v1";
let state = seed();
const serverState = state;
const listeners = new Set();
let loaded = false;
function emit() {
  if (!cloudWrite && typeof window !== "undefined")
    localStorage.setItem(KEY, JSON.stringify(state));
  listeners.forEach((l) => l());
}
function subscribe(l) {
  if (!loaded && typeof window !== "undefined") {
    loaded = true;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        state = JSON.parse(raw);
        queueMicrotask(() => listeners.forEach((x) => x()));
      }
    } catch {
      /* ignore */
    }
  }
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
export function useCrm() {
  return state;
}
export { subscribe };
export function startDemo(role, name) {
  if (!["admin", "asesor"].includes(role)) throw Error("Rol demo inválido.");
  cloudWrite = null;
  currentRole = role;
  CURRENT_USER = name;
  try {
    state = JSON.parse(localStorage.getItem(KEY)) || seed();
  } catch {
    state = seed();
  }
  loaded = true;
  emit();
}
let batchBefore = null;
let writing = false;
let savePromise = Promise.resolve();
export async function flushCrm() {
  await savePromise;
}
function set(fn) {
  if (writing) throw new Error("Hay un guardado en curso. Espera un momento.");
  const before = state;
  state = fn(state);
  emit();
  if (cloudWrite && !batchBefore) {
    batchBefore = before;
    savePromise = Promise.resolve().then(async () => {
      const snapshot = batchBefore;
      batchBefore = null;
      writing = true;
      try {
        await cloudWrite(snapshot, state);
      } catch (e) {
        state = snapshot;
        listeners.forEach((l) => l());
        toast.error(e.message);
        throw e;
      } finally {
        writing = false;
      }
    });
    savePromise.catch(() => {});
  }
}
const uid = (p) => p + crypto.randomUUID();
export const crm = {
  saveProspect(id, values) {
    if (!["admin", "asesor"].includes(currentRole)) throw Error("Sin autorización.");
    if (!state.clients.some((c) => c.id === id)) throw Error("Cliente no encontrado.");
    const prospect = { ...normalizeProspect(values), updatedAt: new Date().toISOString() };
    set((s) => ({
      ...s,
      clients: s.clients.map((c) =>
        c.id !== id
          ? c
          : {
              ...c,
              prospect,
              interactions: [
                ...c.interactions,
                {
                  date: prospect.updatedAt,
                  type: "Prospecto",
                  text: "Prospecto de inscripción actualizado",
                },
              ],
            },
      ),
    }));
  },
  clear() {
    cloudWrite = null;
    currentRole = null;
    state = {
      clients: [],
      visits: [],
      projects: [],
      advisors: [],
      followUps: [],
      savedFilters: [],
      templates: {},
    };
    loaded = true;
    listeners.forEach((l) => l());
  },
  saveProject(project) {
    if (currentRole !== "admin")
      throw new Error("Solo administradores pueden gestionar proyectos.");
    set((s) => ({ ...s, projects: [...s.projects.filter((p) => p.id !== project.id), project] }));
  },
  resetDemo() {
    if (cloudWrite) throw new Error("La restauración local está desactivada en modo compartido.");
    state = seed();
    emit();
  },
  saveClient(data, id) {
    if (!data.name.trim()) return { ok: false, error: "El nombre es obligatorio." };
    if (!isValidPeruMobile(data.phone))
      return { ok: false, error: "Celular inválido. Usa 9 dígitos que empiecen con 9." };
    const dup = findDuplicate(state.clients, data, id);
    if (dup)
      return {
        ok: false,
        error: `Ya existe un cliente con esos datos: ${dup.name} (${dup.code}).`,
      };
    const now = iso(new Date());
    if (id) {
      set((s) => ({
        ...s,
        clients: s.clients.map((c) =>
          c.id === id
            ? {
                ...c,
                ...data,
                history:
                  c.stage !== data.stage
                    ? [
                        ...c.history,
                        { date: now, user: CURRENT_USER, from: c.stage, to: data.stage },
                      ]
                    : c.history,
                interactions: [
                  ...c.interactions,
                  { date: now, type: "Edición", text: "Datos del cliente actualizados" },
                ],
              }
            : c,
        ),
      }));
      return { ok: true, id };
    }
    const nid = uid("c");
    const code = "COCO-" + crypto.randomUUID().slice(0, 8).toUpperCase();
    const prospect = makeProspect(data, state.projects, state.advisors);
    set((s) => ({
      ...s,
      clients: [
        {
          ...data,
          prospect,
          id: nid,
          code,
          createdAt: now,
          lastContact: now,
          archived: false,
          proposals: [],
          history: [{ date: now, user: CURRENT_USER, from: null, to: data.stage }],
          interactions: [{ date: now, type: "Registro", text: "Cliente registrado en el CRM" }],
        },
        ...s.clients,
      ],
    }));
    return { ok: true, id: nid };
  },
  moveStage(id, to, reason) {
    const now = iso(new Date());
    set((s) => ({
      ...s,
      clients: s.clients.map((c) =>
        c.id !== id || c.stage === to
          ? c
          : {
              ...c,
              stage: to,
              lostReason: to === "perdido" ? reason : c.lostReason,
              history: [...c.history, { date: now, user: CURRENT_USER, from: c.stage, to, reason }],
              interactions: [
                ...c.interactions,
                {
                  date: now,
                  type: "Etapa",
                  text: `${stageLabel(c.stage)} → ${stageLabel(to)}${reason ? " · " + reason : ""}`,
                },
              ],
            },
      ),
    }));
  },
  setInterest(id, interest, reason) {
    const now = iso(new Date());
    set((s) => ({
      ...s,
      clients: s.clients.map((c) =>
        c.id === id
          ? {
              ...c,
              interest,
              interestReason: reason,
              interactions: [
                ...c.interactions,
                { date: now, type: "Interés", text: `Nivel ${INTEREST[interest]}: ${reason}` },
              ],
            }
          : c,
      ),
    }));
  },
  toggleArchive(id) {
    set((s) => ({
      ...s,
      clients: s.clients.map((c) => (c.id === id ? { ...c, archived: !c.archived } : c)),
    }));
  },
  addInteraction(id, type, text) {
    const now = iso(new Date());
    set((s) => ({
      ...s,
      clients: s.clients.map((c) =>
        c.id === id
          ? {
              ...c,
              lastContact: type === "Nota" ? c.lastContact : now,
              interactions: [...c.interactions, { date: now, type, text }],
            }
          : c,
      ),
    }));
  },
  toggleProject(id, pid) {
    set((s) => ({
      ...s,
      clients: s.clients.map((c) =>
        c.id === id
          ? {
              ...c,
              projectIds: c.projectIds.includes(pid)
                ? c.projectIds.filter((x) => x !== pid)
                : [...c.projectIds, pid],
            }
          : c,
      ),
    }));
  },
  addProposal(id, projectId, amount) {
    set((s) => ({
      ...s,
      clients: s.clients.map((c) =>
        c.id === id
          ? {
              ...c,
              proposals: [
                ...c.proposals,
                { date: iso(new Date()), projectId, amount, status: "Enviada" },
              ],
            }
          : c,
      ),
    }));
  },
  saveVisit(v, id) {
    set((s) => ({
      ...s,
      visits: id
        ? s.visits.map((x) => (x.id === id ? { ...v, id } : x))
        : [...s.visits, { ...v, id: uid("v") }],
    }));
    if (!id)
      crm.addInteraction(
        v.clientId,
        "Visita",
        `Visita programada para ${new Date(v.date).toLocaleString("es-PE")}`,
      );
  },
  setVisitStatus(id, status) {
    const v = state.visits.find((x) => x.id === id);
    set((s) => ({ ...s, visits: s.visits.map((x) => (x.id === id ? { ...x, status } : x)) }));
    if (v) crm.addInteraction(v.clientId, "Visita", `Visita marcada como ${status.toLowerCase()}`);
  },
  saveFollowUp(f) {
    set((s) => ({
      ...s,
      followUps: [...s.followUps, { ...f, id: uid("f"), done: false }],
      clients: s.clients.map((c) => (c.id === f.clientId ? { ...c, nextFollowUp: f.date } : c)),
    }));
  },
  completeFollowUp(id) {
    const f = state.followUps.find((x) => x.id === id);
    set((s) => ({
      ...s,
      followUps: s.followUps.map((x) => (x.id === id ? { ...x, done: true } : x)),
    }));
    if (f) crm.addInteraction(f.clientId, "Seguimiento", `${f.type} completado`);
  },
  saveFilter(name, filter) {
    set((s) => ({
      ...s,
      savedFilters: [...s.savedFilters.filter((f) => f.name !== name), { name, filter }],
    }));
  },
  deleteFilter(name) {
    set((s) => ({ ...s, savedFilters: s.savedFilters.filter((f) => f.name !== name) }));
  },
  setTemplate(k, v) {
    if (currentRole !== "admin") throw new Error("Solo administradores pueden cambiar plantillas.");
    set((s) => ({ ...s, templates: { ...s.templates, [k]: v } }));
  },
};
/* ---------- Export ---------- */
export function exportRows(filename, rows, kind) {
  if (!rows.length) return;
  const head = Object.keys(rows[0]);
  let blob;
  if (kind === "csv") {
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    blob = new Blob(
      [
        "\ufeff" +
          [head.map(esc).join(","), ...rows.map((r) => head.map((h) => esc(r[h])).join(","))].join(
            "\n",
          ),
      ],
      { type: "text/csv;charset=utf-8" },
    );
  } else {
    const cell = (v) =>
      String(v ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;");
    const html = `<html><head><meta charset="utf-8"></head><body><table><tr>${head.map((h) => `<th>${cell(h)}</th>`).join("")}</tr>${rows.map((r) => `<tr>${head.map((h) => `<td>${cell(r[h])}</td>`).join("")}</tr>`).join("")}</table></body></html>`;
    blob = new Blob([html], { type: "application/vnd.ms-excel" });
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${filename}.${kind}`;
  a.click();
}
export const money = (n) => "S/ " + n.toLocaleString("es-PE");
export const fdate = (d) =>
  new Date(d).toLocaleDateString("es-PE", { day: "2-digit", month: "short" });
