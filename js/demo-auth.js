// Accesos exclusivamente locales; nunca son cuentas de Supabase.
export function authenticateDemo(username, password) {
  const role = String(username ?? '').trim().toLowerCase();
  if (!['admin', 'asesor'].includes(role) || password !== '1234') {
    throw new Error('Usuario o contraseña incorrectos.');
  }
  return { id: 'demo-' + role, role, name: (role === 'admin' ? 'Admin' : 'Asesor') + ' COCO · demostración' };
}
