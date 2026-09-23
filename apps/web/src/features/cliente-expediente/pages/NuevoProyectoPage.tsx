import { useState } from 'react';
import { AltaFormLayout } from '../components/AltaForm';
import { Bloque, Campo, Opciones, ariaError } from '../../../shared/ui/molecules/FormFields';
import { validarProyecto, type DatosProyecto } from '../model/validaciones';
import type { ClienteFila } from '../model/clientes-mock';

interface Props {
  cliente: ClienteFila;
  nombresExistentes: string[];
  onRegistrar: (datos: DatosProyecto) => void;
  onCancelar: () => void;
}

const INICIAL: DatosProyecto = {
  nombre: '',
  direccion: '',
  distrito: '',
  provincia: 'Arequipa',
  departamento: 'Arequipa',
  contactoNombre: '',
  contactoCargo: '',
  contactoTelefono: '',
  estado: 'ACTIVO',
  observaciones: '',
};

/** Alta de proyecto (sede) — spec §7.2. Un cliente puede tener varias sedes activas a la vez. */
export function NuevoProyectoPage({ cliente, nombresExistentes, onRegistrar, onCancelar }: Props) {
  const [datos, setDatos] = useState<DatosProyecto>(INICIAL);
  const [intentado, setIntentado] = useState(false);

  const errores = validarProyecto(datos, nombresExistentes);
  const visibles = intentado ? errores : {};

  function set<K extends keyof DatosProyecto>(campo: K, valor: DatosProyecto[K]) {
    setDatos((prev) => ({ ...prev, [campo]: valor }));
  }

  function registrar() {
    setIntentado(true);
    if (Object.keys(errores).length > 0) return;
    onRegistrar(datos);
  }

  return (
    <AltaFormLayout
      code={`ALTA DE PROYECTO · ${cliente.codigoCorto} · §7.2`}
      title="Nueva sede"
      meta={`${cliente.razonSocial} · la sede agrupa los servicios que se ejecutan en esa ubicación`}
      textoConfirmar="Registrar sede"
      cantidadErrores={Object.keys(errores).length}
      mostrarErrores={intentado}
      onSubmit={registrar}
      onCancelar={onCancelar}
    >
      <Bloque titulo="Sede">
        <Campo
          id="pro-nombre"
          label="Nombre del proyecto"
          error={visibles.nombre}
          ayuda="4 a 20 caracteres en mayúsculas, sin espacios (ej. PLANTA, ALMACEN, CSF_SUNNY)."
          ancho="completo"
        >
          <input
            {...ariaError('pro-nombre', visibles.nombre)}
            className="ff-campo__mono"
            type="text"
            maxLength={20}
            value={datos.nombre}
            onChange={(e) => set('nombre', e.target.value.toUpperCase().replace(/\s+/g, '_'))}
            placeholder="PLANTA_NORTE"
          />
        </Campo>
        <Campo
          id="pro-direccion"
          label="Dirección de la sede"
          error={visibles.direccion}
          ayuda="Donde se ejecuta el servicio; puede ser distinta de la dirección fiscal."
          ancho="completo"
        >
          <input
            {...ariaError('pro-direccion', visibles.direccion)}
            type="text"
            value={datos.direccion}
            onChange={(e) => set('direccion', e.target.value)}
            placeholder="Parque Industrial Río Seco Mz. B Lote 2"
          />
        </Campo>
        <Campo id="pro-distrito" label="Distrito" error={visibles.distrito}>
          <input
            {...ariaError('pro-distrito', visibles.distrito)}
            type="text"
            value={datos.distrito}
            onChange={(e) => set('distrito', e.target.value)}
            placeholder="Cerro Colorado"
          />
        </Campo>
        <Campo id="pro-provincia" label="Provincia" error={visibles.provincia}>
          <input
            {...ariaError('pro-provincia', visibles.provincia)}
            type="text"
            value={datos.provincia}
            onChange={(e) => set('provincia', e.target.value)}
          />
        </Campo>
        <Campo id="pro-departamento" label="Departamento" error={visibles.departamento}>
          <input
            {...ariaError('pro-departamento', visibles.departamento)}
            type="text"
            value={datos.departamento}
            onChange={(e) => set('departamento', e.target.value)}
          />
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

      <Bloque titulo="Contacto en la sede">
        <Campo id="pro-contacto-nombre" label="Nombre" error={visibles.contactoNombre}>
          <input
            {...ariaError('pro-contacto-nombre', visibles.contactoNombre)}
            type="text"
            value={datos.contactoNombre}
            onChange={(e) => set('contactoNombre', e.target.value)}
            placeholder="Luis Rojas"
          />
        </Campo>
        <Campo id="pro-contacto-cargo" label="Cargo" error={visibles.contactoCargo}>
          <input
            {...ariaError('pro-contacto-cargo', visibles.contactoCargo)}
            type="text"
            value={datos.contactoCargo}
            onChange={(e) => set('contactoCargo', e.target.value)}
            placeholder="Jefe de Planta"
          />
        </Campo>
        <Campo id="pro-contacto-telefono" label="Teléfono" error={visibles.contactoTelefono}>
          <input
            {...ariaError('pro-contacto-telefono', visibles.contactoTelefono)}
            type="tel"
            value={datos.contactoTelefono}
            onChange={(e) => set('contactoTelefono', e.target.value)}
            placeholder="054 223344"
          />
        </Campo>
        <Campo
          id="pro-observaciones"
          label="Observaciones del proyecto (opcional)"
          ayuda="Condiciones de acceso, restricciones o EPP adicional que el técnico debe conocer."
          ancho="completo"
        >
          <textarea
            id="pro-observaciones"
            value={datos.observaciones}
            onChange={(e) => set('observaciones', e.target.value)}
            placeholder="Ingreso solo con casco y chaleco; coordinar con vigilancia."
          />
        </Campo>
      </Bloque>
    </AltaFormLayout>
  );
}
