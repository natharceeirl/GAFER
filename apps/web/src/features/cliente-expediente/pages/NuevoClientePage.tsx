import { useState } from 'react';
import { AltaFormLayout, Bloque, Campo, Opciones, ariaError } from '../components/AltaForm';
import { normalizarCodigo, validarCliente, type DatosCliente } from '../model/validaciones';

interface Props {
  giros: string[];
  codigosExistentes: string[];
  rucsExistentes: string[];
  onRegistrar: (datos: DatosCliente) => void;
  onCancelar: () => void;
}

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

/** Alta de cliente — spec §7.1. Solo el Administrador llega acá (§12). */
export function NuevoClientePage({ giros, codigosExistentes, rucsExistentes, onRegistrar, onCancelar }: Props) {
  const [datos, setDatos] = useState<DatosCliente>(INICIAL);
  const [intentado, setIntentado] = useState(false);

  const errores = validarCliente(datos, { codigos: codigosExistentes, rucs: rucsExistentes });
  const visibles = intentado ? errores : {};

  function set<K extends keyof DatosCliente>(campo: K, valor: DatosCliente[K]) {
    setDatos((prev) => ({ ...prev, [campo]: valor }));
  }

  function registrar() {
    setIntentado(true);
    if (Object.keys(errores).length > 0) return;
    onRegistrar({
      ...datos,
      razonSocial: datos.razonSocial.trim(),
      direccionFiscal: datos.direccionFiscal.trim(),
      contactoCorreo: datos.contactoCorreo.trim(),
    });
  }

  return (
    <AltaFormLayout
      code="ALTA DE CLIENTE · §7.1"
      title="Nuevo cliente"
      meta="Mantenimiento · solo Administrador · el cliente queda listo para crearle sedes y servicios"
      textoConfirmar="Registrar cliente"
      cantidadErrores={Object.keys(errores).length}
      mostrarErrores={intentado}
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
          ayuda="11 dígitos. Las personas naturales se registran como sede del cliente VARIOS."
        >
          <input
            {...ariaError('cli-ruc', visibles.ruc)}
            className="alta-campo__mono"
            type="text"
            inputMode="numeric"
            maxLength={11}
            value={datos.ruc}
            onChange={(e) => set('ruc', e.target.value.replace(/\D/g, ''))}
            placeholder="20611122233"
          />
        </Campo>
        <Campo
          id="cli-codigo"
          label="Código corto"
          error={visibles.codigoCorto}
          ayuda="4 a 10 caracteres en mayúsculas. Se usa en la numeración: INFORME-CÓDIGO-N°-AÑO."
        >
          <input
            {...ariaError('cli-codigo', visibles.codigoCorto)}
            className="alta-campo__mono"
            type="text"
            maxLength={10}
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
            {giros.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </Campo>
        <Opciones
          nombre="Estado"
          valor={datos.estado}
          opciones={[
            { valor: 'ACTIVO', etiqueta: 'Activo' },
            { valor: 'INACTIVO', etiqueta: 'Inactivo' },
          ]}
          onCambiar={(v) => set('estado', v)}
        />
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
    </AltaFormLayout>
  );
}
