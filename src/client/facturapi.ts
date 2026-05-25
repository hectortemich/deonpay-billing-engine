/**
 * Cliente HTTP para Facturapi.io v2.
 *
 * Sin dependencias runtime — usa `fetch` nativo (Node 18+ / runtime
 * de Vercel). Cada metodo devuelve la respuesta tipada o lanza
 * `FacturapiError` con el status + body para que el consumidor
 * decida como reaccionar (retry, log, mostrar al usuario).
 *
 * Auth: Bearer con la API key del comercio (test sk_test_..., live
 * sk_live_...). El cliente NO guarda credenciales — se pasan en el
 * constructor para que el consumidor maneje multi-tenant facilmente.
 */

import type {
  CancelInvoiceInput,
  CancelInvoiceResponse,
  CreateInvoiceInput,
  InvoiceResponse,
  OrganizationInfo,
} from "../types/invoice"

const FACTURAPI_BASE_URL = "https://www.facturapi.io/v2"

export interface FacturapiClientOptions {
  apiKey: string
  /** Override del base URL — util para tests o staging propio. */
  baseUrl?: string
  /** Timeout en ms para cada request. Default 15000 (15s). */
  timeoutMs?: number
  /**
   * Logger opcional. Recibe { method, url, status, durationMs, error? }
   * por cada llamada. Util para integrar con netpay_api_logs o similar.
   */
  logger?: (event: FacturapiLogEvent) => void
}

export interface FacturapiLogEvent {
  method: string
  url: string
  status: number | null
  durationMs: number
  error?: string
}

/**
 * Error tipado de Facturapi. Contiene status HTTP, codigo de error
 * (cuando Facturapi lo manda) y el body crudo para debugging.
 */
export class FacturapiError extends Error {
  status: number
  code?: string
  body?: unknown

  constructor(message: string, opts: { status: number; code?: string; body?: unknown }) {
    super(message)
    this.name = "FacturapiError"
    this.status = opts.status
    this.code = opts.code
    this.body = opts.body
  }
}

export class FacturapiClient {
  private apiKey: string
  private baseUrl: string
  private timeoutMs: number
  private logger?: (event: FacturapiLogEvent) => void

  constructor(opts: FacturapiClientOptions) {
    if (!opts.apiKey) {
      throw new Error("FacturapiClient requires apiKey")
    }
    this.apiKey = opts.apiKey
    this.baseUrl = opts.baseUrl ?? FACTURAPI_BASE_URL
    this.timeoutMs = opts.timeoutMs ?? 15000
    this.logger = opts.logger
  }

  /**
   * Detecta si la key es de produccion (sk_live_*) o sandbox (sk_test_*).
   * Util para que el consumidor pinte un badge "TEST" / "LIVE" sin
   * llamar a /me.
   */
  isLive(): boolean {
    return this.apiKey.startsWith("sk_live_")
  }

  /**
   * Valida la key llamando GET /organizations/me. Si la key es invalida,
   * lanza FacturapiError con status 401.
   */
  async getOrganization(): Promise<OrganizationInfo> {
    return this.request<OrganizationInfo>("GET", "/organizations/me")
  }

  /**
   * Crea (timbra) una factura. Si Facturapi valida y el PAC del SAT
   * timbra correctamente, devuelve la factura con `uuid` y stamp.
   * Sino lanza FacturapiError con el detalle de validacion.
   *
   * Sobre el envio de email:
   * Facturapi v2 envia automaticamente el CFDI al `customer.email` si
   * esta presente. No hay flag `send_email` (rechaza en body con 400
   * "send_email is not allowed") ni query `?email=true` (rechaza con
   * 400 "email is not allowed"). El comportamiento por default ya es
   * "enviar si hay email".
   *
   * Si el caller pasa send_email=false en el input, lo descartamos
   * silenciosamente — Facturapi no soporta deshabilitar el envio
   * inline. Si quieren controlarlo, deben no incluir customer.email
   * (el CFDI igual se timbra, sin envio automatico).
   */
  async createInvoice(input: CreateInvoiceInput): Promise<InvoiceResponse> {
    const { send_email: _ignored, ...body } = input
    return this.request<InvoiceResponse>("POST", "/invoices", body)
  }

  /**
   * Lee una factura por ID Facturapi (no UUID SAT).
   */
  async retrieveInvoice(id: string): Promise<InvoiceResponse> {
    return this.request<InvoiceResponse>("GET", `/invoices/${encodeURIComponent(id)}`)
  }

  /**
   * Cancela una factura. Requiere motivo SAT obligatorio.
   *  - motive "01" requiere substitution UUID.
   *  - El proceso es asincrono en SAT (status "pending" → "accepted").
   */
  async cancelInvoice(id: string, input: CancelInvoiceInput): Promise<CancelInvoiceResponse> {
    const params = new URLSearchParams()
    params.set("motive", input.motive)
    if (input.substitution) params.set("substitution", input.substitution)
    return this.request<CancelInvoiceResponse>(
      "DELETE",
      `/invoices/${encodeURIComponent(id)}?${params.toString()}`,
    )
  }

  /**
   * Descarga el PDF de una factura. Devuelve un ArrayBuffer; el
   * consumidor decide si lo guarda, lo sirve o lo manda por email.
   */
  async downloadPdf(id: string): Promise<ArrayBuffer> {
    return this.requestBinary("GET", `/invoices/${encodeURIComponent(id)}/pdf`)
  }

  /**
   * Descarga el XML CFDI 4.0 firmado y timbrado por el SAT.
   */
  async downloadXml(id: string): Promise<ArrayBuffer> {
    return this.requestBinary("GET", `/invoices/${encodeURIComponent(id)}/xml`)
  }

  /**
   * Reenvia la factura por email al receptor. Usa el email registrado
   * en customer.email salvo que se pase override.
   */
  async sendByEmail(id: string, email?: string): Promise<{ ok: true }> {
    const body = email ? { email } : undefined
    await this.request<unknown>("POST", `/invoices/${encodeURIComponent(id)}/email`, body)
    return { ok: true }
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
          Authorization: `Bearer ${this.apiKey}`,
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
            : null) ||
          `Facturapi ${method} ${path} respondio ${res.status}`
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

  private async requestBinary(method: string, path: string): Promise<ArrayBuffer> {
    const url = `${this.baseUrl}${path}`
    const startedAt = Date.now()
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          Accept: "*/*",
        },
        signal: controller.signal,
      })
      const durationMs = Date.now() - startedAt
      this.logger?.({ method, url, status: res.status, durationMs })
      if (!res.ok) {
        throw new FacturapiError(`Facturapi ${method} ${path} respondio ${res.status}`, {
          status: res.status,
        })
      }
      return await res.arrayBuffer()
    } finally {
      clearTimeout(timeout)
    }
  }
}
