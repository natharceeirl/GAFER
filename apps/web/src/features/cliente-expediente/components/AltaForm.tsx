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
  /** Con una operación en curso los botones quedan deshabilitados. */
  enviando?: boolean;
  /** Error que no corresponde a un campo (red caída, permisos, etc.). */
  errorGeneral?: string | null;
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
  enviando = false,
  errorGeneral = null,
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
          <button type="button" className="alta-page__volver" onClick={onCancelar} disabled={enviando}>
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
        {errorGeneral ? (
          <p className="alta-form__resumen" role="alert">
            {errorGeneral}
          </p>
        ) : null}
        {children}
        <div className="alta-form__acciones">
          <Button type="button" variant="secondary" onClick={onCancelar} disabled={enviando}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={enviando}>
            {enviando ? 'Guardando…' : textoConfirmar}
          </Button>
        </div>
      </form>
    </div>
  );
}
