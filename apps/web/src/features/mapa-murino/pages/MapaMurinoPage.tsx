import { useMemo } from 'react';
import { TicketHeader } from '../../../shared/ui/molecules/TicketHeader';
import { fechaLocal } from '../../../shared/lib/fecha';
import { useCartera } from '../../cliente-expediente/model/cartera-context';
import { esClienteNuevo, proyectosDe } from '../../cliente-expediente/model/cartera';
import { generarHistorial } from '../../estadisticas/model/historial-mock';
import { mapasDeLaCartera, type MapaProyecto } from '../model/mapas-mock';
import { MapaConVisitas } from '../components/MapaConVisitas';
import { PlanoBaseEditor } from '../components/PlanoBaseEditor';
import './mapa-murino-page.css';

export interface SeleccionMapa {
  clienteId: string;
  proyecto?: string;
}

interface Props {
  seleccion: SeleccionMapa | null;
  onSeleccionar: (seleccion: SeleccionMapa) => void;
}

interface Opcion {
  clienteId: string;
  cliente: string;
  proyecto: string;
  mapa: MapaProyecto | null;
}

const clave = (o: { clienteId: string; proyecto: string }) => `${o.clienteId}/${o.proyecto}`;

/** Mapa murino por proyecto (§5): hasta 20 planos, hasta 100 estaciones por plano, a lo largo de todas sus visitas. */
export function MapaMurinoPage({ seleccion, onSeleccionar }: Props) {
  const { cartera } = useCartera();
  const hoy = fechaLocal();
  const historial = useMemo(() => generarHistorial(hoy), [hoy]);
  const mapas = useMemo(() => mapasDeLaCartera(historial, cartera.clientes), [historial, cartera.clientes]);

  const opciones: Opcion[] = [
    ...mapas.map((m) => ({ clienteId: m.clienteId, cliente: m.cliente, proyecto: m.proyecto, mapa: m })),
    ...cartera.clientes
      .filter((c) => esClienteNuevo(cartera, c.id))
      .flatMap((c) =>
        proyectosDe(cartera, c.id)
          .filter((p) => p.estado === 'ACTIVO' && p.servicios.some((s) => s.tipoId === 'DRT'))
          .map((p) => ({ clienteId: c.id, cliente: c.codigoCorto, proyecto: p.nombre, mapa: null })),
      ),
  ];

  const actual =
    opciones.find((o) => o.clienteId === seleccion?.clienteId && (!seleccion.proyecto || o.proyecto === seleccion.proyecto)) ?? opciones[0];
  const cliente = actual ? cartera.clientes.find((c) => c.id === actual.clienteId) : undefined;

  return (
    <div className="mapa-page">
      <TicketHeader
        code={actual ? `${actual.cliente} · ${actual.proyecto}` : 'MAPA MURINO'}
        title={cliente ? `Mapa murino · ${cliente.razonSocial}` : 'Mapa murino'}
        meta={
          actual?.mapa
            ? `${actual.mapa.planos.length} ${actual.mapa.planos.length === 1 ? 'plano' : 'planos'} · ${actual.mapa.visitas.length} visitas de desratización`
            : 'Programa de control de roedores'
        }
      />

      <div className="mapa-page__body">
        {opciones.length === 0 ? (
          <p className="mapa-aviso">Ningún cliente tiene desratización contratada todavía.</p>
        ) : (
          <>
            <label className="mapa-selector">
              <span>Proyecto</span>
              <select
                value={clave(actual)}
                onChange={(e) => {
                  const o = opciones.find((x) => clave(x) === e.target.value);
                  if (o) onSeleccionar({ clienteId: o.clienteId, proyecto: o.proyecto });
                }}
              >
                {opciones.map((o) => (
                  <option key={clave(o)} value={clave(o)}>
                    {o.cliente} · {o.proyecto}
                    {o.mapa ? ` (${o.mapa.visitas.length} visitas)` : ' (sin visitas)'}
                  </option>
                ))}
              </select>
            </label>

            {actual.mapa ? (
              <MapaConVisitas key={clave(actual)} mapa={actual.mapa} />
            ) : (
              <PlanoBaseEditor key={clave(actual)} proyecto={actual.proyecto} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
