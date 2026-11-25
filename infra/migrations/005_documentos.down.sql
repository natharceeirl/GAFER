-- Reversa de 005_documentos
DROP INDEX IF EXISTS uq_documentos_certificado_correlativo;
DROP FUNCTION IF EXISTS fn_siguiente_correlativo_global(VARCHAR);
DROP TABLE IF EXISTS correlativos_globales;
DROP TABLE IF EXISTS documentos_transiciones;
ALTER TABLE documentos DROP COLUMN IF EXISTS creado_por_usuario;
ALTER TABLE documentos DROP COLUMN IF EXISTS creado_por_id;
