import { useMemo, useState } from 'react';
import { TicketHeader } from '../../../shared/ui/molecules/TicketHeader';
import { PerforatedDivider } from '../../../shared/ui/molecules/PerforatedDivider';
import { Badge } from '../../../shared/ui/atoms/Badge';
import { Button } from '../../../shared/ui/atoms/Button';
import { CLIENTES_MOCK, type ClienteFila } from '../model/clientes-mock';
import './clientes-list-page.css';

type Columna = 'razonSocial' | 'proximoVencimiento';
type Direccion = 'asc' | 'desc';

function diasHasta(fecha: string | null): number | null {
  if (!fecha) return null;
  return Math.round((new Date(fecha).getTime() - Date.now()) / 86_400_000);
}

function formatearFecha(fecha: string | null): string {
  if (!fecha) return '—';
  return new Date(fecha).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
}

interface Props {
  onAbrirCliente: (cliente: ClienteFila) => void;
  /** Spec §12: solo el Administrador crea clientes (§7.1 lo contradice; se sigue la tabla de roles). */
  puedeCrearCliente: boolean;
}

export function ClientesListPage({ onAbrirCliente, puedeCrearCliente }: Props) {
  const [busqueda, setBusqueda] = useState('');
  const [columna, setColumna] = useState<Columna>('razonSocial');
  const [direccion, setDireccion] = useState<Direccion>('asc');

  const filas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    const filtradas = texto
      ? CLIENTES_MOCK.filter(
          (c) =>
            c.razonSocial.toLowerCase().includes(texto) ||
            c.codigoCorto.toLowerCase().includes(texto) ||
            c.ruc.includes(texto),
        )
      : CLIENTES_MOCK;

    const signo = direccion === 'asc' ? 1 : -1;
    return [...filtradas].sort((a, b) => {
      if (columna === 'razonSocial') {
        return signo * a.razonSocial.localeCompare(b.razonSocial);
      }
      const da = diasHasta(a.proximoVencimiento) ?? Number.POSITIVE_INFINITY;
      const db = diasHasta(b.proximoVencimiento) ?? Number.POSITIVE_INFINITY;
      return signo * (da - db);
    });
  }, [busqueda, columna, direccion]);

  function alternarOrden(col: Columna) {
    if (columna === col) {
      setDireccion((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setColumna(col);
      setDireccion('asc');
    }
  }

  return (
    <div className="clientes-page">
      <TicketHeader
        code={`${filas.length} DE ${CLIENTES_MOCK.length}`}
        title="Cartera de clientes"
        meta="Administrador · Supervisor"
        action={puedeCrearCliente ? <Button>Nuevo cliente</Button> : undefined}
      />

      <div className="clientes-page__body">
        <input
          type="search"
          className="clientes-page__buscador"
          placeholder="Buscar por razón social, código o RUC…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          aria-label="Buscar cliente"
        />

        <div className="clientes-tabla">
          <div className="clientes-tabla__cabecera" role="row">
            <button type="button" className="clientes-tabla__th" onClick={() => alternarOrden('razonSocial')}>
              Cliente {columna === 'razonSocial' ? (direccion === 'asc' ? '↑' : '↓') : ''}
            </button>
            <span className="clientes-tabla__th">Giro</span>
            <span className="clientes-tabla__th">Último servicio</span>
            <button type="button" className="clientes-tabla__th" onClick={() => alternarOrden('proximoVencimiento')}>
              Vencimiento {columna === 'proximoVencimiento' ? (direccion === 'asc' ? '↑' : '↓') : ''}
            </button>
            <span className="clientes-tabla__th">Estado</span>
          </div>

          {filas.length === 0 ? (
            <p className="clientes-page__vacio">Ningún cliente coincide con “{busqueda}”.</p>
          ) : (
            filas.map((c, i) => {
              const dias = diasHasta(c.proximoVencimiento);
              const vencVariant = dias !== null && dias < 15 ? 'urgente' : dias !== null && dias < 45 ? 'atencion' : 'normal';
              return (
                <div key={c.id}>
                  <button type="button" className="clientes-tabla__fila" onClick={() => onAbrirCliente(c)}>
                    <span className="clientes-tabla__cliente">
                      <span className="clientes-tabla__razon">{c.razonSocial}</span>
                      <span className="clientes-tabla__codigo tabular">
                        {c.codigoCorto} · RUC {c.ruc}
                      </span>
                    </span>
                    <span>{c.giro}</span>
                    <span className="tabular">{formatearFecha(c.ultimoServicio)}</span>
                    <span className={`clientes-tabla__venc clientes-tabla__venc--${vencVariant} tabular`}>
                      {formatearFecha(c.proximoVencimiento)}
                    </span>
                    <span className="clientes-tabla__estado">
                      <Badge color={c.estado === 'ACTIVO' ? 'VERDE' : 'SIN_COLOR'}>{c.estado}</Badge>
                    </span>
                  </button>
                  {i < filas.length - 1 && <PerforatedDivider />}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
