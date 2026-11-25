-- GAF-99: estado del trabajo de cada servicio contratado (PROGRAMADO, EJECUTADO, CONCLUIDO, CANCELADO).
-- Es aparte de la baja lógica (estado ACTIVO / INACTIVO). PENDIENTE no se guarda: se deriva en la API
-- (PROGRAMADO con la fecha de su visita programada ya pasada).
-- Se numera 004 para no chocar con 003_montos_opcionales (GAF-105), que vive en otra rama: el migrador ordena por nombre
-- y vuelve a ejecutar todas las migraciones en cada corrida, así que el hueco no afecta y esta migración debe ser idempotente.
--
-- Tres puntos de partida, todos soportados:
--   1. Sin la columna: se crea con su CHECK y se siembra el estado inicial una sola vez
--      (EJECUTADO si el servicio ya tiene inspecciones registradas; PROGRAMADO en otro caso).
--   2. Con la versión anterior de esta migración (PENDIENTE, EN_CURSO, COMPLETADO, CANCELADO): se quita el CHECK viejo,
--      se pasan los valores (PENDIENTE a PROGRAMADO, EN_CURSO a EJECUTADO, COMPLETADO a CONCLUIDO) y se agrega el CHECK nuevo.
--   3. Ya con los valores nuevos: no se toca nada (no se pisan los cambios de estado).
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'servicios_contratados' AND column_name = 'estado_trabajo'
    ) THEN
        ALTER TABLE servicios_contratados ADD COLUMN estado_trabajo VARCHAR(20) NOT NULL DEFAULT 'PROGRAMADO';

        UPDATE servicios_contratados s
        SET estado_trabajo = 'EJECUTADO'
        WHERE EXISTS (SELECT 1 FROM inspecciones i WHERE i.servicio_id = s.id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_servicios_estado_trabajo'
          AND conrelid = 'servicios_contratados'::regclass
          AND pg_get_constraintdef(oid) LIKE '%PROGRAMADO%'
    ) THEN
        ALTER TABLE servicios_contratados DROP CONSTRAINT IF EXISTS chk_servicios_estado_trabajo;

        UPDATE servicios_contratados SET estado_trabajo = 'PROGRAMADO' WHERE estado_trabajo = 'PENDIENTE';
        UPDATE servicios_contratados SET estado_trabajo = 'EJECUTADO' WHERE estado_trabajo = 'EN_CURSO';
        UPDATE servicios_contratados SET estado_trabajo = 'CONCLUIDO' WHERE estado_trabajo = 'COMPLETADO';

        ALTER TABLE servicios_contratados ALTER COLUMN estado_trabajo SET DEFAULT 'PROGRAMADO';
        ALTER TABLE servicios_contratados
            ADD CONSTRAINT chk_servicios_estado_trabajo
            CHECK (estado_trabajo IN ('PROGRAMADO', 'EJECUTADO', 'CONCLUIDO', 'CANCELADO'));
    END IF;
END
$$;
