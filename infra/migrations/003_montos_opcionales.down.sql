ALTER TABLE servicios_contratados
DROP CONSTRAINT IF EXISTS chk_servicios_contratados_monto_moneda_par,
DROP CONSTRAINT IF EXISTS chk_servicios_contratados_moneda_valida,
DROP CONSTRAINT IF EXISTS chk_servicios_contratados_monto_no_negativo,
DROP COLUMN IF EXISTS monto,
DROP COLUMN IF EXISTS moneda;

ALTER TABLE proyectos
DROP CONSTRAINT IF EXISTS chk_proyectos_monto_moneda_par,
DROP CONSTRAINT IF EXISTS chk_proyectos_moneda_valida,
DROP CONSTRAINT IF EXISTS chk_proyectos_monto_presupuestado_no_negativo,
DROP COLUMN IF EXISTS monto_presupuestado,
DROP COLUMN IF EXISTS moneda;
