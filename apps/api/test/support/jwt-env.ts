/**
 * jwt-env.ts
 * Fija el secreto con que la API firma los tokens durante las pruebas.
 *
 * La API no arranca sin JWT_SECRET (no hay valor por defecto). Este valor es solo de pruebas
 * automatizadas y no sirve fuera de ellas.
 *
 * Historial de versiones
 *   v1.0  2026-10-04  ihuayhuam  Creación del archivo (GAF-93).
 */
process.env.JWT_SECRET = 'secreto-jwt-solo-para-pruebas-automatizadas-0123456789';
