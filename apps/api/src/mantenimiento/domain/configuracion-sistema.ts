export class ConfiguracionSistema {
  constructor(
    public readonly id: string = 'global',
    public directorNombre: string = 'Ing. Carlos Medina Ruiz',
    public directorCip: string = '84512',
    public directorFirma: string | null = null,
    public resolucionSanitaria: string = '0023-2024-DESA/MINSA',
    public parametros: Record<string, unknown> = {},
    public actualizadoPor: string | null = null,
    public readonly updatedAt?: Date,
  ) {}

  actualizarDirector(nombre: string, cip: string, firma?: string | null): void {
    const nombreLimpio = nombre.trim();
    if (!nombreLimpio) {
      throw new Error('El nombre del Director Técnico es obligatorio');
    }
    const cipLimpio = cip.trim();
    if (!/^\d{4,7}$/.test(cipLimpio)) {
      throw new Error('El CIP debe contener entre 4 y 7 dígitos numéricos');
    }

    this.directorNombre = nombreLimpio;
    this.directorCip = cipLimpio;
    if (firma !== undefined) {
      this.directorFirma = firma;
    }
  }

  actualizarResolucionSanitaria(resolucion: string): void {
    const limpia = resolucion.trim();
    if (!limpia) {
      throw new Error('La resolución sanitaria no puede estar vacía');
    }
    this.resolucionSanitaria = limpia;
  }

  actualizarParametros(parametros: Record<string, unknown>): void {
    this.parametros = { ...this.parametros, ...parametros };
  }
}
