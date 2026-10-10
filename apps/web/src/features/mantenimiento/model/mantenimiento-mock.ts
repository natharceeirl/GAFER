import type { CatalogoTexto, Insumo, Personal } from '@gafer/contracts';

/**
 * Catálogo de insumos de demostración que siguen usando los documentos (anexos del PDF). Tiene la forma del API
 * (`Insumo` de @gafer/contracts); la pantalla de Mantenimiento ya lee el catálogo real.
 */
const insumoMock = (parcial: Pick<Insumo, 'id' | 'nombreComercial' | 'principioActivo' | 'presentacion' | 'unidadMedida' | 'concentracion' | 'registroDigesa' | 'dosisEstandar' | 'estado'>): Insumo => ({
  ...parcial,
  fichaTecnicaKey: `insumos/ficha-tecnica/${parcial.id}.pdf`,
  hojaMsdsKey: `insumos/hoja-msds/${parcial.id}.pdf`,
  resolucionKey: null,
  proveedor: null,
});

export const INSUMOS_MOCK: Insumo[] = [
  insumoMock({ id: 'i1', nombreComercial: 'Brodifacoum 0.005% bloque parafinado', principioActivo: 'Brodifacoum', presentacion: 'BLOQUE', unidadMedida: 'BLOQUE', concentracion: '0.005%', registroDigesa: 'DIG-2451-SA', dosisEstandar: '1 bloque por estación', estado: 'ACTIVO' }),
  insumoMock({ id: 'i2', nombreComercial: 'Cipermetrina 25% EC', principioActivo: 'Cipermetrina', presentacion: 'LIQUIDO', unidadMedida: 'ML', concentracion: '25%', registroDigesa: 'DIG-1980-SA', dosisEstandar: '10 ml/L', estado: 'ACTIVO' }),
  insumoMock({ id: 'i3', nombreComercial: 'Bromadiolona 0.005% pellet', principioActivo: 'Bromadiolona', presentacion: 'OTRO', unidadMedida: 'SOBRE', concentracion: '0.005%', registroDigesa: 'DIG-2510-SA', dosisEstandar: '1 sobre por estación', estado: 'ACTIVO' }),
  insumoMock({ id: 'i5', nombreComercial: 'Hipoclorito de sodio 7.5%', principioActivo: 'Hipoclorito de sodio', presentacion: 'LIQUIDO', unidadMedida: 'L', concentracion: '7.5%', registroDigesa: 'DIG-3120-SA', dosisEstandar: '50 ppm de cloro libre', estado: 'ACTIVO' }),
  insumoMock({ id: 'i4', nombreComercial: 'Deltametrina 2.5% SC', principioActivo: 'Deltametrina', presentacion: 'OTRO', unidadMedida: 'ML', concentracion: '2.5%', registroDigesa: 'DIG-1765-SA', dosisEstandar: '8 ml/L', estado: 'INACTIVO' }),
];

/** Personal de demostración que siguen usando programación y el panel; la pantalla de Mantenimiento ya lee el real. */
const personalMock = (id: string, nombres: string, apellidos: string, dni: string, cargo: Personal['cargo'], estado: Personal['estado'] = 'ACTIVO'): Personal => ({
  id,
  dni,
  nombres,
  apellidos,
  cargo,
  telefono: '958123456',
  usuario: null,
  estado,
});

export const PERSONAL_MOCK: Personal[] = [
  personalMock('p1', 'Diana', 'Amamani', '45231098', 'SUPERVISOR'),
  personalMock('p2', 'Marco', 'Ipusari', '47210345', 'TECNICO_OPERADOR'),
  personalMock('p3', 'Jorge', 'Huamán', '46109287', 'TECNICO_OPERADOR'),
  personalMock('p4', 'Rosa', 'Agárate', '44982315', 'ADMINISTRADOR'),
  personalMock('p5', 'Luis', 'Beltrán', '48765123', 'TECNICO_OPERADOR', 'INACTIVO'),
];

export const CATALOGOS_TEXTO_MOCK: CatalogoTexto[] = [
  { id: 'hallazgos', titulo: 'Tipos de hallazgo', items: ['Roedores vivos', 'Excretas frescas', 'Daño en empaques', 'Nidos activos', 'Sin evidencia'] },
  { id: 'acciones-correctivas', titulo: 'Acciones correctivas', items: ['Sellado de perforación', 'Reubicación de estación', 'Retiro de cebo vencido', 'Refuerzo de cebado'] },
  { id: 'observaciones', titulo: 'Observaciones técnicas', items: ['Acceso restringido a zona', 'Condiciones de humedad elevada', 'Presencia de residuos orgánicos'] },
  { id: 'recomendaciones', titulo: 'Recomendaciones al cliente', items: ['Retirar cartones acumulados', 'Reparar tuberías con fuga', 'Mantener orden en almacén'] },
  { id: 'giros', titulo: 'Giros de negocio', items: ['Energía', 'Alimentos', 'Transporte', 'Construcción', 'Salud', 'Educación', 'Sector público'] },
  {
    id: 'motivos-modificacion',
    titulo: 'Motivos de modificación',
    items: ['Error de digitación en campo', 'Solicitud del cliente', 'Corrección de dato de insumo', 'Observación de auditoría'],
    soloAdministrador: true,
  },
];
