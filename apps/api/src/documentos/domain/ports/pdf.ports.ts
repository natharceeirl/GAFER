/**
 * Puertos de la generación asíncrona del PDF (GAF-54 / PoC GAF-41).
 * El servidor HTTP solo encola; `apps/worker` renderiza. El motor concreto vive detrás de
 * `PdfRendererPort` para poder cambiarlo sin tocar el caso de uso.
 */

export interface EmpresaPdf {
  razonSocial: string | null;
  ruc: string | null;
  direccion: string | null;
  telefono: string | null;
}

export interface DirectorTecnicoPdf {
  nombre: string;
  cip: string;
}

export interface ClientePdf {
  razonSocial: string;
  ruc: string;
  direccionFiscal: string;
  giroNegocio: string;
  contactoNombre: string;
  contactoCargo: string;
  contactoTelefono: string;
}

export interface SedePdf {
  nombre: string;
  direccion: string;
  distrito: string;
  provincia: string;
  departamento: string;
  contactoNombre: string;
  contactoCargo: string;
}

export interface InsumoPdf {
  producto: string;
  principioActivo: string;
  registroDigesa: string;
  concentracion: string;
  presentacion: string;
}

export interface ServicioPdf {
  tipoServicio: string;
  frecuencia: string;
  areaTotalM2: number;
  areaTratarM2: number;
  insumos: InsumoPdf[];
  equipos: string[];
}

export interface PersonalPdf {
  nombre: string;
  cargo: string;
}

export interface InspeccionPdf {
  codigo: string;
  fechaEjecucion: string;
  horaInicio: string | null;
  horaFin: string | null;
}

export interface FotoPdf {
  imagen: Buffer;
  fecha: string;
  hora: string;
}

/** Todo lo que el renderizador necesita: datos ya resueltos, sin acceso a la base. */
export interface DatosInformePdf {
  documento: {
    id: string;
    tipo: string;
    codigo: string;
    numeroCorrelativo: number;
    estado: string;
    /** AAAA-MM-DD */
    fecha: string;
  };
  /** Datos de GAFER. Un campo sin configurar llega `null`: el PDF lo marca, no inventa. */
  empresa: EmpresaPdf;
  director: DirectorTecnicoPdf;
  cliente: ClientePdf;
  sede: SedePdf | null;
  servicios: ServicioPdf[];
  personal: PersonalPdf[];
  inspeccion: InspeccionPdf | null;
  /** Quién aprobó el documento (historial de transiciones), si consta. */
  aprobadoPor: string | null;
  /** Hasta 20 fotos seleccionadas (sección 7). Vacío mientras no exista la selección de fotos. */
  fotos: FotoPdf[];
}

export interface PdfRendererPort {
  renderizar(datos: DatosInformePdf): Promise<Buffer>;
}
export const PDF_RENDERER = Symbol('PDF_RENDERER');

/** Lectura de todo lo que lleva el PDF (documento, cliente, sede, servicio, personal, empresa). */
export interface DocumentoPdfDatosPort {
  cargar(documentoId: string): Promise<DatosInformePdf | null>;
}
export const DOCUMENTO_PDF_DATOS = Symbol('DOCUMENTO_PDF_DATOS');

/** Almacenamiento de archivos (MinIO / S3). */
export interface AlmacenPdfPort {
  guardar(clave: string, contenido: Buffer): Promise<void>;
  /** `null` si el objeto no existe. */
  obtener(clave: string): Promise<Buffer | null>;
}
export const ALMACEN_PDF = Symbol('ALMACEN_PDF');

/** Cola de trabajos (Redis). Encolar puede fallar: quien llama debe dejar constancia del error. */
export interface ColaPdfPort {
  encolar(documentoId: string): Promise<void>;
}
export const COLA_PDF = Symbol('COLA_PDF');

export const COLA_GENERAR_PDF = 'generar-pdf';
export interface TrabajoGenerarPdf {
  documentoId: string;
}
