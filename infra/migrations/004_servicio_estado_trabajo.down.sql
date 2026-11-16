-- GAF-99: quita el estado de trabajo del servicio contratado (su CHECK se va con la columna).
ALTER TABLE IF EXISTS servicios_contratados DROP COLUMN IF EXISTS estado_trabajo;
