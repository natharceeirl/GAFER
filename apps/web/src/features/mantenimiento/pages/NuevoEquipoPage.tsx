import { useEffect, useState } from 'react';
import { AltaFormLayout } from '../../cliente-expediente/components/AltaForm';
import type { Errores } from '../../cliente-expediente/model/validaciones';
import { Bloque, Campo, ariaError } from '../../../shared/ui/molecules/FormFields';
import { TIPOS_EQUIPO } from '../model/catalogos-etiquetas';
import type { DatosEquipo } from '../model/equipo-mapper';
import { validarEquipo } from '../model/validaciones';

interface Props {
  /** Con `inicial` el formulario edita un equipo ya registrado. */
  inicial?: DatosEquipo;
  /** Operación en curso: se deshabilitan los botones. */
  enviando?: boolean;
  /** Errores por campo devueltos por el servidor (400/409). */
  erroresServidor?: Errores<keyof DatosEquipo>;
  /** Error del servidor que no corresponde a un campo. */
  errorGeneral?: string | null;
  onRegistrar: (datos: DatosEquipo) => void;
  onCancelar: () => void;
}

const SIN_ERRORES: Errores<keyof DatosEquipo> = {};

const INICIAL: DatosEquipo = {
  codigoInterno: '',
  nombre: '',
  tipo: '',
  marcaModelo: '',
  fechaAdquisicion: '',
  ultimoMantenimiento: '',
  proximoMantenimiento: '',
};

/**
 * Alta y edición de equipo operativo — spec §7.5. El equipo nace operativo; su estado (en mantenimiento, fuera
 * de servicio) se cambia desde la lista, porque un equipo fuera de servicio no se puede asignar a un servicio.
 */
export function NuevoEquipoPage({ inicial, enviando = false, erroresServidor = SIN_ERRORES, errorGeneral = null, onRegistrar, onCancelar }: Props) {
  const edicion = inicial !== undefined;
  const [datos, setDatos] = useState<DatosEquipo>(inicial ?? INICIAL);
  const [intentado, setIntentado] = useState(false);

  /** Campos que se tocaron después del último error del servidor: su error ya no aplica. */
  const [corregidos, setCorregidos] = useState<Array<keyof DatosEquipo>>([]);
  useEffect(() => setCorregidos([]), [erroresServidor]);

  const errores = validarEquipo(datos);
  const delServidor: Errores<keyof DatosEquipo> = {};
  for (const campo of Object.keys(erroresServidor) as Array<keyof DatosEquipo>) {
    if (!corregidos.includes(campo)) delServidor[campo] = erroresServidor[campo];
  }
  const visibles = { ...(intentado ? errores : {}), ...delServidor };

  function set<K extends keyof DatosEquipo>(campo: K, valor: DatosEquipo[K]) {
    setDatos((prev) => ({ ...prev, [campo]: valor }));
    setCorregidos((prev) => (prev.includes(campo) ? prev : [...prev, campo]));
  }

  function registrar() {
    setIntentado(true);
    if (enviando || Object.keys(errores).length > 0) return;
    onRegistrar(datos);
  }

  return (
    <AltaFormLayout
      code={edicion ? `EQUIPO · ${inicial.codigoInterno} · §7.5` : 'ALTA DE EQUIPO · §7.5'}
      title={edicion ? 'Editar equipo' : 'Nuevo equipo'}
      meta={edicion ? inicial.nombre : 'Equipo operativo del catálogo; se asigna a los servicios contratados'}
      textoConfirmar={edicion ? 'Guardar equipo' : 'Registrar equipo'}
      cantidadErrores={Object.keys(errores).length}
      mostrarErrores={intentado}
      enviando={enviando}
      errorGeneral={errorGeneral}
      onSubmit={registrar}
      onCancelar={onCancelar}
    >
      <Bloque titulo="Equipo">
        <Campo id="eq-codigo" label="Código interno" error={visibles.codigoInterno} ayuda="Código único de GAFER (ej. EQ-NEB-01).">
          <input
            {...ariaError('eq-codigo', visibles.codigoInterno)}
            className="ff-campo__mono"
            type="text"
            value={datos.codigoInterno}
            onChange={(e) => set('codigoInterno', e.target.value.toUpperCase())}
            placeholder="EQ-022"
          />
        </Campo>
        <Campo id="eq-tipo" label="Tipo de equipo" error={visibles.tipo}>
          <select {...ariaError('eq-tipo', visibles.tipo)} value={datos.tipo} onChange={(e) => set('tipo', e.target.value as DatosEquipo['tipo'])}>
            <option value="">Seleccione…</option>
            {TIPOS_EQUIPO.map((t) => (
              <option key={t.codigo} value={t.codigo}>
                {t.etiqueta}
              </option>
            ))}
          </select>
        </Campo>
        <Campo id="eq-nombre" label="Nombre del equipo" error={visibles.nombre} ancho="completo">
          <input
            {...ariaError('eq-nombre', visibles.nombre)}
            type="text"
            value={datos.nombre}
            onChange={(e) => set('nombre', e.target.value)}
            placeholder="Aspersora de mochila 20L"
          />
        </Campo>
        <Campo id="eq-marca" label="Marca y modelo (opcional)" error={visibles.marcaModelo} ancho="completo">
          <input
            {...ariaError('eq-marca', visibles.marcaModelo)}
            type="text"
            value={datos.marcaModelo}
            onChange={(e) => set('marcaModelo', e.target.value)}
            placeholder="Jacto XP-20"
          />
        </Campo>
      </Bloque>

      <Bloque titulo="Fechas">
        <Campo id="eq-adquisicion" label="Fecha de adquisición (opcional)" error={visibles.fechaAdquisicion}>
          <input
            {...ariaError('eq-adquisicion', visibles.fechaAdquisicion)}
            type="date"
            value={datos.fechaAdquisicion}
            onChange={(e) => set('fechaAdquisicion', e.target.value)}
          />
        </Campo>
        <Campo id="eq-ultimo" label="Último mantenimiento (opcional)" error={visibles.ultimoMantenimiento}>
          <input
            {...ariaError('eq-ultimo', visibles.ultimoMantenimiento)}
            type="date"
            value={datos.ultimoMantenimiento}
            onChange={(e) => set('ultimoMantenimiento', e.target.value)}
          />
        </Campo>
        <Campo id="eq-proximo" label="Próximo mantenimiento (opcional)" error={visibles.proximoMantenimiento}>
          <input
            {...ariaError('eq-proximo', visibles.proximoMantenimiento)}
            type="date"
            value={datos.proximoMantenimiento}
            onChange={(e) => set('proximoMantenimiento', e.target.value)}
          />
        </Campo>
      </Bloque>
    </AltaFormLayout>
  );
}
