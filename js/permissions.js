export const advisorPaths = ["/clientes", "/visitas", "/embudo", "/verificacion", "/cuenta"];
export function canAccess(role, path) {
    return role === "admin" || (role === "asesor" && advisorPaths.some((p) => path === p || path.startsWith(p + "/")));
}
export function canManageGeneral(role) { return role === "admin"; }
