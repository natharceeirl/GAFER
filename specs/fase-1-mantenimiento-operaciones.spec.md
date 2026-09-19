# Especificación Técnica Canónica — Fase 1: Mantenimiento y Operaciones de Campo

> **Fuente de Verdad del Sistema GAFER**  
> Basado en el pliego contractual oficial: `GAFER_Especificaciones_Sistema_v6_Actualizado.pdf`  
> Estado: **APROBADO PARA DESARROLLO (SPRINT 1)**

---

## 1. Objetivo y Alcance de la Fase 1

La **Fase 1** establece los cimientos de datos, el módulo administrativo de **Mantenimiento** y el núcleo del **Formulario de Campo Offline-First** con trabajo colaborativo.

### Criterio de Aceptación Contractual (Condición de Pago)
El Administrador y Supervisor pueden registrar un cliente con sus sedes (proyectos) y servicios contratados. Dos técnicos pueden ingresar datos del mismo proyecto en paralelo desde la app móvil sin conexión, sincronizar al recuperar señal, y el log de auditoría registra cada acción cronológicamente sin pérdidas ni colisiones.

---

## 2. Jerarquía de Negocio del Sistema

La estructura del sistema es estrictamente jerárquica y determina los expedientes, la numeración de documentos y los permisos operativos:

$$\text{CLIENTE} \longrightarrow \text{PROYECTO (Sede)} \longrightarrow \text{SERVICIO CONTRATADO}$$

- Un **Cliente** tiene $N$ **Proyectos** (sedes físicas de operación).
- Un **Proyecto** tiene $N$ **Servicios Contratados**.
- Cada servicio contratado tiene su propio tipo, frecuencia y numeración correlativa independiente.

---

## 3. Diccionario de Datos de Mantenimiento

### 3.1 Entidad: Cliente
| Campo | Tipo | Obligatorio | Regla / Validación | Descripción |
|---|---|---|---|---|
| `id` | UUID v4 | Sí | Generado automáticamente | Identificador interno |
| `razon_social` | String | Sí | Máx. 200 caracteres | Nombre legal completo de la empresa |
| `ruc` | String(11) | Sí | Exactamente 11 dígitos numéricos | RUC (empresas). Personas naturales usan `12345678910` bajo cliente VARIOS |
| `codigo_corto` | String | Sí | 4 a 10 caracteres, `[A-Z0-9_]+` | Único en el sistema. Ej: `KALLPA`, `SAMAY`. Alimenta la numeración de documentos |
| `direccion_fiscal`| String | Sí | Texto libre | Domicilio legal del cliente |
| `giro_negocio` | String | Sí | Selección desde catálogo | Ej: Minería, Alimentos, Energía, etc. |
| `contacto_nombre` | String | Sí | Nombre de la persona de contacto | Responsable administrativo/técnico |
| `contacto_cargo` | String | Sí | Cargo del contacto | Ej: Jefe de SSOMA |
| `contacto_telefono`| String | Sí | Teléfono o celular | Contacto rápido |
| `contacto_correo` | String | Sí | Email válido | Para envío automático de reportes |
| `estado` | Enum | Sí | `ACTIVO` \| `INACTIVO` | Inactivo oculta al cliente de la app móvil pero conserva el historial |
| `campos_extra` | JSONB | No | Clave/Valor configurable | Campos personalizados agregados sin programar |

### 3.2 Entidad: Proyecto (Sede)
| Campo | Tipo | Obligatorio | Regla / Validación | Descripción |
|---|---|---|---|---|
| `id` | UUID v4 | Sí | Generado automáticamente | Identificador interno |
| `cliente_id` | UUID v4 | Sí | FK a `Cliente` | Cliente al que pertenece la sede |
| `nombre` | String | Sí | 4 a 20 caracteres, `[A-Z0-9_]+` | Sin espacios. Ej: `PLANTA`, `ALMACEN_1`, `CAMPAMENTO` |
| `direccion_sede` | String | Sí | Dirección física de la sede | Ubicación real donde se hace el servicio |
| `distrito` | String | Sí | Catálogo geográfico | Distrito |
| `provincia` | String | Sí | Catálogo geográfico | Provincia (ej. Arequipa) |
| `departamento` | String | Sí | Catálogo geográfico | Departamento (ej. Arequipa) |
| `contacto_nombre` | String | Sí | Nombre del responsable en sede | Quien recibe a los técnicos en campo |
| `contacto_cargo` | String | Sí | Cargo en sede | Ej: Supervisor de Turno |
| `contacto_telefono`| String | Sí | Teléfono | Celular del responsable |
| `estado` | Enum | Sí | `ACTIVO` \| `INACTIVO` | Estado de la sede |
| `observaciones` | Texto | No | Texto libre | Requisitos de EPP, restricciones de acceso |

### 3.3 Entidad: Servicio Contratado
| Campo | Tipo | Obligatorio | Regla / Validación | Descripción |
|---|---|---|---|---|
| `id` | UUID v4 | Sí | Generado automáticamente | Identificador interno |
| `proyecto_id` | UUID v4 | Sí | FK a `Proyecto` | Sede donde se ejecuta |
| `tipo_servicio` | Enum | Sí | `DSF`, `DSS`, `DRT`, `LRA`, `LTG`, `LTS`, `LAM` | Los 7 tipos oficiales en mayúsculas |
| `frecuencia` | Enum | Sí | `DIARIA`, `SEMANAL`, `QUINCENAL`, `MENSUAL`, `BIMESTRAL`, `TRIMESTRAL`, `SEMESTRAL`, `ANUAL`, `PUNTUAL` | Frecuencia de atención |
| `area_total_m2` | Decimal | Sí | $> 0$ | Superficie total del establecimiento |
| `area_tratar_m2` | Decimal | Sí | $> 0$ y $\le$ `area_total_m2` | Superficie efectiva tratada en cada visita |
| `insumos_ids` | UUID[] | Sí | Array de FKs a `Insumo` | Insumos autorizados pre-cargados |
| `equipos_ids` | UUID[] | Sí | Array de FKs a `Equipo` | Equipos asignados pre-cargados |
| `dosis_referencial`| JSONB | Sí | InsumoId -> Dosis string | Ej: "10 ml/L" para referencia del técnico |
| `requiere_certificado`| Boolean | Sí | `true` \| `false` | Si emite certificado ambiental |
| `vigencia_dias` | Integer | No | Requerido si `requiere_certificado = true` | Período de vigencia en días |
| `estado` | Enum | Sí | `ACTIVO` \| `INACTIVO` | Estado del servicio |

### 3.4 Catálogo de Insumos
| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `id` | UUID v4 | Sí | Identificador |
| `nombre_comercial` | String | Sí | Ej: "Cipermetrina 25%", "Brodifacoum 0.005%" |
| `principio_activo` | String | Sí | Ingrediente activo químico |
| `presentacion` | Enum | Sí | `LIQUIDO`, `POLVO`, `BLOQUE`, `SOBRE`, `GEL`, `OTRO` |
| `unidad_medida` | Enum | Sí | `ML`, `L`, `G`, `KG`, `SOBRE`, `BLOQUE`, `UNIDAD` |
| `registro_digesa` | String | Sí | Número oficial de autorización sanitaria |
| `concentracion` | String | Sí | Concentración del principio activo |
| `dosis_estandar` | String | Sí | Dosis recomendada de fábrica |
| `ficha_tecnica_key`| String | Sí | Referencia en Object Storage (MinIO) al PDF |
| `hoja_msds_key` | String | Sí | Referencia en Object Storage (MinIO) al PDF |
| `resolucion_key` | String | Sí | PDF de Resolución Directoral |
| `proveedor` | String | No | Nombre del proveedor habitual |
| `estado` | Enum | Sí | `ACTIVO` \| `INACTIVO` |

### 3.5 Catálogo de Equipos
| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `id` | UUID v4 | Sí | Identificador |
| `codigo_interno` | String | Sí | Código único GAFER (ej. `EQ-NEB-01`) |
| `nombre` | String | Sí | Ej. "Nebulizadora ULV Vector Fog C-150" |
| `tipo` | Enum | Sí | `FUMIGACION`, `NEBULIZACION`, `ASPERSION`, `LIMPIEZA`, `MEDICION`, `PROTECCION`, `OTRO` |
| `marca_modelo` | String | No | Fabricante y modelo |
| `estado_operativo`| Enum | Sí | `OPERATIVO`, `MANTENIMIENTO`, `FUERA_SERVICIO` |
| `fecha_adquisicion`| Date | No | Fecha de compra |
| `ultimo_mantenimiento`| Date | No | Última fecha de servicio técnico |
| `proximo_mantenimiento`| Date| No | Alerta de mantenimiento programado |

### 3.6 Gestión de Personal
| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `id` | UUID v4 | Sí | Identificador |
| `dni` | String(8) | Sí | Documento de identidad (exactamente 8 dígitos) |
| `nombres` | String | Sí | Nombres completos |
| `apellidos` | String | Sí | Apellidos completos |
| `cargo` | Enum | Sí | `SUPERVISOR` \| `TECNICO_OPERADOR` |
| `telefono` | String | Sí | Celular de contacto |
| `usuario` | String | No | Nombre de usuario en sistema (ej. `AMAMANI`, `IPUSARI`) |
| `estado` | Enum | Sí | `ACTIVO` \| `INACTIVO` |

---

## 4. Regla Innegociable de Inmutabilidad (Sección 13)

> **Cláusula Contractual Estricta:**
> Modificar o eliminar cualquier insumo, equipo, personal o catálogo de texto en el módulo de Mantenimiento **NUNCA debe afectar, sobrescribir ni mutar los registros históricos de servicios ya guardados**.

### Patrón Técnico de Implementación
1. Las inspecciones guardadas en base de datos **no dependen de claves foráneas mutables** para los datos técnicos críticos.
2. Al registrar un insumo en una inspección, se persiste un **Snapshot JSON** con el valor exacto en ese instante:
   ```json
   {
     "insumo_id": "uuid",
     "nombre_historico": "Brodifacoum 0.005%",
     "lote": "L-2026-X",
     "vencimiento": "2027-05-01",
     "registro_digesa": "RD-1234-DIGESA",
     "cantidad_usada": 250,
     "unidad": "G"
   }
   ```
3. Si el Administrador renombra el insumo en el catálogo en 2027, el reporte de 2026 sigue imprimiendo el nombre histórico original.

---

## 5. Operaciones de Campo y Trabajo Colaborativo (Fase 1)

### 5.1 Reglas de Colaboración
- Cualquier técnico activo puede atender cualquier proyecto activo (no hay asignación restrictiva).
- Dos o más técnicos pueden cargar datos en paralelo en un proyecto grande (ej. Técnico A registra estaciones 1 a 50; Técnico B registra estaciones 51 a 100).
- **Resolución de conflictos en colisión:** Si dos técnicos excepcionalmente cargan la misma estación, el backend resuelve el desempate por **hora de recepción en servidor (`server_received_at`) con versión monótona**. El dato anterior queda archivado en el log de auditoría.

### 5.2 Ciclo de Estados del Documento
```text
[BORRADOR] ──(Técnico guarda parcial)──> Múltiples técnicos pueden editar
     │
     └──(Cierre por cualquier técnico)──> [CERRADO] (Bloquea edición en campo)
                                                │
                                                └──> [ENVIADO_A_REVISION] (Revisa Supervisor)
                                                           │
                              ┌────────────────────────────┴───────────────────────────┐
                              ▼                                                        ▼
                        [OBSERVADO]                                               [APROBADO]
                 (Supervisor pide corrección)                            (Genera PDF y bloquea)
```

---

## 6. Checklist de Entregables del Sprint 1

- [ ] **Contratos:** `@gafer/contracts` exporta esquemas Zod validados para Cliente, Proyecto, Servicio, Insumo, Equipo y Personal.
- [ ] **Base de Datos (Cristian):** Migración inicial en PostgreSQL (`tables + triggers` de auditoría) corriendo en Docker.
- [ ] **Backend (Cristian):** Endpoints REST en `apps/api` con validación Zod y pruebas de inmutabilidad.
- [ ] **Web (Ivan):** Módulo de Mantenimiento con tablas FSD para gestionar Clientes, Sedes y Catálogos.
- [ ] **QA (Andre):** Suite de tests de integración Supertest automatizando la prueba de inmutabilidad de la Sección 13.
