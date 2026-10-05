// Simulated external registry lookup (assumption #4: "validar contra un servicio externo").
// Same contract a real integration would expose: async, resolves { ok }.
import { isPlausibleDni } from './rules.js';

export async function verifyPersona(dni) {
  await new Promise((resolve) => setTimeout(resolve, 120));
  return { ok: isPlausibleDni(dni) };
}
