import { useEffect, useState } from 'react';
import { AltaFormLayout } from '../../cliente-expediente/components/AltaForm';
import type { Errores } from '../../cliente-expediente/model/validaciones';
import { Bloque, Campo, ariaError } from '../../../shared/ui/molecules/FormFields';
import { CARGOS_PERSONAL } from '../model/catalogos-etiquetas';
import type { DatosPersonal } from '../model/personal-mapper';
import { validarPersonal, type PersonalExistente } from '../model/validaciones';

interface Props {
  /** Con `inicial` el formulario edita una persona ya registrada. */
  inicial?: DatosPersonal;
  /** DNI y usuarios de las demás personas ya cargadas (en edición, sin la que se edita). */
  existentes?: PersonalExistente;
  /** Operación en curso: se deshabilitan los botones. */
  enviando?: boolean;
  /** Errores por campo devueltos por el servidor (400/409). */
  erroresServidor?: Errores<keyof DatosPersonal>;
  /** Error del servidor que no corresponde a un campo. */
  errorGeneral?: string | null;
  onRegistrar: (datos: DatosPersonal) => void;
  onCancelar: () => void;
}

const SIN_ERRORES: Errores<keyof DatosPersonal> = {};
const SIN_EXISTENTES: PersonalExistente = { dnis: [], usuarios: [] };

const INICIAL: DatosPersonal = { dni: '', nombres: '', apellidos: '', cargo: '', telefono: '', usuario: '' };

/**
 * Alta y edición de personal técnico y de supervisión — spec §7.6. La clave de acceso no se maneja aquí: el API
 * no tiene una operación para asignarla o cambiarla, así que la define el administrador del sistema.
 */
export function NuevoPersonalPage({ inicial, existentes = SIN_EXISTENTES, enviando = false, erroresServidor = SIN_ERRORES, errorGeneral = null, onRegistrar, onCancelar }: Props) {
  const edicion = inicial !== undefined;
  const [datos, setDatos] = useState<DatosPersonal>(inicial ?? INICIAL);
  const [intentado, setIntentado] = useState(false);

  /** Campos que se tocaron después del último error del servidor: su error ya no aplica. */
  const [corregidos, setCorregidos] = useState<Array<keyof DatosPersonal>>([]);
  useEffect(() => setCorregidos([]), [erroresServidor]);

  const errores = validarPersonal(datos, existentes);
  const delServidor: Errores<keyof DatosPersonal> = {};
  for (const campo of Object.keys(erroresServidor) as Array<keyof DatosPersonal>) {
    if (!corregidos.includes(campo)) delServidor[campo] = erroresServidor[campo];
  }
  const visibles = { ...(intentado ? errores : {}), ...delServidor };

  function set<K extends keyof DatosPersonal>(campo: K, valor: DatosPersonal[K]) {
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
      code={edicion ? `PERSONAL · DNI ${inicial.dni} · §7.6` : 'ALTA DE PERSONAL · §7.6'}
      title={edicion ? 'Editar persona' : 'Nueva persona'}
      meta={edicion ? `${inicial.nombres} ${inicial.apellidos}` : 'Personal técnico y de supervisión que usa el sistema'}
      textoConfirmar={edicion ? 'Guardar persona' : 'Registrar persona'}
      cantidadErrores={Object.keys(errores).length}
      mostrarErrores={intentado}
      enviando={enviando}
      errorGeneral={errorGeneral}
      onSubmit={registrar}
      onCancelar={onCancelar}
    >
      <Bloque titulo="Datos personales">
        <Campo id="per-dni" label="DNI" error={visibles.dni}>
          <input
            {...ariaError('per-dni', visibles.dni)}
            className="ff-campo__mono"
            type="text"
            inputMode="numeric"
            maxLength={8}
            value={datos.dni}
            onChange={(e) => set('dni', e.target.value.replace(/\D/g, ''))}
            placeholder="45892312"
          />
        </Campo>
        <Campo id="per-telefono" label="Teléfono" error={visibles.telefono}>
          <input {...ariaError('per-telefono', visibles.telefono)} type="tel" value={datos.telefono} onChange={(e) => set('telefono', e.target.value)} placeholder="958 123 456" />
        </Campo>
        <Campo id="per-nombres" label="Nombres" error={visibles.nombres}>
          <input {...ariaError('per-nombres', visibles.nombres)} type="text" value={datos.nombres} onChange={(e) => set('nombres', e.target.value)} placeholder="Marco Antonio" />
        </Campo>
        <Campo id="per-apellidos" label="Apellidos" error={visibles.apellidos}>
          <input {...ariaError('per-apellidos', visibles.apellidos)} type="text" value={datos.apellidos} onChange={(e) => set('apellidos', e.target.value)} placeholder="Ipusari Quispe" />
        </Campo>
      </Bloque>

      <Bloque titulo="Acceso al sistema">
        <Campo id="per-cargo" label="Cargo" error={visibles.cargo}>
          <select {...ariaError('per-cargo', visibles.cargo)} value={datos.cargo} onChange={(e) => set('cargo', e.target.value as DatosPersonal['cargo'])}>
            <option value="">Seleccione…</option>
            {CARGOS_PERSONAL.map((c) => (
              <option key={c.codigo} value={c.codigo}>
                {c.etiqueta}
              </option>
            ))}
          </select>
        </Campo>
        <Campo id="per-usuario" label="Usuario (opcional)" error={visibles.usuario} ayuda="Nombre con el que inicia sesión; no se repite entre personas.">
          <input {...ariaError('per-usuario', visibles.usuario)} className="ff-campo__mono" type="text" value={datos.usuario} onChange={(e) => set('usuario', e.target.value)} placeholder="m.ipusari" />
        </Campo>
        <p className="mant-nota ff-campo--completo">
          La clave de acceso no se define en esta pantalla. La asigna el administrador del sistema; mientras no tenga clave, la persona no puede iniciar sesión.
        </p>
      </Bloque>
    </AltaFormLayout>
  );
}
