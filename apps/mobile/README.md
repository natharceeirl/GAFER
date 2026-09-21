# GAFER Mobile — Aplicación de Campo (Android)

Aplicación móvil offline-first para técnicos operadores de GAFER Saneamiento Ambiental E.I.R.L. Desarrollada con **React Native** y **Expo (SDK 57)** sobre la Nueva Arquitectura.

---

## Arquitectura

- **Feature-Sliced Design (FSD):** Capas de `app/`, `features/` y `shared/`.
- **Contratos compartidos:** Consume esquemas Zod directamente desde `@gafer/contracts`.
- **Offline-First & Outbox:** Toda operación en campo se persiste localmente y se encola en `OutboxQueue` con `operation_id` único para sincronización idempotente con el backend.
- **Manejo de estado:** Zustand (`useBorradorStore`) para el borrador local sin sincronizar.

---

## Cómo ejecutar en desarrollo

### Requisitos previos
1. **Node.js** y **pnpm**.
2. **Java JDK 17**.
3. **Android Studio** con Android SDK y herramientas de plataforma (`adb`).

### 1. Iniciar servidor de desarrollo (Metro)
Desde la raíz del monorepo:
```bash
pnpm dev:mobile
# o dentro de apps/mobile:
pnpm start
```

### 2. Probar en un dispositivo Android físico (Recomendado)
1. Conecta tu celular por cable USB con la opción **Depuración por USB** activada en Opciones de Desarrollador.
2. Verifica que tu PC lo detecte:
   ```bash
   adb devices
   ```
3. Ejecuta la app en el dispositivo:
   ```bash
   pnpm android
   ```
   *Cualquier cambio de código en `src/` se reflejará inmediatamente en pantalla vía Fast Refresh sin reinstalar.*

### 3. Probar en Emulador de Android Studio
1. Abre tu AVD (Android Virtual Device) desde Android Studio.
2. Presiona la tecla `a` en la terminal de Metro o ejecuta `pnpm android`.
3. Para comunicarse con el backend local desde el emulador, utiliza `http://10.0.2.2:3000`.

---

## Tests
Para correr los tests unitarios de la app móvil:
```bash
pnpm --filter @gafer/mobile test
```
