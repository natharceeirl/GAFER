-- GAF-99: estado del trabajo de cada servicio contratado (PENDIENTE, EN_CURSO, COMPLETADO, CANCELADO).
-- Es aparte de la baja lógica (estado ACTIVO / INACTIVO). Los valores son un supuesto sujeto a confirmación de GAFER.
-- Se numera 004 para no chocar con 003_montos_opcionales (GAF-105), que vive en otra rama: el migrador ordena por nombre
-- y vuelve a ejecutar todas las migraciones en cada corrida, así que el hueco no afecta y esta migración debe ser idempotente.
-- La columna y el estado inicial se crean una sola vez: si la columna ya existe, no se toca nada (no se pisan los cambios de estado).
-- Estado inicial: EN_CURSO si el servicio ya tiene inspecciones registradas; PENDIENTE en otro caso.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'servicios_contratados' AND column_name = 'estado_trabajo'
    ) THEN
        ALTER TABLE servicios_contratados
            ADD COLUMN estado_trabajo VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE'
            CONSTRAINT chk_servicios_estado_trabajo CHECK (estado_trabajo IN ('PENDIENTE', 'EN_CURSO', 'COMPLETADO', 'CANCELADO'));

        UPDATE servicios_contratados s
        SET estado_trabajo = 'EN_CURSO'
        WHERE EXISTS (SELECT 1 FROM inspecciones i WHERE i.servicio_id = s.id);
    END IF;
END
$$;
