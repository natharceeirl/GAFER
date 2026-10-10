import { useEffect, useState, type ChangeEvent } from 'react';
import { mensajeDeError } from '../../../shared/api/errores';
import { Button } from '../../../shared/ui/atoms/Button';
import { Campo, ariaError } from '../../../shared/ui/molecules/FormFields';
import { useAbrirPdf, useSubirPdf } from '../api/use-almacenamiento';
import { validarPdf, type CarpetaPdf } from '../model/validaciones';
import './campo-pdf.css';

interface Props {
  id: string;
  etiqueta: string;
  carpeta: CarpetaPdf;
  /** Clave del PDF ya guardado; vacía mientras no se haya subido uno. */
  clave: string;
  onCambiar: (clave: string) => void;
  /** Avisa al formulario cuándo hay una subida en curso, para que no se guarde a medias. */
  onSubiendoCambio?: (subiendo: boolean) => void;
  /** Error del formulario sobre este campo (falta el archivo, o lo rechazó el servidor). */
  error?: string;
}

/**
 * Campo de PDF de un insumo (ficha técnica o MSDS, decisión C14). Al elegir el archivo lo valida (tipo y tamaño),
 * lo sube de inmediato al almacenamiento y entrega la clave al formulario; si la subida falla se puede reintentar.
 */
export function CampoPdf({ id, etiqueta, carpeta, clave, onCambiar, onSubiendoCambio, error }: Props) {
  const subir = useSubirPdf();
  const abrir = useAbrirPdf();
  const [archivo, setArchivo] = useState<File | null>(null);
  const [subido, setSubido] = useState<string | null>(null);
  const [errorArchivo, setErrorArchivo] = useState<string | null>(null);

  useEffect(() => {
    onSubiendoCambio?.(subir.isPending);
  }, [subir.isPending, onSubiendoCambio]);

  function subirArchivo(elegido: File) {
    abrir.reset();
    subir.mutate(
      { archivo: elegido, carpeta },
      {
        onSuccess: (nuevaClave) => {
          setSubido(elegido.name);
          onCambiar(nuevaClave);
        },
      },
    );
  }

  function elegir(e: ChangeEvent<HTMLInputElement>) {
    const elegido = e.target.files?.[0];
    if (!elegido) return;
    subir.reset();
    const problema = validarPdf(elegido);
    setErrorArchivo(problema);
    if (problema) {
      setArchivo(null);
      return;
    }
    setArchivo(elegido);
    subirArchivo(elegido);
  }

  const estado = subir.isPending
    ? `Subiendo ${archivo?.name ?? 'el archivo'}…`
    : clave
      ? subido
        ? `Archivo cargado: ${subido}`
        : 'Archivo cargado.'
      : 'Sin archivo cargado.';
  const problema = errorArchivo ?? (subir.isError ? mensajeDeError(subir.error) : abrir.isError ? mensajeDeError(abrir.error) : null);

  return (
    <Campo id={id} label={etiqueta} error={error} ancho="completo">
      <input {...ariaError(id, error)} type="file" accept="application/pdf" onChange={elegir} disabled={subir.isPending} />
      <div className="mant-pdf">
        <span className="mant-pdf__estado" role="status">
          {estado}
        </span>
        {clave && !subir.isPending ? (
          <Button type="button" variant="secondary" onClick={() => abrir.mutate(clave)} disabled={abrir.isPending}>
            Ver PDF
          </Button>
        ) : null}
      </div>
      {problema ? (
        <div className="mant-pdf__error" role="alert">
          <span>{problema}</span>
          {subir.isError && archivo ? (
            <Button type="button" variant="secondary" onClick={() => subirArchivo(archivo)}>
              Reintentar
            </Button>
          ) : null}
        </div>
      ) : null}
    </Campo>
  );
}
