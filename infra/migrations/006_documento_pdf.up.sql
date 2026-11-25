-- 006_documento_pdf (GAF-54)
-- Estado de la generación asíncrona del PDF del documento y dónde quedó guardado.
-- Idempotente: el migrador reaplica todas las migraciones en cada ejecución.
--
--   * pdf_estado: PENDIENTE (encolado), GENERANDO (el worker lo toma), GENERADO o ERROR. NULL = nadie lo pidió.
--   * pdf_storage_key: clave del objeto en el bucket de archivos (determinista por documento).
--   * pdf_generado_at: fecha de la última generación correcta.
--   * pdf_error: motivo del último fallo; se borra cuando un reintento termina bien.
--   * pdf_intentos: intentos de la solicitud vigente (informativo, para soporte).

ALTER TABLE documentos ADD COLUMN IF NOT EXISTS pdf_estado VARCHAR(12)
    CHECK (pdf_estado IS NULL OR pdf_estado IN ('PENDIENTE', 'GENERANDO', 'GENERADO', 'ERROR'));
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS pdf_storage_key TEXT;
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS pdf_generado_at TIMESTAMPTZ;
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS pdf_error TEXT;
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS pdf_intentos INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_documentos_pdf_estado ON documentos(pdf_estado) WHERE pdf_estado IS NOT NULL;
