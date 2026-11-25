/** Fecha de hoy (AAAA-MM-DD) en Lima, la zona de operación de GAFER, para comparar con fechas programadas. */
export function fechaHoyLima(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).format(ahora);
}
