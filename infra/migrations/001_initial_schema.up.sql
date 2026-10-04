-- =============================================================================
-- Migración Inicial: 001_initial_schema.up.sql
-- Dominio: Mantenimiento y Operaciones de Campo (Fase 1)
-- Base de Datos: PostgreSQL 16
-- Cumplimiento: GAFER Especificaciones v6 (Sección 3, 4, 13)
-- =============================================================================

-- 1. Tabla de Clientes
CREATE TABLE IF NOT EXISTS clientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    razon_social VARCHAR(200) NOT NULL,
    ruc VARCHAR(11) NOT NULL UNIQUE,
    codigo_corto VARCHAR(10) NOT NULL UNIQUE,
    direccion_fiscal TEXT NOT NULL,
    giro_negocio VARCHAR(100) NOT NULL,
    contacto_nombre VARCHAR(150) NOT NULL,
    contacto_cargo VARCHAR(100) NOT NULL,
    contacto_telefono VARCHAR(50) NOT NULL,
    contacto_correo VARCHAR(150) NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO', 'INACTIVO')),
    campos_extra JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_ruc_format CHECK (ruc ~ '^[0-9]{11}$'),
    CONSTRAINT chk_codigo_corto_format CHECK (codigo_corto ~ '^[A-Z0-9_]{3,10}$')
);

CREATE INDEX IF NOT EXISTS idx_clientes_ruc ON clientes(ruc);
CREATE INDEX IF NOT EXISTS idx_clientes_codigo_corto ON clientes(codigo_corto);
CREATE INDEX IF NOT EXISTS idx_clientes_estado ON clientes(estado);

-- 2. Tabla de Proyectos (Sedes Físicas)
CREATE TABLE IF NOT EXISTS proyectos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
    nombre VARCHAR(50) NOT NULL,
    direccion_sede TEXT NOT NULL,
    distrito VARCHAR(50) NOT NULL,
    provincia VARCHAR(50) NOT NULL,
    departamento VARCHAR(50) NOT NULL,
    contacto_nombre VARCHAR(150) NOT NULL,
    contacto_cargo VARCHAR(100) NOT NULL,
    contacto_telefono VARCHAR(50) NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO', 'INACTIVO')),
    observaciones TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_cliente_proyecto_nombre UNIQUE (cliente_id, nombre),
    CONSTRAINT chk_proyecto_nombre_format CHECK (nombre ~ '^[A-Z0-9_]{3,50}$')
);

CREATE INDEX IF NOT EXISTS idx_proyectos_cliente_id ON proyectos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_proyectos_estado ON proyectos(estado);

-- 3. Tabla de Servicios Contratados
CREATE TABLE IF NOT EXISTS servicios_contratados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proyecto_id UUID NOT NULL REFERENCES proyectos(id) ON DELETE RESTRICT,
    tipo_servicio VARCHAR(10) NOT NULL CHECK (tipo_servicio IN ('DSF', 'DSS', 'DRT', 'LRA', 'LTG', 'LTS', 'LAM')),
    frecuencia VARCHAR(20) NOT NULL CHECK (frecuencia IN ('DIARIA', 'SEMANAL', 'QUINCENAL', 'MENSUAL', 'BIMESTRAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL', 'PUNTUAL')),
    area_total_m2 NUMERIC(10,2) NOT NULL CHECK (area_total_m2 > 0),
    area_tratar_m2 NUMERIC(10,2) NOT NULL CHECK (area_tratar_m2 > 0 AND area_tratar_m2 <= area_total_m2),
    insumos_autorizados JSONB NOT NULL DEFAULT '[]'::jsonb,
    equipos_autorizados JSONB NOT NULL DEFAULT '[]'::jsonb,
    dosis_referencial JSONB NOT NULL DEFAULT '{}'::jsonb,
    requiere_certificado BOOLEAN NOT NULL DEFAULT FALSE,
    vigencia_dias INT CHECK (vigencia_dias IS NULL OR vigencia_dias > 0),
    estado VARCHAR(20) NOT NULL DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO', 'INACTIVO')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_servicios_proyecto_id ON servicios_contratados(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_servicios_tipo ON servicios_contratados(tipo_servicio);

-- 4. Catálogo de Insumos Químicos / Biológicos
CREATE TABLE IF NOT EXISTS insumos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre_comercial VARCHAR(150) NOT NULL,
    principio_activo VARCHAR(150) NOT NULL,
    presentacion VARCHAR(50) NOT NULL CHECK (presentacion IN ('LIQUIDO', 'POLVO', 'BLOQUE', 'SOBRE', 'GEL', 'OTRO')),
    unidad_medida VARCHAR(20) NOT NULL CHECK (unidad_medida IN ('ML', 'L', 'G', 'KG', 'SOBRE', 'BLOQUE', 'UNIDAD')),
    registro_digesa VARCHAR(100) NOT NULL,
    concentracion VARCHAR(100) NOT NULL,
    dosis_estandar VARCHAR(100) NOT NULL,
    ficha_tecnica_key TEXT NOT NULL,
    hoja_msds_key TEXT NOT NULL,
    resolucion_key TEXT,
    proveedor VARCHAR(150),
    estado VARCHAR(20) NOT NULL DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO', 'INACTIVO')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_insumos_registro_digesa ON insumos(registro_digesa);
CREATE INDEX IF NOT EXISTS idx_insumos_estado ON insumos(estado);

-- 5. Catálogo de Equipos Operativos
CREATE TABLE IF NOT EXISTS equipos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_interno VARCHAR(50) NOT NULL UNIQUE,
    nombre VARCHAR(150) NOT NULL,
    tipo VARCHAR(50) NOT NULL CHECK (tipo IN ('FUMIGACION', 'NEBULIZACION', 'ASPERSION', 'LIMPIEZA', 'MEDICION', 'PROTECCION', 'OTRO')),
    marca_modelo VARCHAR(150),
    estado_operativo VARCHAR(30) NOT NULL DEFAULT 'OPERATIVO' CHECK (estado_operativo IN ('OPERATIVO', 'MANTENIMIENTO', 'FUERA_SERVICIO')),
    fecha_adquisicion DATE,
    ultimo_mantenimiento DATE,
    proximo_mantenimiento DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_equipos_codigo_interno ON equipos(codigo_interno);
CREATE INDEX IF NOT EXISTS idx_equipos_estado_operativo ON equipos(estado_operativo);

-- 6. Gestión de Personal Técnico y Supervisión
CREATE TABLE IF NOT EXISTS personal (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dni VARCHAR(8) NOT NULL UNIQUE CHECK (dni ~ '^[0-9]{8}$'),
    nombres VARCHAR(100) NOT NULL,
    apellidos VARCHAR(100) NOT NULL,
    cargo VARCHAR(50) NOT NULL CHECK (cargo IN ('ADMINISTRADOR', 'SUPERVISOR', 'TECNICO_OPERADOR')),
    telefono VARCHAR(50) NOT NULL,
    usuario VARCHAR(50) UNIQUE,
    estado VARCHAR(20) NOT NULL DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO', 'INACTIVO')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_personal_dni ON personal(dni);
CREATE INDEX IF NOT EXISTS idx_personal_cargo ON personal(cargo);
CREATE INDEX IF NOT EXISTS idx_personal_estado ON personal(estado);

-- 7. Programación de Visitas de Campo (Spec §8.1 / Decisión C12)
CREATE TABLE IF NOT EXISTS visitas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
    proyecto_id UUID NOT NULL REFERENCES proyectos(id) ON DELETE RESTRICT,
    servicio_id UUID NOT NULL REFERENCES servicios_contratados(id) ON DELETE RESTRICT,
    tecnico_titular_id UUID REFERENCES personal(id) ON DELETE SET NULL,
    fecha DATE NOT NULL,
    hora TIME NOT NULL,
    estado_campo VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE' CHECK (estado_campo IN ('PENDIENTE', 'EN_CURSO', 'EN_REVISION')),
    observaciones TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_visitas_cliente_id ON visitas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_visitas_proyecto_id ON visitas(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_visitas_servicio_id ON visitas(servicio_id);
CREATE INDEX IF NOT EXISTS idx_visitas_tecnico_titular_id ON visitas(tecnico_titular_id);
CREATE INDEX IF NOT EXISTS idx_visitas_fecha ON visitas(fecha);
CREATE INDEX IF NOT EXISTS idx_visitas_estado_campo ON visitas(estado_campo);

-- 8. Registro de Inspecciones de Campo (Sección 13: Inmutabilidad)
CREATE TABLE IF NOT EXISTS inspecciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    servicio_id UUID NOT NULL REFERENCES servicios_contratados(id) ON DELETE RESTRICT,
    visita_id UUID REFERENCES visitas(id) ON DELETE SET NULL,
    codigo_inspeccion VARCHAR(50) NOT NULL UNIQUE,
    estado VARCHAR(30) NOT NULL DEFAULT 'BORRADOR' CHECK (estado IN ('BORRADOR', 'CERRADO', 'ENVIADO_A_REVISION', 'OBSERVADO', 'APROBADO')),
    version_sync INT NOT NULL DEFAULT 1 CHECK (version_sync >= 1),
    fecha_ejecucion DATE NOT NULL,
    hora_inicio TIME,
    hora_fin TIME,
    tecnicos_participantes JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- Snapshot inmutable de catálogos e insumos usados al momento de la ejecución
    snapshot_catalogos JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE inspecciones ADD COLUMN IF NOT EXISTS visita_id UUID REFERENCES visitas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_inspecciones_servicio_id ON inspecciones(servicio_id);
CREATE INDEX IF NOT EXISTS idx_inspecciones_visita_id ON inspecciones(visita_id);
CREATE INDEX IF NOT EXISTS idx_inspecciones_codigo ON inspecciones(codigo_inspeccion);
CREATE INDEX IF NOT EXISTS idx_inspecciones_estado ON inspecciones(estado);
CREATE INDEX IF NOT EXISTS idx_inspecciones_fecha ON inspecciones(fecha_ejecucion);
CREATE UNIQUE INDEX IF NOT EXISTS idx_inspecciones_servicio_borrador_unico ON inspecciones(servicio_id) WHERE estado = 'BORRADOR';

-- Disparador de inmutabilidad para snapshot_catalogos (BUG-03 / Sección 13)
CREATE OR REPLACE FUNCTION fn_proteger_snapshot_inspeccion_cerrada()
RETURNS TRIGGER AS $$
BEGIN
    -- Si la inspección ya no está en BORRADOR, el snapshot_catalogos no puede alterarse
    IF OLD.estado != 'BORRADOR' AND NEW.snapshot_catalogos IS DISTINCT FROM OLD.snapshot_catalogos THEN
        RAISE EXCEPTION 'Operación denegada: snapshot_catalogos es inmutable una vez cerrada la inspección (Sección 13)';
    END IF;

    -- Prevenir revertir estado de una inspección cerrada a BORRADOR
    IF OLD.estado != 'BORRADOR' AND NEW.estado = 'BORRADOR' THEN
        RAISE EXCEPTION 'Operación denegada: no se puede revertir una inspección cerrada a estado BORRADOR';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_proteger_snapshot_inspeccion ON inspecciones;
CREATE TRIGGER trg_proteger_snapshot_inspeccion
    BEFORE UPDATE ON inspecciones
    FOR EACH ROW
    EXECUTE FUNCTION fn_proteger_snapshot_inspeccion_cerrada();

-- 9. Bitácora de Auditoría Concurrente
CREATE TABLE IF NOT EXISTS inspecciones_auditoria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inspeccion_id UUID NOT NULL REFERENCES inspecciones(id) ON DELETE CASCADE,
    actor_id UUID NOT NULL REFERENCES personal(id) ON DELETE RESTRICT,
    accion VARCHAR(50) NOT NULL,
    payload_anterior JSONB,
    payload_nuevo JSONB,
    server_received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auditoria_inspeccion_id ON inspecciones_auditoria(inspeccion_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_server_received_at ON inspecciones_auditoria(server_received_at);
-- BUG-08: Índice único para garantizar idempotencia concurrente sobre operationId
CREATE UNIQUE INDEX IF NOT EXISTS idx_auditoria_inspeccion_operation_id
ON inspecciones_auditoria(inspeccion_id, (payload_nuevo->>'operationId'))
WHERE (payload_nuevo->>'operationId') IS NOT NULL;

-- 10. Numeración Correlativa Atómica por Cliente y Tipo (Spec §6.1 / Decisión C13)
CREATE TABLE IF NOT EXISTS correlativos (
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('INFORME', 'REPORTE', 'CERTIFICADO')),
    ultimo_numero INT NOT NULL DEFAULT 0 CHECK (ultimo_numero >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (cliente_id, tipo)
);

CREATE INDEX IF NOT EXISTS idx_correlativos_cliente_tipo ON correlativos(cliente_id, tipo);

-- Función atómica para obtención de siguiente correlativo sin condiciones de carrera
CREATE OR REPLACE FUNCTION fn_siguiente_correlativo(p_cliente_id UUID, p_tipo VARCHAR)
RETURNS INT AS $$
DECLARE
    v_siguiente INT;
BEGIN
    INSERT INTO correlativos (cliente_id, tipo, ultimo_numero, updated_at)
    VALUES (p_cliente_id, p_tipo, 1, NOW())
    ON CONFLICT (cliente_id, tipo)
    DO UPDATE SET ultimo_numero = correlativos.ultimo_numero + 1, updated_at = NOW()
    RETURNING ultimo_numero INTO v_siguiente;

    RETURN v_siguiente;
END;
$$ LANGUAGE plpgsql;

-- 11. Documentos Generados y Bandeja de Aprobación (Spec §6, §8.3, §13 / Decisión C13)
CREATE TABLE IF NOT EXISTS documentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
    proyecto_id UUID REFERENCES proyectos(id) ON DELETE RESTRICT,
    inspeccion_id UUID REFERENCES inspecciones(id) ON DELETE SET NULL,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('INFORME', 'REPORTE', 'CERTIFICADO')),
    codigo VARCHAR(50) NOT NULL UNIQUE,
    numero_correlativo INT NOT NULL CHECK (numero_correlativo > 0),
    estado VARCHAR(30) NOT NULL DEFAULT 'BORRADOR' CHECK (estado IN ('BORRADOR', 'CERRADO', 'ENVIADO_A_REVISION', 'OBSERVADO', 'APROBADO', 'ENVIADO')),
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    diagnostico TEXT NOT NULL DEFAULT '',
    trabajos_realizados TEXT NOT NULL DEFAULT '',
    insumos_usados JSONB NOT NULL DEFAULT '[]'::jsonb,
    personal JSONB NOT NULL DEFAULT '[]'::jsonb,
    acciones_correctivas JSONB NOT NULL DEFAULT '[]'::jsonb,
    observaciones TEXT NOT NULL DEFAULT '',
    recomendaciones TEXT NOT NULL DEFAULT '',
    fotos INT NOT NULL DEFAULT 0,
    numero_certificado VARCHAR(100) NOT NULL DEFAULT '',
    vencimiento_certificado VARCHAR(50) NOT NULL DEFAULT '',
    firma_cliente TEXT NOT NULL DEFAULT '',
    firma_director TEXT,
    comentario_observacion TEXT,
    generados JSONB NOT NULL DEFAULT '[]'::jsonb,
    anexos JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_documentos_cliente_tipo_correlativo UNIQUE (cliente_id, tipo, numero_correlativo)
);

CREATE INDEX IF NOT EXISTS idx_documentos_cliente_id ON documentos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_documentos_proyecto_id ON documentos(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_documentos_inspeccion_id ON documentos(inspeccion_id);
CREATE INDEX IF NOT EXISTS idx_documentos_tipo ON documentos(tipo);
CREATE INDEX IF NOT EXISTS idx_documentos_estado ON documentos(estado);
CREATE INDEX IF NOT EXISTS idx_documentos_codigo ON documentos(codigo);

-- 12. Catálogos de Texto Editables (Spec §7, §12 / GAF-23)
CREATE TABLE IF NOT EXISTS catalogos_texto (
    id VARCHAR(64) PRIMARY KEY,
    titulo VARCHAR(120) NOT NULL,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    solo_administrador BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Semilla de catálogos de texto iniciales
INSERT INTO catalogos_texto (id, titulo, items, solo_administrador)
VALUES 
('hallazgos', 'Tipos de hallazgo', '["Roedores vivos", "Excretas frescas", "Daño en empaques", "Nidos activos", "Sin evidencia"]'::jsonb, false),
('acciones-correctivas', 'Acciones correctivas', '["Sellado de perforación", "Reubicación de estación", "Retiro de cebo vencido", "Refuerzo de cebado"]'::jsonb, false),
('observaciones', 'Observaciones técnicas', '["Acceso restringido a zona", "Condiciones de humedad elevada", "Presencia de residuos orgánicos"]'::jsonb, false),
('recomendaciones', 'Recomendaciones al cliente', '["Retirar cartones acumulados", "Reparar tuberías con fuga", "Mantener orden en almacén"]'::jsonb, false),
('giros', 'Giros de negocio', '["Energía", "Alimentos", "Transporte", "Construcción", "Salud", "Educación", "Sector público"]'::jsonb, false),
('motivos-modificacion', 'Motivos de modificación', '["Error de digitación en campo", "Solicitud del cliente", "Corrección de dato de insumo", "Observación de auditoría"]'::jsonb, true)
ON CONFLICT (id) DO NOTHING;

-- 13. Configuración Global del Sistema (Director Técnico C7, parámetros / GAF-23)
CREATE TABLE IF NOT EXISTS configuracion_sistema (
    id VARCHAR(32) PRIMARY KEY DEFAULT 'global',
    director_nombre VARCHAR(150) NOT NULL DEFAULT '',
    director_cip VARCHAR(20) NOT NULL DEFAULT '',
    director_firma TEXT,
    resolucion_sanitaria VARCHAR(100) NOT NULL DEFAULT '',
    parametros JSONB NOT NULL DEFAULT '{}'::jsonb,
    actualizado_por UUID REFERENCES personal(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Semilla de configuración global inicial
INSERT INTO configuracion_sistema (id, director_nombre, director_cip, director_firma, resolucion_sanitaria, parametros)
VALUES (
    'global',
    'Ing. Carlos Medina Ruiz',
    '84512',
    NULL,
    '0023-2024-DESA/MINSA',
    '{"diasAnticipacionAlertaCertificado": 30}'::jsonb
) ON CONFLICT (id) DO NOTHING;

-- 14. Bitácora General de Acciones y Auditoría (Spec §8.4 / Decisión C6 / GAF-23)
CREATE TABLE IF NOT EXISTS auditoria_eventos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES personal(id) ON DELETE SET NULL,
    actor_usuario VARCHAR(50) NOT NULL,
    actor_rol VARCHAR(30) NOT NULL,
    modulo VARCHAR(50) NOT NULL,
    accion VARCHAR(100) NOT NULL,
    entidad VARCHAR(50) NOT NULL,
    entidad_id VARCHAR(100) NOT NULL,
    payload_anterior JSONB,
    payload_nuevo JSONB,
    detalles JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auditoria_eventos_created_at ON auditoria_eventos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auditoria_eventos_entidad ON auditoria_eventos(entidad, entidad_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_eventos_actor ON auditoria_eventos(actor_usuario);
CREATE INDEX IF NOT EXISTS idx_auditoria_eventos_modulo ON auditoria_eventos(modulo);
