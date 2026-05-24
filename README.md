# @deonpay/billing-engine

Motor de facturación CFDI 4.0 para México. Cliente Facturapi.io + validadores + catálogos SAT.

Diseñado para vivir como submódulo dentro de DeonPay hoy, e independizarse como producto/paquete npm en el futuro. Por eso es **puro** (sin dependencias de DB, framework o ORM) y solo expone funciones y tipos.

## Alcance

- Cliente HTTP para [Facturapi.io](https://www.facturapi.io) v2 (emisión, cancelación, descarga, reenvío).
- Tipos TypeScript para `Invoice`, `Customer`, `Item`, `Tax`, `PaymentForm`.
- Catálogos SAT vigentes (Usos CFDI 4.0, Formas de pago, Regímenes fiscales).
- Validador de RFC con dígito verificador.
- Mappers de helpers (DeonPay-style transaction → payload Facturapi).

## NO está en alcance

- Persistencia (la DB vive en el consumidor).
- Cron / colas / reintentos (orquestación del consumidor).
- UI / componentes React.
- Webhooks / firma HMAC (lo dispara el consumidor).

## Uso

```ts
import { FacturapiClient } from "@deonpay/billing-engine";

const client = new FacturapiClient({ apiKey: process.env.FACTURAPI_KEY });

const invoice = await client.createInvoice({
  customer: {
    legal_name: "Juan Perez",
    tax_id: "PEPJ800101AB1",
    email: "juan@example.com",
    tax_system: "612",
    address: { zip: "06600" },
  },
  items: [
    {
      product: {
        description: "Servicio profesional",
        product_key: "84111506",
        price: 500.0,
      },
      quantity: 1,
    },
  ],
  use: "G03",
  payment_form: "28",
});
```

## Estructura

```
src/
  client/        Cliente HTTP Facturapi v2
  types/         Interfaces TS (Invoice, Customer, etc.)
  utils/         Validadores (RFC) + mappers + catálogos SAT
  index.ts       Re-exports públicos
```

## Versionado

Pre-1.0: pueden romperse APIs entre minors. Cuando se independice como paquete público se respetará semver estricto.
