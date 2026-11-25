import { NotFoundException } from '@nestjs/common';
import { CrearDocumentoUseCase } from './crear-documento.usecase';
import { TransicionarDocumentoUseCase } from './transicionar-documento.usecase';
import { ListarDocumentosUseCase } from './listar-documentos.usecase';
import { ObtenerDocumentoUseCase } from './obtener-documento.usecase';
import { DocumentoRepositoryMemory } from '../infrastructure/documento.repository.memory';
import { NumeradorCorrelativoMemory } from '../infrastructure/numerador-correlativo.memory';
import { TransaccionMemory } from '../infrastructure/transaccion.memory';
import { ClienteCodigoMemory } from '../infrastructure/cliente-codigo.memory';

const ACTOR = { id: '11111111-1111-4111-8111-111111111111', usuario: 'SUP.UNO', rol: 'SUPERVISOR' };

function montar() {
  const repo = new DocumentoRepositoryMemory();
  const numerador = new NumeradorCorrelativoMemory();
  const clientes = new ClienteCodigoMemory({ 'cli-1': 'KALLPA', 'cli-2': 'SAMAY' });
  const tx = new TransaccionMemory();
  return {
    repo,
    crear: new CrearDocumentoUseCase(repo, numerador, clientes, tx),
    transicionar: new TransicionarDocumentoUseCase(repo, tx),
    listar: new ListarDocumentosUseCase(repo),
    obtener: new ObtenerDocumentoUseCase(repo),
  };
}

describe('CrearDocumentoUseCase', () => {
  it('numera por cliente y tipo, arma el código y deja la creación en el historial', async () => {
    const { crear, obtener } = montar();
    const a = await crear.ejecutar('cli-1', 'INFORME', ACTOR);
    const b = await crear.ejecutar('cli-1', 'INFORME', ACTOR);
    const c = await crear.ejecutar('cli-1', 'REPORTE', ACTOR);
    const d = await crear.ejecutar('cli-2', 'INFORME', ACTOR);

    expect([a.numeroCorrelativo, b.numeroCorrelativo, c.numeroCorrelativo, d.numeroCorrelativo]).toEqual([1, 2, 1, 1]);
    expect(a.codigo).toMatch(/^INFORME-KALLPA-001-\d{4}$/);
    expect(d.codigo).toMatch(/^INFORME-SAMAY-001-\d{4}$/);

    const detalle = await obtener.ejecutar(a.id);
    expect(detalle.transiciones).toHaveLength(1);
    expect(detalle.transiciones[0]).toMatchObject({ estadoAnterior: null, estadoNuevo: 'BORRADOR', actorUsuario: 'SUP.UNO' });
  });

  it('el certificado usa una secuencia global aunque cambie el cliente', async () => {
    const { crear } = montar();
    const a = await crear.ejecutar('cli-1', 'CERTIFICADO', ACTOR);
    const b = await crear.ejecutar('cli-2', 'CERTIFICADO', ACTOR);
    const c = await crear.ejecutar('cli-1', 'CERTIFICADO', ACTOR);
    expect([a.numeroCorrelativo, b.numeroCorrelativo, c.numeroCorrelativo]).toEqual([1, 2, 3]);
  });

  it('rechaza un cliente inexistente sin consumir número', async () => {
    const { crear } = montar();
    await expect(crear.ejecutar('no-existe', 'INFORME', ACTOR)).rejects.toThrow(NotFoundException);
    const ok = await crear.ejecutar('cli-1', 'INFORME', ACTOR);
    expect(ok.numeroCorrelativo).toBe(1);
  });
});

describe('TransicionarDocumentoUseCase', () => {
  it('guarda cada transición en el historial con actor y motivo', async () => {
    const { crear, transicionar, obtener } = montar();
    const doc = await crear.ejecutar('cli-1', 'INFORME', ACTOR);
    await transicionar.ejecutar(doc.id, 'CERRADO', ACTOR);
    await transicionar.ejecutar(doc.id, 'ENVIADO_A_REVISION', ACTOR, 'Listo');

    const detalle = await obtener.ejecutar(doc.id);
    expect(detalle.estado).toBe('ENVIADO_A_REVISION');
    expect(detalle.transiciones.map((t) => [t.estadoAnterior, t.estadoNuevo, t.motivo])).toEqual([
      [null, 'BORRADOR', null],
      ['BORRADOR', 'CERRADO', null],
      ['CERRADO', 'ENVIADO_A_REVISION', 'Listo'],
    ]);
  });

  it('una transición inválida no cambia el estado ni el historial', async () => {
    const { crear, transicionar, obtener } = montar();
    const doc = await crear.ejecutar('cli-1', 'INFORME', ACTOR);
    await expect(transicionar.ejecutar(doc.id, 'APROBADO', ACTOR)).rejects.toThrow('No se puede pasar de BORRADOR a APROBADO');
    const detalle = await obtener.ejecutar(doc.id);
    expect(detalle.estado).toBe('BORRADOR');
    expect(detalle.transiciones).toHaveLength(1);
  });

  it('responde NotFound si el documento no existe', async () => {
    const { transicionar } = montar();
    await expect(transicionar.ejecutar('x', 'CERRADO', ACTOR)).rejects.toThrow(NotFoundException);
  });
});

describe('ListarDocumentosUseCase / ObtenerDocumentoUseCase', () => {
  it('lista la cola de revisión filtrando por estado', async () => {
    const { crear, transicionar, listar } = montar();
    const a = await crear.ejecutar('cli-1', 'INFORME', ACTOR);
    const b = await crear.ejecutar('cli-1', 'REPORTE', ACTOR);
    await crear.ejecutar('cli-2', 'INFORME', ACTOR);
    for (const doc of [a, b]) {
      await transicionar.ejecutar(doc.id, 'CERRADO', ACTOR);
      await transicionar.ejecutar(doc.id, 'ENVIADO_A_REVISION', ACTOR);
    }

    const cola = await listar.ejecutar({ estado: 'ENVIADO_A_REVISION' });
    expect(cola.map((d) => d.id).sort()).toEqual([a.id, b.id].sort());
    expect(await listar.ejecutar({})).toHaveLength(3);
    expect(await listar.ejecutar({ tipo: 'REPORTE' })).toHaveLength(1);
  });

  it('obtener lanza NotFound si no existe', async () => {
    const { obtener } = montar();
    await expect(obtener.ejecutar('nada')).rejects.toThrow(NotFoundException);
  });
});
