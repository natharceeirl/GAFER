-- GAF-105: Montos y monedas opcionales en proyectos y servicios contratados
ALTER TABLE servicios_contratados
ADD COLUMN IF NOT EXISTS monto NUMERIC(12, 2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS moneda VARCHAR(3) DEFAULT NULL;

ALTER TABLE servicios_contratados
DROP CONSTRAINT IF EXISTS chk_servicios_contratados_monto_no_negativo,
DROP CONSTRAINT IF EXISTS chk_servicios_contratados_moneda_valida,
DROP CONSTRAINT IF EXISTS chk_servicios_contratados_monto_moneda_par;

ALTER TABLE servicios_contratados
ADD CONSTRAINT chk_servicios_contratados_monto_no_negativo CHECK (monto IS NULL OR monto >= 0),
ADD CONSTRAINT chk_servicios_contratados_moneda_valida CHECK (moneda IS NULL OR moneda IN ('PEN', 'USD')),
ADD CONSTRAINT chk_servicios_contratados_monto_moneda_par CHECK ((monto IS NULL) = (moneda IS NULL));

ALTER TABLE proyectos
ADD COLUMN IF NOT EXISTS monto_presupuestado NUMERIC(12, 2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS moneda VARCHAR(3) DEFAULT NULL;

ALTER TABLE proyectos
DROP CONSTRAINT IF EXISTS chk_proyectos_monto_presupuestado_no_negativo,
DROP CONSTRAINT IF EXISTS chk_proyectos_moneda_valida,
DROP CONSTRAINT IF EXISTS chk_proyectos_monto_moneda_par;

ALTER TABLE proyectos
ADD CONSTRAINT chk_proyectos_monto_presupuestado_no_negativo CHECK (monto_presupuestado IS NULL OR monto_presupuestado >= 0),
ADD CONSTRAINT chk_proyectos_moneda_valida CHECK (moneda IS NULL OR moneda IN ('PEN', 'USD')),
ADD CONSTRAINT chk_proyectos_monto_moneda_par CHECK ((monto_presupuestado IS NULL) = (moneda IS NULL));
