import { useState } from 'react';
import type { Estacion } from '@gafer/contracts';
import { Badge } from '../../../shared/ui/atoms/Badge';
import { Button } from '../../../shared/ui/atoms/Button';
import { PerforatedDivider } from '../../../shared/ui/molecules/PerforatedDivider';
import { TIPOS_CEBO_MOCK, type InspeccionRegistrada, type PorcentajeConsumo } from '../model/aura';
import './inspeccion-estacion-panel.css';

const PORCENTAJES: PorcentajeConsumo[] = [0, 25, 50, 75, 100];

interface InspeccionEstacionPanelProps {
  estacion: Estacion;
  historial: InspeccionRegistrada[];
  onRegistrar: (inspeccion: InspeccionRegistrada) => void;
  onCerrar: () => void;
}

/**
 * Se abre al tocar una estación ya colocada en el plano — el técnico
 * no elige el color a mano: registra si hubo consumo o no, y el
 * ícono/aura los calcula el sistema con la regla de un nivel por
 * visita (spec §5.3). El historial muestra las últimas 3 inspecciones
 * de esa estación puntual (spec §5.6).
 */
export function InspeccionEstacionPanel({ estacion, historial, onRegistrar, onCerrar }: InspeccionEstacionPanelProps) {
  const [tipoCebo, setTipoCebo] = useState<string>(TIPOS_CEBO_MOCK[0]);
  const [cantidadGramos, setCantidadGramos] = useState('');
  const [lote, setLote] = useState('');
  const [vencimiento, setVencimiento] = useState('');
  const [huboConsumo, setHuboConsumo] = useState<boolean | null>(null);
  const [porcentaje, setPorcentaje] = useState<PorcentajeConsumo>(25);
  const [cantidadReposicion, setCantidadReposicion] = useState('');
  const [estadoFisico, setEstadoFisico] = useState<'BUENAS_CONDICIONES' | 'MALAS_CONDICIONES'>('BUENAS_CONDICIONES');
  const [cantidadRepuesta, setCantidadRepuesta] = useState('');

  const ultimasTres = historial.slice(-3).reverse();
  const datosBaseCompletos = cantidadGramos !== '' && lote.trim() !== '' && vencimiento !== '';

  function registrar() {
    if (huboConsumo === null || !datosBaseCompletos) return;
    onRegistrar({
      fecha: new Date().toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }),
      tipoCebo,
      cantidadGramos: Number(cantidadGramos),
      lote,
      vencimiento,
      huboConsumo,
      porcentajeConsumo: huboConsumo ? porcentaje : undefined,
      cantidadReposicion: huboConsumo && cantidadReposicion !== '' ? Number(cantidadReposicion) : undefined,
      estadoFisico: huboConsumo ? undefined : estadoFisico,
      cantidadRepuesta: !huboConsumo && cantidadRepuesta !== '' ? Number(cantidadRepuesta) : undefined,
    });
    setHuboConsumo(null);
    setCantidadGramos('');
    setLote('');
    setVencimiento('');
    setCantidadReposicion('');
    setCantidadRepuesta('');
  }

  return (
    <aside className="inspeccion-panel" aria-label={`Estación número ${estacion.numero}`}>
      <div className="inspeccion-panel__cabecera">
        <div>
          <span className="inspeccion-panel__numero mono">ESTACIÓN N.° {estacion.numero}</span>
          <div className="inspeccion-panel__estados">
            <Badge color={estacion.colorAura}>
              {estacion.colorAura === 'SIN_COLOR' ? 'sin aura' : `aura ${estacion.colorAura.toLowerCase()}`}
            </Badge>
            <span className={`inspeccion-panel__icono inspeccion-panel__icono--${estacion.colorIcono.toLowerCase()}`}>
              ícono {estacion.colorIcono.toLowerCase()}
            </span>
          </div>
        </div>
        <button type="button" className="inspeccion-panel__cerrar" onClick={onCerrar} aria-label="Cerrar">
          ✕
        </button>
      </div>

      <section className="inspeccion-panel__historial">
        <h3>Últimas inspecciones</h3>
        {ultimasTres.length === 0 ? (
          <p className="inspeccion-panel__vacio">Sin inspecciones registradas todavía en esta estación.</p>
        ) : (
          <ul>
            {ultimasTres.map((insp, i) => (
              <li key={i}>
                <span className="tabular">{insp.fecha}</span>
                <span>
                  {insp.tipoCebo} · {insp.cantidadGramos} g
                </span>
                <span className={insp.huboConsumo ? 'inspeccion-panel__consumo--si' : 'inspeccion-panel__consumo--no'}>
                  {insp.huboConsumo
                    ? `consumo ${insp.porcentajeConsumo}%`
                    : insp.estadoFisico === 'BUENAS_CONDICIONES'
                      ? 'sin consumo · buenas condiciones'
                      : 'sin consumo · malas condiciones'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <PerforatedDivider />

      <section className="inspeccion-panel__form">
        <h3>Registrar nueva inspección</h3>

        <label className="inspeccion-panel__campo">
          <span>Tipo de cebo</span>
          <select value={tipoCebo} onChange={(e) => setTipoCebo(e.target.value)}>
            {TIPOS_CEBO_MOCK.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>

        <div className="inspeccion-panel__fila">
          <label className="inspeccion-panel__campo">
            <span>Cantidad (g)</span>
            <input
              type="number"
              min={0}
              value={cantidadGramos}
              onChange={(e) => setCantidadGramos(e.target.value)}
              placeholder="0"
            />
          </label>
          <label className="inspeccion-panel__campo">
            <span>Lote</span>
            <input type="text" value={lote} onChange={(e) => setLote(e.target.value)} placeholder="L-2026-01" />
          </label>
        </div>

        <label className="inspeccion-panel__campo">
          <span>Vencimiento</span>
          <input type="date" value={vencimiento} onChange={(e) => setVencimiento(e.target.value)} />
        </label>

        <fieldset className="inspeccion-panel__campo">
          <legend>¿Hubo consumo?</legend>
          <div className="inspeccion-panel__toggle">
            <button
              type="button"
              className={huboConsumo === true ? 'inspeccion-panel__toggle-btn is-activo-si' : 'inspeccion-panel__toggle-btn'}
              onClick={() => setHuboConsumo(true)}
            >
              Sí
            </button>
            <button
              type="button"
              className={huboConsumo === false ? 'inspeccion-panel__toggle-btn is-activo-no' : 'inspeccion-panel__toggle-btn'}
              onClick={() => setHuboConsumo(false)}
            >
              No
            </button>
          </div>
        </fieldset>

        {huboConsumo === true ? (
          <>
            <label className="inspeccion-panel__campo">
              <span>Porcentaje consumido</span>
              <select value={porcentaje} onChange={(e) => setPorcentaje(Number(e.target.value) as PorcentajeConsumo)}>
                {PORCENTAJES.map((p) => (
                  <option key={p} value={p}>
                    {p}%
                  </option>
                ))}
              </select>
            </label>
            <label className="inspeccion-panel__campo">
              <span>Cantidad de reposición (g)</span>
              <input
                type="number"
                min={0}
                value={cantidadReposicion}
                onChange={(e) => setCantidadReposicion(e.target.value)}
                placeholder="0"
              />
            </label>
          </>
        ) : null}

        {huboConsumo === false ? (
          <>
            <label className="inspeccion-panel__campo">
              <span>Estado de la estación</span>
              <select value={estadoFisico} onChange={(e) => setEstadoFisico(e.target.value as typeof estadoFisico)}>
                <option value="BUENAS_CONDICIONES">En buenas condiciones</option>
                <option value="MALAS_CONDICIONES">En malas condiciones (agua, polvo, calor)</option>
              </select>
            </label>
            <label className="inspeccion-panel__campo">
              <span>Cantidad repuesta (g)</span>
              <input
                type="number"
                min={0}
                value={cantidadRepuesta}
                onChange={(e) => setCantidadRepuesta(e.target.value)}
                placeholder="0"
              />
            </label>
          </>
        ) : null}

        <Button type="button" variant="primary" onClick={registrar} disabled={huboConsumo === null || !datosBaseCompletos}>
          Registrar inspección
        </Button>
      </section>
    </aside>
  );
}
