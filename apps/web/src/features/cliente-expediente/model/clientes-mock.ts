export interface ClienteFila {
  id: string;
  codigoCorto: string;
  razonSocial: string;
  ruc: string;
  giro: string;
  ultimoServicio: string;
  proximoVencimiento: string | null;
  estado: 'ACTIVO' | 'INACTIVO';
}

export const CLIENTES_MOCK: ClienteFila[] = [
  { id: 'c1', codigoCorto: 'KALLPA', razonSocial: 'Kallpa Energía S.A.', ruc: '20512345678', giro: 'Energía', ultimoServicio: '2026-09-05', proximoVencimiento: '2026-10-14', estado: 'ACTIVO' },
  { id: 'c2', codigoCorto: 'SAMAY', razonSocial: 'Samay Alimentos E.I.R.L.', ruc: '20489012345', giro: 'Alimentos', ultimoServicio: '2026-09-08', proximoVencimiento: '2026-09-30', estado: 'ACTIVO' },
  { id: 'c3', codigoCorto: 'PETROPERU', razonSocial: 'Petróleos del Perú S.A.', ruc: '20100128218', giro: 'Energía', ultimoServicio: '2026-08-30', proximoVencimiento: '2026-09-12', estado: 'ACTIVO' },
  { id: 'c4', codigoCorto: 'MINACORP', razonSocial: 'Minacorp Sociedad Minera S.A.C.', ruc: '20601234567', giro: 'Construcción', ultimoServicio: '2026-09-10', proximoVencimiento: '2026-11-02', estado: 'ACTIVO' },
  { id: 'c5', codigoCorto: 'CONSTRUYE_SAC', razonSocial: 'Construye S.A.C.', ruc: '20556677889', giro: 'Construcción', ultimoServicio: '2026-09-09', proximoVencimiento: '2026-10-01', estado: 'ACTIVO' },
  { id: 'c6', codigoCorto: 'AGROSUR', razonSocial: 'Agrosur Exportadora S.A.', ruc: '20498765432', giro: 'Alimentos', ultimoServicio: '2026-06-08', proximoVencimiento: null, estado: 'ACTIVO' },
  { id: 'c7', codigoCorto: 'TRANSANDES', razonSocial: 'Transandes Logística S.A.C.', ruc: '20512309876', giro: 'Transporte', ultimoServicio: '2026-09-01', proximoVencimiento: '2026-09-25', estado: 'ACTIVO' },
  { id: 'c8', codigoCorto: 'CLINIVIDA', razonSocial: 'Clínica Vida S.A.C.', ruc: '20523456781', giro: 'Salud', ultimoServicio: '2026-09-11', proximoVencimiento: '2026-12-01', estado: 'ACTIVO' },
  { id: 'c9', codigoCorto: 'MUNIQPA', razonSocial: 'Municipalidad Provincial de Q.', ruc: '20147852369', giro: 'Sector público', ultimoServicio: '2026-08-20', proximoVencimiento: '2026-09-18', estado: 'ACTIVO' },
  { id: 'c10', codigoCorto: 'FRIGOSUR', razonSocial: 'Frigorífico del Sur S.A.C.', ruc: '20534567890', giro: 'Alimentos', ultimoServicio: '2026-09-07', proximoVencimiento: '2026-09-29', estado: 'ACTIVO' },
  { id: 'c11', codigoCorto: 'VARIOS', razonSocial: 'Clientes persona natural (varios)', ruc: '12345678910', giro: '—', ultimoServicio: '2026-08-15', proximoVencimiento: null, estado: 'ACTIVO' },
  { id: 'c12', codigoCorto: 'PLASTIQ', razonSocial: 'Plastiq Industrial S.A.', ruc: '20567123489', giro: 'Construcción', ultimoServicio: '2025-11-02', proximoVencimiento: null, estado: 'INACTIVO' },
  { id: 'c13', codigoCorto: 'HOTELREAL', razonSocial: 'Hotel Real Arequipa S.A.C.', ruc: '20589123456', giro: 'Salud', ultimoServicio: '2026-09-03', proximoVencimiento: '2026-10-20', estado: 'ACTIVO' },
  { id: 'c14', codigoCorto: 'VIALSUR', razonSocial: 'Vial Sur Concesiones S.A.', ruc: '20599887766', giro: 'Transporte', ultimoServicio: '2026-07-18', proximoVencimiento: '2026-09-16', estado: 'ACTIVO' },
  { id: 'c15', codigoCorto: 'TEXPACIFICO', razonSocial: 'Textiles del Pacífico S.A.C.', ruc: '20544332211', giro: 'Construcción', ultimoServicio: '2026-09-02', proximoVencimiento: '2026-09-14', estado: 'ACTIVO' },
];
