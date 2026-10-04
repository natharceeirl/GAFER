import { useEffect, useState } from 'react';
import { AltaFormLayout } from '../components/AltaForm';
import { Bloque, Campo, Opciones, ariaError } from '../../../shared/ui/molecules/FormFields';
import { ANTICIPACION_ALERTA_POR_DEFECTO } from '../model/cliente-mapper';
import { normalizarCodigo, validarCliente, type DatosCliente, type Errores } from '../model/validaciones';

interface Props {
  giros: string[];
  /** Con `inicial` el formulario edita la ficha: código corto y RUC quedan fijos (§2). */
  inicial?: DatosCliente;
  anticipacionInicial?: number;
  /** Operación en curso: se deshabilitan los botones. */
  enviando?: boolean;
  /** Errores por campo devueltos por el servidor (400/409). */
  erroresServidor?: Errores<keyof DatosCliente>;
  /** Error del servidor que no corresponde a un campo. */
  errorGeneral?: string | null;
  onRegistrar: (datos: DatosCliente, anticipacionAlertaDias: number) => void;
  onCancelar: () => void;
}

const ANTICIPACIONES = [15, 30, 45, 60, 90];
const SIN_ERRORES: Errores<keyof DatosCliente> = {};

const INICIAL: DatosCliente = {
  razonSocial: '',
  ruc: '',
  codigoCorto: '',
  direccionFiscal: '',
  giro: '',
  contactoNombre: '',
  contactoCargo: '',
  contactoTelefono: '',
  contactoCorreo: '',
  estado: 'ACTIVO',
};

/** Alta y edición de la ficha del cliente — spec §3 y §7.1. Solo el Administrador llega acá (§12). */
export function NuevoClientePage({
  giros,
  inicial,
  anticipacionInicial = ANTICIPACION_ALERTA_POR_DEFECTO,
  enviando = false,
  erroresServidor = SIN_ERRORES,
  errorGeneral = null,
  onRegistrar,
  onCancelar,
}: Props) {
  const edicion = inicial !== undefined;
  const [datos, setDatos] = useState<DatosCliente>(inicial ?? INICIAL);
  const [anticipacion, setAnticipacion] = useState(anticipacionInicial);
  const [intentado, setIntentado] = useState(false);

  /** Campos que se tocaron después del último error del servidor: su error ya no aplica. */
  const [corregidos, setCorregidos] = useState<Array<keyof DatosCliente>>([]);
  useEffect(() => setCorregidos([]), [erroresServidor]);

  const errores = validarCliente(datos, { edicion });
  const delServidor: Errores<keyof DatosCliente> = {};
  for (const campo of Object.keys(erroresServidor) as Array<keyof DatosCliente>) {
    if (!corregidos.includes(campo) && !(edicion && (campo === 'ruc' || campo === 'codigoCorto'))) delServidor[campo] = erroresServidor[campo];
  }
  const visibles = { ...(intentado ? errores : {}), ...delServidor };

  const girosOpciones = datos.giro !== '' && !giros.includes(datos.giro) ? [datos.giro, ...giros] : giros;
  const anticipaciones = ANTICIPACIONES.includes(anticipacion) ? ANTICIPACIONES : [...ANTICIPACIONES, anticipacion].sort((a, b) => a - b);

  function set<K extends keyof DatosCliente>(campo: K, valor: DatosCliente[K]) {
    setDatos((prev) => ({ ...prev, [campo]: valor }));
    setCorregidos((prev) => (prev.includes(campo) ? prev : [...prev, campo]));
  }

  function registrar() {
    setIntentado(true);
    if (enviando || Object.keys(errores).length > 0) return;
    onRegistrar(
      {
        ...datos,
        razonSocial: datos.razonSocial.trim(),
        direccionFiscal: datos.direccionFiscal.trim(),
        contactoCorreo: datos.contactoCorreo.trim(),
      },
      anticipacion,
    );
  }

  return (
    <AltaFormLayout
      code={edicion ? `FICHA DE CLIENTE · ${datos.codigoCorto} · §3` : 'ALTA DE CLIENTE · §7.1'}
      title={edicion ? 'Editar ficha del cliente' : 'Nuevo cliente'}
      meta={
        edicion
          ? 'Mantenimiento · solo Administrador · los documentos ya emitidos no cambian'
          : 'Mantenimiento · solo Administrador · el cliente queda listo para crearle sedes y servicios'
      }
      textoConfirmar={edicion ? 'Guardar ficha' : 'Registrar cliente'}
      cantidadErrores={Object.keys(errores).length}
      mostrarErrores={intentado}
      enviando={enviando}
      errorGeneral={errorGeneral}
      onSubmit={registrar}
      onCancelar={onCancelar}
    >
      <Bloque titulo="Datos de la empresa">
        <Campo id="cli-razon" label="Razón social" error={visibles.razonSocial} ancho="completo">
          <input
            {...ariaError('cli-razon', visibles.razonSocial)}
            type="text"
            value={datos.razonSocial}
            onChange={(e) => set('razonSocial', e.target.value)}
            placeholder="Molinos del Sur S.A.C."
            autoComplete="organization"
          />
        </Campo>
        <Campo
          id="cli-ruc"
          label="RUC"
          error={visibles.ruc}
          ayuda={
            edicion ? 'No se puede cambiar una vez registrado.' : '11 dígitos. Las personas naturales se registran como sede del cliente VARIOS.'
          }
        >
          <input
            {...ariaError('cli-ruc', visibles.ruc)}
            className="ff-campo__mono"
            type="text"
            inputMode="numeric"
            maxLength={11}
            disabled={edicion}
            value={datos.ruc}
            onChange={(e) => set('ruc', e.target.value.replace(/\D/g, ''))}
            placeholder="20611122233"
          />
        </Campo>
        <Campo
          id="cli-codigo"
          label="Código corto"
          error={visibles.codigoCorto}
          ayuda={
            edicion
              ? 'No se puede cambiar: arma la numeración de todos sus documentos.'
              : '4 a 10 caracteres en mayúsculas. Se usa en la numeración: INFORME-CÓDIGO-N°-AÑO.'
          }
        >
          <input
            {...ariaError('cli-codigo', visibles.codigoCorto)}
            className="ff-campo__mono"
            type="text"
            maxLength={10}
            disabled={edicion}
            value={datos.codigoCorto}
            onChange={(e) => set('codigoCorto', normalizarCodigo(e.target.value))}
            placeholder="MOLISUR"
          />
        </Campo>
        <Campo id="cli-direccion" label="Dirección fiscal" error={visibles.direccionFiscal} ancho="completo">
          <input
            {...ariaError('cli-direccion', visibles.direccionFiscal)}
            type="text"
            value={datos.direccionFiscal}
            onChange={(e) => set('direccionFiscal', e.target.value)}
            placeholder="Av. Ejército 101, Yanahuara, Arequipa"
          />
        </Campo>
        <Campo id="cli-giro" label="Giro del negocio" error={visibles.giro} ayuda="Se edita en Mantenimiento → Catálogos de texto.">
          <select {...ariaError('cli-giro', visibles.giro)} value={datos.giro} onChange={(e) => set('giro', e.target.value)}>
            <option value="">Seleccione un giro…</option>
            {girosOpciones.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </Campo>
        {edicion ? (
          <Opciones
            nombre="Estado"
            valor={datos.estado}
            opciones={[
              { valor: 'ACTIVO', etiqueta: 'Activo' },
              { valor: 'INACTIVO', etiqueta: 'Inactivo' },
            ]}
            onCambiar={(v) => set('estado', v)}
          />
        ) : null}
      </Bloque>

      <Bloque titulo="Contacto principal">
        <Campo id="cli-contacto-nombre" label="Nombre" error={visibles.contactoNombre}>
          <input
            {...ariaError('cli-contacto-nombre', visibles.contactoNombre)}
            type="text"
            value={datos.contactoNombre}
            onChange={(e) => set('contactoNombre', e.target.value)}
            placeholder="Carla Pinto"
          />
        </Campo>
        <Campo id="cli-contacto-cargo" label="Cargo" error={visibles.contactoCargo}>
          <input
            {...ariaError('cli-contacto-cargo', visibles.contactoCargo)}
            type="text"
            value={datos.contactoCargo}
            onChange={(e) => set('contactoCargo', e.target.value)}
            placeholder="Jefa de Calidad"
          />
        </Campo>
        <Campo id="cli-contacto-telefono" label="Teléfono" error={visibles.contactoTelefono}>
          <input
            {...ariaError('cli-contacto-telefono', visibles.contactoTelefono)}
            type="tel"
            value={datos.contactoTelefono}
            onChange={(e) => set('contactoTelefono', e.target.value)}
            placeholder="959 123 456"
          />
        </Campo>
        <Campo id="cli-contacto-correo" label="Correo" error={visibles.contactoCorreo}>
          <input
            {...ariaError('cli-contacto-correo', visibles.contactoCorreo)}
            type="email"
            value={datos.contactoCorreo}
            onChange={(e) => set('contactoCorreo', e.target.value)}
            placeholder="cpinto@molisur.pe"
          />
        </Campo>
      </Bloque>

      <Bloque titulo="Alertas de vencimiento">
        <Campo
          id="cli-anticipacion"
          label="Avisar el vencimiento del certificado con"
          ayuda="La alerta aparece en el expediente y en el Panel de control con esta anticipación."
        >
          <select id="cli-anticipacion" value={anticipacion} onChange={(e) => setAnticipacion(Number(e.target.value))}>
            {anticipaciones.map((d) => (
              <option key={d} value={d}>
                {d} días de anticipación
              </option>
            ))}
          </select>
        </Campo>
      </Bloque>
    </AltaFormLayout>
  );
}
