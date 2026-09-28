import { describe, expect, it } from 'vitest';
import {
  CambioEstadoEquipoSchema,
  CatalogoTextoSchema,
  EquipoRegistroSchema,
  EquipoSchema,
  InsumoActualizacionSchema,
  InsumoRegistroSchema,
  InsumoSchema,
  PersonalRegistroSchema,
  PersonalSchema,
} from './catalogos';
import { esperarFallaEn } from './pruebas';

const id = '11111111-1111-1111-1111-111111111111';

const insumo = {
  id,
  nombreComercial: 'Klerat Bloque',
  principioActivo: 'Brodifacoum',
  presentacion: 'BLOQUE',
  unidadMedida: 'BLOQUE',
  registroDigesa: 'HS-2020-0001',
  concentracion: '0.005%',
  dosisEstandar: '1 bloque por estación',
  fichaTecnicaKey: 'insumos/klerat/ficha.pdf',
  hojaMsdsKey: 'insumos/klerat/msds.pdf',
  estado: 'ACTIVO',
};

describe('InsumoSchema (Spec §7.5)', () => {
  it('acepta un insumo con campos opcionales ausentes o nulos', () => {
    expect(InsumoSchema.safeParse(insumo).success).toBe(true);
    expect(InsumoSchema.safeParse({ ...insumo, resolucionKey: null, proveedor: null }).success).toBe(true);
  });
  it('rechaza presentación o unidad fuera del catálogo', () => {
    esperarFallaEn(InsumoSchema, { ...insumo, presentacion: 'ESPUMA' }, 'presentacion');
    esperarFallaEn(InsumoSchema, { ...insumo, unidadMedida: 'LITRO' }, 'unidadMedida');
  });
  it('exige ficha técnica y hoja MSDS', () => {
    esperarFallaEn(InsumoSchema, { ...insumo, fichaTecnicaKey: '' }, 'fichaTecnicaKey');
    const { hojaMsdsKey: _o, ...sinMsds } = insumo;
    esperarFallaEn(InsumoSchema, sinMsds, 'hojaMsdsKey');
  });
  it('el registro no lleva id ni estado', () => {
    const { id: _i, estado: _e, ...nuevo } = insumo;
    expect(InsumoRegistroSchema.safeParse(nuevo).success).toBe(true);
  });
});

const equipo = {
  id,
  codigoInterno: 'EQ-NEB-01',
  nombre: 'Nebulizadora ULV',
  tipo: 'NEBULIZACION',
  estadoOperativo: 'OPERATIVO',
};

describe('EquipoSchema', () => {
  it('acepta un equipo con y sin fechas de mantenimiento', () => {
    expect(EquipoSchema.safeParse(equipo).success).toBe(true);
    expect(
      EquipoSchema.safeParse({ ...equipo, marcaModelo: 'Igeba TF-35', fechaAdquisicion: '2024-02-29', ultimoMantenimiento: '2026-08-01', proximoMantenimiento: null }).success,
    ).toBe(true);
  });
  it('rechaza estado operativo con la etiqueta de pantalla en vez del código', () => {
    esperarFallaEn(EquipoSchema, { ...equipo, estadoOperativo: 'EN_MANTENIMIENTO' }, 'estadoOperativo');
    expect(EquipoSchema.safeParse({ ...equipo, estadoOperativo: 'MANTENIMIENTO' }).success).toBe(true);
    expect(EquipoSchema.safeParse({ ...equipo, estadoOperativo: 'FUERA_SERVICIO' }).success).toBe(true);
  });
  it('rechaza fechas mal formadas o imposibles', () => {
    esperarFallaEn(EquipoSchema, { ...equipo, ultimoMantenimiento: '01/08/2026' }, 'ultimoMantenimiento');
    esperarFallaEn(EquipoSchema, { ...equipo, proximoMantenimiento: '2027-02-30' }, 'proximoMantenimiento');
  });
  it('rechaza código interno vacío y tipo desconocido', () => {
    esperarFallaEn(EquipoSchema, { ...equipo, codigoInterno: '' }, 'codigoInterno');
    esperarFallaEn(EquipoSchema, { ...equipo, tipo: 'MARTILLO' }, 'tipo');
  });
  it('el registro no lleva id', () => {
    const { id: _i, ...nuevo } = equipo;
    expect(EquipoRegistroSchema.safeParse(nuevo).success).toBe(true);
  });
  it('el registro no exige el estado operativo: un equipo nuevo parte como OPERATIVO', () => {
    const { id: _i, estadoOperativo: _e, ...nuevo } = equipo;
    expect(EquipoRegistroSchema.safeParse(nuevo).success).toBe(true);
    esperarFallaEn(EquipoRegistroSchema, { ...nuevo, estadoOperativo: 'ROTO' }, 'estadoOperativo');
  });
});

const personal = { id, dni: '45678912', nombres: 'Luis', apellidos: 'Quispe Mamani', cargo: 'TECNICO_OPERADOR', telefono: '958123456', estado: 'ACTIVO' };

describe('PersonalSchema (Spec §7.6)', () => {
  it('acepta técnicos, supervisores y administradores, con usuario opcional', () => {
    expect(PersonalSchema.safeParse(personal).success).toBe(true);
    expect(PersonalSchema.safeParse({ ...personal, cargo: 'SUPERVISOR', usuario: 'lquispe' }).success).toBe(true);
    expect(PersonalSchema.safeParse({ ...personal, cargo: 'ADMINISTRADOR', usuario: 'admin' }).success).toBe(true);
    expect(PersonalSchema.safeParse({ ...personal, usuario: null }).success).toBe(true);
  });
  it('rechaza DNI que no tiene 8 dígitos y cargo desconocido', () => {
    esperarFallaEn(PersonalSchema, { ...personal, dni: '1234567' }, 'dni');
    esperarFallaEn(PersonalSchema, { ...personal, cargo: 'Técnico Operador' }, 'cargo');
  });
  it('rechaza nombres vacíos', () => {
    esperarFallaEn(PersonalSchema, { ...personal, nombres: '' }, 'nombres');
    esperarFallaEn(PersonalSchema, { ...personal, apellidos: '' }, 'apellidos');
  });
  it('el registro no lleva id ni estado', () => {
    const { id: _i, estado: _e, ...nuevo } = personal;
    expect(PersonalRegistroSchema.safeParse(nuevo).success).toBe(true);
  });
});

describe('CatalogoTextoSchema (Spec §7.7)', () => {
  const catalogo = { id: 'hallazgos', titulo: 'Hallazgos', items: ['Presencia de roedores'] };
  it('acepta un catálogo, con la marca opcional de solo administrador', () => {
    expect(CatalogoTextoSchema.safeParse(catalogo).success).toBe(true);
    expect(CatalogoTextoSchema.safeParse({ ...catalogo, id: 'motivos-modificacion', soloAdministrador: true }).success).toBe(true);
  });
  it('acepta una lista vacía de ítems', () => expect(CatalogoTextoSchema.safeParse({ ...catalogo, items: [] }).success).toBe(true));
  it('rechaza un catálogo desconocido o ítems vacíos', () => {
    esperarFallaEn(CatalogoTextoSchema, { ...catalogo, id: 'chistes' }, 'id');
    esperarFallaEn(CatalogoTextoSchema, { ...catalogo, items: ['ok', ''] }, 'items.1');
  });
});

describe('InsumoActualizacionSchema', () => {
  it('acepta cualquier subconjunto de los datos del insumo, incluso vacío', () => {
    expect(InsumoActualizacionSchema.safeParse({}).success).toBe(true);
    expect(InsumoActualizacionSchema.safeParse({ concentracion: '50% p/v', presentacion: 'LIQUIDO' }).success).toBe(true);
  });

  it('descarta el id y el estado, que no se editan por esta vía', () => {
    expect(InsumoActualizacionSchema.parse({ proveedor: 'Bayer S.A.', id, estado: 'INACTIVO' })).toEqual({ proveedor: 'Bayer S.A.' });
  });

  it('mantiene las reglas del alta en los campos que llegan', () => {
    esperarFallaEn(InsumoActualizacionSchema, { nombreComercial: '' }, 'nombreComercial');
    esperarFallaEn(InsumoActualizacionSchema, { unidadMedida: 'LITRO' }, 'unidadMedida');
  });
});

describe('CambioEstadoEquipoSchema', () => {
  it.each(['OPERATIVO', 'MANTENIMIENTO', 'FUERA_SERVICIO'])('acepta %j', (estado) =>
    expect(CambioEstadoEquipoSchema.safeParse({ estadoOperativo: estado }).success).toBe(true),
  );
  it('rechaza un estado desconocido o ausente', () => {
    esperarFallaEn(CambioEstadoEquipoSchema, { estadoOperativo: 'ROTO' }, 'estadoOperativo');
    esperarFallaEn(CambioEstadoEquipoSchema, {}, 'estadoOperativo');
  });
});
