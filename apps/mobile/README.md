# GAFER Mobile — Aplicación de Campo (Android)

Aplicación móvil offline-first para técnicos operadores de GAFER Saneamiento Ambiental E.I.R.L. Desarrollada con **React Native** y **Expo (SDK 57)** sobre la Nueva Arquitectura.

---

## Arquitectura

- **Feature-Sliced Design (FSD):** Capas de `features/` (`auth`, `agenda`, `operaciones`) y `shared/` (`api`, `storage`, `ui`).
- **Contratos compartidos:** Consume esquemas Zod directamente desde `@gafer/contracts`.
- **Offline-First & Outbox:** Toda operación en campo se persiste localmente y se encola en `OutboxQueue` con `operation_id` único para sincronización idempotente con el backend.
- **Manejo de estado:** Zustand (`useAuthStore`, `useAgendaStore`, `useBorradorStore`) para sesiones y borradores locales.

---

## Usuarios de ejemplo para pruebas locales

El repositorio **no guarda ninguna contraseña**. Los usuarios los crea el seed de datos de ejemplo (`pnpm db:seed:demo`, ver el README de la raíz), que genera una clave **aleatoria** para cada uno y la imprime **una sola vez** en la consola. Cópiala en ese momento; si la pierdes, regenérala con `pnpm db:seed:demo --regenerar-claves`.

| Usuario | Rol / Cargo | Dónde puede ingresar |
| :--- | :--- | :--- |
| `demo.tecnico1`, `demo.tecnico2`, `demo.tecnico3` | TECNICO_OPERADOR | Solo la app móvil (`cliente: 'mobile'`) |
| `demo.supervisor` | SUPERVISOR | Web y app móvil |
| `demo.admin` | ADMINISTRADOR | Web y app móvil |

Los nombres de usuario no distinguen mayúsculas, pero las claves sí.

> [!NOTE]
> Según la Decisión C10 / Spec §16, el rol `TECNICO_OPERADOR` solo tiene acceso autorizado a través de la app móvil; la web rechaza el inicio de sesión con 403 Forbidden.

---

## Cómo ejecutar en desarrollo

### Requisitos previos
1. **Node.js** y **pnpm**.
2. **Java JDK 17** (si compilas con Android Studio).
3. Backend levantado: `pnpm --filter @gafer/api start:dev`.

### 1. Iniciar servidor de desarrollo (Metro)
Desde la raíz del monorepo:
```bash
pnpm --filter @gafer/mobile start
```

### 2. Probar en un celular físico con Expo Go (Recomendado)
1. Instala **Expo Go** desde Google Play Store.
2. Conecta tu teléfono a la misma red Wi-Fi de tu computadora.
3. Asegúrate de que en `apps/mobile/.env` la variable `EXPO_PUBLIC_API_URL` apunte a la IP de tu PC en la red local (ejemplo: `http://192.168.18.205:3000`).
4. Escanea el código QR que muestra la terminal en Expo Go.

### 3. Probar en Emulador de Android Studio
1. Abre tu AVD (Android Virtual Device) desde Android Studio.
2. Presiona la tecla `a` en la terminal de Metro.
3. Para comunicarse con el backend local desde el emulador oficial de Android, la IP loopback es `http://10.0.2.2:3000`.

---

## Tests
Para correr los tests unitarios de la app móvil:
```bash
pnpm --filter @gafer/mobile test
```
Para verificación de tipos TypeScript:
```bash
pnpm --filter @gafer/mobile typecheck
```
