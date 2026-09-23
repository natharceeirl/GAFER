import type { FormEvent, ReactNode } from 'react';
import { TicketHeader } from '../../../shared/ui/molecules/TicketHeader';
import { Button } from '../../../shared/ui/atoms/Button';
import './alta-form.css';

interface AltaFormLayoutProps {
  code: string;
  title: string;
  meta: string;
  textoConfirmar: string;
  cantidadErrores: number;
  mostrarErrores: boolean;
  onSubmit: () => void;
  onCancelar: () => void;
  children: ReactNode;
}

/** Hoja de alta de Mantenimiento (§7): los errores recién aparecen al intentar registrar, no mientras se escribe. */
export function AltaFormLayout({
  code,
  title,
  meta,
  textoConfirmar,
  cantidadErrores,
  mostrarErrores,
  onSubmit,
  onCancelar,
  children,
}: AltaFormLayoutProps) {
  function enviar(e: FormEvent) {
    e.preventDefault();
    onSubmit();
  }

  return (
    <div className="alta-page">
      <TicketHeader
        code={code}
        title={title}
        meta={meta}
        action={
          <button type="button" className="alta-page__volver" onClick={onCancelar}>
            ← Volver sin guardar
          </button>
        }
      />
      <form className="alta-form" onSubmit={enviar} noValidate>
        {mostrarErrores && cantidadErrores > 0 ? (
          <p className="alta-form__resumen" role="alert">
            {cantidadErrores === 1 ? 'Hay 1 campo por corregir.' : `Hay ${cantidadErrores} campos por corregir.`} Están marcados abajo.
          </p>
        ) : null}
        {children}
        <div className="alta-form__acciones">
          <Button type="button" variant="secondary" onClick={onCancelar}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary">
            {textoConfirmar}
          </Button>
        </div>
      </form>
    </div>
  );
}

export function Bloque({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <fieldset className="alta-bloque">
      <legend>{titulo}</legend>
      <div className="alta-bloque__campos">{children}</div>
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
  const clases = ['alta-campo', error ? 'alta-campo--error' : '', ancho === 'completo' ? 'alta-campo--completo' : '']
    .filter(Boolean)
    .join(' ');
  return (
    <div className={clases}>
      <label htmlFor={id}>{label}</label>
      {children}
      {error ? (
        <span className="alta-campo__error" id={`${id}-error`}>
          {error}
        </span>
      ) : ayuda ? (
        <span className="alta-campo__ayuda">{ayuda}</span>
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
}

export function Opciones<T extends string | boolean>({ nombre, valor, opciones, onCambiar, error }: OpcionesProps<T>) {
  return (
    <div className={error ? 'alta-campo alta-campo--error' : 'alta-campo'}>
      <span className="alta-campo__label" id={`${nombre}-label`}>
        {nombre}
      </span>
      <div className="alta-opciones" role="radiogroup" aria-labelledby={`${nombre}-label`}>
        {opciones.map((o) => (
          <button
            key={String(o.valor)}
            type="button"
            role="radio"
            aria-checked={valor === o.valor}
            className={valor === o.valor ? 'alta-opcion alta-opcion--activa' : 'alta-opcion'}
            onClick={() => onCambiar(o.valor)}
          >
            {o.etiqueta}
          </button>
        ))}
      </div>
      {error ? <span className="alta-campo__error">{error}</span> : null}
    </div>
  );
}
