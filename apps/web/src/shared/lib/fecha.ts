const dos = (n: number) => String(n).padStart(2, '0');

/** Fecha local YYYY-MM-DD, desplazada en días si se indica. */
export function fechaLocal(desplazamientoDias = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + desplazamientoDias);
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}

/** Fecha y hora local "YYYY-MM-DD HH:MM", el formato del log de auditoría. */
export function ahora(): string {
  const d = new Date();
  return `${fechaLocal()} ${dos(d.getHours())}:${dos(d.getMinutes())}`;
}
