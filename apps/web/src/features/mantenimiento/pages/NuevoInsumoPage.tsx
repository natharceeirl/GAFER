import { useEffect, useState } from 'react';
import { AltaFormLayout } from '../../cliente-expediente/components/AltaForm';
import type { Errores } from '../../cliente-expediente/model/validaciones';
import { Bloque, Campo, ariaError } from '../../../shared/ui/molecules/FormFields';
import { CampoPdf } from '../components/CampoPdf';
import { PRESENTACIONES, UNIDADES_MEDIDA } from '../model/catalogos-etiquetas';
import type { DatosInsumo } from '../model/insumo-mapper';
import { validarInsumo } from '../model/validaciones';

interface Props {
  /** Con `inicial` el formulario edita un insumo ya registrado. */
  inicial?: DatosInsumo;
  /** Operación en curso: se deshabilitan los botones. */
  enviando?: boolean;
  /** Errores por campo devueltos por el servidor (400/409). */
  erroresServidor?: Errores<keyof DatosInsumo>;
  /** Error del servidor que no corresponde a un campo. */
  errorGeneral?: string | null;
  onRegistrar: (datos: DatosInsumo) => void;
  onCancelar: () => void;
}

const SIN_ERRORES: Errores<keyof DatosInsumo> = {};

const INICIAL: DatosInsumo = {
  nombreComercial: '',
  principioActivo: '',
  presentacion: '',
  unidadMedida: '',
  registroDigesa: '',
  concentracion: '',
  dosisEstandar: '',
  proveedor: '',
  fichaTecnicaKey: '',
  hojaMsdsKey: '',
};

/**
 * Alta y edición de insumo químico — spec §7.5. La ficha técnica y la hoja MSDS se suben en PDF y se anexan
 * solas al documento cuando el insumo se consume (decisión C14). El estado no se elige aquí: el insumo nace
 * activo y se activa o desactiva desde la lista.
 */
export function NuevoInsumoPage({ inicial, enviando = false, erroresServidor = SIN_ERRORES, errorGeneral = null, onRegistrar, onCancelar }: Props) {
  const edicion = inicial !== undefined;
  const [datos, setDatos] = useState<DatosInsumo>(inicial ?? INICIAL);
  const [intentado, setIntentado] = useState(false);
  const [subiendoFicha, setSubiendoFicha] = useState(false);
  const [subiendoMsds, setSubiendoMsds] = useState(false);
  const subiendo = subiendoFicha || subiendoMsds;

  /** Campos que se tocaron después del último error del servidor: su error ya no aplica. */
  const [corregidos, setCorregidos] = useState<Array<keyof DatosInsumo>>([]);
  useEffect(() => setCorregidos([]), [erroresServidor]);

  const errores = validarInsumo(datos);
  const delServidor: Errores<keyof DatosInsumo> = {};
  for (const campo of Object.keys(erroresServidor) as Array<keyof DatosInsumo>) {
    if (!corregidos.includes(campo)) delServidor[campo] = erroresServidor[campo];
  }
  const visibles = { ...(intentado ? errores : {}), ...delServidor };

  function set<K extends keyof DatosInsumo>(campo: K, valor: DatosInsumo[K]) {
    setDatos((prev) => ({ ...prev, [campo]: valor }));
    setCorregidos((prev) => (prev.includes(campo) ? prev : [...prev, campo]));
  }

  function registrar() {
    setIntentado(true);
    if (enviando || subiendo || Object.keys(errores).length > 0) return;
    onRegistrar(datos);
  }

  return (
    <AltaFormLayout
      code={edicion ? `INSUMO · ${inicial.registroDigesa} · §7.5` : 'ALTA DE INSUMO · §7.5'}
      title={edicion ? 'Editar insumo' : 'Nuevo insumo'}
      meta={
        edicion
          ? `${inicial.nombreComercial} · los cambios no alteran lo ya registrado en visitas y documentos`
          : 'Producto químico o biológico del catálogo; solo lo autorizado en un servicio puede usarse en campo'
      }
      textoConfirmar={edicion ? 'Guardar insumo' : 'Registrar insumo'}
      cantidadErrores={Object.keys(errores).length}
      mostrarErrores={intentado}
      enviando={enviando}
      bloqueado={subiendo}
      errorGeneral={errorGeneral}
      onSubmit={registrar}
      onCancelar={onCancelar}
    >
      <Bloque titulo="Producto">
        <Campo id="ins-nombre" label="Nombre comercial" error={visibles.nombreComercial} ancho="completo">
          <input
            {...ariaError('ins-nombre', visibles.nombreComercial)}
            type="text"
            value={datos.nombreComercial}
            onChange={(e) => set('nombreComercial', e.target.value)}
            placeholder="Brodifacoum 0.005% bloque parafinado"
          />
        </Campo>
        <Campo id="ins-principio" label="Principio activo" error={visibles.principioActivo}>
          <input
            {...ariaError('ins-principio', visibles.principioActivo)}
            type="text"
            value={datos.principioActivo}
            onChange={(e) => set('principioActivo', e.target.value)}
            placeholder="Brodifacoum"
          />
        </Campo>
        <Campo id="ins-digesa" label="Registro DIGESA" error={visibles.registroDigesa} ayuda="Registro oficial del producto; no se repite entre insumos.">
          <input
            {...ariaError('ins-digesa', visibles.registroDigesa)}
            className="ff-campo__mono"
            type="text"
            value={datos.registroDigesa}
            onChange={(e) => set('registroDigesa', e.target.value)}
            placeholder="DIG-2451-SA"
          />
        </Campo>
        <Campo id="ins-presentacion" label="Presentación" error={visibles.presentacion}>
          <select {...ariaError('ins-presentacion', visibles.presentacion)} value={datos.presentacion} onChange={(e) => set('presentacion', e.target.value as DatosInsumo['presentacion'])}>
            <option value="">Seleccione…</option>
            {PRESENTACIONES.map((p) => (
              <option key={p.codigo} value={p.codigo}>
                {p.etiqueta}
              </option>
            ))}
          </select>
        </Campo>
        <Campo id="ins-unidad" label="Unidad de medida" error={visibles.unidadMedida} ayuda="Unidad en que se descuentan el stock y los consumos.">
          <select {...ariaError('ins-unidad', visibles.unidadMedida)} value={datos.unidadMedida} onChange={(e) => set('unidadMedida', e.target.value as DatosInsumo['unidadMedida'])}>
            <option value="">Seleccione…</option>
            {UNIDADES_MEDIDA.map((u) => (
              <option key={u.codigo} value={u.codigo}>
                {u.etiqueta}
              </option>
            ))}
          </select>
        </Campo>
        <Campo id="ins-concentracion" label="Concentración" error={visibles.concentracion}>
          <input
            {...ariaError('ins-concentracion', visibles.concentracion)}
            type="text"
            value={datos.concentracion}
            onChange={(e) => set('concentracion', e.target.value)}
            placeholder="0.005%"
          />
        </Campo>
        <Campo id="ins-dosis" label="Dosis estándar" error={visibles.dosisEstandar} ayuda="Es la dosis que se propone al contratar un servicio.">
          <input
            {...ariaError('ins-dosis', visibles.dosisEstandar)}
            type="text"
            value={datos.dosisEstandar}
            onChange={(e) => set('dosisEstandar', e.target.value)}
            placeholder="1 bloque por estación"
          />
        </Campo>
        <Campo id="ins-proveedor" label="Proveedor (opcional)" error={visibles.proveedor} ancho="completo">
          <input
            {...ariaError('ins-proveedor', visibles.proveedor)}
            type="text"
            value={datos.proveedor}
            onChange={(e) => set('proveedor', e.target.value)}
            placeholder="Química Suiza S.A."
          />
        </Campo>
      </Bloque>

      <Bloque titulo="Anexos del PDF">
        <CampoPdf
          id="ins-ficha"
          etiqueta="Ficha técnica (PDF)"
          carpeta="ficha-tecnica"
          clave={datos.fichaTecnicaKey}
          onCambiar={(clave) => set('fichaTecnicaKey', clave)}
          onSubiendoCambio={setSubiendoFicha}
          error={visibles.fichaTecnicaKey}
        />
        <CampoPdf
          id="ins-msds"
          etiqueta="Hoja de seguridad MSDS (PDF)"
          carpeta="hoja-msds"
          clave={datos.hojaMsdsKey}
          onCambiar={(clave) => set('hojaMsdsKey', clave)}
          onSubiendoCambio={setSubiendoMsds}
          error={visibles.hojaMsdsKey}
        />
      </Bloque>
    </AltaFormLayout>
  );
}
