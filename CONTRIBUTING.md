# Guía de Contribución y Estándares de Ingeniería — GAFER

Bienvenido al repositorio central de **GAFER Saneamiento Ambiental**. Este documento establece las normas operativas, convenciones de código, flujo de ramas y criterios de calidad obligatorios para todos los miembros del equipo de ingeniería.

---

## 1. Distribución del Equipo y Responsabilidades

| Integrante | Rol Oficial | Ámbito de Trabajo | Entregables Principales |
|---|---|---|---|
| **Ivan** | Líder / Full Stack | `packages/contracts`, `apps/web`, `apps/mobile` | Contratos Zod canónicos, UI/UX Backoffice en React FSD, App móvil Expo FSD. |
| **Cristian** | Backend & Database / Integraciones | `apps/api`, `apps/worker`, `infra` | Modelo relacional PostgreSQL, endpoints NestJS Hexagonal, Worker BullMQ, MinIO S3. |
| **Andre** | QA / Testing | `tests/`, suites E2E, pipelines | Tests de integración (Supertest), validación de inmutabilidad (Sección 13), reportes de calidad. |

---

## 2. Flujo de Desarrollo Dirigido por Especificación (OpenSpec / SDD)

Todo desarrollo sigue estrictamente el estándar de **Spec-Driven Development (SDD)**:

1. **Fuente de Verdad**: Ninguna funcionalidad se programa sin estar especificada en `openspec/changes/<fase>/`.
2. **Asignación de Tareas**: Antes de programar, verificar en `tasks.md` la tarea asignada con su ID respectivo (ej. `T2.1`).
3. **Validación de Criterios**: Cada tarea tiene un **Definition of Done (DoD)** y escenarios **GIVEN/WHEN/THEN** en `specs/` que deben ser cubiertos por pruebas antes de solicitar revisión.
4. **Cierre de Tareas**: Al completar una tarea y mergear su PR, se marca la casilla correspondiente en `tasks.md` (`- [x]`).

---

## 3. Convención de Ramas (Git Branching)

La rama `main` está protegida y siempre refleja código estable y desplegable. **Está estrictamente prohibido hacer commits directos a `main`**.

### Estructura de nombres de rama
```text
<tipo>/<modulo-o-fase>-<descripcion-corta>
```

- **Tipos de rama**:
  - `feat/`: Nueva funcionalidad o módulo (ej. `feat/mantenimiento-db-init`, `feat/web-clientes-crud`).
  - `fix/`: Corrección de un error detectado (ej. `fix/api-ruc-validator`).
  - `test/`: Creación o ampliación de suites de prueba (ej. `test/inmutabilidad-seccion-13`).
  - `docs/`: Documentación técnica o actualización de specs (ej. `docs/openspec-phase-1`).
  - `refactor/`: Mejoras internas de código sin alterar comportamiento externo.

---

## 4. Convención de Commits (Conventional Commits)

Cada commit debe describir con precisión el cambio realizado. Esto permite generar **reportes de avance auditables** mediante el historial de Git.

### Formato
```text
<tipo>(<alcance>): <descripción corta en minúsculas y modo imperativo>
```

- **Tipos permitidos**:
  - `feat`: Nueva característica añadida.
  - `fix`: Corrección de un bug.
  - `test`: Adición o modificación de pruebas unitarias o de integración.
  - `docs`: Cambios en documentación o especificaciones.
  - `refactor`: Refactorización de código sin cambio de comportamiento.
  - `chore`: Mantenimiento de dependencias, scripts o configuración de build.

- **Alcances oficiales (`scope`)**:
  - `contracts`: Cambios en `@gafer/contracts`.
  - `api`: Cambios en el backend NestJS (`apps/api`).
  - `worker`: Cambios en tareas en segundo plano (`apps/worker`).
  - `web`: Cambios en el backoffice React (`apps/web`).
  - `mobile`: Cambios en la aplicación móvil Expo (`apps/mobile`).
  - `infra`: Cambios en Docker, PostgreSQL, MinIO o Redis (`infra/`).
  - `sdd`: Cambios en especificaciones o diseño en `openspec/`.

### Ejemplos válidos
- `feat(api): implement client creation endpoint with zod validation`
- `test(infra): verify postgresql initial migration down and up scripts`
- `docs(sdd): update operations spec with monotonic server timestamp`

---

## 5. Ciclo de Pull Requests y Revisión de Código

1. **Creación del PR**:
   - Título claro siguiendo Conventional Commits (ej. `feat(api): postgresql schema for maintenance module`).
   - Descripción vinculando la tarea de OpenSpec: `Resuelve T2.1 en openspec/changes/fase-1-mantenimiento/tasks.md`.
2. **Verificación Automatizada**:
   - El comando `pnpm test` debe ejecutarse y pasar al 100% (todas las pruebas del monorepo en verde).
3. **Aprobación de Pares (Peer Review)**:
   - Todo PR requiere la aprobación de al menos **un revisor**:
     - Cambios en Backend/DB: Revisados por Ivan o Andre.
     - Cambios en Frontend/Mobile: Revisados por Cristian o Andre.
     - Pruebas y Reportes: Revisados por Ivan o Cristian.
4. **Estrategia de Integración**:
   - Se utiliza **Squash and Merge** o **Rebase** para mantener una historia de `main` limpia y lineal.

---

## 6. Definition of Done (DoD) Contractual

Una tarea solo se considera **Terminada** cuando cumple:

1. **Código y Tipado**: Compilación limpia en TypeScript (`pnpm build`) sin advertencias de tipos (`any` no justificado prohibido).
2. **Pruebas (TDD)**: Pruebas unitarias o de integración escritas y pasando.
3. **Inmutabilidad (Sección 13)**: Ningún cambio en catálogos debe poder mutar registros históricos.
4. **Clean Code & Arquitectura**:
   - Backend respeta Hexagonal + Screaming Architecture.
   - Frontend/Mobile respeta Feature-Sliced Design (FSD).
   - Variables de entorno cargadas con Twelve-Factor App (prohibido traversal relativo `../../.env`).

---

## 7. Políticas de Seguridad e Higiene del Repositorio

- **Prohibido subir secretos**: Archivos `.env`, credenciales de base de datos o claves privadas jamás se commitean. Utilizar `.env.example`.
- **Sin hacks temporales**: Todo código debe estar preparado para entorno real de producción con tipado estricto y manejo formal de excepciones.
