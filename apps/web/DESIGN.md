---
name: GAFER Saneamiento Ambiental
description: Industrial checkpoint gate-pass system — every record is issued and stamped, never softly created
colors:
  kraft-ground: "#d7d7ca"
  kraft-panel: "#ecede6"
  kraft-panel-raised: "#f4f5ef"
  rule-hairline: "#a8ab9b"
  rule-strong: "#82866f"
  carbon-ink: "#23241f"
  carbon-ink-soft: "#56564b"
  carbon-ink-faint: "#837e6c"
  verified-verde: "#2f6b3e"
  verified-verde-ink: "#eef3ea"
  warning-amarillo: "#93701c"
  warning-amarillo-ink: "#fbf3e1"
  alert-naranja: "#b3501e"
  alert-naranja-ink: "#fbeee1"
  danger-rojo: "#9c2c21"
  danger-rojo-ink: "#fbe9e6"
  no-trend-sin-color: "#8c8670"
  no-trend-sin-color-ink: "#f1efe6"
typography:
  ui:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontWeight: 400
  headline:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "clamp(19px, 2.6vw, 25px)"
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  stamp:
    fontFamily: "Big Shoulders Display, Archivo, sans-serif"
    fontWeight: 800
    letterSpacing: "0.06em"
    textTransform: "uppercase"
  mono:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "12px"
rounded:
  sm: "2px"
  pill: "999px"
spacing:
  sm: "8px"
  md: "10px"
  lg: "16px"
  panel-padding: "14px 16px 16px"
components:
  button-primary:
    backgroundColor: "{colors.carbon-ink}"
    textColor: "{colors.kraft-panel}"
    typography: "{typography.ui}"
    rounded: "{rounded.sm}"
    padding: "10px 20px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "transparent"
    textColor: "{colors.carbon-ink}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.carbon-ink}"
    typography: "{typography.ui}"
    rounded: "{rounded.sm}"
    padding: "10px 20px"
    height: "44px"
  badge-verde:
    backgroundColor: "{colors.verified-verde-ink}"
    textColor: "{colors.verified-verde}"
    typography: "{typography.stamp}"
    rounded: "{rounded.sm}"
    padding: "3px 10px 4px"
  badge-amarillo:
    backgroundColor: "{colors.warning-amarillo-ink}"
    textColor: "{colors.warning-amarillo}"
    typography: "{typography.stamp}"
    rounded: "{rounded.sm}"
  badge-naranja:
    backgroundColor: "{colors.alert-naranja-ink}"
    textColor: "{colors.alert-naranja}"
    typography: "{typography.stamp}"
    rounded: "{rounded.sm}"
  badge-rojo:
    backgroundColor: "{colors.danger-rojo-ink}"
    textColor: "{colors.danger-rojo}"
    typography: "{typography.stamp}"
    rounded: "{rounded.sm}"
---

# Design System: GAFER Saneamiento Ambiental

## Overview

**Creative North Star: "Garita de control industrial" (the checkpoint gate-pass)**

GAFER's UI treats every client, service, and inspection as a pass through a checkpoint, not a record softly "created" in a dashboard. Kraft-cardstock surfaces, carbon ink rules, ticket-stub headers, and rotated ink-stamp badges replace the generic SaaS vocabulary of pastel pills and floating cards. Nothing here is decorative texture: the ground is cool-grey industrial kraft (confirmed and retuned during the build to read as cardstock, never bakery cream), and the four safety-system colors — verified green, warning amber, alert orange, danger red — are load-bearing twice over: they are both the brand accent set and the literal VERDE/AMARILLO/NARANJA/ROJO Mapa Murino status vocabulary, required by product to read identically on the map, on badges, on lists, and on dashboards.

The system is deliberately flat and hairline-ruled rather than shadowed or gradiented — depth reads through boxed compartments and rule weight, not elevation. Two roles get two working modes on the same token set: dense, scan-and-decide tables and panels for desk use; large touch targets (44px minimum) and single-column stacking under 480px for gloved, sunlit field use. Motion is a small, literal vocabulary — an ink-stamp thud, a real paper fold, a solid color flood — never generic easing or a bouncy micro-interaction library.

**Key Characteristics:**
- Kraft/carbon industrial ground with hairline box-rules; no soft cards, no drop shadows as an ambient default.
- Status color doubles as brand color: the same four hues carry Mapa Murino state everywhere they appear.
- State is a rotated ink-stamp, never a pill; cancellation is a diagonal overlay banding across the record, not a replaced badge.
- Three-typeface role split: grotesk for running UI/headings, slab-display strictly for stamps/badges/counts, monospace for ticket codes.
- A fixed ticket-stub header (ticket code · title · meta) opens every screen.

## Colors

The palette is a cool industrial neutral scale plus one safety-color family that is simultaneously the brand accent and the Mapa Murino status vocabulary — there is no separate "brand blue" anywhere in the system.

### Primary
- **Carbon Ink** (`#23241f`): the system's one true ink — headline text, primary button fill, structural rule borders (ticket header bottom border, active table sort state). Its hover-inverted pairing with Kraft Panel is the system's only "primary color" relationship.

### Secondary (status-as-brand — doing double duty as the Mapa Murino aura vocabulary)
- **Verified Verde** (`#2f6b3e` / ink `#eef3ea`): APROBADO documents, "sin actividad" station state, "cerrado/completado" list rows.
- **Warning Amarillo** (`#93701c` / ink `#fbf3e1`): ENVIADO_A_REVISION, "pendiente" rows, near-term expiration warnings.
- **Alert Naranja** (`#b3501e` / ink `#fbeee1`): OBSERVADO state and its cancellation-band color, urgent expirations, focus ring color system-wide.
- **Danger Rojo** (`#9c2c21` / ink `#fbe9e6`): "actividad detectada" station state, escalated alerts.
- **No-Trend Sin Color** (`#8c8670` / ink `#f1efe6`): the fifth Mapa Murino value — no accumulated trend yet; treated as a genuine neutral state, not an error.

### Neutral
- **Kraft Ground** (`#d7d7ca`): page background — cool-grey cardstock, confirmed during finish review to read as industrial kraft, never bakery cream.
- **Kraft Panel** (`#ecede6`): compartment/section background, one step lighter than ground.
- **Kraft Panel Raised** (`#f4f5ef`): inputs, ticket header strip, the barra-acciones bar — the "raised sheet" surface.
- **Rule Hairline** (`#a8ab9b`): dashed perforation lines, ambient dividers.
- **Rule Strong** (`#82866f`): compartment borders, input borders, station-tag borders.
- **Carbon Ink Soft** (`#56564b`): section titles, secondary body text.
- **Carbon Ink Faint** (`#837e6c`): ticket codes, muted metadata.

A full dark-mode mirror exists via `prefers-color-scheme`, remapping every token (darker kraft grounds, brightened status hues for contrast) — the same role structure, not a separate palette.

### Named Rules
**The Status-Is-Brand Rule.** VERDE/AMARILLO/NARANJA/ROJO are never "just an accent" — they are simultaneously the Mapa Murino trend vocabulary and the only saturated colors in the system. A new status-bearing surface reuses these four hues; it never introduces a fifth "brand" color.

**The Solid Flood Rule.** Escalating state on a StationTag floods the entire card in the solid status color (background + border + ink-contrast text), not a tinted accent or a colored dot. This is confirmed build behavior (`station-tag--rojo` etc. set `background`, `border-color`, and `color` together), carrying over the "instant solid flood, no soft transition" raise from the direction contract.

## Typography

**UI Font:** Archivo (with system-ui, sans-serif fallback)
**Stamp Font:** Big Shoulders Display (with Archivo, sans-serif fallback)
**Mono Font:** JetBrains Mono (with ui-monospace, monospace fallback)

**Character:** A workhorse grotesk carries every heading, label, and body string in the system; a condensed slab-display face is reserved exclusively for ink-stamp contexts (state stamps, badges, cancellation overlays, tabular counts); a monospace carries ticket/correlativo codes. This is a literal, load-bearing three-way split confirmed during finish review — the display face was pulled back out of page headings (where an earlier pass had let it drift in) specifically so it could stay a stamp-only signature.

### Hierarchy
- **Headline** (Archivo, 800, `clamp(19px, 2.6vw, 25px)`, line-height 1.15): the `TicketHeader` title — the one heading every screen carries.
- **Title** (Archivo, 800, 15px, uppercase, 0.03em tracking): compartment/section titles (`.compartimento__titulo`, `.dashboard-section__title`).
- **Body** (Archivo, 400–600, 13–15px): running UI text, table cells, form inputs.
- **Stamp** (Big Shoulders Display, 800, uppercase, 0.06–0.08em tracking): `StateStamp`, `Badge`, `CancelledStampOverlay` text only — never page prose.
- **Code/Mono** (JetBrains Mono, 400–600, 12–13px): ticket codes (`INFORME-KALLPA-014-2026`), station icon numerals, tabular numeric counts (`.tabular` applies `font-variant-numeric: tabular-nums` to the UI font for counts; JetBrains Mono is reserved for actual codes, not all numerals).

### Named Rules
**The Stamp-Face Containment Rule.** Big Shoulders Display renders only inside `StateStamp`, `Badge`, and `CancelledStampOverlay` (plus the station-tag icon numeral, which uses mono, not stamp). It never appears on a page heading, section title, or body copy — a defect from an earlier build pass, corrected before this documentation. Do not reintroduce the display face into running headings.

**The Ticket-Code Rule.** Any human-facing correlativo or ticket identifier (`INFORME-KALLPA-014-2026`) renders in JetBrains Mono at reduced size and faint ink color — it reads as a stamped-on serial number, distinct from both prose and stamp text.

## Layout

Every screen opens with a `TicketHeader`: a sticky, full-width strip (padding `14px 20px 16px`, 2px carbon-ink bottom border, `0 3px 0` rule-colored drop) carrying the ticket code (mono), title (headline), meta line (identity: cliente · proyecto · servicio · fecha), and an optional trailing action. Below it, body content is organized into `.compartimento` boxes — 1.5px rule-strong bordered panels with an uppercase title — rather than shadowed cards.

List rows are separated by a dashed `PerforatedDivider` (2px dashed rule-hairline), never a solid line or gap-only spacing — the "tear-off ticket stub" motif recurring between every row of a list (dashboard alerts, servicios, client table rows).

Density splits by role: desk screens (Dashboard, Cartera de clientes) use dense multi-column table rows; field/mobile layouts collapse `.grid-2`/`.grid-3` to one column under 480px, and a fixed `.barra-acciones` bottom action bar (raised-panel background, 2px carbon-ink top border) pins primary actions within thumb reach on mobile. Touch targets default to 44px minimum height across inputs, buttons, and list rows — generous by default for gloved, sunlit field use, per PRODUCT.md's inferred accessibility stance.

## Elevation & Depth

The system is flat by design: no ambient drop shadows on cards or panels. Depth is conveyed by rule weight and offset border-shadows instead — a `TicketHeader` uses a 2px solid border plus a flat `0 3px 0` color offset (a hard-edged "step" shadow, not a blur), and `.barra-acciones` mirrors the same technique upward. The one blurred shadow in the system is on `StateStamp` (`1px 2px 3px 0 rgb(0 0 0 / 0.18)`), simulating the slight physical lift of a real ink stamp — an intentional, isolated exception to flatness, not a general elevation system.

### Named Rules
**The Flat-Ledger Rule.** Panels and headers are flat at rest; the only depth cues are rule-weight borders and hard color-offset "step" shadows (never blurred, except on the stamp itself). Do not add ambient box-shadow blur to cards, panels, or buttons.

## Shapes

Corners are almost square throughout: a single 2px radius token (`--gf-radius`) covers compartments, inputs, buttons, and badges — just enough to soften a cut edge, never a rounded "card" look. The one exception is fully circular (999px) shapes: chip-list toggle buttons and the `StationTag` icon roundel, both explicitly pill/circular rather than square-cornered. Stamps and badges carry a fixed negative rotation (`-4deg` to `-11deg`) as their signature imperfection — every ink-stamp element is tilted, never axis-aligned, simulating an imprecise hand-stamped mark.

## Components

### Buttons (`Button`, `.btn`)
- **Shape:** 2px radius, 44px min-height, 10px/20px padding.
- **Primary:** solid carbon-ink fill, kraft-panel text, 2px carbon-ink border; hover inverts to transparent fill with carbon-ink text/border (a "stamp lifted off the page" hover, not a lighten/darken tint).
- **Secondary:** transparent fill, carbon-ink text, rule-strong border; hover darkens border to carbon-ink.
- **Active:** both variants translate 1px down on `:active` — a physical press, not a scale/opacity change.

### Badge (`Badge`, `.badge`)
- **Style:** inline ink-stamp, not a pill — 1.5px `currentColor` border, stamp-face text, uppercase, fixed `-4deg` tilt, per-status ink/fill pairing (verde/amarillo/naranja/rojo/sin-color).
- **Use:** inline status wherever a compact state marker is needed in a list or table row (client "ACTIVO", service "Cerrado/Pendiente"). Routed through this shared atom everywhere status appears — never bespoke per-page CSS, per finish-review correction.

### StateStamp (signature component)
- **Style:** large block-level ink stamp — 3px `currentColor` border, 3px radius, stamp-face 22px uppercase text, `-7deg` base tilt (steeper `-11deg` + 1.05 scale specifically for OBSERVADO).
- **Behavior:** on mount with `animate`, plays the "ink-thud" keyframe — enters oversized and transparent, overshoots slightly small, settles to rest (`220ms cubic-bezier(0.3, 1.2, 0.5, 1)`), simulating physical stamp impact rather than a generic bounce; respects `prefers-reduced-motion`.
- **Use:** the one big state marker per document (BORRADOR/CERRADO/ENVIADO_A_REVISION/OBSERVADO/APROBADO/ENVIADO).

### CancelledStampOverlay (signature component)
- **Style:** an absolutely positioned diagonal band (`-9deg`) crossing the full width of its container, naranja border top/bottom, 14%-mix naranja fill, repeated stamp-face text (e.g. "OBSERVADO · OBSERVADO · OBSERVADO").
- **Behavior:** overlays a document without hiding it — the record underneath stays fully legible. This literally carries the "rejected/observado states render as a diagonal stamp overlay; nothing disappears, it cancels" raise from the direction contract.
- **Use:** mount over any container with `position: relative` when a document is OBSERVADO — it supplements, never replaces, the document's own `StateStamp` badge.

### FoldPanel (signature component)
- **Style:** bordered compartment with a pull-tab header (small rotating tab icon, not a chevron glyph) and a dashed "crease" line.
- **Behavior:** disclosure animates via a real `rotateX`/`perspective` fold from the top edge (`transform-origin: top`, `rotateX(-90deg)` → `0deg`, `perspective: 900px` on the stage), combined with a CSS-grid `0fr → 1fr` row trick so height need not be measured in JS. This is a genuine paper-fold, rebuilt during finish review to replace an earlier `scaleY` accordion that read as a generic disclosure widget rather than the direction contract's "Miura-fold" raise.
- **Use:** dense records that benefit from progressive disclosure (expediente de cliente, historial de estación).

### PerforatedDivider
- **Style:** a 2px dashed rule-hairline border, zero height — the tear-line between two ticket stubs.
- **Use:** between every row of a list (alerts, servicios, client table), never a plain solid divider or bare spacing gap.

### TicketHeader (signature component)
- **Style:** sticky top strip; mono ticket code (faint ink) above a bold headline title above a soft-ink meta line; optional trailing action slot.
- **Use:** the one required per-screen header across the whole app — the "identity never leaves view" invariant from the direction contract (cliente · proyecto · servicio · fecha, or the page-level equivalent).

### StationTag (signature component)
- **Style:** rounded-pill icon roundel (mono numeral, 2.5px `currentColor` border) plus an aura-flooded row background.
- **Behavior:** the icon shows only the latest visit's raw state (verde/rojo ink on transparent); the surrounding row background floods solid with the 4-visit trend aura color (verde/amarillo/naranja/rojo/sin-color) — the two-layer Mapa Murino read (icon = last visit, aura = trend) rendered as two independently-colored zones of one component.
- **Use:** anywhere a rodent-control station needs to appear off the map itself (lists, summaries) — reuses the exact same five-color vocabulary as `Badge` and the map.

### Cards / Containers (`.compartimento`)
- **Corner Style:** 2px radius.
- **Background:** kraft-panel.
- **Shadow Strategy:** none — flat, per Elevation & Depth.
- **Border:** 1.5px rule-strong.
- **Internal Padding:** `14px 16px 16px`.

### Inputs / Fields
- **Style:** kraft-panel-raised background, 1.5px rule-strong border, 2px radius, 44px min-height, Archivo body text.
- **Focus:** 2.5px solid alert-naranja outline, 1–2px offset — the same naranja used for OBSERVADO, reused system-wide as the one focus-ring color.
- **Disabled:** 0.55 opacity, not-allowed cursor.

## Do's and Don'ts

### Do:
- **Do** treat status color as brand color: reuse VERDE/AMARILLO/NARANJA/ROJO/SIN_COLOR everywhere a state or trend appears, through `Badge`/`StationTag`/`StateStamp`, never a bespoke inline color.
- **Do** render state as a rotated ink-stamp (`Badge`, `StateStamp`) — border in `currentColor`, stamp-face type, fixed negative tilt — never a rounded pastel pill.
- **Do** flood the entire element in solid status color for an escalating/aura state (`StationTag`), not a tinted accent or soft gradient.
- **Do** open every screen with a `TicketHeader` carrying a mono ticket code, a bold title, and an identity meta line.
- **Do** separate list rows with the dashed `PerforatedDivider`, never a plain solid rule or bare gap.
- **Do** keep touch targets at 44px minimum and collapse multi-column grids to one column under 480px, honoring the field/gloved-use constraint from PRODUCT.md.

### Don't:
- **Don't** use Big Shoulders Display (the stamp face) outside `StateStamp`, `Badge`, `CancelledStampOverlay`, or numeric/count contexts — it does not belong on page or section headings (Archivo carries those), a defect corrected during finish review.
- **Don't** add ambient blurred box-shadow to cards, panels, or buttons — this system is flat by rule; the one blurred shadow (`StateStamp`) is an isolated physical-stamp exception, not a precedent.
- **Don't** replace a cancelled/rejected document's existing badge with a new one — overlay a diagonal `CancelledStampOverlay` band on top instead; nothing in this system disappears on rejection, it gets cancelled visibly.
- **Don't** animate disclosure as a generic vertical accordion (`scaleY`/height-slide) — dense records fold open via `FoldPanel`'s real `rotateX`/perspective transform.
- **Don't** introduce kicker/eyebrow labels above headings — none exist in the shipped system; a stray one was found and removed during finish review and must not recur.
