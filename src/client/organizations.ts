/**
 * Cliente Facturapi Organizations API (v2).
 *
 * Separado de FacturapiClient (que opera contra una org especifica con
 * sk_test/sk_live) porque este usa User Key (sk_user_*) — la "master"
 * del reseller. Mezclarlos seria error-prone: si alguien instancia esto
 * con sk_test, todos los endpoints respondan 401.
 *
 * Multi-tenant white-label: DeonPay corre como un FacturapiOrganizationsClient
 * en el server con la User Key compartida. Crea/lee/actualiza orgs por
 * comerciante. Cuando llega el momento de timbrar, instancia un
 * FacturapiClient con la sk_test/sk_live de la org del comerciante.
 *
 * Sin dependencias runtime — fetch nativo + ArrayBuffer/Blob para multipart.
 */

import type {
  CreateOrganizationInput,
  LiveApiKey,
  OrganizationLegalData,
  OrganizationResponse,
  TestApiKeyResponse,
  UploadCertificateInput,
  UploadCertificateResponse,
} from "../types/organization"
import { FacturapiError } from "./facturapi"

const FACTURAPI_BASE_URL = "https://www.facturapi.io/v2"

export interface FacturapiOrganizationsClientOptions {
  /** User Key del reseller (sk_user_*). Auth para TODOS los endpoints. */
  userKey: string
  baseUrl?: string
  timeoutMs?: number
  logger?: (event: { method: string; url: string; status: number | null; durationMs: number; error?: string }) => void
}

export class FacturapiOrganizationsClient {
  private userKey: string
  private baseUrl: string
  private timeoutMs: number
  private logger?: FacturapiOrganizationsClientOptions["logger"]

  constructor(opts: FacturapiOrganizationsClientOptions) {
    if (!opts.userKey) {
      throw new Error("FacturapiOrganizationsClient requires userKey")
    }
    if (!opts.userKey.startsWith("sk_user_")) {
      throw new Error("userKey must start with sk_user_ (use the master/User Key, not org's sk_test/sk_live)")
    }
    this.userKey = opts.userKey
    this.baseUrl = opts.baseUrl ?? FACTURAPI_BASE_URL
    this.timeoutMs = opts.timeoutMs ?? 20000
    this.logger = opts.logger
  }

  /**
   * POST /v2/organizations — crea una nueva sub-organization bajo
   * la cuenta master. Inicialmente solo lleva `name`; los datos
   * fiscales se llenan despues via updateLegalData(orgId, ...).
   */
  async createOrganization(input: CreateOrganizationInput): Promise<OrganizationResponse> {
    return this.request<OrganizationResponse>("POST", "/organizations", input)
  }

  /**
   * GET /v2/organizations/{id} — obtiene una organization por id.
   * Incluye `pending_steps` para saber que falta antes de timbrar.
   */
  async getOrganization(orgId: string): Promise<OrganizationResponse> {
    return this.request<OrganizationResponse>("GET", `/organizations/${encodeURIComponent(orgId)}`)
  }

  /**
   * GET /v2/organizations — lista todas las orgs del reseller.
   * Util para reconciliacion o admin tools.
   */
  async listOrganizations(): Promise<OrganizationResponse[]> {
    const res = await this.request<{ data: OrganizationResponse[] } | OrganizationResponse[]>(
      "GET",
      "/organizations",
    )
    // Facturapi a veces envuelve en {data: []}, a veces devuelve array
    // directo segun version. Manejar ambos.
    if (Array.isArray(res)) return res
    return res.data ?? []
  }

  /**
   * PUT /v2/organizations/{id}/legal-data — actualiza RFC, razon
   * social, regimen, CP. Es lo que el comerciante captura en el
   * paso "Datos fiscales" del onboarding.
   */
  async updateLegalData(orgId: string, data: OrganizationLegalData): Promise<OrganizationResponse> {
    return this.request<OrganizationResponse>(
      "PUT",
      `/organizations/${encodeURIComponent(orgId)}/legal-data`,
      data,
    )
  }

  /**
   * DELETE /v2/organizations/{id} — elimina la organization. Solo
   * usar si el comerciante cancela su cuenta antes de timbrar o
   * para limpieza. Si ya hay CFDIs timbrados desde aqui, contactar
   * a Facturapi (no podemos borrar emisores con historial).
   */
  async deleteOrganization(orgId: string): Promise<void> {
    await this.request<unknown>("DELETE", `/organizations/${encodeURIComponent(orgId)}`)
  }

  /**
   * GET /v2/organizations/{id}/test-api-key — obtiene la sk_test
   * de la organization. Es lo que pasamos a FacturapiClient para
   * timbrar en modo test.
   */
  async getTestApiKey(orgId: string): Promise<string> {
    const res = await this.request<TestApiKeyResponse>(
      "GET",
      `/organizations/${encodeURIComponent(orgId)}/test-api-key`,
    )
    return res.value
  }

  /**
   * PUT /v2/organizations/{id}/test-api-key — regenera la sk_test
   * de la org. Util si se filtra o por rotacion periodica.
   */
  async renewTestApiKey(orgId: string): Promise<string> {
    const res = await this.request<TestApiKeyResponse>(
      "PUT",
      `/organizations/${encodeURIComponent(orgId)}/test-api-key`,
    )
    return res.value
  }

  /**
   * GET /v2/organizations/{id}/live-api-keys — lista las live keys
   * existentes. Notar que `value` siempre viene null aqui: Facturapi
   * solo expone el value en el POST de creacion. Por eso al crear
   * la org generamos la live key inmediato y la guardamos.
   */
  async listLiveApiKeys(orgId: string): Promise<LiveApiKey[]> {
    const res = await this.request<{ data: LiveApiKey[] } | LiveApiKey[]>(
      "GET",
      `/organizations/${encodeURIComponent(orgId)}/live-api-keys`,
    )
    if (Array.isArray(res)) return res
    return res.data ?? []
  }

  /**
   * POST /v2/organizations/{id}/live-api-keys — crea una nueva live
   * key. La respuesta incluye `value` (sk_live_*) — guardarlo en
   * el momento, despues NO se puede recuperar.
   */
  async createLiveApiKey(orgId: string): Promise<LiveApiKey> {
    return this.request<LiveApiKey>(
      "POST",
      `/organizations/${encodeURIComponent(orgId)}/live-api-keys`,
    )
  }

  /**
   * PUT /v2/organizations/{id}/certificates — sube el CSD del
   * emisor. Los archivos van como base64 + passphrase. Facturapi
   * los valida con SAT inline; si el .cer/.key no parean o la
   * password es incorrecta, devuelve 400.
   *
   * Despues de subir, is_production_ready cambia a true y la org
   * puede timbrar contra SAT real.
   */
  async uploadCertificates(
    orgId: string,
    input: UploadCertificateInput,
  ): Promise<UploadCertificateResponse> {
    return this.request<UploadCertificateResponse>(
      "PUT",
      `/organizations/${encodeURIComponent(orgId)}/certificates`,
      input,
    )
  }

  /**
   * DELETE /v2/organizations/{id}/certificates — elimina el CSD.
   * Vuelve la org a is_production_ready=false. Util si el comerciante
   * cambia de CSD o lo revoca con SAT.
   */
  async deleteCertificates(orgId: string): Promise<void> {
    await this.request<unknown>(
      "DELETE",
      `/organizations/${encodeURIComponent(orgId)}/certificates`,
    )
  }

  // ---------- Internals ----------

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`
    const startedAt = Date.now()
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${this.userKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      })
      const durationMs = Date.now() - startedAt
      const text = await res.text()
      let parsed: unknown = null
      if (text) {
        try {
          parsed = JSON.parse(text)
        } catch {
          parsed = text
        }
      }
      this.logger?.({ method, url, status: res.status, durationMs })

      if (!res.ok) {
        const errMsg =
          (typeof parsed === "object" && parsed && "message" in parsed
            ? String((parsed as { message: unknown }).message)
            : null) ?? `Facturapi ${method} ${path} respondio ${res.status}`
        const code =
          typeof parsed === "object" && parsed && "code" in parsed
            ? String((parsed as { code: unknown }).code)
            : undefined
        throw new FacturapiError(errMsg, { status: res.status, code, body: parsed })
      }

      return parsed as T
    } catch (err) {
      if (err instanceof FacturapiError) throw err
      const durationMs = Date.now() - startedAt
      const message = err instanceof Error ? err.message : "Unknown error"
      this.logger?.({ method, url, status: null, durationMs, error: message })
      throw new FacturapiError(`Facturapi network error: ${message}`, {
        status: 0,
        body: null,
      })
    } finally {
      clearTimeout(timeout)
    }
  }
}
