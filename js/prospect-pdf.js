import { normalizeProspect } from "./prospect-model.js";
// Constructor inyectable para reutilizar exactamente el mismo PDF en navegador y pruebas.
export function createProspectPdf(jsPDF, input, background) {
  const p = normalizeProspect(input),
    doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  const left = 13,
    width = 184,
    top = 65,
    bottom = 244;
  let y = top;
  const date = (s) => (s ? s.split("-").reverse().join("/") : "");
  function page() {
    doc.addImage(background, "PNG", 0, 0, 210, 297, "coco-base", "FAST");
    y = top;
  }
  function ensure(h) {
    if (y + h > bottom) {
      doc.addPage();
      page();
    }
  }
  function section(title) {
    ensure(15);
    doc.setFillColor(255, 236, 214);
    doc.setDrawColor(235, 174, 117);
    doc.setLineWidth(0.16);
    doc.rect(left, y, width, 6, "FD");
    doc.setTextColor(128, 65, 24);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(title, left + 2, y + 4);
    y += 6;
  }
  function row(cells) {
    const parts = cells.map(([label, value, weight = 1]) => ({
        label,
        value: String(value ?? ""),
        weight,
      })),
      total = parts.reduce((n, c) => n + c.weight, 0);
    for (const c of parts) {
      c.w = (width * c.weight) / total;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      c.lines = doc.splitTextToSize(c.value, c.w - 4);
    }
    let offset = 0;
    const count = Math.max(1, ...parts.map((c) => c.lines.length));
    const fullHeight = Math.max(10, 5.6 + count * 3.5);
    if (fullHeight <= bottom - top) ensure(fullHeight);
    while (offset < count) {
      ensure(10);
      const capacity = Math.max(1, Math.floor((bottom - y - 5.6) / 3.5));
      const take = Math.min(count - offset, capacity),
        h = Math.max(10, 5.6 + take * 3.5);
      let x = left;
      for (const c of parts) {
        doc.setDrawColor(234, 184, 139);
        doc.setLineWidth(0.13);
        doc.rect(x, y, c.w, h);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(6.3);
        doc.setTextColor(132, 86, 53);
        doc.text(c.label, x + 2, y + 3);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(36, 45, 52);
        const lines = c.lines.slice(offset, offset + take);
        doc.text(lines.length ? lines : [" "], x + 2, y + 7);
        x += c.w;
      }
      y += h;
      offset += take;
      if (offset < count) {
        doc.addPage();
        page();
      }
    }
  }
  page();
  section("DATOS DEL CLIENTE");
  row([
    ["APELLIDOS Y NOMBRES", p.fullName, 3],
    ["DNI", p.dni],
  ]);
  row([
    ["ESTADO CIVIL", p.civilStatus],
    ["GÉNERO", p.gender],
    ["OCUPACIÓN", p.occupation, 2],
  ]);
  row([
    ["DIRECCIÓN", p.address, 2],
    ["DISTRITO", p.district],
    ["REFERENCIA", p.reference],
  ]);
  row([
    ["TELÉFONO", p.phone],
    ["EMAIL (OPCIONAL)", p.email, 2],
    ["EDAD", p.age],
    ["TIENE HIJOS", p.children],
  ]);
  row([
    ["MOTIVO DE LA COMPRA", p.purchaseReason, 2],
    ["PAGARÁ EN CONJUNTO", p.jointPurchase],
    ["NOMBRE DE LA OTRA PERSONA", p.jointName, 2],
  ]);
  section("DATOS DEL PROYECTO");
  row([
    ["PROYECTO", p.projectName, 2],
    ["TIPO DE INMUEBLE", p.projectType],
    ["METRAJE (m²)", p.area],
    ...(p.projectType === "Departamento" ? [["NIVEL", p.level]] : []),
  ]);
  row([["UBICACIÓN", p.location]]);
  section("MÉTODO DE PAGO: CONTADO, FRACCIONADO O FINANCIADO");
  row([
    ["PRECIO DEL INMUEBLE", p.price],
    ["MONEDA / MODALIDAD", [p.currency, p.paymentMethod].filter(Boolean).join(" / ")],
    ["T. CAMBIO / DÓLAR REF.", p.dollarRate],
    ["ENTIDAD BANCARIA", p.bank],
  ]);
  row([
    ["ABONO", p.deposit],
    ["SALDO", p.balance],
    ["COMPROMISO DE PAGO (DETALLE)", p.paymentCommitment, 2],
  ]);
  row([
    ["CUOTAS FRACCIONADAS", p.fractionCount],
    ["CUOTA", p.fractionAmount],
    ["FECHA DE INICIO DE PAGO", date(p.fractionStart), 2],
  ]);
  row([
    ["CUOTAS FINANCIADAS", p.financeCount],
    ["TEM / TEA", [p.rateType, p.rate ? p.rate + "%" : ""].filter(Boolean).join(" ")],
    ["CUOTA", p.financeAmount],
    ["FECHA DE INICIO DE PAGO", date(p.financeStart)],
  ]);
  section("¿CÓMO SE ENTERÓ DEL PROYECTO?");
  row([["CANALES SELECCIONADOS", p.channels.join("  /  ")]]);
  row([
    ["PROMOTOR", p.promoter],
    ["REFERIDO POR", p.referrer],
    ["VISITA DIRECTA / CITA", p.visitType],
  ]);
  row([
    ["LUGAR", p.issuePlace],
    ["FECHA", date(p.issueDate)],
    ["VIGENCIA DE SEPARACIÓN HASTA", date(p.separationUntil)],
  ]);
  // La nota legal está incluida en la imagen original y se conserva intacta.
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(6);
    doc.setTextColor(115);
    doc.text(`${i} / ${pages}`, 197, 247, { align: "right" });
  }
  doc.setProperties({
    title: "Prospecto de inscripción · COCO Inmobiliaria",
    subject: "Ficha editable desde el CRM",
    creator: "COCO CRM",
  });
  return doc;
}
let templatePromise;
export async function buildProspectFile(prospect, code = "cliente") {
  const [{ jsPDF }, background] = await Promise.all([
    import("/vendor/jspdf.js"),
    (templatePromise ??= fetch("/public/prospectos/base-coco.png")
      .then(async (r) => {
        if (!r.ok) throw Error("No se pudo cargar la base del prospecto.");
        return new Uint8Array(await r.arrayBuffer());
      })
      .catch((e) => {
        templatePromise = null;
        throw e;
      })),
  ]);
  const doc = createProspectPdf(jsPDF, prospect, background);
  return new File(
    [doc.output("blob")],
    `Prospecto-COCO-${String(code).replace(/[^a-z0-9-]/gi, "_")}.pdf`,
    { type: "application/pdf" },
  );
}
