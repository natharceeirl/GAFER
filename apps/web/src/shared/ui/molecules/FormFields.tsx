import type { ReactNode } from 'react';
import './form-fields.css';

interface BloqueProps {
  titulo: string;
  error?: string;
  children: ReactNode;
}

/** Compartimento de formulario: un bloque de datos con su propio título, como una sección de la planilla en papel. */
export function Bloque({ titulo, error, children }: BloqueProps) {
  return (
    <fieldset className={error ? 'ff-bloque ff-bloque--error' : 'ff-bloque'}>
      <legend>{titulo}</legend>
      <div className="ff-bloque__campos">
        {error ? (
          <p className="ff-bloque__error" role="alert">
            {error}
          </p>
        ) : null}
        {children}
      </div>
    </fieldset>
  );
}

interface CampoProps {
  id: string;
  label: string;
  error?: string;
  ayuda?: string;
  ancho?: 'completo';
  children: ReactNode;
}

export function Campo({ id, label, error, ayuda, ancho, children }: CampoProps) {
  const clases = ['ff-campo', error ? 'ff-campo--error' : '', ancho === 'completo' ? 'ff-campo--completo' : '']
    .filter(Boolean)
    .join(' ');
  return (
    <div className={clases}>
      <label htmlFor={id}>{label}</label>
      {children}
      {error ? (
        <span className="ff-campo__error" id={`${id}-error`}>
          {error}
        </span>
      ) : ayuda ? (
        <span className="ff-campo__ayuda">{ayuda}</span>
      ) : null}
    </div>
  );
}

/** Props de accesibilidad para el control dentro de un Campo con error. */
export function ariaError(id: string, error?: string) {
  return { id, 'aria-invalid': error ? true : undefined, 'aria-describedby': error ? `${id}-error` : undefined };
}

interface OpcionesProps<T extends string | boolean> {
  nombre: string;
  valor: T | null;
  opciones: Array<{ valor: T; etiqueta: string }>;
  onCambiar: (valor: T) => void;
  error?: string;
  ancho?: 'completo';
}

/** Elección única entre pocas opciones, con botones grandes para usar con guantes (44px). */
export function Opciones<T extends string | boolean>({ nombre, valor, opciones, onCambiar, error, ancho }: OpcionesProps<T>) {
  const id = `op-${nombre.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const clases = ['ff-campo', error ? 'ff-campo--error' : '', ancho === 'completo' ? 'ff-campo--completo' : '']
    .filter(Boolean)
    .join(' ');
  return (
    <div className={clases}>
      <span className="ff-campo__label" id={`${id}-label`}>
        {nombre}
      </span>
      <div className="ff-opciones" role="radiogroup" aria-labelledby={`${id}-label`}>
        {opciones.map((o) => (
          <button
            key={String(o.valor)}
            type="button"
            role="radio"
            aria-checked={valor === o.valor}
            className={valor === o.valor ? 'ff-opcion ff-opcion--activa' : 'ff-opcion'}
            onClick={() => onCambiar(o.valor)}
          >
            {o.etiqueta}
          </button>
        ))}
      </div>
      {error ? <span className="ff-campo__error">{error}</span> : null}
    </div>
  );
}

interface ChipsProps {
  etiqueta: string;
  opciones: string[];
  seleccion: string[];
  onCambiar: (seleccion: string[]) => void;
  ayuda?: string;
}

/** Selección múltiple desde un catálogo editable (§7.7): el técnico toca, no escribe. */
export function Chips({ etiqueta, opciones, seleccion, onCambiar, ayuda }: ChipsProps) {
  function alternar(o: string) {
    onCambiar(seleccion.includes(o) ? seleccion.filter((s) => s !== o) : [...seleccion, o]);
  }
  return (
    <div className="ff-campo ff-campo--completo">
      <span className="ff-campo__label">{etiqueta}</span>
      <div className="ff-chips" role="group" aria-label={etiqueta}>
        {opciones.map((o) => (
          <button key={o} type="button" className="ff-chip" aria-pressed={seleccion.includes(o)} onClick={() => alternar(o)}>
            {o}
          </button>
        ))}
      </div>
      {ayuda ? <span className="ff-campo__ayuda">{ayuda}</span> : null}
    </div>
  );
}
