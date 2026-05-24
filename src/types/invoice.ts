/**
 * Tipos del modelo Facturapi v2. Estructurados para que el consumidor
 * (DeonPay hoy, paquete publico manana) pueda construir payloads y
 * leer respuestas con autocomplete y type-safety.
 *
 * NO mapean 1:1 todo lo que devuelve Facturapi — solo los campos que
 * usamos hoy + algunos que probablemente vamos a necesitar. Si llega
 * un campo nuevo, agregar aqui antes de leerlo.
 */

import type {
  FormaPago,
  MetodoPago,
  MotivoCancelacion,
  RegimenFiscal,
  TipoRelacion,
  UsoCFDI,
} from "./catalogs.js"

/**
 * Direccion fiscal del receptor. Solo `zip` es obligatorio en CFDI 4.0;
 * el resto se incluye por completitud (Facturapi los aceptara opcionalmente).
 */
export interface InvoiceAddress {
  street?: string
  exterior?: string
  interior?: string
  neighborhood?: string
  city?: string
  municipality?: string
  zip: string
  state?: string
  country?: string
}

/**
 * Receptor de la factura. CFDI 4.0 exige:
 *  - legal_name (razon social tal cual aparece en la constancia)
 *  - tax_id (RFC)
 *  - tax_system (regimen fiscal del receptor)
 *  - address.zip (CP fiscal del receptor)
 *  - email (no SAT, pero Facturapi lo usa para envio automatico)
 */
export interface InvoiceCustomer {
  legal_name: string
  tax_id: string
  email?: string
  phone?: string
  tax_system: RegimenFiscal
  address: InvoiceAddress
}

/**
 * Producto/servicio facturado. Facturapi acepta tanto un objeto
 * `product` inline como una referencia a un product_id pre-registrado.
 * Manejamos inline para no obligar al consumidor a sincronizar catalogos.
 */
export interface InvoiceItemProduct {
  description: string
  /**
   * Clave producto/servicio SAT (8 digitos). Si no se conoce, Facturapi
   * acepta "01010101" (No existe en el catalogo) — pero se debe evitar
   * porque puede traer observaciones al timbrar. Para servicios genericos
   * de software/SaaS, "84111506" (Servicios de facturacion) es la mas comun.
   */
  product_key: string
  price: number
  /**
   * Unidad SAT. Default Facturapi: "E48" (Unidad de servicio).
   * Otras comunes: "H87" (Pieza), "ACT" (Actividad), "MTS" (Metro).
   */
  unit_key?: string
  unit_name?: string
  sku?: string
  taxability?: string
  taxes?: InvoiceTax[]
  /** Permite enviar atributos custom (Facturapi los ignora si no aplican). */
  [key: string]: unknown
}

export interface InvoiceItem {
  product: InvoiceItemProduct
  quantity: number
  discount?: number
}

/**
 * Impuesto aplicado a un item. IVA 16% es lo default.
 *  - type: "IVA" | "ISR" | "IEPS"
 *  - rate: tasa decimal (0.16 para 16%)
 *  - factor: "Tasa" | "Cuota" | "Exento"
 *  - withholding: true si es retencion, false si es traslado
 */
export interface InvoiceTax {
  type: "IVA" | "ISR" | "IEPS"
  rate: number
  factor?: "Tasa" | "Cuota" | "Exento"
  withholding?: boolean
}

/**
 * CFDI relacionado (para sustitucion o nota de credito).
 */
export interface InvoiceRelated {
  type: TipoRelacion
  uuids: string[]
}

/**
 * Payload para crear una factura tipo "I" (Ingreso) — el caso 99%
 * de DeonPay. Otros tipos (E=egreso, P=pago, T=traslado) requieren
 * campos adicionales; cuando los necesitemos los agregamos.
 */
export interface CreateInvoiceInput {
  customer: InvoiceCustomer
  items: InvoiceItem[]
  /** Uso CFDI declarado por el receptor. */
  use: UsoCFDI
  /** Forma de pago (SAT). En cargos con tarjeta default "28" (debito) o "04" (credito). */
  payment_form: FormaPago
  /** Default PUE para cargos puntuales. */
  payment_method?: MetodoPago
  /** Serie/folio interno del comercio (Facturapi tambien lleva su contador). */
  series?: string
  folio_number?: number
  /** Moneda ISO 4217. Default "MXN". */
  currency?: string
  /** Tipo de cambio (solo si currency != MXN). */
  exchange?: number
  /** Condiciones de pago en texto libre. */
  conditions?: string
  /** CFDI relacionados (sustitucion, etc). */
  related?: InvoiceRelated[]
  /**
   * Si true (default), Facturapi envia la factura por email al cliente
   * usando customer.email. Se controla aqui para que el consumidor
   * decida si quiere usar el email de Facturapi o el suyo propio.
   */
  send_email?: boolean
  /** Permite atributos extra propios de Facturapi. */
  [key: string]: unknown
}

/**
 * Respuesta de Facturapi al crear/leer una factura. Incluye los IDs
 * generados (facturapi_id, uuid SAT, folio) + status + uris de descarga.
 */
export interface InvoiceResponse {
  id: string
  created_at: string
  livemode: boolean
  status: "valid" | "canceled" | "pending"
  cancellation_status?: string | null
  verification_url: string
  /** Folio fiscal SAT (UUID). Solo presente cuando status === "valid". */
  uuid: string
  folio_number: number
  series?: string | null
  customer: InvoiceCustomer & { id?: string }
  total: number
  currency: string
  use: UsoCFDI
  payment_form: FormaPago
  payment_method: MetodoPago
  type: "I" | "E" | "P" | "T" | "N"
  /** Si livemode=true, viene con sello/timbre SAT. */
  stamp?: {
    signature: string
    date: string
    sat_cert_number?: string
    sat_signature?: string
  }
  /** Permite leer cualquier campo extra que Facturapi devuelva. */
  [key: string]: unknown
}

/**
 * Input para cancelar. La motivacion es obligatoria desde Nov 2022.
 *  - Motivo "01" requiere un substitution UUID (CFDI que reemplaza).
 *  - Otros motivos no.
 */
export interface CancelInvoiceInput {
  motive: MotivoCancelacion
  /** Solo requerido si motive === "01". */
  substitution?: string
}

export interface CancelInvoiceResponse {
  id: string
  status: "canceled"
  cancellation_status: "pending" | "accepted" | "rejected"
  livemode: boolean
}

/**
 * Respuesta del endpoint /organizations/me — usado para validar
 * que una API key funciona antes de guardarla en la BD del comercio.
 */
export interface OrganizationInfo {
  id: string
  legal_name: string
  tax_id: string
  legal_business_name?: string
  is_production_ready?: boolean
  livemode: boolean
}
