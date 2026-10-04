-- GAF-93: la clave de acceso vive en personal, solo como hash (scrypt con sal). Nulo = sin clave, no puede iniciar sesión.
-- Se crea con `pnpm db:crear-usuario`; no hay usuarios ni claves fijos en el código.
ALTER TABLE personal ADD COLUMN IF NOT EXISTS clave_hash TEXT;
