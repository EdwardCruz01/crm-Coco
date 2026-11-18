import { crm, useCrm, flushCrm, waLink, DEFAULT_TEMPLATES, templateForStage } from "./store.js";
import { FIELDS, CHANNELS, makeProspect } from "./prospect-model.js";
import { buildProspectFile } from "./prospect-pdf.js";
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
let dialog, previewUrl;
function getDialog() {
  if (!dialog) {
    dialog = document.createElement("dialog");
    dialog.className = "prospect-dialog";
    dialog.setAttribute("aria-label", "Prospecto de inscripción");
    document.body.append(dialog);
    dialog.addEventListener("close", () => {
      if (dialog.open) return;
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        previewUrl = null;
      }
      dialog.innerHTML = "";
    });
  }
  if (dialog.open) dialog.close();
  if (previewUrl) {
    URL.revokeObjectURL(previewUrl);
    previewUrl = null;
  }
  return dialog;
}
function client(id) {
  const c = useCrm().clients.find((c) => c.id === id);
  if (!c) throw Error("Cliente no encontrado.");
  return c;
}
window.addEventListener("hashchange", () => {
  if (dialog?.open) dialog.close();
});
function inputField([key, label, type = "text", options], p) {
  if (type === "project") {
    options = useCrm().projects.map((p) => [p.id, p.name]);
    if (p.projectId && !options.some((x) => x[0] === p.projectId))
      options.push([p.projectId, p.projectName + " (proyecto anterior)"]);
  }
  const select = options
    ? `<select name="${key}"><option value=""></option>${options
        .map((o) => {
          const [value, label] = Array.isArray(o) ? o : [o, o];
          return `<option value="${esc(value)}" ${p[key] === value ? "selected" : ""}>${esc(label)}</option>`;
        })
        .join("")}</select>`
    : null;
  const control =
    select ??
    (type === "textarea"
      ? `<textarea name="${key}" maxlength="1000">${esc(p[key])}</textarea>`
      : `<input name="${key}" type="${type}" value="${esc(p[key])}" ${type === "number" ? 'min="0" step="any"' : ""} ${key === "dni" ? 'inputmode="numeric" maxlength="8"' : ""} ${type === "text" ? 'maxlength="1000"' : ""}>`);
  return `<label data-prospect-field="${key}" class="${type === "textarea" ? "wide" : ""}">${esc(label)}${control}</label>`;
}
export function openProspect(id) {
  const c = client(id),
    state = useCrm(),
    p = makeProspect(c, state.projects, state.advisors),
    d = getDialog();
  d.innerHTML = `<div class="heading"><div><small>COCO · ${esc(c.code)}</small><h2>Prospecto de inscripción</h2><p class="muted">Completa lo que tengas disponible. Los espacios vacíos se conservan en el documento.</p></div><button type="button" data-close aria-label="Cerrar prospecto">×</button></div><form id="prospect-form">${[
    ["01 · Datos del cliente", 0, 15],
    ["02 · Datos del proyecto", 15, 20],
    ["03 · Método de pago", 20, 36],
  ]
    .map(
      ([title, start, end]) =>
        `<fieldset class="prospect-section"><legend>${title}</legend><div class="fields">${FIELDS.slice(
          start,
          end,
        )
          .map((f) => inputField(f, p))
          .join("")}</div></fieldset>`,
    )
    .join(
      "",
    )}<fieldset class="prospect-section"><legend>04 · ¿Cómo se enteró del proyecto?</legend><div class="channel-grid">${CHANNELS.map((ch) => `<label><input type="checkbox" name="channels" value="${esc(ch)}" ${p.channels?.includes(ch) ? "checked" : ""}>${esc(ch)}</label>`).join("")}</div></fieldset><fieldset class="prospect-section"><legend>05 · Promotor y visita</legend><div class="fields">${FIELDS.slice(
    36,
  )
    .map((f) => inputField(f, p))
    .join(
      "",
    )}</div></fieldset><p class="muted">La nota de separaciones de la base COCO se incluye en todos los documentos, sin modificaciones.</p><p class="error" role="alert"></p><footer class="sticky-actions"><button type="button" data-close>Cancelar</button><button name="intent" value="save">Guardar cambios</button><button class="primary" name="intent" value="pdf">Guardar y ver prospecto</button></footer></form>`;
  d.showModal();
  d.querySelectorAll("[data-close]").forEach((b) => (b.onclick = () => d.close()));
  const form = d.querySelector("form");
  const sync = () => {
    form.querySelector('[data-prospect-field="jointName"]').hidden =
      form.elements.jointPurchase.value !== "Sí";
    form.querySelector('[data-prospect-field="level"]').hidden =
      form.elements.projectType.value !== "Departamento";
  };
  form.elements.jointPurchase.onchange = sync;
  form.elements.projectType.onchange = sync;
  sync();
  form.elements.projectId.onchange = () => {
    const project = state.projects.find((x) => x.id === form.elements.projectId.value);
    if (project) {
      for (const [key, value] of Object.entries({
        projectType: project.type,
        area: project.area,
        location: project.location,
        price: project.price,
      }))
        form.elements[key].value = value ?? "";
    }
    sync();
  };
  form.onsubmit = async (e) => {
    e.preventDefault();
    const buttons = [...form.querySelectorAll("button")];
    buttons.forEach((b) => (b.disabled = true));
    form.querySelector(".error").textContent = "";
    try {
      const fd = new FormData(form),
        values = Object.fromEntries(fd);
      values.channels = fd.getAll("channels");
      values.projectName =
        state.projects.find((x) => x.id === values.projectId)?.name ||
        (values.projectId === p.projectId ? p.projectName : "");
      crm.saveProspect(id, values);
      await flushCrm();
      if (e.submitter.value === "pdf") {
        await openProspectPreview(id);
      } else d.close();
    } catch (err) {
      form.querySelector(".error").textContent = err.message;
    } finally {
      buttons.forEach((b) => (b.disabled = false));
    }
  };
}
function download(file) {
  const url = URL.createObjectURL(file),
    a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
export async function openProspectPreview(id) {
  const c = client(id),
    p = makeProspect(c, useCrm().projects, useCrm().advisors);
  const file = await buildProspectFile(p, c.code),
    d = getDialog();
  previewUrl = URL.createObjectURL(file);
  d.innerHTML = `<div class="heading"><div><h2>Prospecto de ${esc(c.name)}</h2><small>Revisa el documento antes de compartirlo.</small></div><button data-close aria-label="Cerrar vista previa">×</button></div><div class="actions"><button data-edit>Editar prospecto</button><a class="button" href="${previewUrl}" target="_blank" rel="noopener">Abrir PDF</a><button class="primary" data-download>Descargar PDF</button><button data-share>Compartir archivo</button></div><p class="muted">Para enviarlo por WhatsApp: descarga el PDF, abre la conversación y adjúntalo como documento. Si tu dispositivo permite compartir archivos, puedes elegir WhatsApp en «Compartir archivo».</p><a class="button wa" data-chat href="${esc(waLink(c.phone, `Hola ${c.name}, te comparto tu prospecto de inscripción de COCO Inmobiliaria para que revises los datos.`))}" target="_blank" rel="noopener noreferrer">Abrir WhatsApp</a><iframe class="prospect-preview" src="${previewUrl}" title="Vista previa del prospecto PDF"></iframe><p class="error" role="alert"></p>`;
  d.showModal();
  d.querySelector("[data-close]").onclick = () => d.close();
  d.querySelector("[data-edit]").onclick = () => openProspect(id);
  d.querySelector("[data-download]").onclick = () => download(file);
  d.querySelector("[data-share]").onclick = async () => {
    try {
      if (!navigator.canShare?.({ files: [file] })) {
        download(file);
        d.querySelector(".error").textContent =
          "PDF descargado. Adjúntalo desde la conversación de WhatsApp.";
        return;
      }
      await navigator.share({ files: [file], title: "Prospecto COCO" });
    } catch (e) {
      if (e.name !== "AbortError")
        d.querySelector(".error").textContent =
          "No se pudo compartir. Descarga el PDF y adjúntalo desde WhatsApp.";
    }
  };
}
export function openContact(id) {
  const c = client(id),
    d = getDialog(),
    templates = { ...DEFAULT_TEMPLATES, ...useCrm().templates };
  d.classList.add("contact-dialog");
  d.innerHTML = `<div class="heading"><div><h2>Contactar a ${esc(c.name)}</h2><small>Selecciona qué enviar por WhatsApp.</small></div><button data-close aria-label="Cerrar contacto">×</button></div><label>Mensaje<select id="contact-choice">${Object.keys(
    templates,
  )
    .map(
      (k) =>
        `<option value="${esc(k)}" ${k === templateForStage(c.stage) ? "selected" : ""}>${esc(k)}</option>`,
    )
    .join(
      "",
    )}<option value="__prospect__">Enviar prospecto</option></select></label><div id="contact-message"><label>Texto del mensaje<textarea id="contact-text" rows="5"></textarea></label><a class="button wa" id="contact-send" target="_blank" rel="noopener noreferrer">Abrir mensaje en WhatsApp</a></div><div id="contact-prospect" hidden><p>El prospecto se genera con la información guardada del cliente. Puedes completarlo o enviarlo con espacios vacíos.</p><div class="actions"><button data-edit>Completar / editar prospecto</button><button class="primary" data-preview>Ver y enviar prospecto</button></div></div><p class="error" role="alert"></p>`;
  d.showModal();
  d.addEventListener("close", () => d.classList.remove("contact-dialog"), { once: true });
  d.querySelector("[data-close]").onclick = () => d.close();
  const choice = d.querySelector("#contact-choice"),
    text = d.querySelector("#contact-text"),
    link = d.querySelector("#contact-send");
  const sync = () => {
    const isProspect = choice.value === "__prospect__";
    d.querySelector("#contact-prospect").hidden = !isProspect;
    d.querySelector("#contact-message").hidden = isProspect;
    if (!isProspect) {
      text.value = templates[choice.value].replaceAll("[nombre]", c.name);
      link.href = waLink(c.phone, text.value);
    }
  };
  choice.onchange = sync;
  text.oninput = () => (link.href = waLink(c.phone, text.value));
  sync();
  link.onclick = () => {
    try {
      crm.addInteraction(id, "WhatsApp", "Mensaje abierto en WhatsApp: " + choice.value);
    } catch (e) {
      d.querySelector(".error").textContent = e.message;
    }
  };
  d.querySelector("[data-edit]").onclick = () => openProspect(id);
  d.querySelector("[data-preview]").onclick = async (e) => {
    e.target.disabled = true;
    try {
      await openProspectPreview(id);
    } catch (err) {
      d.querySelector(".error").textContent = err.message;
      e.target.disabled = false;
    }
  };
}
