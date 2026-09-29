/**
 * @gafer/contracts — esquemas zod y tipos compartidos por web, servidor y app.
 *
 * Convención de versionado (compatible hacia atrás):
 * - Modelos de dominio (cliente, proyecto, servicio, catalogos, visita, inspeccion, documento):
 *   solo se agregan campos opcionales. Los objetos no son estrictos, así que un consumidor
 *   antiguo ignora los campos nuevos que envíe un servidor más reciente.
 * - Contratos de red con clientes instalados (la app en campo) van en un archivo con versión
 *   en el nombre, como `sync.v1.ts`. Un cambio incompatible crea `sync.v2.ts` junto al anterior,
 *   sin tocar el vigente, hasta que ninguna app lo use.
 * - Un campo obligatorio nuevo, quitar o renombrar un campo, o restringir un valor ya aceptado
 *   cuenta como cambio incompatible.
 */
export * from './comun';
export * from './cliente';
export * from './proyecto';
export * from './servicio';
export * from './catalogos';
export * from './almacenamiento';
export * from './estacion';
export * from './visita';
export * from './inspeccion';
export * from './documento';
export * from './sync.v1';
export * from './auth';
