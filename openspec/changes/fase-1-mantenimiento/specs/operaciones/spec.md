# Spec: Operaciones de Campo, Colaboración e Inmutabilidad

## Requirements

### Requirement: Trabajo Colaborativo en Inspecciones
Dos o más técnicos DEBEN poder capturar datos en paralelo sobre una misma inspección en estado `BORRADOR` sin bloquearse mutuamente.

#### Scenario: Carga paralela de sectores o estaciones
- **GIVEN** una inspección iniciada para un proyecto en estado `BORRADOR`
- **WHEN** el Técnico A registra las estaciones 1 a 50 desde su dispositivo móvil
- **AND** el Técnico B registra las estaciones 51 a 100 simultáneamente desde su dispositivo móvil
- **THEN** el backend DEBE fusionar ambas cargas de datos en la inspección sin descartar registros
- **AND** el registro de auditoría DEBE reflejar qué técnico registró cada estación con su timestamp

#### Scenario: Resolución de colisión sobre la misma estación
- **GIVEN** dos técnicos operando sin conexión que modifican la misma estación de control
- **WHEN** ambos sincronizan sus cambios con el servidor
- **THEN** el backend DEBE resolver la colisión aplicando el cambio con timestamp de recepción en servidor (`server_received_at`) más reciente
- **AND** el valor desplazado DEBE archivarse en el historial de auditoría de la inspección

---

### Requirement: Inmutabilidad Contractual de Datos Históricos (Sección 13)
La modificación, inactivación o eliminación de insumos, dosis, equipos o personal en los catálogos NUNCA DEBE alterar los datos ya guardados en inspecciones previas.

#### Scenario: Preservación de datos históricos ante cambio de catálogo
- **GIVEN** una inspección guardada que utilizó el insumo "Cipermetrina 25%" con lote "L-2026-A"
- **WHEN** un administrador renombra o modifica la concentración de "Cipermetrina 25%" en el catálogo de insumos
- **THEN** la consulta o exportación en PDF de la inspección pasada DEBE continuar mostrando "Cipermetrina 25%" y "L-2026-A" exactamente como se registró originalmente
- **AND** el sistema DEBE leer estos datos desde el `snapshot_json` inmutable de la inspección

---

### Requirement: Ciclo de Vida del Documento de Campo
Las inspecciones DEBEN transitar por los estados definidos: `BORRADOR` -> `CERRADO` -> `ENVIADO_A_REVISION` -> `OBSERVADO` / `APROBADO`.

#### Scenario: Bloqueo de edición al cerrar la inspección
- **GIVEN** una inspección en estado `BORRADOR`
- **WHEN** cualquiera de los técnicos participantes ejecuta el cierre de la inspección
- **THEN** el estado DEBE cambiar a `CERRADO`
- **AND** cualquier intento posterior de edición de datos de campo desde la app móvil DEBE ser rechazado
