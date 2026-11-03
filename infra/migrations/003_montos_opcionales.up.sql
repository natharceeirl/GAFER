-- GAF-105: Montos y pagos opcionales en clientes, proyectos y servicios
ALTER TABLE servicios_contratados
ADD COLUMN IF NOT EXISTS monto NUMERIC(12, 2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS moneda VARCHAR(3) DEFAULT NULL CHECK (moneda IS NULL OR moneda IN ('PEN', 'USD'));

ALTER TABLE proyectos
ADD COLUMN IF NOT EXISTS monto_presupuestado NUMERIC(12, 2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS moneda VARCHAR(3) DEFAULT NULL CHECK (moneda IS NULL OR moneda IN ('PEN', 'USD'));
