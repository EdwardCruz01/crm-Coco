import * as backend from "./backend.js";
import { useCrm } from "./store.js";
import { validateVerification, validDni } from "./verification.js";
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
const purposes = [
  "Verificación de arrendatario",
  "Registro de comprador",
  "Actualización de expediente",
];
let mode = "facial",
  records = [],
  selected = null,
  photo = null,
  photoUrl = "",
  owner = "",
  loadVersion = 0;
export function setVerificationMode(next) {
  if (["facial", "dni"].includes(next)) {
    mode = next;
    selected = null;
  }
  disposeVerification();
}
export function disposeVerification() {
  if (photoUrl) URL.revokeObjectURL(photoUrl);
  photoUrl = "";
  photo = null;
}
const status = (r) => (r.status === "pending_provider" ? "Pendiente de proveedor" : r.status);
const when = (v) => new Date(v).toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" });
function resultMarkup(r) {
  if (!r)
    return '<div class="verification-empty"><span class="result-symbol">◎</span><p>Guarda un expediente para ver el resultado.</p><small>El resultado y su estado se mostrarán aquí.</small></div>';
  return `<div class="result-person"><span class="result-symbol">${r.mode === "dni" ? "▤" : "◎"}</span><div><h3>${esc(r.name)}</h3><small>${esc(r.mode === "facial" ? "Facial · demostración" : "Consulta de DNI")} · ${esc(when(r.date))}</small></div></div><div class="result-status"><span class="badge">${esc(status(r))}</span><p>${esc(r.message)}</p></div>${
    r.mode === "facial"
      ? `<div class="demo-notice">Simulación aleatoria. No acredita identidad ni es una evaluación biométrica real.</div>${[
          ["Coincidencia (demo)", r.match],
          ["Prueba de vida (demo)", r.liveness],
        ]
          .map(
            ([l, n]) =>
              `<div class="verification-metric"><span>${l}</span><strong>${Number(n) || 0}%</strong><progress max="100" value="${Number(n) || 0}"></progress></div>`,
          )
          .join("")}`
      : `<dl class="dni-summary"><dt>Documento declarado</dt><dd>${esc(r.dni)}</dd><dt>Formato</dt><dd>8 dígitos · válido</dd><dt>Identidad oficial</dt><dd>No confirmada</dd><dt>Consulta externa</dt><dd>Proveedor no conectado</dd><dt>Consentimiento</dt><dd>Registrado</dd></dl>`
  }<div class="result-meta"><small>Finalidad: ${esc(r.purpose || "Registro de comprador")}</small><small>Expediente: ${esc(r.id)}</small><small>Responsable: ${esc(r.createdBy || "Equipo COCO")}</small></div>`;
}
function historyMarkup() {
  return records.length
    ? records
        .map(
          (r) =>
            `<button class="verification-record" data-record="${esc(r.id)}"><span class="result-symbol">${r.mode === "dni" ? "▤" : "◎"}</span><span><b>${esc(r.name)}</b><small>${esc(r.mode === "dni" ? "DNI" : "Facial · demo")} · ${esc(when(r.date))}</small></span><span class="badge">${esc(status(r))}</span></button>`,
        )
        .join("")
    : '<p class="muted">Todavía no hay expedientes.</p>';
}
export function verificationMarkup() {
  if (owner !== backend.account?.id) {
    owner = backend.account?.id || "";
    records = [];
    selected = null;
  }
  return `<div class="heading verification-heading"><div><h1>Análisis y verificación de clientes</h1><p class="muted">${mode === "facial" ? "Carga una fotografía, vincúlala al expediente y prueba el flujo de verificación." : "Organiza las consultas de DNI, registra el consentimiento y consulta el estado de cada expediente."}</p></div></div><div class="verification-tabs" role="group" aria-label="Tipo de verificación"><button data-action="verification-mode" data-id="facial" class="${mode === "facial" ? "primary" : ""}" aria-pressed="${mode === "facial"}">◎ Facial</button><button data-action="verification-mode" data-id="dni" class="${mode === "dni" ? "primary" : ""}" aria-pressed="${mode === "dni"}">▤ Documento DNI</button></div>${mode === "dni" ? '<div class="dni-provider"><span class="provider-dot"></span><div><b>Consulta de identidad · DNI</b><p>El proveedor externo aún no está conectado. Puedes validar el formato y guardar una solicitud pendiente, sin confirmar la identidad.</p></div><span class="badge">Pendiente de integración</span></div>' : ""}<div class="verification-layout"><section class="card verification-card"><h2>Nuevo expediente</h2><form id="identity-form"><label>Cliente del CRM<select name="clientId"><option value="">Sin vincular</option>${useCrm()
    .clients.filter((c) => !c.archived)
    .map((c) => `<option value="${esc(c.id)}">${esc(c.name)} · ${esc(c.code)}</option>`)
    .join(
      "",
    )}</select></label>${mode === "facial" ? '<div class="photo-drop" tabindex="0" role="button" aria-label="Seleccionar o arrastrar fotografía"><img hidden alt="Fotografía seleccionada para la demostración"><div class="photo-prompt"><span>↥</span><p>Arrastra una foto o haz clic</p><small>JPG, PNG, WEBP · máx 5 MB</small></div></div><input id="identity-photo" type="file" accept="image/jpeg,image/png,image/webp" hidden><button type="button" class="photo-remove" hidden>Eliminar fotografía</button>' : ""}<label>Nombre declarado *<input name="declaredName" autocomplete="off" placeholder="Nombre declarado" required maxlength="180"></label><label>${mode === "dni" ? "DNI · 8 dígitos *" : "Número de documento (opcional)"}<input name="dni" inputmode="numeric" maxlength="8" placeholder="${mode === "dni" ? "Ej. 12345678" : "Número de documento (opcional)"}" ${mode === "dni" ? 'required pattern="[0-9]{8}"' : ""}></label>${mode === "dni" ? '<div class="dni-format" aria-live="polite">Introduce 8 dígitos para validar el formato del DNI.</div>' : ""}<label>Finalidad<select name="purpose">${purposes.map((p) => `<option>${p}</option>`).join("")}</select></label><label class="consent-label"><input name="consent" type="checkbox" required><span>El cliente autoriza el tratamiento de ${mode === "facial" ? "su imagen" : "sus datos"} para la finalidad indicada.</span></label><p class="error" role="alert"></p><button class="primary verification-submit">${mode === "facial" ? "Guardar y verificar" : "Consultar DNI y guardar expediente"}</button><small>${mode === "facial" ? "La fotografía solo se utiliza en esta demostración y no se almacena." : "La validación del formato no verifica que el DNI exista ni que pertenezca al cliente."}</small></form></section><section class="card verification-card"><h2>Resultado</h2><div id="identity-result" aria-live="polite">${resultMarkup(selected)}</div></section></div><section class="card verification-history"><div class="heading"><div><h2>Expedientes del equipo</h2><small>Selecciona un expediente para revisar su resultado.</small></div><label>Buscar expediente<input id="verification-search" placeholder="Nombre o DNI"></label></div><p id="verification-load-error" class="error" role="alert"></p><div id="identity-history">${historyMarkup()}</div></section>`;
}
function drawHistory() {
  const el = document.querySelector("#identity-history");
  if (!el) return;
  el.innerHTML = historyMarkup();
  el.querySelectorAll("[data-record]").forEach(
    (b) =>
      (b.onclick = () => {
        selected = records.find((r) => r.id === b.dataset.record);
        document.querySelector("#identity-result").innerHTML = resultMarkup(selected);
        document
          .querySelector("#identity-result")
          .scrollIntoView({ behavior: "smooth", block: "nearest" });
      }),
  );
}
export async function loadVerificationRecords() {
  const token = ++loadVersion,
    accountId = backend.account?.id;
  if (!accountId) return;
  let next;
  if (backend.demo) {
    try {
      const raw = JSON.parse(localStorage.getItem("coco-verifications-demo-v1") || "[]");
      next = Array.isArray(raw) ? raw : [];
    } catch {
      next = [];
    }
  } else {
    next = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await backend.db
        .from("crm_records")
        .select("payload")
        .eq("kind", "verifications")
        .order("id")
        .range(offset, offset + 499);
      if (error) throw error;
      next.push(...data.map((x) => x.payload));
      if (data.length < 500) break;
    }
  }
  if (token !== loadVersion || backend.account?.id !== accountId) return;
  records = next.sort((a, b) => b.date.localeCompare(a.date));
  drawHistory();
}
export function mountVerification() {
  const form = document.querySelector("#identity-form");
  if (!form) return;
  const error = form.querySelector(".error"),
    drop = form.querySelector(".photo-drop"),
    fileInput = form.querySelector("#identity-photo");
  const showFormat = () => {
    const hint = form.querySelector(".dni-format");
    if (hint) {
      const valid = validDni(form.elements.dni.value);
      hint.textContent = valid
        ? "✓ Formato válido · la identidad aún no está confirmada."
        : `${form.elements.dni.value.length}/8 dígitos · completa el DNI.`;
      hint.classList.toggle("valid", valid);
    }
  };
  form.elements.dni.oninput = () => {
    form.elements.dni.value = form.elements.dni.value.replace(/\D/g, "").slice(0, 8);
    showFormat();
  };
  form.elements.clientId.onchange = () => {
    const c = useCrm().clients.find((c) => c.id === form.elements.clientId.value);
    if (c) {
      form.elements.declaredName.value = c.name;
      form.elements.dni.value = c.dni || c.prospect?.dni || "";
    }
    showFormat();
  };
  if (drop) {
    const load = (file) => {
      error.textContent = "";
      if (!file) return;
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5242880) {
        error.textContent = "Usa una fotografía JPG, PNG o WEBP de hasta 5 MB.";
        return;
      }
      disposeVerification();
      photo = file;
      photoUrl = URL.createObjectURL(file);
      const img = drop.querySelector("img");
      img.src = photoUrl;
      img.hidden = false;
      img.onerror = () => {
        error.textContent = "No se pudo leer la imagen. Selecciona otra fotografía.";
        clearPhoto();
      };
      drop.querySelector(".photo-prompt").hidden = true;
      form.querySelector(".photo-remove").hidden = false;
    };
    const clearPhoto = () => {
      disposeVerification();
      fileInput.value = "";
      drop.querySelector("img").hidden = true;
      drop.querySelector("img").removeAttribute("src");
      drop.querySelector(".photo-prompt").hidden = false;
      form.querySelector(".photo-remove").hidden = true;
    };
    drop.onclick = () => fileInput.click();
    drop.onkeydown = (e) => {
      if (["Enter", " "].includes(e.key)) {
        e.preventDefault();
        fileInput.click();
      }
    };
    fileInput.onchange = () => load(fileInput.files[0]);
    drop.ondragover = (e) => {
      e.preventDefault();
      drop.classList.add("drag-over");
    };
    drop.ondragleave = () => drop.classList.remove("drag-over");
    drop.ondrop = (e) => {
      e.preventDefault();
      drop.classList.remove("drag-over");
      load(e.dataTransfer.files[0]);
    };
    form.querySelector(".photo-remove").onclick = clearPhoto;
  }
  form.onsubmit = async (e) => {
    e.preventDefault();
    error.textContent = "";
    const b = e.submitter,
      original = b.textContent;
    try {
      const f = new FormData(form),
        validation = validateVerification(
          mode,
          f.get("declaredName"),
          f.get("dni"),
          !!photo,
          f.has("consent"),
        );
      if (validation) throw Error(validation);
      b.disabled = true;
      b.textContent = "Guardando expediente…";
      const currentAccount = backend.account.id;
      const r = {
        id: crypto.randomUUID(),
        name: f.get("declaredName").trim(),
        dni: f.get("dni"),
        clientId: f.get("clientId"),
        mode,
        purpose: f.get("purpose"),
        consent: true,
        consentAt: new Date().toISOString(),
        date: new Date().toISOString(),
        createdBy: backend.account.name,
        createdById: currentAccount,
        status: "pending_provider",
        message:
          "Solicitud registrada. La consulta oficial está pendiente de conectar un proveedor de DNI.",
      };
      if (mode === "facial") {
        r.match = Math.round(60 + Math.random() * 40);
        r.liveness = Math.round(55 + Math.random() * 45);
        r.status =
          r.match >= 85 && r.liveness >= 75 ? "Verificado (demo)" : "Revisión manual (demo)";
        r.message = "Resultado aleatorio de demostración; no acredita identidad.";
      } else if (!backend.demo) {
        const response = await backend.invoke("check-dni", { dni: r.dni, consent: true });
        r.status = response.status;
        r.message = response.message;
      }
      if (backend.demo) {
        const next = [r, ...records];
        localStorage.setItem("coco-verifications-demo-v1", JSON.stringify(next));
      } else {
        const { error } = await backend.db
          .from("crm_records")
          .insert({ kind: "verifications", id: r.id, payload: r });
        if (error) throw error;
      }
      if (backend.account?.id !== currentAccount || !form.isConnected) return;
      loadVersion++; // Una carga anterior no debe sustituir el expediente recién guardado.
      records.unshift(r);
      selected = r;
      document.querySelector("#identity-result").innerHTML = resultMarkup(r);
      drawHistory();
    } catch (err) {
      error.textContent = err.message || "No se pudo guardar el expediente.";
    } finally {
      b.disabled = false;
      b.textContent = original;
    }
  };
  const search = document.querySelector("#verification-search");
  search.oninput = () => {
    const q = search.value.trim().toLowerCase();
    document.querySelectorAll("[data-record]").forEach((b) => {
      const r = records.find((r) => r.id === b.dataset.record);
      b.hidden = !`${r.name} ${r.dni}`.toLowerCase().includes(q);
    });
  };
  drawHistory();
  loadVerificationRecords().catch((e) => {
    const target = document.querySelector("#verification-load-error");
    if (target) target.textContent = "No se pudieron cargar los expedientes: " + e.message;
  });
}
