# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Existing codebase: React + Vite (installable PWA via vite-plugin-pwa), TypeScript, Feature-Sliced Design (app/pages/widgets/features/entities/shared). Backend is a NestJS modular monolith (apps/api) consumed over REST — not part of this surface's UI work, but the contract this surface renders against.

## Users

Two primary roles, deliberately different working modes:

- **Administrador / Supervisor** — office-based, desktop/laptop. Creates and manages clients, proyectos and servicios; maintains catalogs (insumos, equipos, personal, textos); reviews and approves documents generated in the field; monitors the full client portfolio, alerts, and statistics from a dashboard. Administrador has full access including Mantenimiento; Supervisor operates and approves but cannot create clients/proyectos/servicios or touch Mantenimiento.
- **Técnico Operador** — field-based, phone or tablet, PWA installed. Works inside client sites (industrial plants, mines, remote facilities) frequently with no signal. Registers a full service inspection through a 12-block form, applies insumos, captures up to 20 photos, and collects the client's digital signature on-screen. Any active technician can work any active project — there is no per-technician job assignment.

## Product Purpose

GAFER Saneamiento Ambiental is a pest-control / environmental sanitation company (desratización, desinsectación, desinfección, limpieza de reservorios de agua potable, trampas de grasa, tanques sépticos, limpieza de ambientes) serving roughly 1,000 clients across sectors (energía, alimentos, transporte, construcción, salud, sector público). This product replaces manual paperwork with a system that registers, processes, generates, and stores every service document, producing standardized PDFs (Informe de Servicio, Reporte de Inspección de Roedores) automatically on approval. Scope is strictly the technical/operational documentation flow — no billing or collections.

## Positioning

The product's signature, differentiating mechanism is the **Mapa Murino Dinámico**: two independent visual layers per rodent-control station, rendered over the client's own floor plan —
- an **icon** showing only the latest visit's state (VERDE = sin actividad, ROJO = actividad detectada), and
- an **aura** halo showing the accumulated trend across the last 4 consecutive visits (sin color → VERDE → AMARILLO → NARANJA → ROJO), which escalates or de-escalates exactly one level per visit and irradiates faintly to nearby stations.

This is the one capability the source specification itself names as "elemento diferencial del sistema" — no other module carries that claim.

## Operating Context

- Field visits happen with no signal, routinely. The Técnico surface must be fully usable offline and sync silently on reconnect — offline is the default condition, not a fallback.
- Multiple technicians can register data on the same proyecto in parallel; conflicts resolve per-station (last entry wins), never by locking the whole document.
- A document moves through a fixed chain: BORRADOR → CERRADO → ENVIADO A REVISIÓN → OBSERVADO → APROBADO → ENVIADO. Only APROBADO produces the final, immutable PDF with correlative numbering.
- The field form has 12 required blocks: identificación, personal, herramientas y equipos, insumos aplicados, método de aplicación, condiciones ambientales, diagnóstico y hallazgos, acciones correctivas, observaciones técnicas, recomendaciones, fotografías (hasta 20), and conformidad del cliente (firma digital + nombre + cargo).
- Catalogs (insumos, equipos, personal, hallazgos, acciones correctivas, observaciones, recomendaciones) are editable by Administrador/Supervisor without touching code, and must never alter data already registered against a prior version — every historical document is an immutable snapshot of the catalog values at the time it was created.
- Every insumo carries its DIGESA registration number; every state change and every catalog edit is written to an immutable audit log (quién, cuándo, qué cambió).
- Development is already sequenced by the team into 5 phases: Fase 1 Mantenimiento + Cliente-Expediente + Operaciones offline colaborativo; Fase 2 aprobación + generación de PDF; Fase 3 Mapa Murino; Fase 4 Dashboard/Estadísticas; Fase 5 Inventario. This design pass covers representative screens across all 5, confirmed with the user.

## Capabilities and Constraints

- Three roles, distinct permission boundaries: Administrador (full, incl. Mantenimiento) · Supervisor (opera + aprueba + edita catálogos de texto, sin Mantenimiento) · Técnico Operador (solo registro de campo).
- PDF is the only export format. Documents are numbered correlatively per cliente per tipo de documento, assigned automatically at approval.
- Photos: up to 20 per Informe (4 per PDF page), up to 12 per Reporte; compressed automatically on upload.
- Delivery is PWA-only — no separate native mobile app is planned; Android installability via the browser covers the field role.

## Brand Commitments

None exist yet. No official GAFER logo or brand palette has been supplied — confirmed with the user that the visual identity for this product is being established as part of this design work, not inherited. Do not fabricate a pre-existing "GAFER brand" beyond the plain company name.

## Evidence on Hand

- The full functional specification (`GAFER_Especificaciones_Sistema_v6_Actualizado.pdf`, repo root) is the authority for field names, catalog contents, states, and business rules used on these screens.
- No real Informe/Reporte PDF sample, no real client roster, and no real service photos exist yet — the source specification itself names these as pending developer inputs for later phases. Screens must use realistic placeholder data of the kind the spec itself illustrates (e.g. client codes KALLPA, SAMAY, PETROPERU, given as examples in the source document), clearly not represented as real customer data.

## Product Principles

1. Offline is the default working condition for the Técnico role, not a degraded state — no field screen may assume connectivity to be usable.
2. A catalog edit must never visibly or silently change a document already generated — historical truth stays immutable, everywhere it's shown.
3. The Mapa Murino color language (icon = última visita, aura = tendencia de 4 visitas) must read consistently wherever it appears, not just on the map screen — the same VERDE/AMARILLO/NARANJA/ROJO vocabulary belongs on lists, badges, and summaries too.
4. Two roles, two working modes: desk-based management/approval is a scan-and-decide tool; field registration is a single-handed, glove-and-sunlight-tolerant data-entry tool. Neither surface should borrow the other's density or interaction patterns.
5. Every Técnico screen must survive a real field interruption — lost signal mid-form, phone locks, an incoming call — without losing entered data.

## Accessibility & Inclusion

No formal accessibility standard was specified by the client. Given the field operating context (technicians outdoors, sometimes gloved, reading a phone screen in direct sunlight), touch targets and contrast should default to generous rather than compact. Recorded here as an inferred operating requirement, not a confirmed formal standard.
