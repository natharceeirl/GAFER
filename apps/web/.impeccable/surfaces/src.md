---
version: 1
slug: "src"
primary_target: "src"
related_targets: []
---

# Surface brief: src (whole GAFER web app)

## Scope and visitor mode

Operate. Two roles, two devices: Técnico Operador (mobile PWA, field, offline-first) and Administrador/Supervisor (desktop, office). All screens across the 7 domain modules / 5 delivery phases share this one visual world.

## Audience, job, task, constraints

- Técnico: registers a full service inspection (12-block form) at a client site, often offline, sometimes gloved, in direct sunlight. Job: clear a checklist fast and correctly.
- Administrador/Supervisor: manages ~1,000 clients' catalogs, projects, services; reviews and approves field-generated documents; watches the portfolio for expiring certificates and escalating rodent activity.
- Constraint: the VERDE/AMARILLO/NARANJA/ROJO Mapa Murino color vocabulary must read identically everywhere it appears, not just on the map.
- Constraint: no real brand assets exist; this design pass establishes the identity.

## Chosen direction and memorable moment

Garita de control industrial (Industrial checkpoint gate-pass). Assigned build candidate, seed key `d35207da`, index 7 of 7 grounded candidates.

### Direction contract

**THESIS:** Every record is a pass through a checkpoint — clients, services, inspections don't get "created," they get issued and stamped through a sequence of gates (BORRADOR→CERRADO→…→APROBADO), refusing the generic SaaS-dashboard arrangement of soft cards and pastel status pills.

**OWN-WORLD:** Kraft/industrial-cardstock neutral ground (cool-grey kraft, not bakery cream); safety-system accents doing double duty as brand AND status — verified-stamp green, warning amber, alert safety-orange-red — these ARE the aura colors. Deep carbon/graphite ink for structural rules. Hairline box-rules, a perforated tear-line between list rows, rotated imperfect ink-stamp badges for every state (never soft pills). Type: a robust grotesk for running UI, a slab/stencil display face for stamp glyphs and correlativo numbers, a monospace for ticket/correlativo codes (`INFORME-KALLPA-014-2026`). Every screen opens with a fixed ticket-stub header strip (identity: cliente · proyecto · servicio · fecha) above the working body.

**STORY:** A técnico opens a stack of today's tickets, clears one checkpoint-style form, gets a physical-feeling stamp on close. A supervisor's dashboard is the gatehouse ledger — every pass logged, every escalating station flooding its aura color at a glance.

**FIRST VIEWPORT** (per surface; canonical pattern): ticket-stub header pinned at top naming identity; body below organized as boxed, ruled fields/rows; state renders as a rotated ink-stamp badge, never a pill; escalating aura floods the whole card in solid color, not a tinted accent.

**FORM:** Own grounded candidate #7 of 7 (assigned by the roll, not top-ranked — my own #1 was "ficha DIGESA / libro de actas regulatorio," offered as IMPECCABLE'S PICK and declined by the user in favor of this one). Seed key `d35207da`.

Raises won from weighed challengers (fused into this world, never their surface clothes):
- from *anti-aliased racing league* (declined): state escalation floods the whole card/badge in solid color instantly, no soft transition.
- from *jet-age ticket wallet* (competitive): rejected/observado states render as a literal diagonal stamp overlay on the record; nothing disappears, it cancels.
- from *phosphor terminal* (declined): every state change also appends one plain-language line to a visible, ticket-stub-styled audit log — never hidden metadata.
- from *Miura-fold deployable sheet* (competitive): dense records (expediente de cliente, historial de estación) expand via a fold-open interaction, not a generic accordion.

**FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.

## Unresolved decisions

- Exact face choices for grotesk/slab/mono (to be picked at build time from Google Fonts, per the type-pairing discipline — avoid Inter/Space Grotesk as defaults).
- Whether the stamp/ticket motion (ink-thud on state change) uses CSS keyframes only or a small motion library — decide at build, no dependency needed for a single keyframe.
- Native app icon/PWA manifest branding deferred (no real logo yet, per PRODUCT.md).
