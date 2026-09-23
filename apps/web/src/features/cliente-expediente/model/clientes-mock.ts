export interface ContactoCliente {
  nombre: string;
  cargo: string;
  telefono: string;
  correo: string;
}

/** Cliente de la cartera con su ficha de datos generales (§3, §7.1). */
export interface ClienteFila {
  id: string;
  codigoCorto: string;
  razonSocial: string;
  ruc: string;
  giro: string;
  direccionFiscal: string;
  contacto: ContactoCliente;
  ultimoServicio: string | null;
  proximoVencimiento: string | null;
  /** Días de anticipación con que se avisa el vencimiento del certificado (§3, configurable). */
  anticipacionAlertaDias: number;
  estado: 'ACTIVO' | 'INACTIVO';
}

type SinFicha = Omit<ClienteFila, 'direccionFiscal' | 'contacto' | 'anticipacionAlertaDias'>;

function conFicha(c: SinFicha, direccionFiscal: string, contacto: ContactoCliente, anticipacionAlertaDias = 30): ClienteFila {
  return { ...c, direccionFiscal, contacto, anticipacionAlertaDias };
}

export const CLIENTES_MOCK: ClienteFila[] = [
  conFicha(
    { id: 'c1', codigoCorto: 'KALLPA', razonSocial: 'Kallpa Energía S.A.', ruc: '20512345678', giro: 'Energía', ultimoServicio: '2026-09-05', proximoVencimiento: '2026-10-14', estado: 'ACTIVO' },
    'Av. Víctor Andrés Belaúnde 147, San Isidro, Lima',
    { nombre: 'Rosa Contreras', cargo: 'Jefa de Planta', telefono: '959 214 380', correo: 'rcontreras@kallpa.pe' },
    45,
  ),
  conFicha(
    { id: 'c2', codigoCorto: 'SAMAY', razonSocial: 'Samay Alimentos E.I.R.L.', ruc: '20489012345', giro: 'Alimentos', ultimoServicio: '2026-09-08', proximoVencimiento: '2026-09-30', estado: 'ACTIVO' },
    'Calle Los Arces 320, Cayma, Arequipa',
    { nombre: 'Luis Beltrán Paz', cargo: 'Jefe de Almacén', telefono: '958 107 442', correo: 'lbeltran@samay.com.pe' },
  ),
  conFicha(
    { id: 'c3', codigoCorto: 'PETROPERU', razonSocial: 'Petróleos del Perú S.A.', ruc: '20100128218', giro: 'Energía', ultimoServicio: '2026-08-30', proximoVencimiento: '2026-09-12', estado: 'ACTIVO' },
    'Av. Enrique Canaval Moreyra 150, San Isidro, Lima',
    { nombre: 'Ana Quispe Huamaní', cargo: 'Jefa de Seguridad', telefono: '054 381 220', correo: 'aquispe@petroperu.com.pe' },
    60,
  ),
  conFicha(
    { id: 'c4', codigoCorto: 'MINACORP', razonSocial: 'Minacorp Sociedad Minera S.A.C.', ruc: '20601234567', giro: 'Construcción', ultimoServicio: '2026-09-10', proximoVencimiento: '2026-11-02', estado: 'ACTIVO' },
    'Carretera a Yura km 12, Cerro Colorado, Arequipa',
    { nombre: 'Jorge Mamani Ccori', cargo: 'Superintendente SSOMA', telefono: '974 552 016', correo: 'jmamani@minacorp.pe' },
  ),
  conFicha(
    { id: 'c5', codigoCorto: 'CONSTRUYE_SAC', razonSocial: 'Construye S.A.C.', ruc: '20556677889', giro: 'Construcción', ultimoServicio: '2026-09-09', proximoVencimiento: '2026-10-01', estado: 'ACTIVO' },
    'Av. Aviación 1880, José Luis Bustamante y Rivero, Arequipa',
    { nombre: 'Patricia Flores', cargo: 'Residente de Obra', telefono: '951 330 874', correo: 'pflores@construye.pe' },
  ),
  conFicha(
    { id: 'c6', codigoCorto: 'AGROSUR', razonSocial: 'Agrosur Exportadora S.A.', ruc: '20498765432', giro: 'Alimentos', ultimoServicio: '2026-06-08', proximoVencimiento: null, estado: 'ACTIVO' },
    'Fundo La Joya s/n, La Joya, Arequipa',
    { nombre: 'Martín Salas Vera', cargo: 'Gerente de Operaciones', telefono: '959 870 221', correo: 'msalas@agrosur.com.pe' },
  ),
  conFicha(
    { id: 'c7', codigoCorto: 'TRANSANDES', razonSocial: 'Transandes Logística S.A.C.', ruc: '20512309876', giro: 'Transporte', ultimoServicio: '2026-09-01', proximoVencimiento: '2026-09-25', estado: 'ACTIVO' },
    'Av. Parra 410, Arequipa',
    { nombre: 'Carla Rivas', cargo: 'Coordinadora de Flota', telefono: '957 441 902', correo: 'crivas@transandes.pe' },
    15,
  ),
  conFicha(
    { id: 'c8', codigoCorto: 'CLINIVIDA', razonSocial: 'Clínica Vida S.A.C.', ruc: '20523456781', giro: 'Salud', ultimoServicio: '2026-09-11', proximoVencimiento: '2026-12-01', estado: 'ACTIVO' },
    'Av. Ejército 725, Yanahuara, Arequipa',
    { nombre: 'Dra. Silvia Núñez', cargo: 'Directora Administrativa', telefono: '054 250 118', correo: 'snunez@clinicavida.pe' },
    60,
  ),
  conFicha(
    { id: 'c9', codigoCorto: 'MUNIQPA', razonSocial: 'Municipalidad Provincial de Q.', ruc: '20147852369', giro: 'Sector público', ultimoServicio: '2026-08-20', proximoVencimiento: '2026-09-18', estado: 'ACTIVO' },
    'Plaza de Armas s/n, Quequeña, Arequipa',
    { nombre: 'Raúl Ticona', cargo: 'Subgerente de Servicios Públicos', telefono: '054 431 006', correo: 'rticona@muniq.gob.pe' },
  ),
  conFicha(
    { id: 'c10', codigoCorto: 'FRIGOSUR', razonSocial: 'Frigorífico del Sur S.A.C.', ruc: '20534567890', giro: 'Alimentos', ultimoServicio: '2026-09-07', proximoVencimiento: '2026-09-29', estado: 'ACTIVO' },
    'Parque Industrial Río Seco Mz. F Lote 9, Cerro Colorado, Arequipa',
    { nombre: 'Elena Cutipa', cargo: 'Jefa de Calidad', telefono: '958 663 510', correo: 'ecutipa@frigosur.pe' },
  ),
  conFicha(
    { id: 'c11', codigoCorto: 'VARIOS', razonSocial: 'Clientes persona natural (varios)', ruc: '12345678910', giro: '—', ultimoServicio: '2026-08-15', proximoVencimiento: null, estado: 'ACTIVO' },
    'Registro interno de GAFER para personas naturales',
    { nombre: 'Atención al cliente GAFER', cargo: 'Registro de personas naturales', telefono: '054 000 000', correo: 'clientes@gafer.pe' },
  ),
  conFicha(
    { id: 'c12', codigoCorto: 'PLASTIQ', razonSocial: 'Plastiq Industrial S.A.', ruc: '20567123489', giro: 'Construcción', ultimoServicio: '2025-11-02', proximoVencimiento: null, estado: 'INACTIVO' },
    'Av. Jesús 1105, Paucarpata, Arequipa',
    { nombre: 'Hugo Díaz', cargo: 'Jefe de Mantenimiento', telefono: '954 227 118', correo: 'hdiaz@plastiq.pe' },
  ),
  conFicha(
    { id: 'c13', codigoCorto: 'HOTELREAL', razonSocial: 'Hotel Real Arequipa S.A.C.', ruc: '20589123456', giro: 'Salud', ultimoServicio: '2026-09-03', proximoVencimiento: '2026-10-20', estado: 'ACTIVO' },
    'Calle Santa Catalina 208, Cercado, Arequipa',
    { nombre: 'Verónica Pinto', cargo: 'Ama de Llaves Ejecutiva', telefono: '054 212 900', correo: 'vpinto@hotelreal.pe' },
  ),
  conFicha(
    { id: 'c14', codigoCorto: 'VIALSUR', razonSocial: 'Vial Sur Concesiones S.A.', ruc: '20599887766', giro: 'Transporte', ultimoServicio: '2026-07-18', proximoVencimiento: '2026-09-16', estado: 'ACTIVO' },
    'Variante de Uchumayo km 5, Sachaca, Arequipa',
    { nombre: 'Fernando Apaza', cargo: 'Jefe de Operaciones', telefono: '959 118 764', correo: 'fapaza@vialsur.pe' },
  ),
  conFicha(
    { id: 'c15', codigoCorto: 'TEXPACIFICO', razonSocial: 'Textiles del Pacífico S.A.C.', ruc: '20544332211', giro: 'Construcción', ultimoServicio: '2026-09-02', proximoVencimiento: '2026-09-14', estado: 'ACTIVO' },
    'Av. Los Incas 530, José Luis Bustamante y Rivero, Arequipa',
    { nombre: 'Gabriela Chávez', cargo: 'Jefa de Planta', telefono: '957 902 336', correo: 'gchavez@texpacifico.pe' },
  ),
];
