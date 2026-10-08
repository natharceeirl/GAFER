import { useState } from 'react';
import type { CatalogoTexto } from '@gafer/contracts';
import { mensajeDeError } from '../../../shared/api/errores';
import { Button } from '../../../shared/ui/atoms/Button';
import { EstadoCargando } from '../../cliente-expediente/components/EstadoConsulta';
import { useActualizarCatalogoTexto, useAgregarItemCatalogo, useCatalogosTexto } from '../api/use-catalogos-texto';
import { ErrorLectura } from '../components/ErrorLectura';
import { quitarItem, reemplazarItem, validarItem } from '../model/catalogo-texto';

interface EdicionItem {
  posicion: number;
  texto: string;
}

/** Un catálogo de texto editable (§7.7): agregar, renombrar y quitar textos sin intervención del desarrollador. */
function TarjetaCatalogo({ catalogo }: { catalogo: CatalogoTexto }) {
  const agregar = useAgregarItemCatalogo();
  const reemplazar = useActualizarCatalogoTexto();
  const [nuevo, setNuevo] = useState('');
  const [edicion, setEdicion] = useState<EdicionItem | null>(null);
  const [errorLocal, setErrorLocal] = useState<string | null>(null);

  const ocupado = agregar.isPending || reemplazar.isPending;
  const error = errorLocal ?? (agregar.error ? mensajeDeError(agregar.error) : reemplazar.error ? mensajeDeError(reemplazar.error) : null);

  function limpiarErrores() {
    setErrorLocal(null);
    agregar.reset();
    reemplazar.reset();
  }

  function agregarTexto() {
    limpiarErrores();
    const problema = validarItem(nuevo, catalogo.items);
    if (problema) {
      setErrorLocal(problema);
      return;
    }
    agregar.mutate({ id: catalogo.id, item: nuevo }, { onSuccess: () => setNuevo('') });
  }

  function guardarEdicion() {
    if (!edicion) return;
    limpiarErrores();
    if (edicion.texto.trim() === catalogo.items[edicion.posicion]) {
      setEdicion(null);
      return;
    }
    const problema = validarItem(edicion.texto, catalogo.items.filter((_, i) => i !== edicion.posicion));
    if (problema) {
      setErrorLocal(problema);
      return;
    }
    reemplazar.mutate({ id: catalogo.id, items: reemplazarItem(catalogo.items, edicion.posicion, edicion.texto) }, { onSuccess: () => setEdicion(null) });
  }

  function quitar(posicion: number) {
    limpiarErrores();
    reemplazar.mutate({ id: catalogo.id, items: quitarItem(catalogo.items, posicion) });
  }

  return (
    <div className="mant-catalogo">
      <h3>{catalogo.titulo}</h3>
      <ul className="mant-catalogo__lista">
        {catalogo.items.map((item, i) => (
          <li key={`${item}-${i}`}>
            {edicion?.posicion === i ? (
              <>
                <input
                  type="text"
                  aria-label={`Texto de ${item}`}
                  value={edicion.texto}
                  onChange={(e) => setEdicion({ posicion: i, texto: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && guardarEdicion()}
                  disabled={ocupado}
                  autoFocus
                />
                <span className="mant-acciones">
                  <button type="button" className="mant-enlace" onClick={guardarEdicion} disabled={ocupado}>
                    Guardar
                  </button>
                  <button type="button" className="mant-enlace" onClick={() => setEdicion(null)} disabled={ocupado}>
                    Cancelar
                  </button>
                </span>
              </>
            ) : (
              <>
                <span>{item}</span>
                <span className="mant-acciones">
                  <button type="button" className="mant-enlace" aria-label={`Editar ${item}`} onClick={() => { limpiarErrores(); setEdicion({ posicion: i, texto: item }); }} disabled={ocupado}>
                    Editar
                  </button>
                  <button type="button" className="mant-catalogo__quitar" aria-label={`Quitar ${item}`} onClick={() => quitar(i)} disabled={ocupado}>
                    ×
                  </button>
                </span>
              </>
            )}
          </li>
        ))}
      </ul>
      {error ? (
        <p className="mant-aviso mant-aviso--error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="mant-catalogo__agregar">
        <input
          type="text"
          aria-label={`Nuevo texto en ${catalogo.titulo}`}
          value={nuevo}
          onChange={(e) => setNuevo(e.target.value)}
          placeholder="Agregar texto al catálogo…"
          onKeyDown={(e) => e.key === 'Enter' && agregarTexto()}
          disabled={ocupado}
        />
        <Button type="button" variant="secondary" onClick={agregarTexto} disabled={ocupado}>
          Agregar
        </Button>
      </div>
    </div>
  );
}

/** Catálogos de texto que el rol puede editar; el API deja fuera los solo de Administrador para el Supervisor. */
export function CatalogosTextoSeccion() {
  const catalogos = useCatalogosTexto();

  if (catalogos.isPending) return <EstadoCargando mensaje="Cargando catálogos…" />;
  if (catalogos.isError) return <ErrorLectura error={catalogos.error} recurso="los catálogos de texto" onReintentar={() => void catalogos.refetch()} />;

  return (
    <div className="mant-seccion">
      <p className="mant-barra__texto">
        Los cambios se aplican a los formularios desde ese momento y no alteran lo ya registrado en visitas y documentos.
      </p>
      <div className="mant-catalogos-grid">
        {catalogos.data.map((c) => (
          <TarjetaCatalogo key={c.id} catalogo={c} />
        ))}
      </div>
    </div>
  );
}
