-- 005_documentos (GAF-47 / GAF-49)
-- Historial de transiciones de estado del documento y numeración correlativa atómica.
-- Idempotente: el migrador reaplica todas las migraciones en cada ejecución.
--
-- Las tablas `documentos` y `correlativos` ya existen desde 001. Esta migración agrega:
--   * actor que creó el documento,
--   * historial de transiciones (`documentos_transiciones`),
--   * contador global para certificados (una sola secuencia, nunca repetida entre clientes),
--   * unicidad global del número de certificado.
-- Informes y reportes numeran por cliente y tipo con `fn_siguiente_correlativo` (001); el
-- contador nunca se reinicia por año: el año es solo una etiqueta del código.

ALTER TABLE documentos ADD COLUMN IF NOT EXISTS creado_por_id UUID;
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS creado_por_usuario VARCHAR(50);

CREATE TABLE IF NOT EXISTS documentos_transiciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    documento_id UUID NOT NULL REFERENCES documentos(id) ON DELETE CASCADE,
    estado_anterior VARCHAR(30) CHECK (estado_anterior IS NULL OR estado_anterior IN ('BORRADOR', 'CERRADO', 'ENVIADO_A_REVISION', 'OBSERVADO', 'APROBADO', 'ENVIADO')),
    estado_nuevo VARCHAR(30) NOT NULL CHECK (estado_nuevo IN ('BORRADOR', 'CERRADO', 'ENVIADO_A_REVISION', 'OBSERVADO', 'APROBADO', 'ENVIADO')),
    actor_id UUID,
    actor_usuario VARCHAR(50) NOT NULL DEFAULT '',
    actor_rol VARCHAR(30) NOT NULL DEFAULT '',
    motivo TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documentos_transiciones_documento ON documentos_transiciones(documento_id, created_at);

-- Una sola secuencia global por tipo (hoy solo certificados).
CREATE TABLE IF NOT EXISTS correlativos_globales (
    tipo VARCHAR(20) PRIMARY KEY CHECK (tipo IN ('CERTIFICADO')),
    ultimo_numero INT NOT NULL DEFAULT 0 CHECK (ultimo_numero >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION fn_siguiente_correlativo_global(p_tipo VARCHAR)
RETURNS INT AS $$
DECLARE
    v_siguiente INT;
BEGIN
    INSERT INTO correlativos_globales (tipo, ultimo_numero, updated_at)
    VALUES (p_tipo, 1, NOW())
    ON CONFLICT (tipo)
    DO UPDATE SET ultimo_numero = correlativos_globales.ultimo_numero + 1, updated_at = NOW()
    RETURNING ultimo_numero INTO v_siguiente;

    RETURN v_siguiente;
END;
$$ LANGUAGE plpgsql;

-- El número de certificado no se repite aunque cambie el cliente.
CREATE UNIQUE INDEX IF NOT EXISTS uq_documentos_certificado_correlativo
    ON documentos(numero_correlativo) WHERE tipo = 'CERTIFICADO';
