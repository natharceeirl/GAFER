-- 007_documento_pdf_sha256 (GAF-56)
-- Huella SHA-256 del PDF emitido. El PDF aprobado se genera una sola vez y no se regenera (spec §13):
-- la huella permite comprobar, antes de servirlo, que los bytes guardados son los que se emitieron.
-- Idempotente: el migrador reaplica todas las migraciones en cada ejecución.
--
--   * pdf_sha256: SHA-256 en hexadecimal minúscula (64 caracteres) de los bytes del PDF almacenado.
--   * Una vez emitido (pdf_estado = 'GENERADO') la base no deja cambiar pdf_sha256 ni pdf_storage_key.

ALTER TABLE documentos ADD COLUMN IF NOT EXISTS pdf_sha256 CHAR(64)
    CHECK (pdf_sha256 IS NULL OR pdf_sha256 ~ '^[0-9a-f]{64}$');

CREATE OR REPLACE FUNCTION documentos_pdf_inmutable() RETURNS trigger AS $$
BEGIN
    IF OLD.pdf_estado = 'GENERADO'
       AND (NEW.pdf_sha256 IS DISTINCT FROM OLD.pdf_sha256
            OR NEW.pdf_storage_key IS DISTINCT FROM OLD.pdf_storage_key) THEN
        RAISE EXCEPTION 'El PDF emitido del documento % es inmutable: no se puede cambiar su huella ni su archivo', OLD.id
            USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_documentos_pdf_inmutable ON documentos;
CREATE TRIGGER trg_documentos_pdf_inmutable
    BEFORE UPDATE ON documentos
    FOR EACH ROW EXECUTE FUNCTION documentos_pdf_inmutable();
