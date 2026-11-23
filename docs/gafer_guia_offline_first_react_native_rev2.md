# GAFER — Guía de Arquitectura Offline-First para React Native

> **Propósito:** Este documento establece las decisiones, reglas, invariantes y prácticas obligatorias para desarrollar la aplicación Android de campo de GAFER Saneamiento Ambiental con React Native, Expo y TypeScript.
>
> **Objetivo no negociable:** un técnico debe poder ejecutar una inspección completa sin Internet, cerrar la aplicación o reiniciar el teléfono sin perder datos, y sincronizar de forma segura cuando exista conectividad.
>
> **Audiencia:** desarrollo mobile, backend, QA, arquitectura, soporte y responsables de producto.
>
> **Revisión 2 (octubre 2026):** incorpora la validación del stack contra documentación vigente (Expo SDK 57 / React Native 0.86), corrección de contradicciones internas, configuración de durabilidad de SQLite, ejecución en segundo plano, pull seguro, política de conflictos explícita, y un spike con criterios de fallo y compuerta de decisión (Sección 22). Los cambios respecto a la revisión 1 están marcados con **[R2]**. Las decisiones que requieren al negocio están listadas en el Anexo B.

---

## 1. Contexto y alcance

GAFER opera servicios de saneamiento ambiental en instalaciones que pueden no tener conectividad: plantas industriales, minas, almacenes y locales remotos. La aplicación Android es usada por Técnicos Operadores para registrar servicios, estaciones de desratización, consumo de insumos, fotografías, firmas y observaciones.

La especificación funcional requiere, entre otros aspectos:

- Operación sin conexión desde la Fase 1.
- Guardados parciales y trabajo colaborativo sobre inspecciones.
- Registro de estaciones, consumos, reposiciones y condiciones físicas.
- Hasta 100 estaciones por plano y hasta 20 planos por proyecto.
- Fotografías, firma manuscrita del responsable y documentos técnicos.
- Cierre de inspección, revisión, aprobación, auditoría e inmutabilidad documental.
- Sincronización posterior sin pérdida ni duplicación de datos.
- PDF final generado en backend y conservado de forma inmutable.

La aplicación móvil **no es una interfaz online con caché**. Es una aplicación local-first: dispone de una base de datos operativa local y sincroniza con el servidor cuando puede.

---

## 2. Principios no negociables

### 2.1 Local-first

La interfaz lee de SQLite local y todas las acciones críticas se guardan primero en SQLite.

```text
UI → caso de uso local → transacción SQLite → outbox → sincronización posterior
```

Nunca se debe esperar una respuesta HTTP para confirmar al técnico que su información fue guardada.

### 2.2 La red es una optimización, no una dependencia

La falta de Internet no puede impedir:

- Abrir una inspección previamente descargada.
- Registrar estación, consumo, reposición u observación.
- Guardar un borrador.
- Capturar fotografías.
- Capturar firma.
- Ver el plano y las estaciones previamente descargadas.
- Cerrar localmente una inspección, sujeto a confirmación posterior del servidor.

### 2.3 El servidor es canónico; SQLite es operativo

- **SQLite local** es la fuente de verdad de lo que la UI muestra y de lo que el técnico registra en el dispositivo.
- **PostgreSQL del servidor** es la fuente de verdad canónica compartida: aprobación, auditoría global, numeración, inventario, documentos, autorización y datos consolidados.
- **El PDF final** se genera únicamente en backend/worker desde snapshots aprobados. Nunca se genera como documento oficial en el móvil.

### 2.4 Durable before visible

Una acción se considera guardada solo después de una transacción SQLite exitosa.

```text
No: actualizar estado React → luego intentar persistir.
Sí: persistir SQLite → observar cambio desde SQLite → actualizar UI.
```

### 2.5 Sincronización idempotente

Toda operación que sale del móvil debe poder reenviarse una o muchas veces sin duplicar información, inventario, auditoría, fotos, estaciones o documentos.

### 2.6 No hay sobrescritura ciega

Nunca se debe reemplazar toda la base local con la nube ni asumir que "el servidor siempre gana" o "el móvil siempre gana".

Los cambios se procesan por operación, entidad, versión y política de conflicto.

### 2.7 Datos históricos inmutables

Los cambios en catálogos, formularios, productos, plantillas o recomendaciones no alteran inspecciones históricas ni PDFs ya generados. Cada inspección y documento relevante conserva snapshots de los datos utilizados.

---

## 3. Stack móvil acordado [R2]

```text
Plataforma: Android (sin iOS planificado)
Lenguaje: TypeScript (strict)
Framework: React Native + Expo, New Architecture (única opción desde RN 0.82)
Versión base: Expo SDK 57 (React Native 0.86.x), siempre con el último patch
Build: Expo Development Builds / EAS Build; no depender de Expo Go
Persistencia local: expo-sqlite (por defecto). op-sqlite solo si el spike lo justifica
Cifrado local: SQLCipher (decisión en 15.5)
Filesystem: expo-file-system (API nueva, predeterminada desde SDK 54)
Preferencias de UI: react-native-mmkv (solo datos no críticos)
Secretos: expo-secure-store (Android Keystore)
Cámara: expo-camera, o expo-image-picker con recuperación de resultado pendiente
Contratos: OpenAPI/JSON Schema como fuente; Zod/tipos generados en paquete compartido del monorepo
Mapa: @shopify/react-native-skia (canvas 2D)
Conectividad: observador de red + verificación real de API
Sync: outbox durable + push/pull incremental + reintentos (motor puro, sin dependencias de RN)
Backend: NestJS + PostgreSQL + object storage + worker de documentos
```

> **Nota:** React Native es válido para este sistema si se respetan las decisiones de este documento y se supera el spike de la Sección 22. El mapa murino debe dibujarse sobre canvas/Skia, no mediante decenas o centenas de `View` y `Text` React independientes.

### 3.1 Reglas de versiones [R2]

```text
- New Architecture es la única arquitectura desde React Native 0.82; toda dependencia nativa
  debe ser compatible. Verificar con `npx expo-doctor` y React Native Directory antes de adoptar.
- Usar Expo SDK 57 con el último patch. NO usar SDK 56: la combinación React Native 0.85 + Hermes V1
  tuvo una regresión de memoria en Android (apps que importan Reanimated/worklets), corregida en
  React Native 0.86.2 y 0.86.3 (expo 57.0.9 y 57.0.17).
- SDK 58 (React Native 0.88) no se adopta hasta que sea estable, lleve parches y pase la batería
  de regresión de la Sección 21.
- Reanimated/worklets solo si son necesarios; si se usan, medir memoria en el equipo de 4 GB.
- Versiones exactas con lockfile. Cada actualización de SDK es una tarea planificada con pruebas.
```

### 3.2 Qué se guarda dónde [R2]

```text
SQLite        -> datos de negocio, outbox, conflictos, metadata, auditoría local.
Filesystem    -> binarios (fotos, firmas, planos).
MMKV          -> SOLO preferencias de UI y banderas no críticas. Nunca outbox, inspecciones,
                 estado de sync ni tokens: no es transaccional con SQLite.
SecureStore   -> refresh token y clave de cifrado de la base.
AsyncStorage  -> no se usa.
```

### 3.3 Contratos y monorepo [R2]

```text
packages/contracts    OpenAPI/JSON Schema como fuente de verdad; tipos y Zod generados.
packages/sync-engine  motor de sync en TypeScript puro (sin React Native), probado en Node.
packages/domain-rules reglas de dominio compartidas (algoritmo de calor/aura, validaciones).
```

Regla: el contrato no depende de React Native. Debe poder consumirse desde otras plataformas (incluido Kotlin) sin reescribirse.

### 3.4 Plan ante fallo de plataforma [R2]

La elección de React Native se mantiene condicionada al resultado del spike (Sección 22). Si falla, el plan es escalonado: mitigación en JS, módulo nativo Kotlin dentro de la app para la pieza afectada, y solo como último recurso migración completa a Android nativo.

---

## 4. Arquitectura de alto nivel

```text
┌───────────────────────────────┐
│        React Native UI        │
│  formularios, agenda, mapa,   │
│  fotos, firma, estado sync    │
└──────────────┬────────────────┘
               │ lee / observa
               ▼
┌───────────────────────────────┐
│        Capa de dominio        │
│ casos de uso y repositorios   │
└──────────────┬────────────────┘
               │ escribe transacciones
               ▼
┌───────────────────────────────┐
│          SQLite local         │
│ entidades + snapshots +       │
│ outbox + conflictos + metadata│
└──────────────┬────────────────┘
               │                         ┌───────────────────────┐
               ├── archivos por URI ────►│ Filesystem del teléfono │
               │                         │ fotos, firma, planos    │
               ▼                         └───────────────────────┘
┌───────────────────────────────┐
│        Sync Coordinator       │
│ push → resolver → pull        │
│ batching, prioridades, retry  │
└──────────────┬────────────────┘
               │ HTTPS autenticado
               ▼
┌───────────────────────────────┐
│         API NestJS            │
│ validación, idempotencia,     │
│ versiones, conflictos, auth   │
└──────────────┬────────────────┘
               │
               ├──────────────► PostgreSQL
               ├──────────────► Object Storage
               └──────────────► Worker / PDF / estadísticas
```

---

## 5. Regla de persistencia: SQLite y filesystem

### 5.1 Qué va en SQLite

SQLite contiene datos estructurados, relaciones, metadata, estados y colas.

```text
- Usuario y configuración mínima de sesión.
- Clientes, proyectos y servicios descargados.
- Agenda de visitas.
- Catálogos descargados y sus versiones.
- Inspecciones, formularios, hallazgos e insumos.
- Registros de estaciones y consumos.
- Coordenadas de estaciones y datos de planos.
- Estado visual del mapa y datos de últimas inspecciones.
- Participantes de inspección.
- Datos de firma: firmante, cargo, timestamps y referencia al archivo.
- Metadata de fotos: URI, hash, tamaño, estado de upload.
- Auditoría local append-only.
- sync_outbox, sync_conflicts, sync_metadata.
- Versiones de entidades y cursores de sincronización.
```

### 5.2 Qué va al filesystem del teléfono

Los archivos binarios no deben almacenarse como Base64 dentro de SQLite ni en estado de React.

```text
- Fotos procesadas pendientes de subida.
- Firmas manuscritas pendientes de subida.
- Planos descargados para uso offline.
- Miniaturas.
- Previews temporales de PDF.
- Archivos temporales de compresión/renderizado.
- Exportaciones explícitamente solicitadas por el usuario.
```

### 5.3 Estructura local recomendada [R2]

```text
documentDirectory/            (persistente; app-private)
└── gafer/
    ├── inspections/
    │   └── INS_<uuid>/
    │       ├── photos/       PH_<uuid>.webp
    │       └── signatures/   SIG_<uuid>.png
    ├── plans/                planos FIJADOS (visitas agendadas / inspecciones abiertas)
    └── exports/
        └── user-requested/

cacheDirectory/               (el sistema puede vaciarla en cualquier momento)
└── gafer/
    ├── plans-unpinned/       planos no fijados (LRU)
    ├── thumbnails/
    ├── pdf-previews/
    └── tmp/                  compresión y render temporales
```

Reglas:

```text
- Nada que sea necesario para trabajar offline vive en cacheDirectory. Android puede vaciarla
  cuando falta espacio; los planos de visitas agendadas e inspecciones abiertas se guardan
  fijados en documentDirectory. El LRU nunca toca planos fijados.
- En SQLite se guardan rutas RELATIVAS (local_path_relative), resueltas contra documentDirectory
  en ejecución. Nunca URIs absolutas.
- No se mueven archivos entre carpetas por estado (pending/failed/recent). El estado vive en
  SQLite. Mover archivos rompe referencias y exige transacciones entre filesystem y base.
- Escritura atómica: escribir con nombre temporal y renombrar al final.
- No existe manifest.json por inspección como fuente de verdad. Si se genera uno, es solo
  diagnóstico/recuperación y nunca se lee para operar.
- Excluir estos directorios del backup automático de Android (allowBackup / reglas de exclusión):
  contienen PII, fotos y firmas.
```

### 5.4 Regla de oro de archivos

```text
Archivo pendiente de confirmación remota:
  no borrar.

Archivo confirmado por servidor:
  conservar durante período de gracia;
  después, purgar copia local según política.

Archivo descargable o regenerable:
  guardar como cache y aplicar limpieza LRU.
```

### 5.5 Configuración obligatoria de SQLite [R2]

La promesa "sobrevive a cierre forzado y reinicio" depende de esta configuración, no solo de usar transacciones.

```text
PRAGMA journal_mode = WAL;
PRAGMA synchronous  = FULL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;
PRAGMA user_version = <sqlite_schema_version>;
```

```text
- En WAL, synchronous=NORMAL protege ante cierre de la app pero puede perder las últimas
  transacciones confirmadas ante corte de energía o caída del sistema operativo (la base no se
  corrompe, pero se pierden). Con el volumen de GAFER el costo de FULL es despreciable.
  Verificar en el spike el valor efectivo con el que abre la librería elegida.
- Una sola ruta de escritura, con cola serializada de escrituras.
- Transacciones exclusivas para toda mutación de negocio (en expo-sqlite:
  withExclusiveTransactionAsync). Una transacción no exclusiva puede incluir consultas de otras
  partes de la app ejecutadas en la misma conexión mientras está abierta.
- APIs síncronas solo para lecturas mínimas; el trabajo con volumen usa APIs asíncronas para no
  bloquear el hilo JS.
- Migraciones transaccionales, versionadas y probadas con datos pendientes reales. Antes de una
  migración mayor se conserva una copia local de la base hasta confirmar el éxito.
- Tras un cierre anómalo detectado, ejecutar PRAGMA quick_check al iniciar. Si falla, no borrar:
  entrar en modo diagnóstico y avisar a soporte.
- Cifrado: ver 15.5.
```


---

## 6. Modelo de datos técnico mínimo

Las entidades de negocio incluyen sus campos propios, pero deben incorporar metadata de sincronización.

```text
id
server_version
sync_status
last_synced_at
created_at_local
updated_at_local
deleted_at
```

**[R2]** `sync_status` de una entidad es una proyección del estado de sus operaciones en `sync_outbox`, actualizada en la misma transacción que las modifica (o calculada en consulta). No es una fuente de verdad independiente. Lo mismo aplica a `files_local.upload_status`.

### 6.1 Tabla `sync_outbox`

Cada mutación local debe crear una operación durable dentro de la misma transacción SQLite que actualiza la entidad.

```text
sync_outbox
- operation_id                 UUID/ULID único e inmutable
- device_id
- user_id
- aggregate_type               INSPECTION | STATION_RECORD | PHOTO | etc.
- aggregate_id
- operation_type               ver catálogo único en 8.2.1 [R2]
- base_version                 versión de servidor desde la que se editó
- payload_kind                 FULL | PATCH [R2]
- changed_fields_json          solo campos cambiados (PATCH) [R2]
- payload_json
- aggregate_seq                secuencia local monotónica por agregado [R2]
- priority                     CRITICAL | HIGH | MEDIUM | LOW
- depends_on_operation_id      nullable
- created_at_local
- attempt_count
- last_attempt_at
- next_retry_at
- status                       PENDING | IN_FLIGHT | ACKED | CONFLICT | FAILED | BLOCKED
- last_error_code
- last_error_message_sanitized
```

### 6.2 Tabla `sync_conflicts`

```text
sync_conflicts
- conflict_id
- operation_id
- aggregate_type
- aggregate_id
- base_snapshot_json
- local_snapshot_json
- server_snapshot_json
- conflict_fields_json
- server_version
- status                       OPEN | RESOLVED | DISCARDED
- resolved_by
- resolved_at
- resolution_note
```

### 6.3 Tabla `files_local`

```text
files_local
- file_id
- inspection_id
- file_type                    PHOTO | SIGNATURE | MAP | PDF_PREVIEW
- local_path_relative          ruta relativa a documentDirectory; nunca absoluta [R2]
- pinned                       solo MAP: fijado, exento de LRU [R2]
- remote_file_id
- sha256
- size_bytes
- mime_type
- upload_status                PENDING | UPLOADING | CONFIRMED | FAILED
- retention_state              PENDING | GRACE | ELIGIBLE_PURGE | PURGED
- pdf_selection_status         UNKNOWN | SELECTED | NOT_SELECTED | REJECTED
- captured_at
- uploaded_at
- local_purge_after
- purged_at
```

### 6.4 Tabla `sync_metadata`

```text
sync_metadata
- key
- value

Ejemplos:
- last_pull_cursor
- last_successful_sync_at
- sync_protocol_version
- sqlite_schema_version
- device_registration_status
```

---

## 7. Escritura local y outbox transaccional

Cada acción del técnico debe ejecutar una única transacción SQLite.

### Ejemplo: registrar consumo en una estación

```text
BEGIN TRANSACTION

1. Insertar o actualizar station_record_local.
2. Insertar audit_event_local.
3. Insertar operación UPSERT_FIELDS (STATION_RECORD) en sync_outbox.
4. Actualizar estado local de la inspección.

COMMIT
```

Si la transacción falla, la UI debe informar error y no simular que los datos fueron guardados.

Si la transacción tiene éxito, la UI muestra:

```text
Guardado en este dispositivo.
Pendiente de sincronización.
```

### Prohibiciones

```text
No actualizar solo Zustand/Redux/estado React.
No depender de una promesa HTTP para guardar.
No insertar una entidad sin crear su operación outbox.
No crear operación outbox fuera de la transacción de negocio.
No usar timestamps del dispositivo como única regla de conflicto.
```

### 7.1 Coalescencia de operaciones [R2]

Ediciones repetidas del mismo agregado antes de sincronizar pueden compactarse:

```text
- Solo se compactan operaciones PENDING (nunca IN_FLIGHT ni ACKED) del mismo agregado y tipo,
  sin operación intermedia de otro tipo que dependa de ellas.
- La operación resultante conserva el operation_id y el base_version de la primera, y la unión
  de changed_fields con el último valor de cada campo.
- La auditoría local NO se compacta: cada acción conserva su audit_event_local.
- CLOSE, REGISTER_FILE y cambios de estado nunca se compactan.
```

### 7.2 Orden por agregado [R2]

```text
- Las operaciones de un mismo agregado se envían en orden de aggregate_seq.
- Si una falla (REJECTED_*, CONFLICT, RETRY_LATER), las siguientes del mismo agregado pasan a
  BLOCKED: no se envían ni se descartan.
- Agregados distintos no se bloquean entre sí, salvo depends_on explícito.
- El servidor aplica las operaciones de un agregado dentro del lote en orden y se detiene en la
  primera que falle.
```

### 7.3 Autoguardado de formularios [R2]

```text
- Cada acción semántica (confirmar estación, elegir opción, blur) es una transacción.
- Texto libre: debounce corto (300-500 ms).
- Se fuerza el guardado pendiente al perder foco, al pasar a segundo plano (AppState) y antes
  de navegar.
- "Guardado en este dispositivo" se muestra solo tras el commit.
```

---

## 8. Protocolo de sincronización

### 8.1 Orden general

```text
1. Verificar conectividad real con API autenticada.
2. Push de operaciones locales pendientes.
3. Procesar ACK, errores, rechazos y conflictos.
4. Pull incremental de cambios del servidor.
5. Aplicar cambios remotos en una transacción SQLite.
6. Reconciliar cambios remotos con mutaciones locales pendientes.
7. Actualizar cursor solo después de aplicar todo correctamente.
8. Actualizar estado visible de sincronización.
```

### 8.2 Push

El móvil debe enviar operaciones en lotes, no una petición por estación.

```http
POST /v1/sync/push
```

```json
{
  "deviceId": "device-uuid",
  "protocolVersion": 1,
  "operations": [
    {
      "operationId": "01J...",
      "aggregateType": "STATION_RECORD",
      "aggregateId": "station-record-uuid",
      "operationType": "UPSERT_FIELDS",
      "baseVersion": 8,
      "occurredAtLocal": "2026-09-26T09:00:00-05:00",
      "payload": {}
    }
  ]
}
```

### 8.2.1 Catálogo único de operaciones [R2]

Vocabulario contractual para `operation_type` (outbox) y `operationType` (API). Toda operación nueva se añade aquí y en el contrato compartido. Los valores de esta tabla son el punto de partida y deben completarse con la especificación funcional.

| aggregateType | operationType | Payload | Prioridad |
|---|---|---|---|
| INSPECTION | CREATE | completo | HIGH |
| INSPECTION | UPDATE_FIELDS | solo campos cambiados | HIGH |
| INSPECTION | CLOSE | referencia + resumen verificable | CRITICAL |
| STATION_RECORD | UPSERT_FIELDS | solo campos cambiados | HIGH |
| STATION_RECORD | DELETE_LOGICAL | id + motivo | HIGH |
| CONSUMPTION / REPLENISHMENT | CREATE | completo, append-only e idempotente | HIGH |
| PHOTO | REGISTER_FILE | metadata (id, sha256, tamaño, mime); el binario va por el pipeline de archivos | MEDIUM |
| SIGNATURE | REGISTER_FILE | metadata; el binario va por el pipeline de archivos | CRITICAL |

### 8.3 Respuesta de push

Cada operación debe recibir una respuesta individual.

```text
ACKED
DUPLICATE_ALREADY_PROCESSED
REJECTED_VALIDATION
REJECTED_PERMISSION
CONFLICT
RETRY_LATER
```

No se elimina una operación del outbox hasta registrar de forma durable un resultado final exitoso o una transición controlada a conflicto/rechazo.

### 8.4 Pull incremental

El móvil no descarga toda la base cada vez. Mantiene un cursor.

```http
GET /v1/sync/pull?cursor=<last_pull_cursor>
```

El servidor devuelve solamente cambios posteriores al cursor.

```json
{
  "nextCursor": "change_94618",
  "changes": [
    {
      "entityType": "CATALOG_PRODUCT",
      "entityId": "product-uuid",
      "version": 4,
      "operation": "UPSERT",
      "data": {}
    }
  ]
}
```

Aplicación local:

```text
BEGIN TRANSACTION
  aplicar deltas remotos
  reconciliar entidades sin cambios locales pendientes
  actualizar nextCursor
COMMIT
```

Si la aplicación muere antes del commit, el cursor anterior se conserva y el pull puede repetirse con seguridad.

### 8.4.1 Cursor seguro, paginación y resincronización [R2]

Problema: si el cursor es un identificador secuencial asignado al insertar (por ejemplo `bigserial`), una transacción larga puede confirmarse después de otra con identificador mayor. Un móvil que ya avanzó el cursor se salta ese cambio para siempre.

```text
- El backend publica los cambios mediante un changelog cuyo orden de lectura es seguro frente a
  transacciones concurrentes (por ejemplo, exponer solo cambios confirmados más antiguos que una
  ventana de seguridad, o un mecanismo basado en visibilidad de transacciones de PostgreSQL).
  La técnica exacta se decide y prueba en backend antes de Fase 1.
- Defensa adicional: el pull se solicita con solapamiento (ventana reciente) y el móvil aplica de
  forma idempotente por (entity_id, version): ignora versiones ya aplicadas o menores.
- Paginación: el pull devuelve hasMore y nextCursor. Cada página se aplica en su propia
  transacción, que incluye el cursor de esa página.
- Cursor demasiado antiguo: el servidor responde CURSOR_EXPIRED. El móvil ejecuta una
  resincronización controlada (descarga el subconjunto necesario y reconcilia por id y versión).
  NUNCA toca el outbox ni los archivos pendientes.
- Cambio de alcance (proyecto nuevo asignado o retirado): el servidor emite eventos de alcance.
  El móvil descarga lo nuevo y marca para purga lo retirado, sin borrar nada con pendientes.
- Entidades con operaciones locales pendientes: el pull registra la versión del servidor sin
  sobrescribir los campos con cambios pendientes; el conflicto se detecta en el push mediante
  base_version.
```

### 8.5 Idempotencia

El backend conserva `operation_id` procesados.

Si el móvil reenvía una operación por corte de red:

```text
Servidor: operación ya procesada.
Servidor: devuelve resultado original.
Móvil: marca operación como ACKED.
```

Nunca se debe duplicar:

```text
- Registro de consumo.
- Reposición de insumo.
- Movimiento de inventario.
- Evento de auditoría.
- Fotografía.
- Firma.
- Cambio de estado.
```

---

## 9. Prioridades, dependencias y lotes

### 9.1 Prioridad de sincronización

| Prioridad | Elementos |
|---|---|
| `CRITICAL` | Cierre de inspección, firma, autorización, conflicto, cambios de estado |
| `HIGH` | Estaciones, consumo, reposición, insumos, hallazgos, observaciones |
| `MEDIUM` | Fotografías comprimidas, planos modificados, adjuntos |
| `LOW` | Miniaturas, catálogos no urgentes, precarga de planos, telemetría |

### 9.2 Dependencias

Una operación puede depender de otra.

```text
Crear inspección
  → registrar estaciones
  → subir firma/fotos
  → cerrar inspección
```

No se debe enviar un cierre que depende de información obligatoria no confirmada, salvo que el negocio permita explícitamente un cierre parcial.

Reglas adicionales [R2]:

```text
- El cierre exige confirmados en servidor: la firma del responsable (si el servicio la requiere)
  y los datos obligatorios del formulario.
- Las fotos NO bloquean el cierre salvo que el tipo de servicio las marque como obligatorias;
  las fotos pendientes siguen subiendo después del cierre (decisión de negocio D-3).
- Un cierre bloqueado por dependencias queda visible como "esperando firma/archivos", con detalle.
- Los archivos CRITICAL (firma) usan la cola de subida con prioridad sobre las fotos.
```

### 9.3 Batching

Reglas iniciales:

```text
- Lotes de 20 a 50 operaciones JSON.
- Máximo 2 a 3 subidas de fotografía concurrentes.
- Fotos no viajan dentro del payload JSON.
- Operaciones críticas se envían antes que fotos pesadas.
- No ejecutar requests concurrentes sin límite.
```

### 9.4 Reintentos

Usar backoff exponencial con jitter.

```text
Intento 1: inmediato
Intento 2: ~15 segundos
Intento 3: ~1 minuto
Intento 4: ~5 minutos
Intentos posteriores: progresivos, con límite y visibilidad al usuario
```

Nunca hacer reintentos infinitos agresivos que consuman batería o datos móviles.

Clasificación de errores [R2]:

```text
- 401 / AUTH_EXPIRED: pausar el sync e intentar refrescar el token; no cuenta como intento fallido.
- 408, 429, 5xx, timeout, DNS: reintento con backoff y jitter; respetar Retry-After.
- 4xx de validación o permiso: no se reintenta automáticamente; la operación pasa a
  FAILED_REQUIRES_ACTION y bloquea las siguientes del mismo agregado. El dato local se conserva.
- Operaciones que fallan de forma permanente se aíslan, aparecen en la pantalla de sync y en el
  diagnóstico sanitizado. Nunca se descartan en silencio.
```

---

## 10. Conectividad real

No usar una sola variable `isOnline` como decisión final.

Estados recomendados:

```text
OFFLINE
NETWORK_AVAILABLE
API_UNREACHABLE
AUTH_EXPIRED
SYNCING
SYNCED
SYNC_PARTIAL
CONFLICT_REQUIRES_REVIEW
```

La conectividad de red solo habilita un intento. La aplicación considera que hay conexión útil solo cuando un endpoint autenticado de API responde correctamente.

Casos a contemplar:

```text
- Wi-Fi conectado sin Internet.
- Portal cautivo.
- DNS fallando.
- API caída.
- Token vencido.
- VPN requerida/desconectada.
- HTTPS bloqueado por red corporativa.
- Datos móviles disponibles pero inestables.
```

### 10.1 Cuándo corre la sincronización [R2]

En Android no existe una garantía de ejecución en segundo plano equivalente a un servicio nativo. expo-background-task usa WorkManager con intervalo mínimo de 15 minutos, el sistema puede retrasar la ejecución y el comportamiento varía según el fabricante. Por eso:

```text
1. Foreground (principal): al abrir la app, al volver a primer plano, al cambiar la
   conectividad, tras operaciones críticas (con debounce) y con "Sincronizar ahora".
2. Background (oportunista): tarea de WorkManager vía expo-background-task, solo como ayuda.
   Ninguna regla de negocio ni promesa al usuario depende de que se ejecute.
3. Subidas largas de fotos: el spike determina si basta foreground o si se requiere un servicio
   en primer plano / módulo nativo (Sección 22).
4. La UI no promete "se sincronizará sola": explica que requiere abrir la app con conectividad.
5. La pantalla de sync muestra la antigüedad de la operación pendiente más antigua. La
   capacitación incluye ahorro de batería y restricciones por fabricante.
```

---

## 11. Conflictos y concurrencia

### 11.1 Regla general

No existe una política global "last-write-wins".

Cada entidad define una política explícita de:

```text
- aceptar,
- fusionar,
- rechazar,
- conservar ambos eventos,
- escalar al Supervisor,
- o aplicar una regla del servidor.
```

### 11.2 Versionado optimista

Cada entidad editable del servidor tiene `server_version` monotónica.

```text
Móvil descarga entidad: server_version = 12
Móvil modifica offline: base_version = 12
Servidor recibe operación:
  si versión actual = 12 → acepta, nueva versión = 13
  si versión actual ≠ 12 → evalúa conflicto
```

El timestamp local sirve para auditoría; no debe ser la única base de resolución.

### 11.3 Matriz de conflicto por entidad

| Entidad | Política |
|---|---|
| Catálogos | Servidor manda para usos futuros; snapshots históricos no se alteran |
| Cliente/proyecto | Versionado optimista; conflicto a Administrador/Supervisor |
| Agenda de visitas | Servidor manda; el móvil actualiza agenda y conserva borradores relacionados |
| Borrador de inspección | Merge por campo cuando los campos no chocan |
| Observaciones y recomendaciones | Merge por campo; si mismo campo cambia, conflicto visible |
| Registro de estación | Operación por estación; conflicto controlado si dos técnicos cambian la misma estación |
| Fotografías | Unión de archivos; nunca eliminar silenciosamente |
| Firma | Inmutable después de confirmación; reemplazo solo con autorización auditada |
| Cierre de inspección | Servidor valida; conflicto escala al Supervisor |
| Aprobación | Solo servidor y Supervisor autorizado |
| Inventario | Operaciones idempotentes; saldo calculado en servidor |
| Auditoría | Append-only; no se sobrescribe |
| PDF aprobado | Inmutable |

### 11.4 Dos técnicos, misma estación [R2]

La especificación funcional permite que excepcionalmente dos técnicos registren la misma estación y establece que se toma el último dato ingresado, manteniendo visible la información anterior hasta el guardado final.

Problema de interpretación: ordenar por `received_at` del servidor significa "último en sincronizar", no "último en ingresar". Un técnico que estuvo más tiempo offline aparecería como el primero aunque haya registrado después. El negocio debe definir qué significa "último" (decisión D-1):

| Opción | Criterio | Ventaja | Riesgo |
|---|---|---|---|
| A | Último en sincronizar (`received_at`) | Simple, determinista, no depende del reloj | Puede contradecir el orden real de los hechos |
| B | Hora del evento corregida (hora del dispositivo + desfase medido contra el servidor) | Refleja el orden real | Depende de medir bien el desfase; relojes manipulables |
| C | Sin ganador automático: conflicto a Supervisor si los valores difieren | Sin pérdida silenciosa | Más carga operativa |

Recomendación inicial: B para el valor operativo actual, con C cuando la diferencia sea relevante o la inspección ya esté cerrada. En todos los casos ambos registros quedan en auditoría y el valor anterior permanece visible. La opción A solo si el negocio la acepta de forma explícita.

Operaciones que llegan después del cierre (decisión D-2): el servidor no las aplica en silencio sobre una inspección cerrada. Se registran, se marcan CONFLICT y se escalan al Supervisor, que decide aceptar (anexando o reabriendo) o rechazar con motivo.

### 11.5 Conflictos visibles

Un técnico no debe intentar resolver conflictos administrativos complejos.

La UI móvil muestra:

```text
Esta inspección requiere revisión del Supervisor.
Tus datos fueron conservados y no se han perdido.
```

El Supervisor visualiza:

```text
- versión base,
- valor local,
- valor del servidor,
- campos en conflicto,
- autor y dispositivo,
- fechas,
- historial de auditoría,
- acciones: conservar local / servidor / combinar / rechazar con motivo.
```

---

## 12. Cierre offline y estados de negocio

No confundir estados de negocio con estado técnico de sync.

### 12.1 Estados de negocio

```text
BORRADOR
CERRADO
ENVIADO_A_REVISION
OBSERVADO
APROBADO
ENVIADO_AL_CLIENTE
```

### 12.2 Estados técnicos locales

```text
LOCAL_ONLY
PENDING_SYNC
SYNCING
SYNCED
SYNC_PARTIAL
CONFLICT
REJECTED
FAILED_RETRYABLE
FAILED_REQUIRES_ACTION
```

### 12.3 Cierre sin Internet

Un cierre local no puede bloquear globalmente otros dispositivos hasta confirmación del servidor.

```text
CERRADO_LOCAL_PENDIENTE
```

Significa:

```text
- El técnico no puede editar más desde su dispositivo.
- La operación CLOSE_INSPECTION está en outbox con prioridad CRITICAL.
- El servidor todavía no confirmó el bloqueo global.
- El Supervisor puede resolver conflictos si el cierre se rechaza.
```

Cuando el servidor confirma:

```text
CERRADO_LOCAL_PENDIENTE → CERRADO / SYNCED
```

**[R2]** `CERRADO_LOCAL_PENDIENTE` no es un séptimo estado de negocio. Es la combinación `business_state = CERRADO` (local) + `sync_status = PENDING_SYNC` + `server_confirmed = false`. Se deriva, no se almacena como estado independiente, para no mezclar negocio con sync.

Si el servidor rechaza el cierre (`REJECTED_VALIDATION` o `CONFLICT`):

```text
- La inspección vuelve localmente a BORRADOR con la marca "cierre rechazado" y el motivo en
  lenguaje claro.
- Todos los datos y archivos se conservan. El técnico corrige y vuelve a cerrar con una nueva
  operación CLOSE y un nuevo operation_id.
- Si es CONFLICT, queda bloqueada para edición hasta que el Supervisor resuelva.
```

---

## 13. Fotografías, firma y almacenamiento

### 13.1 Fotografías

Flujo obligatorio:

```text
1. Captura de cámara/galería.
2. Normalizar orientación EXIF.
3. Generar imagen de subida comprimida.
4. Generar miniatura de caché.
5. Calcular hash SHA-256.
6. Guardar archivo durable localmente.
7. Registrar metadata en SQLite.
8. Crear operación/outbox de carga.
9. Subir archivo por multipart o sesión reanudable.
10. Confirmar remote_file_id en SQLite.
11. Aplicar política de retención/purga local.
```

### 13.1.1 Captura segura en Android [R2]

```text
- Orden anti-pérdida: escribir el archivo procesado con nombre temporal dentro de
  documentDirectory -> renombrar de forma atómica -> insertar la fila de files_local y la
  operación REGISTER_FILE en una sola transacción. Si el proceso muere entre pasos, la
  reconciliación de arranque lo resuelve (13.5).
- Con expo-image-picker (cámara externa), Android puede destruir la actividad principal mientras
  la cámara está abierta. El resultado se recupera con getPendingResultAsync, ejecutado al
  iniciar la app y al volver a primer plano, pasando por el mismo pipeline de captura.
- Con expo-camera (cámara dentro de la app) el riesgo baja pero no desaparece: se prueba igual.
- Probar con "No conservar actividades" activado y con memoria baja en el equipo de 4 GB.
- El SHA-256 se calcula sobre el archivo ya comprimido; verificar que no cargue imágenes grandes
  completas en memoria JS.
```

### 13.1.2 Subida idempotente [R2]

```text
- La subida usa file_id (y sha256) como clave de idempotencia: si el archivo ya existe, el
  servidor responde con el remote_file_id existente sin duplicar.
- Caso "subida confirmada pero la app murió antes de actualizar SQLite": el reintento recibe el
  mismo remote_file_id y el móvil lo registra.
- La cola de subida es la única fuente de verdad; files_local.upload_status es su proyección,
  actualizada en la misma transacción.
```

### 13.2 No usar Base64 como almacenamiento operativo

Prohibido:

```text
- Guardar fotos como Base64 en SQLite.
- Guardar fotos como Base64 en Zustand/Redux.
- Enviar fotos en JSON de sincronización.
- Mantener imágenes grandes en memoria sin control.
```

### 13.3 Selección de fotos para PDF

Una foto no seleccionada para el PDF no equivale a una foto eliminada.

```text
UPLOADED_CONFIRMED + NOT_SELECTED
```

La imagen puede permanecer en servidor como evidencia de la inspección, de acuerdo con la política documental. La copia local se purga después de la ventana de gracia.

### 13.4 Retención local sugerida

| Archivo | Regla local |
|---|---|
| Foto/firma pendiente | Nunca borrar antes de confirmación remota |
| Foto confirmada, inspección abierta | Conservar temporalmente |
| Foto seleccionada para PDF | Purgar después de aprobación + período de gracia |
| Foto no seleccionada para PDF | Purgar después de período de gracia; conservar servidor según política |
| Foto rechazada | Purgar tras confirmar decisión y registrar auditoría |
| Planos de visitas agendadas / inspecciones abiertas | Fijados en documentDirectory; se liberan al cerrar la visita + período de gracia [R2] |
| Planos no fijados | Cache LRU; redescargables |
| Miniaturas/previews | Cache expirable |
| Exportación solicitada | Conservar según decisión visible del usuario |

### 13.5 Limpieza de almacenamiento

La app debe ejecutar limpieza controlada:

```text
Al iniciar:
- limpiar tmp huérfano mayor a 24 horas;
- reconciliar archivos [R2]: archivo operativo sin fila en files_local -> cuarentena
  (nunca borrar) y diagnóstico; fila sin archivo -> FAILED_REQUIRES_ACTION y aviso;
- limpiar previews expirados;
- aplicar LRU a planos/miniaturas;
- detectar archivos confirmados elegibles para purga.

Después de sync exitoso:
- mover archivos confirmados a estado de gracia;
- purgar solo según política.

Antes de capturar foto:
- verificar almacenamiento libre;
- alertar si queda poco espacio;
- impedir captura si no se puede guardar de forma segura.
```

Umbrales iniciales sugeridos:

```text
> 2 GB: operación normal
1–2 GB: limpiar cache
500 MB–1 GB: purgar copias locales confirmadas fuera de gracia
< 500 MB: alertar y limitar capturas según necesidad
< 200 MB: bloquear nueva captura hasta liberar espacio o sincronizar
```

---

## 14. Mapas murinos offline

### 14.1 Regla de renderizado

El mapa se debe renderizar como una superficie gráfica única:

```text
Plano base
+ capa de irradiación/heatmap
+ capa de auras
+ capa de estaciones e íconos
+ gestos de pan/zoom
+ detalle en BottomSheet/modal
```

Usar `@shopify/react-native-skia` para el canvas del mapa.

No usar una lista de 100 `View`/`Text` independientes como representación del plano.

### 14.2 Coordenadas normalizadas

Guardar posiciones de estación entre 0 y 1, no píxeles absolutos.

```text
normalized_x = x / ancho_plano
normalized_y = y / alto_plano

x_render = normalized_x × ancho_visible
y_render = normalized_y × alto_visible
```

Esto permite renderizar el mismo plano en celular, tablet, web, A4, A3 y PDF.

### 14.3 Resultado canónico

El servidor/worker produce el resultado canónico para PDF:

```text
- Estado verde/rojo por última inspección.
- Aura por tendencia de últimas 4 inspecciones.
- Parámetros de irradiación.
- Estadísticas.
- Render PDF final.
```

El móvil ofrece una vista operacional offline basada en datos descargados y cambios locales. El PDF oficial nunca depende del render del teléfono.

### 14.4 Algoritmo versionado

Guardar en snapshots:

```text
heat_algorithm_version
heat_algorithm_parameters
```

Ejemplo:

```json
{
  "heatAlgorithmVersion": "v1",
  "parameters": {
    "influenceRadius": 0.12,
    "opacity": 0.45,
    "decayCurve": "gaussian"
  }
}
```

Esto permite reproducibilidad histórica aunque la visualización evolucione.

### 14.5 Planos pesados [R2]

```text
- No cargar planos de alta resolución sin control: un bitmap grande puede agotar la memoria en
  Android.
- El backend genera, al publicar el plano, versiones raster escaladas (WebP/PNG) por nivel de
  zoom o tiles; el móvil descarga solo lo necesario. Renderizar PDF en el dispositivo no forma
  parte de la solución.
- Medición obligatoria en el spike con un plano real en el equipo de 4 GB.
- Los planos de visitas agendadas e inspecciones abiertas se descargan y se fijan (5.3).
```

### 14.6 Algoritmo compartido [R2]

```text
- El cálculo de estado, aura e irradiación vive en un paquete TypeScript del monorepo
  (domain-rules), usado por el móvil (vista operativa) y por el worker (resultado canónico).
- Pruebas con resultados de referencia compartidas: mismas entradas, mismas salidas en ambos
  entornos.
- La versión del algoritmo se guarda en snapshots (14.4) y el móvil muestra la versión usada.
```

---

## 15. Seguridad, sesión y dispositivo

### 15.1 Datos mínimos en dispositivo

Sincronizar solo el subconjunto necesario:

```text
- Agenda de próximos días.
- Proyectos recientemente usados o descargados.
- Servicios activos de esos proyectos.
- Catálogos necesarios.
- Planos y estaciones correspondientes.
- Últimas inspecciones necesarias para mapa.
- Borradores propios.
```

No descargar por defecto:

```text
- Todos los clientes.
- Todos los PDFs históricos.
- Todas las fotos históricas.
- Todos los planos.
- Auditoría completa.
- Catálogos irrelevantes.
```

### 15.2 Sesión offline

Definir una vigencia configurable para el uso offline.

Propuesta inicial:

```text
- Login online inicial obligatorio.
- Sesión offline permitida por 24–72 horas según política GAFER.
- Después de expiración, restringir operaciones sensibles o nuevos datos.
- Permitir revisar pendientes propios según decisión de seguridad.
- Renovar credenciales cuando regrese conexión.
```

### 15.3 Protección de datos

```text
- HTTPS obligatorio.
- Access token de corta duración.
- Refresh token en almacenamiento seguro, nunca AsyncStorage plano.
- Claves de cifrado protegidas con Android Keystore.
- App-private storage para archivos operativos.
- Cifrado de SQLite (SQLCipher) y política para archivos: decisión temprana, ver 15.5. [R2]
- No escribir tokens, firmas, fotos ni PII sensible en logs.
- Opción de bloqueo local con biometría/PIN según política.
- Limpieza de datos al cerrar sesión confirmada.
```

### 15.4 Identidad de dispositivo

Registrar instalación/dispositivo:

```text
device_id
user_id
device_name
platform_version
app_version
first_registered_at
last_seen_at
revoked_at
```

Cada operación de sync incluye `device_id`, `user_id`, `operation_id` y versión de protocolo.

### 15.5 Cifrado local: decisión temprana [R2]

Agregar cifrado después obliga a migrar base y archivos con datos ya en campo, por lo que se decide antes de Fase 1 (decisión D-4). Recomendación inicial: SQLCipher para SQLite (expo-sqlite lo soporta mediante la opción `useSQLCipher` de su plugin de configuración), clave generada en el dispositivo y protegida con Android Keystore (expo-secure-store), archivos en almacenamiento privado de la app, y evaluación del cifrado de fotos y firmas según el análisis de riesgo.

### 15.6 Sesión, cierre de sesión y dispositivo revocado [R2]

```text
- Los datos locales se aíslan por user_id: en un equipo compartido un usuario no ve los de otro.
- Cerrar sesión con operaciones o archivos pendientes está bloqueado: la app muestra qué falta
  y ofrece "Sincronizar ahora". Si no hay forma de sincronizar, se permite cerrar sesión solo
  conservando los datos cifrados; nunca se borran.
- Refresh token expirado tras muchos días offline: exige nuevo login sin borrar datos locales;
  el sync se reanuda con el usuario correcto.
- Dispositivo revocado (revoked_at): se bloquean nuevas capturas pero se conservan los
  pendientes y se ofrece un proceso controlado de entrega (decisión D-5). Nunca borrado
  automático.
- La "sesión offline" de 24-72 h es un control de uso, no una defensa contra un dispositivo
  comprometido: la protección real es el cifrado y el bloqueo local.
```

### 15.7 Reloj del dispositivo [R2]

```text
- En cada sync el móvil mide el desfase entre su reloj y la hora del servidor y lo registra.
- Si el desfase supera un umbral (por ejemplo 5 minutos), la UI avisa y las reglas basadas en
  fecha usan la hora corregida cuando sea posible.
- La hora local sirve para auditoría; no es la única base de ninguna decisión (ver 7 y 11.4).
```

---

## 16. Borrados, desactivaciones y snapshots

No borrar físicamente una entidad sincronizada solo porque fue eliminada o desactivada desde web.

Usar borrado lógico/tombstones:

```text
status = INACTIVE
deleted_at = ...
deleted_by = ...
server_version = ...
```

Reglas:

```text
- Datos inactivos no aparecen para nuevos registros.
- Snapshots históricos mantienen sus referencias y textos.
- Una inspección offline ya iniciada conserva su snapshot.
- El móvil recibe la baja como delta incremental.
- La app no rompe si una entidad local referencia algo ahora inactivo.
```

Los PDFs aprobados, auditoría y movimientos de inventario no se eliminan mediante flujo ordinario.

---

## 17. Versionado, migraciones y compatibilidad

La aplicación puede pasar días offline. Por ello, no se debe romper el sync con una actualización de backend o mobile.

Mantener:

```text
sqlite_schema_version
sync_protocol_version
minimum_supported_app_version
api_version
heat_algorithm_version
form_template_version
catalog_snapshot_version
```

Reglas:

```text
- Migraciones SQLite transaccionales y probadas.
- Backend acepta versiones anteriores durante una ventana definida.
- Nunca lanzar cambio incompatible sin plan de transición.
- La app informa si requiere actualización antes de permitir operaciones incompatibles.
- Los datos pendientes se migran antes de usar un nuevo protocolo.
- El rollback debe preservar SQLite y outbox.
```

### 17.1 Actualizaciones OTA [R2]

Si se usan actualizaciones OTA (EAS Update), el JavaScript puede cambiar sin pasar por la tienda:

```text
- runtimeVersion ligada a sqlite_schema_version y sync_protocol_version: una OTA nunca cambia el
  esquema local ni el protocolo; eso exige un build nuevo.
- Las migraciones de datos locales solo viajan en builds nativos probados.
- Publicación por canales (staging -> producción) y despliegue gradual; el rollback conserva
  SQLite y outbox.
- Cada OTA pasa la batería mínima de pruebas offline antes de publicarse.
```

---

## 18. Observabilidad, diagnóstico y soporte

La app necesita una pantalla de sincronización entendible para usuarios y útil para soporte.

```text
Sincronización
- Estado actual
- Última sincronización exitosa
- Operaciones pendientes
- Fotos pendientes
- Conflictos pendientes
- Error más reciente sanitizado
- Botón: Sincronizar ahora
- Botón: Ver detalle
```

Datos de diagnóstico sanitizados:

```text
device_id
user_id
app_version
sqlite_schema_version
sync_protocol_version
last_successful_sync_at
pending_operations_count
pending_files_count
oldest_pending_operation_at
last_error_code
network_state
battery_state
```

Nunca enviar automáticamente en telemetría:

```text
- Fotos.
- Firmas.
- Tokens.
- Contraseñas.
- RUC completos si no son necesarios.
- Contenido de observaciones sensibles.
```

### 18.1 Mantenimiento de la base local [R2]

```text
- Operaciones ACKED: se conservan una ventana corta (7-14 días, configurable) y luego se purgan.
- Auditoría local ya confirmada por el servidor: se poda tras la ventana de gracia; la canónica
  vive en el servidor.
- Conflictos RESOLVED / DISCARDED: se purgan tras la ventana.
- Tombstones locales: se purgan cuando el servidor confirma que el cursor las superó.
- VACUUM / optimización: con la app en primer plano, batería suficiente y sin operaciones
  críticas pendientes; nunca durante un sync.
- Monitorear el tamaño de la base y alertar a soporte ante crecimiento anómalo.
```

---

## 19. Recuperación y continuidad operacional

### 19.1 Teléfono perdido, roto o reinstalado antes de sync

Si una inspección solo existe en un dispositivo offline y el dispositivo se pierde antes de sincronizar, el servidor no puede recuperarla mágicamente.

Mitigaciones:

```text
- Sync automático cuando haya conectividad.
- Estado visible de pendientes.
- Botón Sincronizar ahora.
- Priorización de datos críticos antes de fotos.
- Capacitación operativa.
- Dispositivos corporativos/administrados cuando sea viable.
- Sesiones offline limitadas.
- Cifrado local.
- Eventual exportación cifrada de emergencia como mejora futura.
```

### 19.2 Respaldo de emergencia futuro

Fuera de alcance inicial, pero posible:

```text
Exportar respaldo de inspección pendiente
- JSON de datos
- manifest con hashes
- fotos comprimidas
- firma
- cifrado
```

No implementar sin definir seguridad, claves, destino y procedimiento de restauración.

---

## 20. UX obligatoria de offline y sync

El técnico debe entender siempre qué pasó con su trabajo.

### Mensajes esperados

```text
Guardado en este dispositivo.
Pendiente de sincronización.

Sincronización completada.
- 1 inspección actualizada
- 82 estaciones enviadas
- 12 fotos cargadas

Sincronización parcial.
- 8 de 12 fotos cargadas
- Tus datos siguen seguros en este dispositivo

No se pudo sincronizar.
- Sin conexión o API no disponible
- Operaciones pendientes: 26

Esta inspección requiere revisión del Supervisor.
- Tus cambios se conservaron
```

### Prohibiciones UX

```text
No usar spinner infinito sin explicación.
No mostrar “guardado” si solo se actualizó memoria.
No ocultar pendientes de sync.
No descartar cambios locales por un error HTTP.
No mostrar error técnico crudo al técnico.
No bloquear el formulario por falta de Internet.
```

---

## 21. Pruebas obligatorias

### 21.1 Pruebas funcionales offline

```text
- Crear inspección sin Internet.
- Guardar parcialmente y cerrar app.
- Reiniciar teléfono y recuperar borrador.
- Registrar 100 estaciones offline.
- Capturar fotos y firma offline.
- Cerrar inspección offline.
- Recuperar red y sincronizar.
- Ejecutar Sync ahora.
- Confirmar no duplicación tras reintentos.
```

### 21.2 Pruebas de red hostil

```text
- Red cae durante push.
- Red cae durante upload de foto.
- Red alterna Wi-Fi/datos móviles.
- Wi-Fi sin Internet.
- API devuelve 500.
- Token expira durante sync.
- Timeout.
- DNS falla.
- API responde lento.
```

### 21.3 Pruebas de concurrencia

```text
- Dos técnicos editan la misma estación offline.
- Web cambia observación mientras móvil está offline.
- Supervisor desactiva catálogo usado por una inspección offline.
- Un técnico cierra offline mientras otro registra cambios.
- Reintento de la misma operation_id varias veces.
```

### 21.4 Pruebas de archivos

```text
- 20 fotos en una inspección.
- Foto grande de cámara.
- Falta de almacenamiento.
- Interrupción de compresión.
- Interrupción durante upload.
- Foto confirmada pero app muere antes de actualizar SQLite.
- Limpieza de cache sin borrar pendientes.
```

### 21.5 Pruebas de mapa

```text
- Plano real o representativo.
- 100 estaciones.
- Auras de los cinco niveles.
- Estaciones próximas e irradiación.
- Pan, zoom y tap.
- Sin Internet.
- Cambio de orientación/tamaño.
- Memoria estable tras abrir/cerrar planos.
```

### 21.6 Dispositivos reales

Probar al menos en:

```text
- Android de gama media/baja representativo de GAFER.
- Android con 4 GB RAM.
- Android con poco almacenamiento disponible.
- Tablet Android si se usará en campo.
- Diferentes versiones Android soportadas.
```

### 21.7 Pruebas adicionales de robustez [R2]

```text
- Cierre forzado (adb shell am force-stop) durante transacción, compresión y subida.
- Corte de energía real con escrituras recientes; verificar qué se conserva según 5.5.
- Sync con la app en segundo plano y con ahorro de batería activo.
- Cámara con "No conservar actividades" y memoria baja; recuperación del resultado pendiente.
- Plano real de alta resolución con 100 estaciones: memoria medida en el equipo de 4 GB.
- Motor de sync probado en Node (SQLite en memoria) con pruebas de propiedades: reintentos,
  reordenamientos, duplicados y caídas a mitad de lote.
- Cursor: transacciones concurrentes en backend que confirman fuera de orden; paginación;
  CURSOR_EXPIRED.
- Migración de esquema con datos pendientes reales.
- E2E con modo avión (Maestro o Detox).
```

---

## 22. Spike técnico y compuerta de decisión [R2]

### 22.1 Qué es y qué no es

Un spike es un prototipo desechable, de plazo fijo, cuyo único propósito es responder preguntas de riesgo con evidencia medida en dispositivos reales. No es la Fase 1 ni su primera versión. Su resultado es una decisión documentada, no una opinión.

Se ejecuta antes de comprometer la Fase 1. El código del spike se descarta, salvo el motor de sync y los contratos, que se conservan si superan las pruebas.

### 22.2 Preguntas que debe responder

```text
1. ¿Se pierde información con cierre forzado o corte de energía?
2. ¿El outbox es idempotente bajo reintentos, cortes y reordenamientos?
3. ¿La captura de fotos sobrevive a la muerte del proceso en el equipo de 4 GB?
4. ¿La subida de fotos es confiable (foreground y, si hace falta, background)?
5. ¿El mapa con 100 estaciones y un plano real es usable y estable en memoria?
6. ¿La app se mantiene estable (sin ANR ni cierre por memoria) en el equipo objetivo?
```

### 22.3 Alcance, plazo y equipo

```text
- Plazo: 2 a 3 semanas calendario, con fecha de decisión fijada de antemano.
- Equipo: 1-2 desarrolladores mobile + apoyo de backend para la API de prueba.
- Dispositivos: Android de gama media/baja representativo, uno con 4 GB de RAM y, si se usará
  en campo, una tablet.
- Versiones: Expo SDK 57 con el último patch.
```

### 22.4 Entregables

```text
1. SQLite local con migración inicial y configuración de 5.5.
2. Borrador de inspección offline con autoguardado.
3. Outbox durable e idempotente (con coalescencia y orden por agregado).
4. Simulación push/pull contra API de prueba, incluyendo cursor, paginación y CURSOR_EXPIRED.
5. Recuperación tras cerrar app y reiniciar el teléfono.
6. Captura, compresión y persistencia de foto, incluida la recuperación tras muerte del proceso.
7. Upload reintentable e idempotente de foto.
8. Firma local y subida.
9. Plano real con 100 estaciones usando Skia.
10. Pan, zoom, aura e interacción por tap.
11. Medición en dispositivo Android objetivo (memoria, tiempos, estabilidad).
12. Pantalla de estado de sync.
13. Sync en segundo plano (WorkManager) y su comportamiento con ahorro de batería.
14. Informe de resultados con tabla de criterios y cifras.
```

### 22.5 Criterios de éxito (todos obligatorios)

```text
- No se pierde información tras cierre forzado ni reinicio.
- No se duplican operaciones ni archivos tras reintentos.
- Los datos y archivos pendientes sobreviven reinicio y limpieza de caché.
- La UI responde sin esperar Internet.
- El mapa sigue usable (interacción fluida) con 100 estaciones.
- No hay ANR ni cierre por memoria en el dispositivo objetivo.
- El sync muestra resultados y errores claros.
```

### 22.6 Criterios de fallo (definidos antes de empezar)

Cualquiera de los siguientes, sin mitigación razonable dentro del plazo, activa la compuerta:

```text
- Pérdida de datos que la UI mostró como guardados, tras cierre forzado o reinicio.
- Duplicación de operaciones, fotos o eventos tras reintentos.
- Cierres por memoria o ANR en el equipo de 4 GB con un plano real y 20 fotos.
- Fotos pendientes perdidas o inaccesibles tras muerte del proceso o limpieza de caché.
- Subida de fotos que no completa de forma confiable bajo red hostil y sin alternativa viable.
- Mapa con interacción inutilizable con 100 estaciones en el equipo objetivo.
```

### 22.7 Compuerta de decisión

| Resultado | Condición | Acción |
|---|---|---|
| Aprobado | Todos los criterios de éxito y ningún fallo | Inicia Fase 1 en React Native |
| Aprobado con mitigaciones | Fallos menores con solución probada en el spike | Inicia Fase 1; las mitigaciones pasan a ser requisitos y tareas |
| Plan B parcial | Falla un área aislada (por ejemplo subida en segundo plano o cámara) | Módulo nativo Kotlin dentro de la app (Expo Module / WorkManager) para esa pieza; se repite la prueba de esa pieza; el resto sigue en RN |
| Plan C | Fallos en varias áreas o en el núcleo (durabilidad, memoria) sin mitigación | Migración a Android nativo (Room, WorkManager, CameraX). Se conservan backend, protocolo, contratos (generados desde OpenAPI) y la documentación del motor de sync; se descarta la UI de RN |

### 22.8 Cómo evitar un spike engañoso

```text
- Medir en dispositivo real, nunca solo en emulador.
- Usar datos realistas: plano real, 100 estaciones, 20 fotos de cámara real.
- Ejecutar los escenarios hostiles de la Sección 21, no solo el camino feliz.
- Registrar números (memoria, tiempos, conteos), no impresiones.
- Revisión cruzada de resultados: quien más quiere que pase no es quien lo califica.
```

### 22.9 Qué se conserva

Motor de sync (si pasa), contratos, esquema SQLite inicial, scripts de prueba y el informe. El resto se descarta.

---

## 23. Checklist de desarrollo

### Antes de desarrollar una feature

- [ ] ¿La feature funciona sin Internet?
- [ ] ¿Qué se guarda en SQLite?
- [ ] ¿Qué archivos se guardan en filesystem?
- [ ] ¿Qué operación se crea en outbox?
- [ ] ¿Cuál es su `operation_id`?
- [ ] ¿Qué `base_version` utiliza?
- [ ] ¿Qué pasa si se reintenta tres veces?
- [ ] ¿Qué pasa si otro usuario cambia lo mismo desde web?
- [ ] ¿Qué política de conflicto aplica?
- [ ] ¿Qué ocurre si la app muere a mitad de operación?
- [ ] ¿Qué se muestra al técnico?
- [ ] ¿Qué se registra en auditoría?
- [ ] ¿Qué datos deben ser snapshots?
- [ ] ¿Cómo se limpia almacenamiento local después?
- [ ] ¿El payload es PATCH con solo los campos cambiados, y qué pasa si la operación anterior del agregado falla? [R2]
- [ ] ¿Qué ocurre si la operación llega después del cierre de la inspección? [R2]

### Antes de aprobar un Pull Request mobile

- [ ] No existe dependencia obligatoria de HTTP para guardar.
- [ ] Toda mutación está en transacción SQLite + outbox.
- [ ] No se usan fotos Base64 como estado operativo.
- [ ] Los errores no descartan datos locales.
- [ ] Los archivos pendientes son persistentes.
- [ ] Hay manejo de reintento/idempotencia.
- [ ] La UI muestra estado pendiente/sincronizado/conflicto.
- [ ] Se evita render excesivo de mapas.
- [ ] Se preserva compatibilidad de contrato/protocolo.
- [ ] Hay pruebas de modo offline y recuperación.
- [ ] Las mutaciones usan transacción exclusiva y la configuración de 5.5. [R2]
- [ ] Las rutas guardadas son relativas y ningún archivo necesario offline está en cacheDirectory. [R2]
- [ ] Ninguna dependencia nativa nueva sin verificar compatibilidad con New Architecture. [R2]

---

## 24. Decisiones finales resumidas

```text
1. SQLite es la fuente de verdad de la UI móvil.
2. Todo cambio de campo se persiste localmente antes de mostrar éxito.
3. Toda mutación genera una operación durable en sync_outbox.
4. Fotos, firmas y planos viven en filesystem; SQLite conserva metadata.
5. Sync = push → resolver → pull → reconciliar; nunca reemplazo total.
6. Todo sync usa operation_id idempotente y base_version.
7. Conflictos se resuelven por entidad; no hay LWW global.
8. El servidor calcula y conserva resultados canónicos; móvil opera offline.
9. PDFs oficiales se generan únicamente en backend/worker.
10. El mapa usa canvas/Skia y coordenadas normalizadas.
11. Archivos pendientes nunca se borran; archivos confirmados se purgan localmente según retención.
12. El sistema descarga solo el subconjunto necesario para operar.
13. La sesión offline es limitada y los datos locales se protegen.
14. La app siempre muestra estado de sincronización claro.
15. El soporte necesita diagnósticos sanitizados.
16. Se debe validar todo mediante spike técnico y dispositivos reales antes de comprometer Fase 1.
17. El spike tiene criterios de fallo definidos de antemano y una compuerta de decisión (React Native, módulo nativo o Kotlin).
18. SQLite se configura para durabilidad real (WAL, synchronous, transacciones exclusivas) y MMKV nunca guarda datos críticos.
19. Nada necesario offline vive en cacheDirectory; las rutas locales son relativas.
20. El sync es foreground-first; el segundo plano es solo oportunista.
21. El cursor de pull es seguro frente a transacciones concurrentes y existe resincronización controlada.
22. Las decisiones de negocio pendientes (Anexo B) se cierran antes de Fase 1.
```

---

## 25. Frase guía para el equipo

> **La aplicación de campo debe poder perder Internet, cerrar, reiniciar y volver a abrirse sin que el técnico pierda una sola evidencia ni tenga que repetir su trabajo. La red sincroniza; SQLite protege; el servidor consolida; la auditoría explica.**


---

## Anexo A. Validación del stack (octubre 2026) [R2]

Verificado contra documentación y changelogs oficiales de Expo y repositorios de las librerías. Las versiones deben revisarse al iniciar el spike.

| Tema | Hallazgo | Fuente |
|---|---|---|
| New Architecture | Única arquitectura desde React Native 0.82 (octubre 2025) | Notas de React Native / Expo |
| Expo SDK vigente | SDK 57 (React Native 0.86.x); SDK 58 con React Native 0.88 en beta/estabilización | https://expo.dev/changelog/sdk-57 · https://expo.dev/changelog/sdk-58-beta |
| Regresión de memoria | Hermes V1 + Reanimated/worklets (SDK 56), corregida en expo 57.0.9 / 57.0.17 | https://expo.dev/changelog/sdk-57 |
| expo-sqlite | WAL documentado; SQLCipher vía `useSQLCipher`; transacciones exclusivas disponibles; advertencia sobre `withTransactionAsync` | https://docs.expo.dev/versions/latest/sdk/sqlite/ |
| op-sqlite | JSI, SQLCipher opcional; alternativa si el spike lo justifica | Repositorio de la librería |
| MMKV v4 | Módulo Nitro; requiere react-native-nitro-modules >= 0.35; cifrado AES-256 | https://github.com/margelo/react-native-mmkv/releases |
| Segundo plano | WorkManager, intervalo mínimo de 15 minutos, comportamiento variable por fabricante | https://docs.expo.dev/versions/latest/sdk/background-task.md |
| Cámara | Android puede destruir la actividad principal tras el selector; recuperar con getPendingResultAsync | Documentación de expo-image-picker |
| expo-file-system | API nueva predeterminada desde SDK 54; carencias cerradas en SDK 56 | Notas de Expo SDK 56 |

No verificado (se mide en el spike): benchmarks reales en equipos de gama baja, confiabilidad de la subida de archivos en segundo plano en Android, y compatibilidad de Skia con el SDK elegido en el dispositivo objetivo.

---

## Anexo B. Decisiones de negocio y arquitectura pendientes [R2]

| Id | Decisión | Recomendación inicial | Responsable |
|---|---|---|---|
| D-1 | Significado de "último dato ingresado" en estación compartida | Opción B (hora corregida) con C si hay diferencia relevante | Producto / Operaciones |
| D-2 | Tratamiento de operaciones posteriores al cierre | Registrar, marcar CONFLICT y escalar al Supervisor | Producto |
| D-3 | Qué archivos son obligatorios para cerrar | Firma obligatoria; fotos según tipo de servicio | Producto |
| D-4 | Cifrado local (SQLCipher y archivos) | SQLCipher + clave en Keystore | Arquitectura / Seguridad |
| D-5 | Procedimiento ante dispositivo revocado con pendientes | Entrega controlada, nunca borrado automático | Seguridad / Soporte |
| D-6 | Vigencia de sesión offline (24-72 h) | Definir con la política GAFER | Seguridad |
| D-7 | Ventanas de retención (ACKED, auditoría local, archivos confirmados) | 7-14 días para operaciones; gracia definida por negocio para archivos | Producto / Arquitectura |
