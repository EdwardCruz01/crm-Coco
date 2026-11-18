export function validDni(value) { return /^\d{8}$/.test(value); }
export function validateVerification(mode, name, dni, hasPhoto, consent) {
    if (!name.trim())
        return "Escribe el nombre del cliente.";
    if (!consent)
        return "Se requiere la autorización del cliente.";
    if (mode === "dni" && !validDni(dni))
        return "El DNI debe tener 8 dígitos.";
    if (mode === "facial" && !hasPhoto)
        return "Agrega una fotografía.";
    return "";
}
