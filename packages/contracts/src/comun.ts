import { z } from 'zod';

/** RUC peruano: exactamente 11 dígitos (Spec §7.1). */
export const RucSchema = z.string().regex(/^\d{11}$/, 'El RUC tiene 11 dígitos, sin letras ni espacios');

/** DNI peruano: exactamente 8 dígitos (Spec §7.6). */
export const DniSchema = z.string().regex(/^\d{8}$/, 'El DNI tiene 8 dígitos, sin letras ni espacios');

/** Fecha calendario AAAA-MM-DD; rechaza días inexistentes como 2027-02-29. */
export const FechaSchema = z.string().refine((valor) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const fecha = new Date(`${valor}T00:00:00Z`);
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().startsWith(valor);
}, 'La fecha debe tener el formato AAAA-MM-DD y existir en el calendario');

/** Hora HH:mm en formato de 24 horas. */
export const HoraSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'La hora debe tener el formato HH:mm');

/** Teléfono con dígitos y separadores habituales; al menos 6 dígitos. */
export const TelefonoSchema = z
  .string()
  .regex(/^[0-9 +()-]+$/, 'El teléfono solo admite dígitos y + ( ) -')
  .refine((valor) => valor.replace(/\D/g, '').length >= 6, 'El teléfono debe tener al menos 6 dígitos');
