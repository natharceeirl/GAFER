import { CerrarInspeccionDto, ConsumoInsumoDto, CrearInspeccionDto, OperacionSyncDto, SincronizarLoteDto } from './operaciones.dto';
import { rutasRechazadas, validarDto } from '../../../shared/infrastructure/dto/validar-dto.spec-helper';
import { metadatosOpenApi } from '../../../shared/infrastructure/dto/metadatos-openapi.spec-helper';

const uuid = 'a1111111-1111-4111-8111-111111111111';

const consumo = { insumoId: uuid, dosisAplicada: '10 ml/L', lote: 'LOTE-2026-X', cantidadUtilizada: 2.5 };

const operacion = {
  operationId: '11111111-1111-4111-8111-111111111111',
  tipo: 'REGISTRO_ESTACION',
  agregadoId: '22222222-2222-4222-8222-222222222222',
  actorId: '33333333-3333-4333-8333-333333333333',
  clienteTimestamp: '2026-09-20T18:00:00.000Z',
  payload: { numeroEstacion: 1, huboConsumo: true },
};

describe('CrearInspeccionDto', () => {
  it('acepta el id de un servicio contratado', () => {
    expect(validarDto(CrearInspeccionDto, { servicioId: uuid })).toEqual({ servicioId: uuid });
  });
  it('rechaza un servicio ausente o que no es UUID', () => {
    expect(rutasRechazadas(CrearInspeccionDto, {})).toEqual(['servicioId']);
    expect(rutasRechazadas(CrearInspeccionDto, { servicioId: 's1' })).toEqual(['servicioId']);
  });
});

describe('ConsumoInsumoDto', () => {
  it('acepta un consumo válido', () => expect(validarDto(ConsumoInsumoDto, consumo)).toEqual(consumo));
  it('rechaza una cantidad menor que 0.01, un lote vacío y un insumo que no es UUID', () => {
    expect(rutasRechazadas(ConsumoInsumoDto, { ...consumo, cantidadUtilizada: 0 })).toEqual(['cantidadUtilizada']);
    expect(rutasRechazadas(ConsumoInsumoDto, { ...consumo, lote: '' })).toEqual(['lote']);
    expect(rutasRechazadas(ConsumoInsumoDto, { ...consumo, insumoId: 'i1' })).toEqual(['insumoId']);
  });
});

describe('CerrarInspeccionDto', () => {
  it('acepta un cierre vacío y uno completo, y descarta los campos que no declara', () => {
    expect(validarDto(CerrarInspeccionDto, {})).toEqual({});
    const completo = { consumos: [consumo], equiposIds: [uuid], personalIds: [uuid] };
    expect(validarDto(CerrarInspeccionDto, { ...completo, intruso: 1 })).toEqual(completo);
  });

  it('señala el consumo y el campo exacto que falla', () => {
    expect(rutasRechazadas(CerrarInspeccionDto, { consumos: [consumo, { ...consumo, cantidadUtilizada: 0 }] })).toEqual(['consumos.1.cantidadUtilizada']);
    expect(rutasRechazadas(CerrarInspeccionDto, { equiposIds: ['e1'] })).toEqual(['equiposIds.0']);
    expect(rutasRechazadas(CerrarInspeccionDto, { personalIds: 'p1' })).toEqual(['personalIds']);
  });
});

describe('OperacionSyncDto', () => {
  it('acepta una operación de sincronización válida', () => expect(validarDto(OperacionSyncDto, operacion)).toEqual(operacion));

  it('rechaza un tipo desconocido, un id que no es UUID y una marca de tiempo inválida', () => {
    expect(rutasRechazadas(OperacionSyncDto, { ...operacion, tipo: 'BORRAR_TODO' })).toEqual(['tipo']);
    expect(rutasRechazadas(OperacionSyncDto, { ...operacion, actorId: 'a1' })).toEqual(['actorId']);
    expect(rutasRechazadas(OperacionSyncDto, { ...operacion, clienteTimestamp: 'ayer' })).toEqual(['clienteTimestamp']);
  });

  it('rechaza un payload ausente o que no es un objeto', () => {
    const { payload: _p, ...sinPayload } = operacion;
    expect(rutasRechazadas(OperacionSyncDto, sinPayload)).toEqual(['payload']);
    expect(rutasRechazadas(OperacionSyncDto, { ...operacion, payload: [1] })).toEqual(['payload']);
  });
});

describe('SincronizarLoteDto', () => {
  const lote = { inspeccionId: uuid, operaciones: [operacion] };

  it('acepta un lote con operaciones', () => expect(validarDto(SincronizarLoteDto, lote)).toEqual(lote));

  it('señala la operación y el campo que fallan', () => {
    expect(rutasRechazadas(SincronizarLoteDto, { ...lote, operaciones: [operacion, { ...operacion, tipo: 'X' }] })).toEqual(['operaciones.1.tipo']);
  });

  it('acepta un lote sin inspeccionId: la inspección la identifica la ruta', () => {
    expect(validarDto(SincronizarLoteDto, { operaciones: [operacion] })).toEqual({ operaciones: [operacion] });
  });

  it('rechaza un lote sin operaciones o con una inspección que no es UUID', () => {
    expect(rutasRechazadas(SincronizarLoteDto, { ...lote, operaciones: [] })).toEqual(['operaciones']);
    expect(rutasRechazadas(SincronizarLoteDto, { ...lote, inspeccionId: 'i1' })).toEqual(['inspeccionId']);
  });
});

describe('Swagger de los DTO de operaciones', () => {
  it.each([
    ['CrearInspeccionDto', CrearInspeccionDto, ['servicioId'], []],
    ['ConsumoInsumoDto', ConsumoInsumoDto, ['insumoId', 'dosisAplicada', 'lote', 'cantidadUtilizada'], []],
    ['CerrarInspeccionDto', CerrarInspeccionDto, [], ['consumos', 'equiposIds', 'personalIds']],
    ['OperacionSyncDto', OperacionSyncDto, ['operationId', 'tipo', 'agregadoId', 'actorId', 'clienteTimestamp', 'payload'], []],
    ['SincronizarLoteDto', SincronizarLoteDto, ['operaciones'], ['inspeccionId']],
  ] as const)('%s documenta cada campo con descripción y ejemplo, y marca los obligatorios', (_nombre, dto, obligatorios, opcionales) => {
    const propiedades = metadatosOpenApi(dto);
    expect(Object.keys(propiedades).sort()).toEqual([...obligatorios, ...opcionales].sort());
    for (const campo of obligatorios) expect(propiedades[campo].required).toBe(true);
    for (const campo of opcionales) expect(propiedades[campo].required).toBe(false);
    for (const [campo, propiedad] of Object.entries(propiedades)) {
      expect({ campo, description: typeof propiedad.description, ejemplo: propiedad.example !== undefined }).toEqual({ campo, description: 'string', ejemplo: true });
    }
  });

  it('lista los tipos de operación permitidos', () => {
    expect(metadatosOpenApi(OperacionSyncDto).tipo.enum).toEqual(['REGISTRO_ESTACION', 'ACTUALIZACION_ESTACION', 'REGISTRO_OBSERVACIONES']);
  });
});
