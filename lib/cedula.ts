// Validación de cédula ecuatoriana (algoritmo Módulo 10).
// 10 dígitos: 2 de provincia (01–24, ó 30 = exterior), tercer dígito < 6 para
// persona natural, y un dígito verificador final que detecta números alterados.

const COEF = [2, 1, 2, 1, 2, 1, 2, 1, 2];

/** Deja solo dígitos (quita espacios, guiones, etc.). */
export function normalizeCedula(raw: string): string {
  return (raw ?? "").replace(/\D/g, "");
}

export function isValidCedula(raw: string): boolean {
  const cedula = normalizeCedula(raw);
  if (!/^\d{10}$/.test(cedula)) return false;

  const provincia = parseInt(cedula.slice(0, 2), 10);
  if ((provincia < 1 || provincia > 24) && provincia !== 30) return false;

  const tercer = parseInt(cedula[2], 10);
  if (tercer > 5) return false;

  let suma = 0;
  for (let i = 0; i < 9; i++) {
    let v = parseInt(cedula[i], 10) * COEF[i];
    if (v >= 10) v -= 9;
    suma += v;
  }
  const verificador = parseInt(cedula[9], 10);
  const calculado = (10 - (suma % 10)) % 10;
  return calculado === verificador;
}
