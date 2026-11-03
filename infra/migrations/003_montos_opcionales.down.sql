ALTER TABLE servicios_contratados
DROP COLUMN IF EXISTS monto,
DROP COLUMN IF EXISTS moneda;

ALTER TABLE proyectos
DROP COLUMN IF EXISTS monto_presupuestado,
DROP COLUMN IF EXISTS moneda;
