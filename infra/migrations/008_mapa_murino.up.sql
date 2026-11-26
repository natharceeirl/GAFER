-- 008_mapa_murino (GAF-62)
-- Persistencia del Mapa Murino por proyecto (spec §5.1 a §5.5).
-- Idempotente: el migrador reaplica todas las migraciones en cada ejecución.
--
--   * planos: hasta 20 por proyecto (trigger, serializado por proyecto).
--   * mapa_estaciones: hasta 100 por plano. El número va de 1 a 100 y es único por plano, así que la base
--     no admite una estación 101 aunque dos peticiones lleguen a la vez.
--   * mapa_visita_estaciones: lo que se vio de cada estación en cada visita (posición, de dónde se reubicó,
--     inspección). El mapa de una visita pasada se reconstruye repasando estas filas en orden.
--     Una visita EN_REVISION ya no admite cambios: el mapa queda tal como se vio ese día.

CREATE TABLE IF NOT EXISTS planos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proyecto_id UUID NOT NULL REFERENCES proyectos(id) ON DELETE RESTRICT,
    nombre VARCHAR(100) NOT NULL CHECK (length(btrim(nombre)) > 0),
    puntos JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(puntos) = 'array'),
    cerrado BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_plano_proyecto_nombre UNIQUE (proyecto_id, nombre)
);

CREATE INDEX IF NOT EXISTS idx_planos_proyecto_id ON planos(proyecto_id);

CREATE OR REPLACE FUNCTION fn_limitar_planos_por_proyecto() RETURNS trigger AS $$
BEGIN
    -- Serializa las altas del mismo proyecto sin bloquear las claves foráneas que apuntan a él.
    PERFORM 1 FROM proyectos WHERE id = NEW.proyecto_id FOR NO KEY UPDATE;
    IF (SELECT count(*) FROM planos WHERE proyecto_id = NEW.proyecto_id) >= 20 THEN
        RAISE EXCEPTION 'Un proyecto admite hasta 20 planos'
            USING ERRCODE = 'check_violation', CONSTRAINT = 'planos_limite_por_proyecto';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_limitar_planos_por_proyecto ON planos;
CREATE TRIGGER trg_limitar_planos_por_proyecto
    BEFORE INSERT ON planos
    FOR EACH ROW EXECUTE FUNCTION fn_limitar_planos_por_proyecto();

CREATE TABLE IF NOT EXISTS mapa_estaciones (
    id UUID PRIMARY KEY,
    plano_id UUID NOT NULL REFERENCES planos(id) ON DELETE RESTRICT,
    numero SMALLINT NOT NULL CONSTRAINT mapa_estaciones_limite_por_plano CHECK (numero BETWEEN 1 AND 100),
    tipo_estacion VARCHAR(20) NOT NULL CHECK (tipo_estacion IN ('CEBO_RATICIDA', 'TRAMPA_MECANICA')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_mapa_estacion_plano_numero UNIQUE (plano_id, numero),
    CONSTRAINT uq_mapa_estacion_id_plano UNIQUE (id, plano_id)
);

CREATE INDEX IF NOT EXISTS idx_mapa_estaciones_plano_id ON mapa_estaciones(plano_id);

CREATE TABLE IF NOT EXISTS mapa_visita_estaciones (
    visita_id UUID NOT NULL REFERENCES visitas(id) ON DELETE RESTRICT,
    estacion_id UUID NOT NULL,
    plano_id UUID NOT NULL,
    pos_x DOUBLE PRECISION NOT NULL,
    pos_y DOUBLE PRECISION NOT NULL,
    instalada BOOLEAN NOT NULL DEFAULT FALSE,
    reubicada_desde_x DOUBLE PRECISION,
    reubicada_desde_y DOUBLE PRECISION,
    inspeccion JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (visita_id, estacion_id),
    CONSTRAINT fk_mapa_visita_estacion FOREIGN KEY (estacion_id, plano_id)
        REFERENCES mapa_estaciones (id, plano_id) ON DELETE RESTRICT,
    -- La visita de instalación no inspecciona; las demás sí (§5.3).
    CONSTRAINT chk_mapa_visita_inspeccion CHECK ((instalada AND inspeccion IS NULL) OR (NOT instalada AND inspeccion IS NOT NULL)),
    -- El origen de una reubicación son dos coordenadas o ninguna, y una estación recién instalada no se reubica.
    CONSTRAINT chk_mapa_visita_origen CHECK (
        (reubicada_desde_x IS NULL) = (reubicada_desde_y IS NULL)
        AND (NOT instalada OR reubicada_desde_x IS NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_mapa_visita_estaciones_plano ON mapa_visita_estaciones(plano_id, visita_id);

CREATE OR REPLACE FUNCTION fn_proteger_mapa_visita() RETURNS trigger AS $$
DECLARE
    v_visita UUID;
    v_plano UUID;
    v_estado VARCHAR(20);
    v_proyecto_visita UUID;
    v_proyecto_plano UUID;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_visita := OLD.visita_id;
        v_plano := OLD.plano_id;
    ELSE
        v_visita := NEW.visita_id;
        v_plano := NEW.plano_id;
    END IF;

    SELECT estado_campo, proyecto_id INTO v_estado, v_proyecto_visita FROM visitas WHERE id = v_visita;

    -- Una visita enviada a revisión ya no cambia: su mapa queda como se vio ese día.
    IF v_estado = 'EN_REVISION' THEN
        RAISE EXCEPTION 'La visita % está en revisión: su mapa no se puede modificar', v_visita
            USING ERRCODE = 'integrity_constraint_violation', CONSTRAINT = 'mapa_visita_inmutable';
    END IF;

    IF TG_OP <> 'DELETE' THEN
        SELECT proyecto_id INTO v_proyecto_plano FROM planos WHERE id = v_plano;
        IF v_proyecto_plano IS DISTINCT FROM v_proyecto_visita THEN
            RAISE EXCEPTION 'La visita % y el plano % no son del mismo proyecto', v_visita, v_plano
                USING ERRCODE = 'check_violation', CONSTRAINT = 'mapa_visita_mismo_proyecto';
        END IF;
        RETURN NEW;
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_proteger_mapa_visita ON mapa_visita_estaciones;
CREATE TRIGGER trg_proteger_mapa_visita
    BEFORE INSERT OR UPDATE OR DELETE ON mapa_visita_estaciones
    FOR EACH ROW EXECUTE FUNCTION fn_proteger_mapa_visita();
