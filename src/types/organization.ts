/**
 * Tipos del modulo Organizations de Facturapi v2.
 *
 * Estos endpoints se autentican con User Key (sk_user_*), NO con
 * sk_test/sk_live de una organization. La User Key es la "master" del
 * reseller — solo el dueno de la cuenta master puede listarla en
 * dashboard.facturapi.io/settings/api-keys.
 *
 * Una "organization" en Facturapi es un emisor de CFDI con su propio
 * RFC, CSD, y juego de API keys (test + live). En DeonPay cada
 * comerciante en modo "managed" tiene su propia org bajo nuestra
 * cuenta master.
 */

/**
 * Direccion legal del emisor. Solo zip es obligatorio en CFDI 4.0.
 */
export interface OrganizationLegalAddress {
  street?: string
  exterior?: string
  interior?: string
  neighborhood?: string
  city?: string
  municipality?: string
  zip: string
  state?: string
}

/**
 * Datos fiscales del emisor (PUT /v2/organizations/{id}/legal-data).
 * Antes de subir el CSD se puede llenar — son la "identidad" del emisor.
 */
export interface OrganizationLegalData {
  name?: string
  legal_name: string
  tax_id: string                  // RFC del emisor (12 o 13 chars)
  tax_system: string              // regimen fiscal SAT (601, 612, etc)
  website?: string
  phone?: string
  address: OrganizationLegalAddress
  support_email?: string
}

/**
 * Input para POST /v2/organizations. Inicialmente lo unico
 * obligatorio es `name` — el resto se llena con legal-data despues.
 */
export interface CreateOrganizationInput {
  name: string
}

/**
 * Respuesta de una organization. Notar que `pending_steps` indica
 * lo que falta para que pueda timbrar (legal_data + certificate).
 */
export interface OrganizationResponse {
  id: string
  created_at: string
  is_production_ready: boolean
  pending_steps?: Array<{ type: string; description: string }>
  legal?: OrganizationLegalData | null
  // Facturapi expone mas campos (customization, receipts_settings,
  // etc.) pero no los necesitamos por ahora.
  [key: string]: unknown
}

/**
 * Respuesta al obtener test API key (GET /v2/organizations/{id}/test-api-key).
 * value es la key real (sk_test_*) — guardar en BD y nunca enviar al cliente.
 */
export interface TestApiKeyResponse {
  value: string
}

/**
 * Item del listado de live API keys (GET /v2/organizations/{id}/live-api-keys).
 * Diferente a test: pueden coexistir varias live keys (con su key_id propio).
 */
export interface LiveApiKey {
  id: string
  /** Solo presente en respuesta de POST (creacion). En el listado viene NULL */
  value?: string
  created_at: string
  last_used_at?: string | null
}

/**
 * Input para PUT /v2/organizations/{id}/certificates.
 * Los archivos .cer y .key deben ir como base64 — el caller los
 * convierte desde el File del browser (FileReader.readAsDataURL).
 */
export interface UploadCertificateInput {
  /** .cer file encoded as base64. */
  cer_base64: string
  /** .key file encoded as base64. */
  key_base64: string
  /** Password de la llave privada. */
  passphrase: string
}

export interface UploadCertificateResponse {
  message: string
  certificate?: {
    serial_number?: string
    valid_from?: string
    valid_to?: string
  }
}
