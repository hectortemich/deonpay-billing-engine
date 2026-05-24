/**
 * Validador de RFC mexicano.
 *
 * Reglas SAT:
 *  - Persona fisica: 4 letras + 6 digitos (AAMMDD) + 3 chars (homoclave).
 *  - Persona moral: 3 letras + 6 digitos (AAMMDD) + 3 chars (homoclave).
 *  - El dia, mes y año deben ser una fecha valida.
 *  - El ultimo digito de la homoclave es un digito verificador calculado
 *    sobre los primeros 12 (PF) o 11 (PM) caracteres.
 *
 * El digito verificador se valida en `isValidRfc` con suma ponderada
 * (algoritmo oficial SAT). Para "XAXX010101000" (publico en general)
 * y "XEXX010101000" (extranjero) se acepta sin verificar — son
 * RFCs genericos validos para CFDI cuando el receptor no se identifica.
 */

const GENERIC_RFCS = new Set(["XAXX010101000", "XEXX010101000"])

const RFC_REGEX_PF = /^[A-ZÑ&]{4}\d{6}[A-Z\d]{3}$/
const RFC_REGEX_PM = /^[A-ZÑ&]{3}\d{6}[A-Z\d]{3}$/

const CHECK_DIGIT_TABLE: Record<string, number> = {
  "0": 0, "1": 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9,
  A: 10, B: 11, C: 12, D: 13, E: 14, F: 15, G: 16, H: 17, I: 18, J: 19,
  K: 20, L: 21, M: 22, N: 23, "&": 24, O: 25, P: 26, Q: 27, R: 28, S: 29,
  T: 30, U: 31, V: 32, W: 33, X: 34, Y: 35, Z: 36, " ": 37, "Ñ": 38,
}

/**
 * Normaliza un RFC: trim, mayusculas, sin guiones ni espacios.
 * No lo valida — solo lo formatea para validacion posterior.
 */
export function normalizeRfc(input: string): string {
  return input.trim().toUpperCase().replace(/[\s-]/g, "")
}

/**
 * Valida solo la forma estructural (longitud + regex). No verifica
 * fecha ni digito verificador. Util para validacion incremental
 * mientras el usuario escribe.
 */
export function hasValidRfcShape(input: string): boolean {
  const rfc = normalizeRfc(input)
  if (rfc.length === 13) return RFC_REGEX_PF.test(rfc)
  if (rfc.length === 12) return RFC_REGEX_PM.test(rfc)
  return false
}

/**
 * Validacion completa: forma + fecha + digito verificador. Devuelve
 * un objeto con `valid` y `reason` (para mostrar al usuario por que
 * no paso).
 */
export function validateRfc(input: string): { valid: boolean; reason?: string; normalized: string } {
  const rfc = normalizeRfc(input)

  if (GENERIC_RFCS.has(rfc)) {
    return { valid: true, normalized: rfc }
  }

  if (!hasValidRfcShape(rfc)) {
    return {
      valid: false,
      reason: "El RFC debe tener 12 (moral) o 13 (fisica) caracteres con el formato correcto.",
      normalized: rfc,
    }
  }

  const isPF = rfc.length === 13
  const dateStart = isPF ? 4 : 3
  const dateStr = rfc.slice(dateStart, dateStart + 6)
  if (!isValidYYMMDD(dateStr)) {
    return {
      valid: false,
      reason: "La fecha embebida en el RFC no es valida.",
      normalized: rfc,
    }
  }

  if (!hasValidCheckDigit(rfc)) {
    return {
      valid: false,
      reason: "El digito verificador del RFC no coincide. Revisa que este escrito correctamente.",
      normalized: rfc,
    }
  }

  return { valid: true, normalized: rfc }
}

/**
 * Atajo booleano para llamadas simples. Si necesitas el motivo del
 * fallo, usar `validateRfc`.
 */
export function isValidRfc(input: string): boolean {
  return validateRfc(input).valid
}

function isValidYYMMDD(s: string): boolean {
  if (!/^\d{6}$/.test(s)) return false
  const yy = parseInt(s.slice(0, 2), 10)
  const mm = parseInt(s.slice(2, 4), 10)
  const dd = parseInt(s.slice(4, 6), 10)
  if (mm < 1 || mm > 12) return false
  if (dd < 1 || dd > 31) return false
  // Heuristica: si yy <= currentYear+1 lo asumimos 20yy, sino 19yy.
  // No es perfecto pero RFCs validos para el SAT respetan este rango.
  const currentYY = new Date().getFullYear() % 100
  const year = yy <= currentYY + 1 ? 2000 + yy : 1900 + yy
  const date = new Date(year, mm - 1, dd)
  return (
    date.getFullYear() === year &&
    date.getMonth() === mm - 1 &&
    date.getDate() === dd
  )
}

/**
 * Algoritmo oficial SAT del digito verificador (factor 13 descendente).
 * Se aplica sobre los primeros n-1 caracteres del RFC; el digito
 * resultante debe coincidir con el ultimo caracter.
 */
function hasValidCheckDigit(rfc: string): boolean {
  const len = rfc.length
  // El RFC se "padea" a la izquierda con espacios para que el calculo
  // sea uniforme entre PF (13) y PM (12).
  const padded = len === 12 ? " " + rfc : rfc
  let sum = 0
  for (let i = 0; i < 12; i++) {
    const ch = padded[i]
    const val = CHECK_DIGIT_TABLE[ch]
    if (val === undefined) return false
    sum += val * (13 - i)
  }
  const mod = sum % 11
  const expected = mod === 0 ? "0" : mod === 1 ? "A" : String(11 - mod)
  return padded[12] === expected
}
