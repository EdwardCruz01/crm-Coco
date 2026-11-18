import {
  flushCrm,
  crm,
  useCrm,
  subscribe,
  STAGES,
  SOURCES,
  PAYMENTS,
  PURPOSES,
  PROPERTY_TYPES,
  FOLLOW_TYPES,
  VISIT_STATUS,
  INTEREST,
  stageLabel,
  compatibility,
  waLink,
  money,
  fdate,
  dayKey,
  DEFAULT_TEMPLATES,
  templateForStage,
} from "./store.js";
import * as backend from "./backend.js";
import { canAccess } from "./permissions.js";
import {
  verificationMarkup,
  mountVerification,
  setVerificationMode,
  disposeVerification,
} from "./verification-ui.js";
import { openProspect, openProspectPreview, openContact } from "./prospect-ui.js";
import { config } from "./config.js";
const root = document.querySelector("#app"),
  modal = document.querySelector("#modal");
let boardMode = "kanban";
function dashboard() {
  const c = s().clients.filter((x) => !x.archived),
    now = Date.now();
  const series = Array.from({ length: 10 }, (_, i) => {
    const end = now - (9 - i) * 604800000,
      upto = c.filter((x) => new Date(x.createdAt) <= end);
    return {
      label: fdate(new Date(end).toISOString()),
      value: upto.length
        ? Math.round((upto.filter((x) => x.stage === "cerrada").length / upto.length) * 100)
        : 0,
    };
  });
  const points = series.map((p, i) => `${30 + i * 65},${170 - p.value * 1.5}`).join(" ");
  return (
    dashboardBase() +
    card(
      "Conversión de prospectos a compradores (%)",
      `<svg role="img" aria-label="Evolución de la conversión en diez semanas" viewBox="0 0 650 210" style="width:100%;max-height:280px"><path d="M30 20 V170 H625" fill="none" stroke="#ddd"/><polyline points="${points}" fill="none" stroke="#d87b34" stroke-width="3"/>${series.map((p, i) => `<circle cx="${30 + i * 65}" cy="${170 - p.value * 1.5}" r="4" fill="#d87b34"><title>${esc(p.label)}: ${p.value}%</title></circle><text x="${30 + i * 65}" y="195" font-size="9" text-anchor="middle">${esc(p.label)}</text>`).join("")}</svg>`,
    )
  );
}
function reportData() {
  const c = s().clients.filter((x) => !x.archived),
    closed = c.filter((x) => x.stage === "cerrada");
  return [
    {
      title: "Clientes por etapa",
      rows: STAGES.map((t) => ({
        Etapa: t.label,
        Clientes: c.filter((x) => x.stage === t.key).length,
      })),
    },
    {
      title: "Clientes por asesor",
      rows: s().advisors.map((a) => {
        const m = c.filter((x) => x.advisorId === a.id),
          w = m.filter((x) => x.stage === "cerrada").length;
        return {
          Asesor: a.name,
          Clientes: m.length,
          Cerradas: w,
          Conversión: m.length ? Math.round((w / m.length) * 100) + "%" : "0%",
        };
      }),
    },
    {
      title: "Visitas realizadas",
      rows: s()
        .visits.filter((v) => v.status === "Realizada")
        .map((v) => ({
          Cliente: name("clients", v.clientId),
          Proyecto: name("projects", v.projectId),
          Fecha: date(v.date),
        })),
    },
    {
      title: "Negociaciones",
      rows: c
        .filter((x) => ["negociacion", "reserva"].includes(x.stage))
        .map((x) => ({
          Cliente: x.name,
          Etapa: stageLabel(x.stage),
          Proyecto: name("projects", x.projectIds[0]),
          Presupuesto: money(x.budget),
        })),
    },
    {
      title: "Ventas cerradas",
      rows: closed.map((x) => ({
        Cliente: x.name,
        Proyecto: name("projects", x.projectIds[0]),
        Monto: money(x.proposals[0]?.amount ?? x.budget),
      })),
    },
    {
      title: "Motivos de pérdida",
      rows: Object.entries(
        c
          .filter((x) => x.stage === "perdido")
          .reduce(
            (a, x) => (
              (a[x.lostReason || "Sin motivo"] = (a[x.lostReason || "Sin motivo"] || 0) + 1),
              a
            ),
            {},
          ),
      ).map(([Motivo, Casos]) => ({ Motivo, Casos })),
    },
    {
      title: "Rendimiento de captación",
      rows: SOURCES.map((Fuente) => {
        const m = c.filter((x) => x.source === Fuente),
          w = m.filter((x) => x.stage === "cerrada").length;
        return {
          Fuente,
          Clientes: m.length,
          Ventas: w,
          Conversión: m.length ? Math.round((w / m.length) * 100) + "%" : "0%",
        };
      }),
    },
    {
      title: "Conversión comercial",
      rows: [
        {
          Total: c.length,
          Calificados: c.filter(
            (x) => STAGES.findIndex((t) => t.key === x.stage) >= 3 && x.stage !== "perdido",
          ).length,
          Ventas: closed.length,
          Tasa: c.length ? ((closed.length / c.length) * 100).toFixed(1) + "%" : "0%",
        },
      ],
    },
  ];
}
function reportsPage() {
  return (
    head("Reportes", "Calculados con los datos actuales. Exporta a Excel o CSV.") +
    `<div class="grid">${reportData()
      .map((r, i) =>
        card(
          r.title,
          `<div class="actions"><button data-report="${i}" data-format="csv">CSV</button><button data-report="${i}" data-format="xls">Excel</button></div>` +
            (r.rows.length
              ? table(
                  Object.keys(r.rows[0]),
                  r.rows.map((r) => row(Object.values(r).map(esc))),
                )
              : "<p>Sin datos.</p>"),
        ),
      )
      .join("")}</div>`
  );
}
function funnel() {
  const actions =
    '<div class="actions"><button data-board="kanban">Kanban</button><button data-board="tabla">Tabla</button></div>';
  return (
    actions +
    (boardMode === "kanban"
      ? funnelOriginal()
      : head("Embudo de ventas", "Cada cambio queda en el historial.") +
        table(
          ["Cliente", "Etapa", "Mover a", "Interés", "Proyecto", "Último contacto"],
          s()
            .clients.filter((c) => !c.archived)
            .map((c) =>
              row([
                `<a href="#/clientes/${esc(c.id)}">${esc(c.name)}</a>`,
                stageLabel(c.stage),
                `<select aria-label="Mover etapa" data-stage="${esc(c.id)}">${selectOptions(STAGES, c.stage)}</select>`,
                esc(c.interest),
                esc(name("projects", c.projectIds[0])),
                date(c.lastContact),
              ]),
            ),
        ))
  );
}
function followups() {
  const today = dayKey(new Date()),
    pending = s().followUps.filter((f) => !f.done);
  return (
    head(
      "Seguimiento comercial",
      "Tareas y recordatorios por cliente.",
      btn("+ Nuevo seguimiento", "follow", "", "primary"),
    ) +
    `<div class="grid">${[
      ["Seguimientos de hoy", pending.filter((f) => dayKey(f.date) === today)],
      ["Atrasados", pending.filter((f) => dayKey(f.date) < today)],
      ["Próximos", pending.filter((f) => dayKey(f.date) > today)],
      ["Completados", s().followUps.filter((f) => f.done)],
    ]
      .map(([title, items]) =>
        card(
          title,
          items
            .map(
              (f) =>
                `<div class="timeline"><a href="#/clientes/${esc(f.clientId)}">${esc(name("clients", f.clientId))}</a><p>${esc(f.type)} · ${date(f.date)} · ${esc(f.priority)}</p><small>${esc(name("advisors", f.advisorId))} · ${esc(f.notes)}</small><p>${f.done ? "Completado" : btn("Completar", "complete", f.id)} ${s().clients.find((c) => c.id === f.clientId) ? wa(s().clients.find((c) => c.id === f.clientId)) : ""}</p></div>`,
            )
            .join("") || "Nada pendiente.",
        ),
      )
      .join("")}${card(
      "Sin actividad reciente",
      s()
        .clients.filter(
          (c) =>
            !c.archived &&
            !["cerrada", "perdido"].includes(c.stage) &&
            Date.now() - new Date(c.lastContact) > 864000000,
        )
        .map(
          (c) =>
            `<p><a href="#/clientes/${esc(c.id)}">${esc(c.name)}</a> · ${date(c.lastContact)}</p>`,
        )
        .join(""),
    )}${card(
      "Negociaciones pendientes",
      s()
        .clients.filter((c) => !c.archived && c.stage === "negociacion")
        .map((c) => `<p><a href="#/clientes/${esc(c.id)}">${esc(c.name)}</a></p>`)
        .join(""),
    )}</div>` +
    card(
      "Plantillas de WhatsApp",
      Object.entries({ ...DEFAULT_TEMPLATES, ...s().templates })
        .map(
          ([k, v]) =>
            `<div class="timeline"><b>${esc(k)}</b><p>${esc(v)}</p>${btn("Editar", "template", k)}</div>`,
        )
        .join(""),
    )
  );
}
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-report],[data-board],[data-wa]");
  if (!b) return;
  if (b.dataset.report !== undefined) {
    const r = reportData()[Number(b.dataset.report)];
    download(r.rows, b.dataset.format, r.title);
  } else if (b.dataset.board) {
    boardMode = b.dataset.board;
    render();
  } else if (b.dataset.wa) {
    try {
      crm.addInteraction(b.dataset.wa, "WhatsApp", "Conversación abierta en WhatsApp");
    } catch (err) {
      notify(err.message);
    }
  }
});
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
const btn = (text, action, id = "", cls = "") =>
  `<button class="${cls}" data-action="${action}" data-id="${esc(id)}">${actionIcon(action)}${text}</button>`;
function actionIcon(action) {
  const icons = {
    contact: "💬",
    prospect: "📝",
    "prospect-pdf": "📄",
    client: "👤",
    project: "🏘️",
    visit: "📅",
    follow: "🔔",
    complete: "✅",
    logout: "↗",
    recover: "🔑",
    password: "🔐",
  };
  return icons[action]
    ? `<span class="action-icon" aria-hidden="true">${icons[action]}</span>`
    : "";
}
const nav = [
  ["/", "📊", "Dashboard"],
  ["/clientes", "👥", "Clientes"],
  ["/embudo", "🎯", "Embudo"],
  ["/visitas", "📅", "Visitas"],
  ["/seguimientos", "🔔", "Seguimientos"],
  ["/proyectos", "🏘️", "Proyectos"],
  ["/reportes", "📈", "Reportes"],
  ["/verificacion", "🛡️", "Verificación"],
  ["/usuarios", "🤝", "Equipo"],
  ["/cuenta", "👤", "Mi cuenta"],
];
let filters = {},
  query = "",
  archived = false,
  cursor = new Date(),
  calendarMode = "mes";
const path = () => location.hash.slice(1) || "/";
const s = () => useCrm();
const name = (kind, id) => s()[kind].find((x) => x.id === id)?.name || "—";
const date = (v) =>
  v ? new Date(v).toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" }) : "—";
const local = (v) =>
  v
    ? new Date(new Date(v).getTime() - new Date(v).getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16)
    : "";
const option = (v, label, selected) =>
  `<option value="${esc(v)}" ${String(v) === String(selected) ? "selected" : ""}>${esc(label)}</option>`;
function selectOptions(list, selected, blank = false) {
  return (
    (blank ? option("", "Todos", selected) : "") +
    list
      .map((x) =>
        typeof x === "string"
          ? option(x, x, selected)
          : option(x.id ?? x.key, x.name ?? x.label, selected),
      )
      .join("")
  );
}
const card = (title, body) => `<section class="card"><h2>${esc(title)}</h2>${body}</section>`;
const head = (title, subtitle, actions = "") =>
  `<div class="heading"><div><div class="eyebrow">COCO · GESTIÓN COMERCIAL</div><h1>${esc(title)}</h1><small>${esc(subtitle)}</small></div><div class="actions">${actions}</div></div>`;
const table = (headers, rows) =>
  `<div class="card scroll"><table><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.join("") || `<tr><td colspan="${headers.length}" class="empty"><span aria-hidden="true">🔎</span><p>No encontramos resultados.</p><small>Prueba con otros filtros o agrega tu primer registro.</small></td></tr>`}</tbody></table></div>`;
const row = (cells) => `<tr>${cells.map((c) => `<td>${c}</td>`).join("")}</tr>`;
const wa = (c) => btn("WhatsApp ▾", "contact", c.id, "wa");
function notify(message) {
  const el = document.querySelector("#toast");
  el.textContent = message;
  el.style.display = "block";
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => (el.style.display = "none"), 6000);
}
window.addEventListener("crm-error", (e) => notify(e.detail));
function showForm(title, fields, save) {
  modal.innerHTML = `<h2>${esc(title)}</h2><form><div class="fields">${fields}</div><p class="error" role="alert"></p><footer><button type="button" data-action="close">Cancelar</button><button class="primary">Guardar</button></footer></form>`;
  modal.showModal();
  modal.querySelector("form").onsubmit = async (e) => {
    e.preventDefault();
    const b = e.submitter;
    b.disabled = true;
    try {
      await save(new FormData(e.target));
      await flushCrm();
      modal.close();
      render();
    } catch (err) {
      modal.querySelector(".error").textContent = err.message;
    } finally {
      b.disabled = false;
    }
  };
}
function field(key, label, value = "", type = "text", opts = null, required = false) {
  return `<label>${esc(label)}${opts ? `<select name="${key}" ${required ? "required" : ""}>${selectOptions(opts, value)}</select>` : type === "textarea" ? `<textarea name="${key}">${esc(value)}</textarea>` : `<input name="${key}" type="${type}" value="${esc(value)}" ${required ? "required" : ""} ${type === "number" ? 'min="0" step="any"' : ""}>`}</label>`;
}
function clientForm(id) {
  const c = s().clients.find((x) => x.id === id) || {
    name: "",
    stage: "nuevo",
    interest: "medio",
    propertyType: "Lote",
    purpose: "Vivienda",
    payment: "Contado",
    origin: "Perú",
    source: "WhatsApp",
    projectIds: [],
  };
  const schema = [
    ["name", "Nombre", "text", null, true],
    ["phone", "Celular", "tel", null, true],
    ["email", "Correo", "email"],
    ["dni", "DNI"],
    ["city", "Ciudad"],
    ["origin", "Procedencia"],
    ["propertyType", "Tipo", "text", PROPERTY_TYPES],
    ["budget", "Presupuesto", "number"],
    ["area", "Área m²", "number"],
    ["location", "Ubicación"],
    ["purpose", "Finalidad", "text", PURPOSES],
    ["payment", "Pago", "text", PAYMENTS],
    ["downPayment", "Inicial", "number"],
    ["stage", "Etapa", "text", STAGES],
    ["interest", "Interés", "text", ["alto", "medio", "bajo"]],
    ["interestReason", "Justificación"],
    ["advisorId", "Asesor", "text", s().advisors, true],
    ["source", "Fuente", "text", SOURCES],
    ["nextFollowUp", "Próximo seguimiento", "datetime-local"],
    ["notes", "Notas", "textarea"],
  ];
  showForm(
    id ? "Editar cliente" : "Registrar cliente",
    schema
      .map(([k, l, t, o, r]) => field(k, l, k === "nextFollowUp" ? local(c[k]) : c[k], t, o, r))
      .join("") +
      `<label class="wide">Proyectos de interés<select name="projectIds" multiple>${s()
        .projects.map(
          (p) =>
            `<option value="${esc(p.id)}" ${c.projectIds.includes(p.id) ? "selected" : ""}>${esc(p.name)}</option>`,
        )
        .join("")}</select></label>`,
    async (fd) => {
      const data = Object.fromEntries(fd);
      for (const k of ["budget", "area", "downPayment"]) data[k] = Number(data[k] || 0);
      data.projectIds = fd.getAll("projectIds");
      data.nextFollowUp = data.nextFollowUp ? new Date(data.nextFollowUp).toISOString() : "";
      if (data.dni && !/^\d{8}$/.test(data.dni)) throw Error("El DNI debe tener 8 dígitos.");
      if (data.stage === "perdido" && !c.lostReason) {
        data.lostReason = prompt("Motivo de pérdida");
        if (!data.lostReason?.trim()) throw Error("Indica el motivo de pérdida.");
      }
      const result = crm.saveClient(data, id || undefined);
      if (!result.ok) throw Error(result.error);
      await flushCrm();
      location.hash = "/clientes/" + result.id;
    },
  );
}
function projectForm(id) {
  const p = s().projects.find((x) => x.id === id) || {};
  showForm(
    "Proyecto",
    field("name", "Nombre", p.name, "text", null, true) +
      field("type", "Tipo", p.type, "text", PROPERTY_TYPES) +
      field("price", "Precio", p.price, "number", null, true) +
      field("area", "Área m²", p.area, "number", null, true) +
      field("location", "Ubicación", p.location, "text", null, true) +
      field("services", "Servicios separados por coma", p.services?.join(", ")) +
      field("purposes", "Finalidades separadas por coma", p.purposes?.join(", ")) +
      field("financing", "Financiamiento", p.financing ? "Sí" : "No", "text", ["Sí", "No"]),
    (fd) => {
      const p = Object.fromEntries(fd);
      p.id = id || crypto.randomUUID();
      p.price = Number(p.price);
      p.area = Number(p.area);
      p.services = p.services
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
      p.purposes = p.purposes
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
      p.financing = p.financing === "Sí";
      crm.saveProject(p);
    },
  );
}
function visitForm(id) {
  const v = s().visits.find((x) => x.id === id) || {};
  showForm(
    "Programar / editar visita",
    field(
      "clientId",
      "Cliente",
      v.clientId,
      "text",
      s().clients.filter((c) => !c.archived),
      true,
    ) +
      field("projectId", "Proyecto", v.projectId, "text", s().projects, true) +
      field("advisorId", "Asesor", v.advisorId, "text", s().advisors, true) +
      field("date", "Fecha y hora", local(v.date), "datetime-local", null, true) +
      field("location", "Ubicación", v.location, "text", null, true) +
      field("status", "Estado", v.status, "text", VISIT_STATUS) +
      field("notes", "Observaciones", v.notes, "textarea"),
    (fd) => {
      const v = Object.fromEntries(fd);
      v.date = new Date(v.date).toISOString();
      if (
        !["Cancelada", "Realizada"].includes(v.status) &&
        s().visits.some(
          (x) =>
            x.id !== id &&
            x.advisorId === v.advisorId &&
            x.date === v.date &&
            !["Cancelada", "Realizada"].includes(x.status),
        )
      )
        throw Error("El asesor ya tiene una visita a esa hora.");
      crm.saveVisit(v, id || undefined);
    },
  );
}
function followForm() {
  showForm(
    "Nuevo seguimiento",
    field(
      "clientId",
      "Cliente",
      "",
      "text",
      s().clients.filter((c) => !c.archived),
      true,
    ) +
      field("advisorId", "Asesor", "", "text", s().advisors, true) +
      field("date", "Fecha y hora", "", "datetime-local", null, true) +
      field("type", "Actividad", "", "text", FOLLOW_TYPES) +
      field("priority", "Prioridad", "Media", "text", ["Alta", "Media", "Baja"]) +
      field("notes", "Notas", "", "textarea"),
    (fd) => {
      const f = Object.fromEntries(fd);
      f.date = new Date(f.date).toISOString();
      crm.saveFollowUp(f);
    },
  );
}
function visibleClients() {
  return s().clients.filter(
    (c) =>
      c.archived === archived &&
      [c.name, c.phone, c.email, c.code, c.dni].some((v) =>
        (v || "").toLowerCase().includes(query.toLowerCase()),
      ) &&
      Object.entries(filters).every(
        ([k, v]) =>
          !v ||
          (k === "min"
            ? c.budget >= Number(v)
            : k === "max"
              ? c.budget <= Number(v)
              : k === "project"
                ? c.projectIds.includes(v)
                : k === "location"
                  ? c.location.toLowerCase().includes(v.toLowerCase())
                  : k === "createdFrom"
                    ? c.createdAt.slice(0, 10) >= v
                    : k === "contactFrom"
                      ? c.lastContact.slice(0, 10) >= v
                      : k === "followUntil"
                        ? c.nextFollowUp && c.nextFollowUp.slice(0, 10) <= v
                        : String(c[k]) === v),
      ),
  );
}
function clientsPage() {
  return (
    head(
      "Clientes",
      `${visibleClients().length} resultados`,
      btn("CSV", "export", "csv") +
        btn("Excel", "export", "xls") +
        btn("+ Registrar cliente", "client", "", "primary"),
    ) +
    card(
      "Buscar y filtrar",
      `<input id="search" placeholder="Nombre, celular, correo, DNI o código" value="${esc(query)}"><div class="filters">${[
        ["stage", "Etapa", STAGES],
        ["interest", "Interés", ["alto", "medio", "bajo"]],
        ["project", "Proyecto", s().projects],
        ["advisorId", "Asesor", s().advisors],
        ["source", "Fuente", SOURCES],
        ["payment", "Pago", PAYMENTS],
      ]
        .map(
          ([k, l, o]) =>
            `<label>${l}<select data-filter="${k}">${selectOptions(o, filters[k], true)}</select></label>`,
        )
        .join("")}${[
        ["min", "Presupuesto mínimo", "number"],
        ["max", "Presupuesto máximo", "number"],
        ["location", "Ubicación", "text"],
        ["createdFrom", "Registrado desde", "date"],
        ["contactFrom", "Contacto desde", "date"],
        ["followUntil", "Seguimiento hasta", "date"],
      ]
        .map(
          ([k, l, t]) =>
            `<label>${l}<input data-filter="${k}" type="${t}" value="${esc(filters[k])}"></label>`,
        )
        .join(
          "",
        )}</div><div class="actions">${btn("Guardar filtro", "save-filter")}${btn("Limpiar", "clear-filters")}${s()
        .savedFilters.map(
          (f) => btn(esc(f.name), "apply-filter", f.name) + btn("×", "delete-filter", f.name),
        )
        .join(
          "",
        )}<label><input id="archived" type="checkbox" ${archived ? "checked" : ""}>Ver archivados</label></div>`,
    ) +
    table(
      [
        "Cliente",
        "Celular",
        "Proyecto",
        "Presupuesto",
        "Etapa",
        "Interés",
        "Asesor",
        "Seguimiento",
        "",
      ],
      visibleClients().map((c) =>
        row([
          `<a href="#/clientes/${esc(c.id)}"><b>${esc(c.name)}</b></a><br><small>${esc(c.code)}</small>`,
          esc(c.phone),
          esc(name("projects", c.projectIds[0])),
          money(c.budget),
          `<span class="badge">${stageLabel(c.stage)}</span>`,
          `<span class="badge ${c.interest}">${esc(c.interest)}</span>`,
          esc(name("advisors", c.advisorId)),
          date(c.nextFollowUp),
          wa(c),
        ]),
      ),
    )
  );
}
function detail(id) {
  const c = s().clients.find((x) => x.id === id);
  if (!c) return card("Cliente no encontrado", '<a href="#/clientes">Volver a clientes</a>');
  return (
    head(
      c.name,
      `${c.code}${c.archived ? " · ARCHIVADO" : ""}`,
      wa(c) +
        btn("Prospecto de inscripción", "prospect", id, "primary") +
        btn("Editar", "client", id) +
        btn(c.archived ? "Restaurar" : "Archivar", "archive", id),
    ) +
    `<div class="grid">${card(
      "Información",
      `<dl>${[
        ["Celular", c.phone],
        ["Correo", c.email],
        ["DNI", c.dni],
        ["Ciudad", c.city],
        ["Procedencia", c.origin],
        ["Asesor", name("advisors", c.advisorId)],
        ["Presupuesto", money(c.budget)],
        ["Inicial", money(c.downPayment || 0)],
        ["Área", c.area + " m²"],
        ["Ubicación", c.location],
        ["Finalidad", c.purpose],
        ["Pago", c.payment],
        ["Fuente", c.source],
        ["Seguimiento", date(c.nextFollowUp)],
      ]
        .map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`)
        .join(
          "",
        )}</dl><p>${esc(c.notes)}</p><label>Etapa<select data-stage="${esc(id)}">${selectOptions(STAGES, c.stage)}</select></label><p>${esc(c.lostReason || "")}</p><div class="actions">${["alto", "medio", "bajo"].map((i) => btn(i, "interest", id + "|" + i)).join("")}</div><small>${esc(c.interestReason)}</small>`,
    )}${card(
      "Proyectos compatibles",
      s()
        .projects.map((p) => ({ p, ...compatibility(c, p) }))
        .sort((a, b) => b.score - a.score)
        .map(
          (m) =>
            `<div class="timeline"><b>${esc(m.p.name)} · ${m.score}%</b><p>${esc([...m.pros, ...m.cons].join(" · "))}</p>${btn(c.projectIds.includes(m.p.id) ? "Quitar interés" : "Asociar", "associate", id + "|" + m.p.id)} ${btn("Registrar propuesta", "proposal", id + "|" + m.p.id)}</div>`,
        )
        .join(""),
    )}${card(
      "Visitas y propuestas",
      s()
        .visits.filter((v) => v.clientId === id)
        .map(
          (v) =>
            `<p>${esc(name("projects", v.projectId))} · ${date(v.date)} · ${esc(v.status)}</p>`,
        )
        .join("") +
        c.proposals
          .map(
            (p) =>
              `<p>${esc(name("projects", p.projectId))} · ${money(p.amount)} · ${esc(p.status)}</p>`,
          )
          .join("") +
        `<small>Documentos autorizados: ninguno cargado.</small>`,
    )}${card(
      "Historial de contacto",
      btn("Añadir nota", "note", id) +
        [...c.interactions]
          .reverse()
          .map(
            (i) =>
              `<div class="timeline"><b>${esc(i.type)}</b> · ${date(i.date)}<p>${esc(i.text)}</p></div>`,
          )
          .join(""),
    )}${card(
      "Historial de etapas",
      [...c.history]
        .reverse()
        .map(
          (h) =>
            `<div class="timeline">${date(h.date)} · ${esc(h.user)}<p>${esc(stageLabel(h.from || "nuevo"))} → ${esc(stageLabel(h.to))} ${esc(h.reason || "")}</p></div>`,
        )
        .join(""),
    )}</div>`
  );
}
function bars(items) {
  const max = Math.max(1, ...items.map((x) => x[1]));
  return items
    .map(
      ([label, n]) =>
        `<div class="bar"><span>${esc(label)}</span><i style="width:${Math.max(0, (n / max) * 100)}%"></i><strong>${n}</strong></div>`,
    )
    .join("");
}
function dashboardBase(report = false) {
  const c = s().clients.filter((x) => !x.archived),
    n = (k) => c.filter((x) => x.stage === k).length,
    now = Date.now();
  const stats = [
    ["Clientes", c.length],
    ["Nuevos prospectos", n("nuevo")],
    ["Potenciales", n("potencial") + n("calificado")],
    ["Interés alto", c.filter((x) => x.interest === "alto").length],
    [
      "Visitas programadas",
      s().visits.filter((v) => ["Pendiente", "Confirmada"].includes(v.status)).length,
    ],
    ["Visitas realizadas", s().visits.filter((v) => v.status === "Realizada").length],
    ["Negociaciones", n("negociacion") + n("reserva")],
    ["Ventas cerradas", n("cerrada")],
    [
      "Sin seguimiento",
      c.filter(
        (x) =>
          !["cerrada", "perdido"].includes(x.stage) && now - new Date(x.lastContact) > 864000000,
      ).length,
    ],
    ["Conversión", c.length ? ((n("cerrada") / c.length) * 100).toFixed(1) + "%" : "0%"],
  ];
  return (
    head(
      report ? "Reportes" : "Panel comercial",
      "COCO Inmobiliaria · Resumen del equipo",
      report
        ? btn("Exportar reporte CSV", "report-export")
        : '<a class="button primary" href="#/clientes">Ver clientes</a>',
    ) +
    `<div class="welcome-banner"><div><span class="eyebrow">CADA CONTACTO ES UNA OPORTUNIDAD</span><h2>¡Vamos por tu próxima venta! <span aria-hidden="true">👋</span></h2><p>Organiza tus clientes, acompaña sus decisiones y encuentra su próximo hogar.</p></div><span class="welcome-icon" aria-hidden="true">🏡</span></div><div class="stats">${stats.map(([l, v], i) => `<div class="card stat"><span class="stat-icon" aria-hidden="true">${["👥", "🌱", "⭐", "🔥", "📅", "✅", "🤝", "🏡", "🔔", "📈"][i]}</span><small>${l}</small><strong>${v}</strong></div>`).join("")}</div><div class="grid">${card(
      "Clientes captados por semana",
      bars(
        Array.from({ length: 10 }, (_, i) => {
          const end = now - (9 - i) * 7 * 86400000;
          return [
            fdate(new Date(end).toISOString()),
            c.filter(
              (x) => new Date(x.createdAt) > end - 7 * 86400000 && new Date(x.createdAt) <= end,
            ).length,
          ];
        }),
      ),
    )}${card("Embudo de ventas", bars(STAGES.map((t) => [t.label, n(t.key)])))}${card("Proyectos con mayor interés", bars(s().projects.map((p) => [p.name, c.filter((x) => x.projectIds.includes(p.id)).length])))}${card("Fuentes de captación", bars(SOURCES.map((p) => [p, c.filter((x) => x.source === p).length])))}${card("Rendimiento de asesores", bars(s().advisors.map((a) => [a.name, c.filter((x) => x.advisorId === a.id && x.stage === "cerrada").length])))}${card("Motivos de pérdida", bars(Object.entries(c.filter((x) => x.stage === "perdido").reduce((o, x) => ((o[x.lostReason || "Sin motivo"] = (o[x.lostReason || "Sin motivo"] || 0) + 1), o), {}))))}${card(
      "Seguimientos de hoy y atrasados",
      s()
        .followUps.filter((f) => !f.done && dayKey(f.date) <= dayKey(new Date()))
        .map(
          (f) =>
            `<p><a href="#/clientes/${esc(f.clientId)}">${esc(name("clients", f.clientId))}</a> · ${esc(f.type)} · ${date(f.date)}</p>`,
        )
        .join("") || "Sin pendientes.",
    )}${card(
      "Visitas próximas (72 horas)",
      s()
        .visits.filter(
          (v) =>
            ["Pendiente", "Confirmada"].includes(v.status) &&
            new Date(v.date) > now &&
            new Date(v.date) < now + 259200000,
        )
        .map((v) => `<p>${esc(name("clients", v.clientId))} · ${date(v.date)}</p>`)
        .join("") || "Sin visitas próximas.",
    )}</div>`
  );
}
function funnelOriginal() {
  return (
    head("Embudo de ventas", "Arrastra una tarjeta o cambia su etapa desde la ficha.") +
    `<div class="board">${STAGES.map(
      (t) =>
        `<section class="column" data-drop="${t.key}"><h3>${t.label} · ${s().clients.filter((c) => !c.archived && c.stage === t.key).length}</h3>${s()
          .clients.filter((c) => !c.archived && c.stage === t.key)
          .map(
            (c) =>
              `<article class="card" draggable="true" data-drag="${esc(c.id)}"><a href="#/clientes/${esc(c.id)}"><b>${esc(c.name)}</b></a><p>${money(c.budget)} · ${esc(c.interest)}</p><small>${esc(name("advisors", c.advisorId))}</small><label>Etapa<select data-stage="${esc(c.id)}">${selectOptions(STAGES, c.stage)}</select></label></article>`,
          )
          .join("")}</section>`,
    ).join("")}</div>`
  );
}
function visits() {
  const start = new Date(cursor);
  if (calendarMode === "mes") start.setDate(1);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return (
    head(
      "Visitas",
      "Agenda compartida con todos los asesores.",
      btn("Mes", "calendar-mode", "mes") +
        btn("Semana", "calendar-mode", "semana") +
        btn("+ Programar visita", "visit", "", "primary"),
    ) +
    card(
      cursor.toLocaleDateString("es-PE", { month: "long", year: "numeric" }),
      `<div class="actions">${btn("←", "calendar-shift", "-1")}${btn("Hoy", "calendar-today")}${btn("→", "calendar-shift", "1")}</div><div class="scroll"><div class="calendar">${["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => `<b>${d}</b>`).join("")}${Array.from(
        { length: calendarMode === "mes" ? 42 : 7 },
        (_, i) => {
          const d = new Date(start);
          d.setDate(start.getDate() + i);
          return `<div class="day ${dayKey(d) === dayKey(new Date()) ? "today" : ""}">${d.getDate()}${s()
            .visits.filter((v) => dayKey(v.date) === dayKey(d))
            .map((v) =>
              btn(
                esc(
                  new Date(v.date).toLocaleTimeString("es-PE", {
                    hour: "2-digit",
                    minute: "2-digit",
                  }) +
                    " " +
                    name("clients", v.clientId),
                ),
                "visit",
                v.id,
              ),
            )
            .join("")}</div>`;
        },
      ).join("")}</div></div>`,
    ) +
    table(
      ["Cliente", "Proyecto", "Fecha", "Asesor", "Estado", ""],
      [...s().visits]
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((v) =>
          row([
            esc(name("clients", v.clientId)),
            esc(name("projects", v.projectId)),
            date(v.date),
            esc(name("advisors", v.advisorId)),
            `<select aria-label="Estado" data-visit-status="${esc(v.id)}">${selectOptions(VISIT_STATUS, v.status)}</select>`,
            btn("Editar", "visit", v.id) +
              (s().clients.find((c) => c.id === v.clientId)
                ? wa(s().clients.find((c) => c.id === v.clientId))
                : ""),
          ]),
        ),
    )
  );
}
function followupsOriginal() {
  return (
    head(
      "Seguimientos",
      "Actividades y recordatorios del equipo",
      btn("+ Nuevo seguimiento", "follow", "", "primary"),
    ) +
    table(
      ["Cliente", "Actividad", "Fecha", "Asesor", "Prioridad", "Notas", "Estado"],
      [...s().followUps]
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((f) =>
          row([
            `<a href="#/clientes/${esc(f.clientId)}">${esc(name("clients", f.clientId))}</a>`,
            esc(f.type),
            date(f.date),
            esc(name("advisors", f.advisorId)),
            esc(f.priority),
            esc(f.notes),
            f.done ? "Completado" : btn("Completar", "complete", f.id),
          ]),
        ),
    ) +
    card(
      "Plantillas de WhatsApp",
      Object.entries({ ...DEFAULT_TEMPLATES, ...s().templates })
        .map(
          ([k, v]) =>
            `<div class="timeline"><b>${esc(k)}</b><p>${esc(v)}</p>${btn("Editar", "template", k)}</div>`,
        )
        .join(""),
    )
  );
}
function projects() {
  return (
    head(
      "Proyectos",
      "Inventario inmobiliario",
      btn("+ Nuevo proyecto", "project", "", "primary"),
    ) +
    `<div class="grid">${s()
      .projects.map((p) =>
        card(
          p.name,
          `<span class="badge">${esc(p.type)}</span><h3>${money(p.price)}</h3><p>${p.area} m² · ${esc(p.location)}</p><p>${esc(p.services.join(" · "))}</p><small>${p.financing ? "Con financiamiento" : "Sin financiamiento"} · ${esc(p.purposes.join(", "))}</small><p>${btn("Editar proyecto", "project", p.id)}</p>`,
        ),
      )
      .join("")}</div>`
  );
}
function verification() {
  return verificationMarkup();
}
function team() {
  return (
    head("Equipo", "Administración de asesores", btn("+ Crear asesor", "advisor", "", "primary")) +
    table(
      ["Nombre", "Identificador"],
      s().advisors.map((a) => row([esc(a.name), esc(a.id)])),
    )
  );
}
function accountPage() {
  return (
    head("Mi cuenta", "Perfil y acceso") +
    card(
      "Perfil",
      `${backend.account.avatarUrl ? `<img class="avatar" src="${esc(backend.account.avatarUrl)}" alt="Foto de perfil">` : ""}<form id="profile"><div class="fields">${field("name", "Nombre", backend.account.name, "text", null, true)}${field("avatar", "Foto JPG, PNG o WEBP · máximo 5 MB", "", "file")}</div><p><button class="primary">Guardar perfil</button></p><p class="error"></p></form>`,
    ) +
    card("Seguridad", btn("Cambiar contraseña", "password") + btn("Cerrar sesión", "logout"))
  );
}
function auth() {
  const reset = path() === "/reset-password";
  root.innerHTML = `<div class="auth-layout"><section class="auth-story"><div class="brand">COCO<small>INMOBILIARIA · HUÁNUCO</small></div><h2>Grandes historias empiezan con un nuevo hogar.</h2><p>Todo tu equipo, tus clientes y tus proyectos en un mismo lugar.</p><div class="auth-features"><span><i aria-hidden="true">🤝</i> Acompaña a cada cliente</span><span><i aria-hidden="true">🏘️</i> Encuentra el proyecto ideal</span><span><i aria-hidden="true">✨</i> Haz que cada oportunidad cuente</span></div></section><div class="auth-panel"><main class="auth card"><span class="hello" aria-hidden="true">👋</span><div class="brand">COCO<small>INMOBILIARIA</small></div><h1 style="margin-top:28px">${reset ? "Nueva contraseña" : "Bienvenido"}</h1><p class="muted">¡Qué bueno tenerte aquí! Ingresa para continuar.</p><form id="auth">${reset ? "" : field("email", backend.db ? "Correo electrónico" : "Usuario demo", "", backend.db ? "email" : "text", null, true)}${field("password", reset ? "Nueva contraseña (mínimo 10 caracteres)" : "Contraseña", "", "password", null, true)}<button class="primary">${reset ? "Actualizar contraseña" : "Iniciar sesión"}</button><p class="error"></p></form><div class="actions">${reset ? "" : btn("Recuperar contraseña", "recover")}${backend.db && config.google ? btn("Continuar con Google", "google") : ""}</div>${!backend.db ? "<p><small>Accesos demo: admin / 1234 y asesor / 1234. Datos ficticios locales.</small></p>" : '<p class="auth-note">🔒 Acceso del equipo con correo y contraseña.</p>'}</main></div></div>`;
  document.querySelector("#auth").onsubmit = async (e) => {
    e.preventDefault();
    const el = e.currentTarget;
    const submit = el.querySelector('button[type="submit"], button.primary');
    if (submit.disabled) return;
    submit.disabled = true;
    el.querySelector(".error").textContent = "";
    try {
      const f = new FormData(el);
      if (!backend.db && !reset) {
        backend.enterDemo(f.get("email"), f.get("password"));
        location.hash = backend.account.role === "admin" ? "/" : "/clientes";
        render();
        return;
      }
      if (!backend.db) throw Error("La recuperación requiere conectar Supabase.");
      if (reset) {
        if (String(f.get("password")).length < 10) throw Error("Usa al menos 10 caracteres.");
        const { error } = await backend.db.auth.updateUser({ password: f.get("password") });
        if (error) throw error;
        await backend.logout();
        location.hash = "/auth";
        notify("Contraseña actualizada.");
      } else {
        const { error } = await backend.db.auth.signInWithPassword(Object.fromEntries(f));
        if (error) throw error;
        await backend.refreshAccount();
        if (!backend.account?.role) throw Error("Cuenta pendiente de autorización.");
        await backend.load();
        location.hash = backend.account.role === "admin" ? "/" : "/clientes";
        render();
      }
    } catch (err) {
      const messages = {
        "Invalid login credentials": "Revisa tu correo y contraseña e inténtalo otra vez.",
        "Email not confirmed": "Confirma tu correo antes de iniciar sesión.",
        "Failed to fetch": "No pudimos conectar. Revisa tu conexión a internet.",
      };
      el.querySelector(".error").textContent = messages[err.message] || err.message;
    } finally {
      submit.disabled = false;
    }
  };
  document.querySelector('#auth [name="email"]')?.setAttribute("autocomplete", "username");
  document
    .querySelector('#auth [name="password"]')
    .setAttribute("autocomplete", reset ? "new-password" : "current-password");
  document.querySelector("#auth .error").setAttribute("role", "alert");
}
function render() {
  disposeVerification();
  if (!backend.account?.role || path() === "/auth" || path() === "/reset-password") {
    auth();
    return;
  }
  let p = path();
  if (!canAccess(backend.account.role, p)) {
    location.hash = "/clientes";
    return;
  }
  const title = nav.find((x) => x[0] === p)?.[2] || "Cliente";
  document.title = title + " · COCO";
  root.innerHTML = `<div class="shell"><aside class="sidebar"><div class="brand">COCO<small>INMOBILIARIA</small></div><nav>${nav
    .filter((x) => canAccess(backend.account.role, x[0]))
    .map(
      ([url, icon, label]) =>
        `<a href="#${url}" ${p === url || (url !== "/" && p.startsWith(url + "/")) ? 'aria-current="page"' : ""} class="${p === url || (url !== "/" && p.startsWith(url + "/")) ? "active" : ""}"><span class="nav-icon" aria-hidden="true">${icon}</span><span>${label}</span></a>`,
    )
    .join(
      "",
    )}</nav><div class="account"><p>${esc(backend.account.name)}</p><small>${backend.account.role === "admin" ? "Administrador" : "Asesor"}</small><p>${btn("Cerrar sesión", "logout")}</p></div></aside><div class="workspace"><header class="topbar"><span><b>COCO</b> / Espacio de trabajo</span><span><span class="session-chip ${backend.demo ? "demo" : ""}">${backend.demo ? "Demo · datos ficticios" : "Sesión Supabase"}</span> ${btn("Salir", "logout")}</span></header><main class="content">${p === "/" ? dashboard() : p === "/clientes" ? clientsPage() : p.startsWith("/clientes/") ? detail(p.split("/")[2]) : p === "/embudo" ? funnel() : p === "/visitas" ? visits() : p === "/seguimientos" ? followups() : p === "/proyectos" ? projects() : p === "/reportes" ? reportsPage() : p === "/verificacion" ? verification() : p === "/usuarios" ? team() : accountPage()}</main></div></div>`;
  wireForms();
}
function move(id, to) {
  let reason;
  if (to === "perdido") {
    reason = prompt("Motivo de pérdida");
    if (!reason?.trim()) {
      render();
      return;
    }
  }
  crm.moveStage(id, to, reason);
}
function download(rows, kind = "csv", filename = "clientes") {
  if (!rows.length) {
    notify("No hay datos para exportar.");
    return;
  }
  const keys = Object.keys(rows[0]),
    safe = (v) => (/^[=+@\-\t\r]/.test(String(v)) ? "'" + v : v);
  const csv = (v) => '"' + String(safe(v ?? "")).replaceAll('"', '""') + '"';
  const content =
    kind === "csv"
      ? "\ufeff" +
        [keys, ...rows.map((r) => keys.map((k) => r[k]))]
          .map((r) => r.map(csv).join(","))
          .join("\r\n")
      : `<html><meta charset="utf-8"><table>${[keys, ...rows.map((r) => keys.map((k) => r[k]))].map((r) => "<tr>" + r.map((v) => "<td>" + esc(safe(v)) + "</td>").join("") + "</tr>").join("")}</table></html>`;
  const url = URL.createObjectURL(
      new Blob([content], {
        type: kind === "csv" ? "text/csv;charset=utf-8" : "application/vnd.ms-excel",
      }),
    ),
    a = document.createElement("a");
  a.href = url;
  a.download = filename + "." + kind;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
document.addEventListener("click", async (e) => {
  const b = e.target.closest("[data-action]");
  if (!b) return;
  const a = b.dataset.action,
    id = b.dataset.id;
  try {
    if (backend.pending && a !== "close")
      throw Error("Guardando… espera antes de hacer otro cambio.");
    if (a === "close") modal.close();
    else if (a === "logout") {
      await backend.logout();
      location.hash = "/auth";
      render();
    } else if (a === "contact") openContact(id);
    else if (a === "prospect") openProspect(id);
    else if (a === "prospect-pdf") await openProspectPreview(id);
    else if (a === "client") clientForm(id);
    else if (a === "project") projectForm(id);
    else if (a === "visit") visitForm(id);
    else if (a === "follow") followForm();
    else if (a === "archive") crm.toggleArchive(id);
    else if (a === "complete") crm.completeFollowUp(id);
    else if (a === "interest") {
      const [cid, interest] = id.split("|"),
        reason = prompt("Justificación del nivel de interés");
      if (reason?.trim()) crm.setInterest(cid, interest, reason);
    } else if (a === "note") {
      const text = prompt("Nota de seguimiento");
      if (text?.trim()) crm.addInteraction(id, "Nota", text);
    } else if (a === "associate") {
      crm.toggleProject(...id.split("|"));
    } else if (a === "proposal") {
      const [cid, pid] = id.split("|"),
        p = s().projects.find((x) => x.id === pid);
      crm.addProposal(cid, pid, p.price);
    } else if (a === "calendar-mode") {
      calendarMode = id;
      render();
    } else if (a === "calendar-shift") {
      if (calendarMode === "mes") {
        cursor.setDate(1);
        cursor.setMonth(cursor.getMonth() + Number(id));
      } else cursor.setDate(cursor.getDate() + 7 * Number(id));
      render();
    } else if (a === "calendar-today") {
      cursor = new Date();
      render();
    } else if (a === "clear-filters") {
      filters = {};
      query = "";
      render();
    } else if (a === "save-filter") {
      const n = prompt("Nombre del filtro");
      if (n?.trim()) crm.saveFilter(n.trim(), filters);
    } else if (a === "apply-filter") {
      filters = { ...s().savedFilters.find((f) => f.name === id).filter };
      render();
    } else if (a === "delete-filter") crm.deleteFilter(id);
    else if (a === "template") {
      const v = prompt(
        "Texto de plantilla. Usa [nombre].",
        s().templates[id] || DEFAULT_TEMPLATES[id],
      );
      if (v !== null) crm.setTemplate(id, v);
    } else if (a === "export")
      download(
        visibleClients().map((c) => ({
          Código: c.code,
          Nombre: c.name,
          Celular: c.phone,
          Correo: c.email,
          Etapa: stageLabel(c.stage),
          Interés: c.interest,
          Presupuesto: c.budget,
          Asesor: name("advisors", c.advisorId),
        })),
        id,
      );
    else if (a === "report-export")
      download(
        s().advisors.map((a) => ({
          Asesor: a.name,
          Clientes: s().clients.filter((c) => c.advisorId === a.id).length,
          Ventas: s().clients.filter((c) => c.advisorId === a.id && c.stage === "cerrada").length,
        })),
        "csv",
        "reporte",
      );
    else if (a === "verification-mode") {
      setVerificationMode(id);
      render();
    } else if (a === "advisor") {
      showForm(
        "Crear asesor",
        field("name", "Nombre", "", "text", null, true) +
          field("email", "Correo", "", "email", null, true) +
          field("password", "Contraseña inicial (10 caracteres)", "", "password", null, true),
        async (f) => {
          if (String(f.get("password")).length < 10) throw Error("Usa al menos 10 caracteres.");
          await backend.invoke("create-advisor", Object.fromEntries(f));
          await backend.load();
        },
      );
    } else if (a === "recover") {
      if (!backend.db) throw Error("Primero configura Supabase.");
      const email = prompt("Correo de recuperación");
      if (email) {
        const { error } = await backend.db.auth.resetPasswordForEmail(email, {
          redirectTo: location.origin + "/#/reset-password",
        });
        if (error) throw error;
        notify("Si la cuenta existe, recibirá instrucciones.");
      }
    } else if (a === "google") {
      const { error } = await backend.db.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: location.origin },
      });
      if (error) throw error;
    } else if (a === "password")
      showForm(
        "Cambiar contraseña",
        field("password", "Nueva contraseña", "", "password", null, true),
        async (f) => {
          if (backend.demo) throw Error("Requiere Supabase.");
          if (String(f.get("password")).length < 10) throw Error("Mínimo 10 caracteres.");
          const { error } = await backend.db.auth.updateUser({ password: f.get("password") });
          if (error) throw error;
          notify("Contraseña actualizada.");
        },
      );
  } catch (err) {
    notify(err.message);
  }
});
document.addEventListener("change", (e) => {
  try {
    const t = e.target;
    if (t.dataset.filter) {
      filters[t.dataset.filter] = t.value;
      render();
    }
    if (t.id === "search") {
      query = t.value;
      render();
    }
    if (t.id === "archived") {
      archived = t.checked;
      render();
    }
    if (t.dataset.stage) move(t.dataset.stage, t.value);
    if (t.dataset.visitStatus) crm.setVisitStatus(t.dataset.visitStatus, t.value);
  } catch (err) {
    notify(err.message);
  }
});
document.addEventListener("dragstart", (e) => {
  const el = e.target.closest("[data-drag]");
  if (el) e.dataTransfer.setData("text/plain", el.dataset.drag);
});
document.addEventListener("dragover", (e) => {
  if (e.target.closest("[data-drop]")) e.preventDefault();
});
document.addEventListener("drop", (e) => {
  const el = e.target.closest("[data-drop]");
  if (el) {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    if (s().clients.some((c) => c.id === id)) move(id, el.dataset.drop);
  }
});
function wireForms() {
  mountVerification();
  const pf = document.querySelector("#profile");
  if (pf)
    pf.onsubmit = async (e) => {
      e.preventDefault();
      const b = e.submitter;
      b.disabled = true;
      try {
        const f = new FormData(pf);
        if (backend.demo) throw Error("La edición de perfil requiere conectar Supabase.");
        let avatar = backend.account.avatar;
        const file = f.get("avatar");
        if (file.size) {
          if (file.size > 5242880 || !["image/jpeg", "image/png", "image/webp"].includes(file.type))
            throw Error("Usa JPG, PNG o WEBP hasta 5 MB.");
          avatar =
            backend.account.id +
            "/" +
            crypto.randomUUID() +
            "." +
            { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[file.type];
          const { error } = await backend.db.storage.from("coco-profiles").upload(avatar, file);
          if (error) throw error;
        }
        const { error } = await backend.db
          .from("profiles")
          .update({ display_name: f.get("name"), avatar_path: avatar })
          .eq("id", backend.account.id);
        if (error) throw error;
        await backend.refreshAccount();
        notify("Perfil guardado.");
        render();
      } catch (err) {
        pf.querySelector(".error").textContent = err.message;
      } finally {
        b.disabled = false;
      }
    };
}
subscribe(() => {
  if (backend.account && !modal.open) render();
});
window.addEventListener("hashchange", () => {
  modal.close();
  disposeVerification();
  render();
});
window.addEventListener("account-change", render);
try {
  await backend.init();
  if (backend.account?.role) await backend.load();
} catch (e) {
  notify(e.message);
}
render();
setInterval(async () => {
  if (
    backend.account &&
    !backend.demo &&
    !modal.open &&
    !document.querySelector("form") &&
    document.activeElement === document.body
  ) {
    try {
      await backend.load();
    } catch (e) {
      notify("No se pudo actualizar: " + e.message);
    }
  }
}, 15000);
