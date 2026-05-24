/**
 * Helpers para construir payloads CFDI desde estructuras de DeonPay
 * (line_items, customer, transaction) sin acoplar el modulo al schema
 * exacto. El consumidor mapea sus datos a estos tipos minimos y el
 * modulo arma el payload Facturapi.
 */

import type { CreateInvoiceInput, InvoiceCustomer, InvoiceItem } from "../types/invoice.js"
import type { FormaPago, UsoCFDI } from "../types/catalogs.js"

/**
 * Convierte centavos (formato interno DeonPay) a pesos con 2 decimales,
 * el formato que Facturapi/SAT esperan.
 */
export function centavosToPesos(centavos: number): number {
  return Math.round(centavos) / 100
}

/**
 * Mapea el brand de tarjeta NetPay/DeonPay al codigo SAT de forma de pago.
 *  - "credit" / "credito" → "04"
 *  - "debit" / "debito"   → "28"
 *  - otros / desconocido  → "99" (Por definir) — Facturapi lo aceptara
 *    pero el SAT puede pedir aclaracion. Mejor capturar el tipo real
 *    del lado de la transaccion cuando se pueda.
 */
export function paymentFormFromCardKind(kind: string | null | undefined): FormaPago {
  if (!kind) return "99"
  const k = kind.toLowerCase()
  if (k.includes("cred")) return "04"
  if (k.includes("deb")) return "28"
  return "99"
}

/**
 * Line item minimo que el consumidor pasa al helper. Mapea casi 1:1
 * a la estructura DeonPay (`PaymentLink.line_items`).
 */
export interface SimpleLineItem {
  description: string
  amount_centavos: number
  quantity?: number
  /** Clave producto/servicio SAT. Si no se da, usa el fallback del helper. */
  product_key?: string
  /** Unidad SAT. Default "E48" (servicio). */
  unit_key?: string
}

export interface BuildInvoiceInput {
  customer: InvoiceCustomer
  items: SimpleLineItem[]
  use: UsoCFDI
  payment_form: FormaPago
  /** Fallback product_key cuando el item no trae uno. Default "01010101". */
  defaultProductKey?: string
  /** Default unit_key cuando el item no trae uno. Default "E48". */
  defaultUnitKey?: string
  /** Si Facturapi debe enviar email automatico al cliente. Default true. */
  send_email?: boolean
  /** Serie interna (ej. "A", "DP"). */
  series?: string
}

/**
 * Construye el payload de CreateInvoiceInput a partir de datos minimos.
 * Aplica defaults sensatos y normaliza centavos a pesos.
 */
export function buildInvoicePayload(input: BuildInvoiceInput): CreateInvoiceInput {
  const defaultProductKey = input.defaultProductKey ?? "01010101"
  const defaultUnitKey = input.defaultUnitKey ?? "E48"

  const items: InvoiceItem[] = input.items.map((it) => ({
    quantity: it.quantity ?? 1,
    product: {
      description: it.description,
      product_key: it.product_key ?? defaultProductKey,
      price: centavosToPesos(it.amount_centavos),
      unit_key: it.unit_key ?? defaultUnitKey,
      // IVA 16% trasladado por defecto. El SAT lo asume si no se especifica
      // pero ser explicitos evita observaciones al timbrar.
      taxes: [
        {
          type: "IVA",
          rate: 0.16,
          factor: "Tasa",
          withholding: false,
        },
      ],
    },
  }))

  return {
    customer: input.customer,
    items,
    use: input.use,
    payment_form: input.payment_form,
    payment_method: "PUE",
    currency: "MXN",
    send_email: input.send_email ?? true,
    series: input.series,
  }
}
