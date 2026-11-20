/**
 * GAFER Mobile — ColaSerial
 * Ejecuta tareas asíncronas de una en una, en el orden en que se encolan.
 *
 * Los adaptadores SQLite la usan para que todas las operaciones compartan una sola
 * conexión (con sus PRAGMA aplicados) sin que una transacción se intercale con
 * otra escritura. Un fallo en una tarea no detiene a las siguientes.
 */

export class ColaSerial {
  private cola: Promise<unknown> = Promise.resolve();

  ejecutar<T>(tarea: () => Promise<T>): Promise<T> {
    const resultado = this.cola.then(tarea, tarea);
    // La cadena interna nunca rechaza: el error se entrega solo a quien encoló la tarea.
    this.cola = resultado.then(
      () => undefined,
      () => undefined,
    );
    return resultado;
  }
}
