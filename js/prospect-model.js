// Un prospecto es una instantánea editable. Un vacío guardado nunca se rellena de nuevo.
export const CHANNELS = [
  "Caseta",
  "Facebook",
  "Marketplace",
  "Adds",
  "Instagram",
  "WhatsApp",
  "Página web",
  "Volante",
  "Panel publicitario",
  "Ferias",
  "Evento presencial",
  "Publicidad en buses",
  "Panel de ruta",
  "TikTok",
  "Referido",
  "Programa TV",
  "Radio",
  "Revistas",
];
export const NOTE =
  "Las separaciones tienen una vigencia según la fecha señalada en la presente constancia. Sobre las separaciones, si el cliente decide no continuar con la compra, se genera una retención del 100% por gastos administrativos sobre el monto aportado, esta penalidad aplica desde el momento en que el cliente realiza el aporte en cuenta, dando de esta manera su conformidad con el depósito realizado, por lo cual se estipula para departamentos 30 dias y para terrenos 7 dias. Asimismo, la firma y legalización del contrato debe realizarse en una programación máxima de 30 dias calendarios.";
export const FIELDS = [
  ["fullName", "Apellidos y nombres"],
  ["dni", "DNI"],
  [
    "civilStatus",
    "Estado civil",
    "select",
    ["Soltero/a", "Casado/a", "Conviviente", "Divorciado/a", "Viudo/a"],
  ],
  ["gender", "Género", "select", ["Femenino", "Masculino", "Otro", "Prefiere no indicar"]],
  ["occupation", "Ocupación"],
  ["address", "Dirección"],
  ["district", "Distrito"],
  ["reference", "Referencia"],
  ["phone", "Teléfono", "tel"],
  ["email", "Email (opcional)", "email"],
  ["age", "Edad", "number"],
  ["children", "¿Tiene hijos?", "select", ["Sí", "No"]],
  ["purchaseReason", "Motivo de la compra", "textarea"],
  ["jointPurchase", "¿Pagará en conjunto con otra persona?", "select", ["Sí", "No"]],
  ["jointName", "Nombre de la persona con quien pagará"],
  ["projectId", "Proyecto", "project"],
  [
    "projectType",
    "Tipo de inmueble",
    "select",
    ["Terreno", "Lote", "Departamento", "Casa", "Local"],
  ],
  ["area", "Metraje (m²)", "number"],
  ["level", "Nivel / piso"],
  ["location", "Ubicación"],
  ["paymentMethod", "Método de pago", "select", ["Contado", "Fraccionado", "Financiado", "Mixto"]],
  ["currency", "Moneda", "select", ["Soles (PEN)", "Dólares (USD)"]],
  ["price", "Precio del inmueble", "number"],
  ["dollarRate", "Precio referencial del dólar / T. cambio", "number"],
  ["bank", "Entidad bancaria"],
  ["deposit", "Abono", "number"],
  ["balance", "Saldo", "number"],
  ["paymentCommitment", "Compromiso de pago (detalle)", "textarea"],
  ["fractionCount", "Cuotas fraccionadas", "number"],
  ["fractionAmount", "Cuota fraccionada", "number"],
  ["fractionStart", "Fecha de inicio de pago fraccionado", "date"],
  ["financeCount", "Cuotas financiadas", "number"],
  ["financeAmount", "Cuota financiada", "number"],
  ["financeStart", "Fecha de inicio de pago financiado", "date"],
  ["rateType", "Tipo de tasa", "select", ["TEM", "TEA"]],
  ["rate", "TEM / TEA (%)", "number"],
  ["promoter", "Promotor"],
  ["referrer", "Referido por"],
  ["visitType", "Modalidad de visita", "select", ["Visita directa", "Cita"]],
  ["issuePlace", "Lugar de emisión"],
  ["issueDate", "Fecha de emisión", "date"],
  ["separationUntil", "Vigencia de separación hasta", "date"],
  ["observation", "Observación", "textarea"],
];
export function makeProspect(client = {}, projects = [], advisors = []) {
  if (client.prospect) return structuredClone(client.prospect);
  const p = projects.find((p) => p.id === client.projectIds?.[0]);
  const value = Object.fromEntries(FIELDS.map(([key]) => [key, ""]));
  return {
    ...value,
    version: 1,
    fullName: client.name || "",
    dni: client.dni || "",
    phone: client.phone || "",
    email: client.email || "",
    purchaseReason: client.purpose || "",
    projectId: p?.id || "",
    projectName: p?.name || "",
    projectType: p?.type || client.propertyType || "",
    area: p?.area == null ? "" : String(p.area),
    location: p?.location || client.location || "",
    price: p?.price == null ? "" : String(p.price),
    promoter: advisors.find((a) => a.id === client.advisorId)?.name || "",
    channels: [],
    updatedAt: "",
  };
}
export function normalizeProspect(input) {
  const result = { version: 1 };
  for (const [key] of FIELDS) result[key] = String(input[key] ?? "").trim();
  result.projectName = String(input.projectName ?? "").trim();
  result.channels = Array.isArray(input.channels)
    ? CHANNELS.filter((c) => input.channels.includes(c))
    : [];
  if (result.jointPurchase !== "Sí") result.jointName = "";
  if (result.projectType !== "Departamento") result.level = "";
  if (result.dni && !/^\d{8}$/.test(result.dni))
    throw Error("El DNI debe tener 8 dígitos o quedar vacío.");
  if (result.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email))
    throw Error("Revisa el email o déjalo vacío.");
  for (const [key, label, type] of FIELDS) {
    if (result[key].length > 1000) throw Error(label + ": máximo 1000 caracteres.");
    if (
      type === "number" &&
      result[key] !== "" &&
      (!Number.isFinite(Number(result[key])) || Number(result[key]) < 0)
    )
      throw Error(label + ": usa un número positivo o deja el espacio vacío.");
  }
  for (const key of ["age", "fractionCount", "financeCount"])
    if (result[key] !== "" && !Number.isInteger(Number(result[key])))
      throw Error("La edad y el número de cuotas deben ser enteros.");
  return result;
}
