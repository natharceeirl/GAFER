-- Reversa de 007_documento_pdf_sha256
DROP TRIGGER IF EXISTS trg_documentos_pdf_inmutable ON documentos;
DROP FUNCTION IF EXISTS documentos_pdf_inmutable();
ALTER TABLE documentos DROP COLUMN IF EXISTS pdf_sha256;
