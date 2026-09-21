# Spec: Mantenimiento de Catálogos y Entidades Base

## Requirements

### Requirement: Jerarquía Cliente - Proyecto - Servicio
El sistema DEBE hacer cumplir la jerarquía estricta: un Cliente posee uno o más Proyectos (sedes), y cada Proyecto posee uno o más Servicios Contratados.

#### Scenario: Creación válida de Cliente con Sede y Servicio
- **GIVEN** un usuario con rol `ADMINISTRADOR` o `SUPERVISOR` autenticado
- **WHEN** registra un cliente con RUC de 11 dígitos, razón social y código corto único `[A-Z0-9_]+`
- **AND** añade una sede con nombre de proyecto y dirección
- **AND** añade un servicio contratado seleccionando uno de los 7 tipos oficiales (`DSF`, `DSS`, `DRT`, `LRA`, `LTG`, `LTS`, `LAM`)
- **THEN** el sistema DEBE persistir la jerarquía completa y retornar HTTP 201
- **AND** el código corto del cliente DEBE quedar reservado para la numeración de documentos

#### Scenario: Rechazo por RUC inválido o duplicado
- **GIVEN** un usuario intentando registrar un cliente
- **WHEN** proporciona un RUC que no contiene exactamente 11 dígitos numéricos o ya existe en el sistema
- **THEN** el sistema DEBE rechazar la petición con HTTP 400 y mensaje explicativo del campo inválido

---

### Requirement: Catálogo de Insumos y Registro Sanitario
Todo insumo registrado DEBE contener nombre comercial, principio activo, presentación, unidad de medida, registro DIGESA y referencias a archivos PDF de ficha técnica y hoja MSDS.

#### Scenario: Registro exitoso de insumo con documentación
- **GIVEN** un catálogo de insumos en base de datos
- **WHEN** el supervisor ingresa un nuevo insumo con registro DIGESA vigente y claves de MinIO para ficha técnica y MSDS
- **THEN** el sistema DEBE guardar el insumo en estado `ACTIVO`
- **AND** el insumo DEBE estar disponible inmediatamente para ser asignado a servicios contratados

---

### Requirement: Catálogo de Equipos y Control Operativo
Todo equipo DEBE poseer un código interno único GAFER (ej. `EQ-NEB-01`), tipo de equipo y estado operativo (`OPERATIVO`, `MANTENIMIENTO`, `FUERA_SERVICIO`).

#### Scenario: Asignación de equipo en mantenimiento
- **GIVEN** un equipo cuyo estado operativo es `MANTENIMIENTO` o `FUERA_SERVICIO`
- **WHEN** un operador intenta asignarlo a una inspección de campo activa
- **THEN** el sistema DEBE impedir la asignación y notificar que el equipo no está operativo

---

### Requirement: Gestión de Personal Técnico
El personal DEBE estar identificado unívocamente por su DNI de 8 dígitos y clasificado con cargo `SUPERVISOR` o `TECNICO_OPERADOR`.

#### Scenario: Validación de DNI de personal
- **GIVEN** el formulario de alta de personal
- **WHEN** se envía un DNI con longitud distinta de 8 dígitos o caracteres no numéricos
- **THEN** el sistema DEBE rechazar la solicitud con un error de validación estricto
