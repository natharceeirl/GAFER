-- Reversa de 006_documento_pdf
DROP INDEX IF EXISTS idx_documentos_pdf_estado;
ALTER TABLE documentos DROP COLUMN IF EXISTS pdf_intentos;
ALTER TABLE documentos DROP COLUMN IF EXISTS pdf_error;
ALTER TABLE documentos DROP COLUMN IF EXISTS pdf_generado_at;
ALTER TABLE documentos DROP COLUMN IF EXISTS pdf_storage_key;
ALTER TABLE documentos DROP COLUMN IF EXISTS pdf_estado;
