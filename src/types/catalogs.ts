/**
 * Catalogos del SAT vigentes para CFDI 4.0.
 *
 * Fuente: Anexo 20 SAT (catalogos publicados).
 * No se incluyen todos los items — solo los mas comunes para
 * facturacion de servicios/productos en comercio electronico. Si
 * en el futuro necesitamos cubrir mas escenarios (donativos, IEPS,
 * importaciones), agregar aqui sin romper consumidores.
 */

/**
 * Uso CFDI: motivo por el cual el receptor solicita la factura.
 * Cada uso esta restringido por SAT al regimen fiscal del receptor;
 * la validacion final la hace Facturapi al timbrar.
 */
export const USO_CFDI = {
  G01: "Adquisicion de mercancias",
  G02: "Devoluciones, descuentos o bonificaciones",
  G03: "Gastos en general",
  I01: "Construcciones",
  I02: "Mobiliario y equipo de oficina por inversiones",
  I03: "Equipo de transporte",
  I04: "Equipo de computo y accesorios",
  I05: "Dados, troqueles, moldes, matrices y herramental",
  I06: "Comunicaciones telefonicas",
  I07: "Comunicaciones satelitales",
  I08: "Otra maquinaria y equipo",
  D01: "Honorarios medicos, dentales y gastos hospitalarios",
  D02: "Gastos medicos por incapacidad o discapacidad",
  D03: "Gastos funerales",
  D04: "Donativos",
  D05: "Intereses reales efectivamente pagados por creditos hipotecarios (casa habitacion)",
  D06: "Aportaciones voluntarias al SAR",
  D07: "Primas por seguros de gastos medicos",
  D08: "Gastos de transportacion escolar obligatoria",
  D09: "Depositos en cuentas para el ahorro, primas que tengan como base planes de pensiones",
  D10: "Pagos por servicios educativos (colegiaturas)",
  CP01: "Pagos",
  CN01: "Nomina",
  S01: "Sin efectos fiscales",
} as const

export type UsoCFDI = keyof typeof USO_CFDI

/**
 * Forma de pago SAT: medio por el que se recibe el pago.
 * En DeonPay solo aplican algunos (pago electronico). El resto
 * se incluye por completitud para reusar el modulo en otros canales.
 */
export const FORMA_PAGO = {
  "01": "Efectivo",
  "02": "Cheque nominativo",
  "03": "Transferencia electronica de fondos",
  "04": "Tarjeta de credito",
  "05": "Monedero electronico",
  "06": "Dinero electronico",
  "08": "Vales de despensa",
  "12": "Dacion en pago",
  "13": "Pago por subrogacion",
  "14": "Pago por consignacion",
  "15": "Condonacion",
  "17": "Compensacion",
  "23": "Novacion",
  "24": "Confusion",
  "25": "Remision de deuda",
  "26": "Prescripcion o caducidad",
  "27": "A satisfaccion del acreedor",
  "28": "Tarjeta de debito",
  "29": "Tarjeta de servicios",
  "30": "Aplicacion de anticipos",
  "31": "Intermediario pagos",
  "99": "Por definir",
} as const

export type FormaPago = keyof typeof FORMA_PAGO

/**
 * Regimen fiscal: clave del regimen tributario del contribuyente
 * (emisor o receptor). El receptor de una factura tambien tiene
 * regimen — desde CFDI 4.0 es obligatorio.
 */
export const REGIMEN_FISCAL = {
  "601": "General de Ley Personas Morales",
  "603": "Personas Morales con Fines no Lucrativos",
  "605": "Sueldos y Salarios e Ingresos Asimilados a Salarios",
  "606": "Arrendamiento",
  "607": "Regimen de Enajenacion o Adquisicion de Bienes",
  "608": "Demas ingresos",
  "610": "Residentes en el Extranjero sin Establecimiento Permanente en Mexico",
  "611": "Ingresos por Dividendos (socios y accionistas)",
  "612": "Personas Fisicas con Actividades Empresariales y Profesionales",
  "614": "Ingresos por intereses",
  "615": "Regimen de los ingresos por obtencion de premios",
  "616": "Sin obligaciones fiscales",
  "620": "Sociedades Cooperativas de Produccion que optan por diferir sus ingresos",
  "621": "Incorporacion Fiscal",
  "622": "Actividades Agricolas, Ganaderas, Silvicolas y Pesqueras",
  "623": "Opcional para Grupos de Sociedades",
  "624": "Coordinados",
  "625": "Regimen de las Actividades Empresariales con ingresos a traves de Plataformas Tecnologicas",
  "626": "Regimen Simplificado de Confianza",
} as const

export type RegimenFiscal = keyof typeof REGIMEN_FISCAL

/**
 * Metodo de pago SAT: distinto a forma de pago.
 *  - PUE: Pago en una sola exhibicion (la mayoria de cobros en linea).
 *  - PPD: Pago en parcialidades o diferido (requiere complemento de pago).
 *
 * DeonPay procesa cargos puntuales => default PUE.
 */
export const METODO_PAGO = {
  PUE: "Pago en una sola exhibicion",
  PPD: "Pago en parcialidades o diferido",
} as const

export type MetodoPago = keyof typeof METODO_PAGO

/**
 * Tipo de relacion entre CFDI (cuando una factura sustituye/cancela otra).
 * Solo se manda en cancelaciones con sustitucion (motivo 01).
 */
export const TIPO_RELACION = {
  "01": "Nota de credito de los documentos relacionados",
  "02": "Nota de debito de los documentos relacionados",
  "03": "Devolucion de mercancia sobre facturas o traslados previos",
  "04": "Sustitucion de los CFDI previos",
  "05": "Traslados de mercancias facturados previamente",
  "06": "Factura generada por los traslados previos",
  "07": "CFDI por aplicacion de anticipo",
} as const

export type TipoRelacion = keyof typeof TIPO_RELACION

/**
 * Motivo de cancelacion (SAT, vigente desde Nov 2022). Obligatorio
 * al cancelar una factura ya timbrada.
 *  - 01: Comprobante emitido con errores con relacion (requiere CFDI sustituto)
 *  - 02: Comprobante emitido con errores sin relacion
 *  - 03: No se llevo a cabo la operacion
 *  - 04: Operacion nominativa relacionada en la factura global
 */
export const MOTIVO_CANCELACION = {
  "01": "Comprobante emitido con errores con relacion",
  "02": "Comprobante emitido con errores sin relacion",
  "03": "No se llevo a cabo la operacion",
  "04": "Operacion nominativa relacionada en la factura global",
} as const

export type MotivoCancelacion = keyof typeof MOTIVO_CANCELACION
