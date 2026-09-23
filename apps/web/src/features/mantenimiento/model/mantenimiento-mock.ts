import type { CatalogoTexto, Equipo, Insumo, PersonalOperativo } from './tipos';

export const INSUMOS_MOCK: Insumo[] = [
  { id: 'i1', nombre: 'Brodifacoum 0.005% bloque parafinado', principioActivo: 'Brodifacoum', presentacion: 'Bloque', concentracion: '0.005%', registroDigesa: 'DIG-2451-SA', dosisReferencial: '1 bloque por estación', estado: 'ACTIVO' },
  { id: 'i2', nombre: 'Cipermetrina 25% EC', principioActivo: 'Cipermetrina', presentacion: 'Líquido', concentracion: '25%', registroDigesa: 'DIG-1980-SA', dosisReferencial: '10 ml/L', estado: 'ACTIVO' },
  { id: 'i3', nombre: 'Bromadiolona 0.005% pellet', principioActivo: 'Bromadiolona', presentacion: 'Pellet', concentracion: '0.005%', registroDigesa: 'DIG-2510-SA', dosisReferencial: '1 sobre por estación', estado: 'ACTIVO' },
  { id: 'i4', nombre: 'Deltametrina 2.5% SC', principioActivo: 'Deltametrina', presentacion: 'Suspensión', concentracion: '2.5%', registroDigesa: 'DIG-1765-SA', dosisReferencial: '8 ml/L', estado: 'INACTIVO' },
];

export const EQUIPOS_MOCK: Equipo[] = [
  { id: 'e1', nombre: 'Nebulizadora ULV Vector Fog C-150', codigoInterno: 'EQ-014', tipo: 'Nebulización', estadoOperativo: 'OPERATIVO' },
  { id: 'e2', nombre: 'Aspersora de mochila 20L', codigoInterno: 'EQ-022', tipo: 'Aspersión', estadoOperativo: 'OPERATIVO' },
  { id: 'e3', nombre: 'Termonebulizadora Swingfog SN-50', codigoInterno: 'EQ-007', tipo: 'Termonebulización', estadoOperativo: 'EN_MANTENIMIENTO' },
  { id: 'e4', nombre: 'Detector de humedad', codigoInterno: 'EQ-031', tipo: 'Medición', estadoOperativo: 'FUERA_DE_SERVICIO' },
];

export const PERSONAL_MOCK: PersonalOperativo[] = [
  { id: 'p1', nombre: 'Diana Amamani', dni: '45231098', cargo: 'Supervisor', estado: 'ACTIVO' },
  { id: 'p2', nombre: 'Marco Ipusari', dni: '47210345', cargo: 'Técnico Operador', estado: 'ACTIVO' },
  { id: 'p3', nombre: 'Jorge Huamán', dni: '46109287', cargo: 'Técnico Operador', estado: 'ACTIVO' },
  { id: 'p4', nombre: 'Rosa Agárate', dni: '44982315', cargo: 'Administrador', estado: 'ACTIVO' },
  { id: 'p5', nombre: 'Luis Beltrán', dni: '48765123', cargo: 'Técnico Operador', estado: 'INACTIVO' },
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
