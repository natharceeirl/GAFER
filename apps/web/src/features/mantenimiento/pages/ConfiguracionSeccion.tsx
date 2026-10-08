import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import type { ConfiguracionSistema } from '@gafer/contracts';
import { Button } from '../../../shared/ui/atoms/Button';
import { Bloque, Campo, ariaError } from '../../../shared/ui/molecules/FormFields';
import { EstadoCargando } from '../../cliente-expediente/components/EstadoConsulta';
import type { Errores } from '../../cliente-expediente/model/validaciones';
import { useActualizarConfiguracion, useConfiguracionSistema } from '../api/use-configuracion';
import { ErrorLectura } from '../components/ErrorLectura';
import { camposDeErrorConfiguracion, datosDeConfiguracion, type DatosConfiguracion } from '../model/configuracion-mapper';
import { validarConfiguracion, validarFirma } from '../model/validaciones';

const NOTA_ANEXOS =
  'Anexos del PDF: la ficha técnica y la MSDS de cada insumo se adjuntan solas cuando el insumo se consume, junto con la Resolución de licencia sanitaria de GAFER.';

interface FormularioProps {
  configuracion: ConfiguracionSistema;
}

/**
 * Director Técnico (decisión C7): se carga una sola vez y el sistema estampa su firma y CIP en cada PDF al
 * aprobarse, sin un cuarto usuario. Incluye la resolución sanitaria que se anexa a los documentos.
 */
function FormularioConfiguracion({ configuracion }: FormularioProps) {
  const guardar = useActualizarConfiguracion();
  const [datos, setDatos] = useState<DatosConfiguracion>(() => datosDeConfiguracion(configuracion));
  const [intentado, setIntentado] = useState(false);
  const [errorFirma, setErrorFirma] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  /** Campos que se tocaron después del último error del servidor: su error ya no aplica. */
  const [corregidos, setCorregidos] = useState<Array<keyof DatosConfiguracion>>([]);
  const errorServidor = guardar.error ? camposDeErrorConfiguracion(guardar.error) : null;
  useEffect(() => setCorregidos([]), [guardar.error]);

  const errores = validarConfiguracion(datos);
  const delServidor: Errores<keyof DatosConfiguracion> = {};
  for (const campo of Object.keys(errorServidor?.campos ?? {}) as Array<keyof DatosConfiguracion>) {
    if (!corregidos.includes(campo)) delServidor[campo] = errorServidor?.campos[campo];
  }
  const visibles = { ...(intentado ? errores : {}), ...delServidor };

  function set<K extends keyof DatosConfiguracion>(campo: K, valor: DatosConfiguracion[K]) {
    setDatos((prev) => ({ ...prev, [campo]: valor }));
    setCorregidos((prev) => (prev.includes(campo) ? prev : [...prev, campo]));
    setAviso(null);
  }

  function cargarFirma(e: ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    const problema = validarFirma(archivo);
    setErrorFirma(problema);
    if (problema) return;
    const lector = new FileReader();
    lector.onload = () => set('directorFirma', typeof lector.result === 'string' ? lector.result : null);
    lector.readAsDataURL(archivo);
  }

  function enviar(e: FormEvent) {
    e.preventDefault();
    setIntentado(true);
    if (guardar.isPending || Object.keys(errores).length > 0) return;
    guardar.mutate(datos, { onSuccess: () => setAviso('Configuración actualizada. El Director Técnico se estampará en los próximos documentos que se aprueben.') });
  }

  return (
    <form className="mant-director" onSubmit={enviar} noValidate>
      {aviso ? (
        <p className="mant-aviso mant-aviso--ok" role="status">
          {aviso}
        </p>
      ) : null}
      {errorServidor?.general ? (
        <p className="mant-aviso mant-aviso--error" role="alert">
          {errorServidor.general}
        </p>
      ) : null}
      <Bloque titulo="Firma estampada en los PDF">
        <Campo id="dir-nombre" label="Nombre completo" error={visibles.directorNombre}>
          <input {...ariaError('dir-nombre', visibles.directorNombre)} type="text" value={datos.directorNombre} onChange={(e) => set('directorNombre', e.target.value)} placeholder="Ing. Carlos Medina Ruiz" />
        </Campo>
        <Campo id="dir-cip" label="N° de CIP" error={visibles.directorCip} ayuda="Colegio de Ingenieros del Perú, solo números.">
          <input
            {...ariaError('dir-cip', visibles.directorCip)}
            type="text"
            inputMode="numeric"
            className="ff-campo__mono"
            value={datos.directorCip}
            onChange={(e) => set('directorCip', e.target.value.replace(/\D/g, ''))}
            placeholder="84512"
          />
        </Campo>
        <Campo id="dir-firma" label="Firma gráfica" error={errorFirma ?? visibles.directorFirma} ayuda="Imagen PNG o JPG con fondo claro, de hasta 1 MB." ancho="completo">
          <input id="dir-firma" type="file" accept="image/png,image/jpeg" onChange={cargarFirma} />
        </Campo>
        {datos.directorFirma ? (
          <div className="ff-campo--completo">
            <img className="mant-director__firma" src={datos.directorFirma} alt="Firma cargada del Director Técnico" />
            <Button type="button" variant="secondary" onClick={() => set('directorFirma', null)}>
              Quitar firma
            </Button>
          </div>
        ) : null}
      </Bloque>
      <Bloque titulo="Resolución sanitaria">
        <Campo id="dir-resolucion" label="Resolución sanitaria de GAFER" error={visibles.resolucionSanitaria} ancho="completo">
          <input {...ariaError('dir-resolucion', visibles.resolucionSanitaria)} type="text" value={datos.resolucionSanitaria} onChange={(e) => set('resolucionSanitaria', e.target.value)} placeholder="0023-2024-DESA/MINSA" />
        </Campo>
      </Bloque>
      <p className="mant-director__nota">{NOTA_ANEXOS}</p>
      <div className="mant-director__acciones">
        <Button type="submit" variant="primary" disabled={guardar.isPending}>
          {guardar.isPending ? 'Guardando…' : 'Guardar configuración'}
        </Button>
      </div>
    </form>
  );
}

/** Vista de solo lectura del Supervisor: ve lo que se estampa en los PDF, pero no lo modifica. */
function VistaConfiguracion({ configuracion }: FormularioProps) {
  const datos = datosDeConfiguracion(configuracion);
  return (
    <div className="mant-director">
      <p className="mant-nota">Solo el Administrador puede modificarla.</p>
      <Bloque titulo="Firma estampada en los PDF">
        <dl className="mant-lectura">
          <dt>Nombre completo</dt>
          <dd>{datos.directorNombre || '—'}</dd>
          <dt>N° de CIP</dt>
          <dd className="mant-tabla__mono">{datos.directorCip || '—'}</dd>
          <dt>Resolución sanitaria de GAFER</dt>
          <dd>{datos.resolucionSanitaria}</dd>
        </dl>
        {datos.directorFirma ? <img className="mant-director__firma ff-campo--completo" src={datos.directorFirma} alt="Firma del Director Técnico" /> : null}
      </Bloque>
      <p className="mant-director__nota">{NOTA_ANEXOS}</p>
    </div>
  );
}

interface Props {
  /** El Supervisor lee la configuración pero no la modifica. */
  soloLectura?: boolean;
}

export function ConfiguracionSeccion({ soloLectura = false }: Props) {
  const configuracion = useConfiguracionSistema();

  if (configuracion.isPending) return <EstadoCargando mensaje="Cargando configuración…" />;
  if (configuracion.isError) return <ErrorLectura error={configuracion.error} recurso="la configuración" onReintentar={() => void configuracion.refetch()} />;

  return soloLectura ? <VistaConfiguracion configuracion={configuracion.data} /> : <FormularioConfiguracion configuracion={configuracion.data} />;
}
