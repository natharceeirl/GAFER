# BRIEF DE CONTEXTO TÉCNICO PARA ESTIMACIÓN DE INFRAESTRUCTURA CLOUD (TCO)
**Proyecto:** Sistema de Automatización de Informes de Saneamiento, Certificación Ambiental y Mapa Murino — GAFER v1  
**Cliente:** GAFER Saneamiento Ambiental E.I.R.L. (Arequipa / Mollendo / Sur del Perú)  
**Documentos base del proyecto:**
1. `GAFER_Especificaciones_Sistema_v6_Actualizado.pdf` (Especificación funcional oficial v6, Setiembre 2026).
2. `GAFER_Planificacion_y_Tecnologias.docx.md` (Plan de entregas, tecnologías y alcance acordado, Setiembre 2026).
**Rol solicitado a la IA especialista:** Cloud Solutions Architect & FinOps Specialist  
**Objetivo:** Diseñar la propuesta de arquitectura de hosting/cloud y calcular el presupuesto operativo mensual y anual (en USD y Soles PEN) para poner este sistema en producción de forma confiable y costo-eficiente.

---

## 1. Naturaleza del Negocio y del Software
- **Rubro del Cliente:** GAFER es una empresa contratista B2B de Saneamiento Ambiental y Manejo Integrado de Plagas (Desinsectación, Desratización, Desinfección y Limpieza de reservorios de agua).
- **Marco Regulatorio:** Fiscalizado por DIGESA / MINSA (D.S. 022-2001-SA). Todo servicio cerrado genera documentos con valor legal y sanitario (Certificados e Informes Técnicos).
- **Inmutabilidad legal (§13 del PDF):** Una vez aprobado un servicio, el sistema congela un snapshot de los datos y catálogos históricos. La información no puede alterarse ni recalcularse retroactivamente.
- **Retención y Respaldo (Planificación §9 / PDF §16):** Respaldo automático diario obligatorio con retención mínima de 30 días en almacenamiento seguro.

---

## 2. Parámetros de Escala y Volumetría del Sistema

Estos parámetros combinan datos literales de los documentos oficiales con proyecciones operativas estándar:

### A. Cartera de Clientes y Usuarios
- **Base de clientes confirmada:** **~100 clientes activos** (Fuente literal: `GAFER_Planificacion_y_Tecnologias.docx.md`, Sección 5, Línea 188).
- **Usuarios administrativos en oficina (Web PC):** 2 a 4 personas en simultáneo (Administrador, Supervisor de Operaciones y consulta de Director Técnico).
- **Técnicos operativos en campo (App Android):** Cuadrilla estimada de 5 a 10 técnicos aplicadores cubriendo servicios en terreno (el plan de pruebas H2 valida concurrencia con múltiples técnicos en paralelo).

### B. Volumen de Servicios y Documentos Mensuales
- **Frecuencia operativa estimada:** Con ~100 clientes industriales y comerciales con contratos mensuales o quincenales, se proyecta un volumen de **100 a 250 servicios mensuales**.
- **Generación documental por cada servicio cerrado:**
  1. *Informe de Servicio:* Tablas de insumos, dosis, maquinaria, observaciones y fotografías de evidencia (hasta un máximo permitido de 20 fotos por informe según §6.1).
  2. *Certificado Sanitario Oficial:* Documento formal independiente de 1 hoja con numeración correlativa generada por la base de datos.
  3. *Reporte de Inspección de Roedores (Fase 3):* Monitoreo de hasta 20 planos por proyecto y hasta 100 estaciones de cebado por plano con estadísticas de consumo y auras de calor.
- **Cómputo Pesado Asíncrono:** La compilación de los PDFs de informes y reportes (que incluyen planos, gráficos y fotos) se ejecuta en un worker en segundo plano mediante un motor headless (Puppeteer / Chromium), demandando picos de memoria RAM dedicada.

### C. Almacenamiento de Archivos (Object Storage)
- **Fotografías de campo:** Fotos de evidencias tomadas por los técnicos desde la app móvil, comprimidas en el dispositivo antes del despacho (~250 KB a 400 KB por foto).
- **PDFs finales aprobados:** ~1 MB a 2 MB por documento final almacenado.
- **Anexos maestros de insumos:** Hojas de seguridad MSDS y resoluciones de autorización sanitaria de DIGESA asociadas a los productos (~500 MB fijos).
- **Proyección de almacenamiento acumulado:**
  - **Año 1:** ~15 GB a 25 GB de almacenamiento total acumulado.
  - **Transferencia de salida (Egress):** Moderada (consultas web y descargas de PDFs por parte de clientes y supervisores).

---

## 3. Arquitectura del Software (Monorepo TypeScript)

El sistema ya está desarrollado bajo un monorepo `pnpm workspaces` con la siguiente distribución técnica:

1. **Backend REST API (`apps/api`):**
   - Framework: Node.js con NestJS.
   - Arquitectura: Hexagonal (Puertos y Adaptadores) con Kysely para acceso SQL type-safe.
   - Seguridad: Deny-by-Default global (`AuthGuard` con JWT Bearer + `RolesGuard`), hashing de contraseñas con `scrypt` y salt individual.
2. **Worker Asíncrono (`apps/worker`):**
   - Framework: NestJS + BullMQ / Redis 7.
   - Rol: Procesamiento desacoplado en segundo plano de generación de PDFs pesados con Puppeteer/Chromium y compresión de archivos.
3. **Base de Datos Relacional:**
   - Motor: PostgreSQL 16.
   - Características: Tablas relacionales con integridad referencial (`ON DELETE RESTRICT`), almacenamiento de snapshots inmutables en columnas `JSONB` y triggers de motor para protección contra modificaciones no autorizadas.
4. **Almacenamiento de Archivos:**
   - Compatible con AWS S3 API (actualmente probado con MinIO en desarrollo; requiere solución S3 en producción para fotos, anexos y PDFs mediante URLs prefirmadas).
5. **Frontend Web (`apps/web`):**
   - Stack: React 18, Vite, Tailwind CSS, TanStack Query. Single Page Application (SPA).
6. **Aplicación Móvil de Campo (`apps/mobile`):**
   - Stack: React Native, Expo (Android). Base de datos local SQLite para operación 100% offline y cola de sincronización Outbox al recuperar señal.
7. **Contratos Compartidos (`packages/contracts`):**
   - Paquete de tipos y esquemas de validación Zod compartido entre backend, web y app móvil.

---

## 4. Requerimientos de la Consulta para la IA Especialista

Por favor, actúa como Arquitecto Cloud y especialista en FinOps para responder:

1. **Arquitectura de Despliegue Propuesta:**
   - ¿Cómo recomiendas desplegar y conectar estos componentes en producción? (API NestJS, Worker de PDFs, PostgreSQL 16, Redis, Almacenamiento S3 y Frontend Web SPA).
2. **Comparativa de Dos Alternativas de Infraestructura:**
   - **Opción A (Lean / Optimizada / Costo-Eficiente):** Orientada a una PYME en crecimiento que busca maximizar el rendimiento minimizando costos fijos (ej. VPS de alto rendimiento tipo Hetzner/DigitalOcean con Docker/Coolify, Cloudflare R2 para almacenamiento con $0 egress, CDN gratuita para el frontend web, etc.).
   - **Opción B (Cloud Gestionado Tradicional / Enterprise):** Basada en servicios totalmente administrados en un gran proveedor (ej. AWS Lightsail/ECS, RDS PostgreSQL gestionado, S3, ElastiCache Redis, o DigitalOcean Managed Apps & DB).
3. **Presupuesto Detallado y Transparente:**
   - **Costos Recurrentes Mensuales y Anuales** (desglosados por componente en USD y Soles PEN a tipo de cambio ~3.80).
   - **Costos Únicos Iniciales de Puesta en Marcha** (registro de dominio `.pe` vs `.com`, cuenta de Google Play Store para publicar la app Android a los técnicos, certificados SSL).
4. **Recomendación Justificada:**
   - ¿Cuál de las dos opciones recomiendas para el arranque inicial de GAFER (Año 1) y cuáles serían los factores o límites de tráfico que justificarían escalar a una infraestructura superior?
