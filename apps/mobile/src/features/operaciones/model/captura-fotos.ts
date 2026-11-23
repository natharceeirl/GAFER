/**
 * GAFER Mobile — Adaptador de Captura de Fotografías (Cámara / Galería)
 * Encapsula `expo-image-picker` tras un puerto hexagonal para permitir pruebas unitarias
 * sin módulos nativos y cumplir §13.1.1 (recuperación de captura pendiente en Android).
 */

export interface FotoCapturada {
  uri: string;
  nombre: string;
  mimeType: string;
  tamanoBytes?: number;
  buffer?: Uint8Array;
  base64?: string;
}

export interface CapturadorFotosPort {
  capturarDesdeCamara(): Promise<FotoCapturada | null>;
  seleccionarDeGaleria(): Promise<FotoCapturada | null>;
  recuperarCapturaPendiente?(): Promise<FotoCapturada | null>;
}

export interface ExpoImagePickerAssetLike {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
  fileSize?: number;
  base64?: string | null;
}

export interface ExpoImagePickerResultLike {
  canceled: boolean;
  assets: ExpoImagePickerAssetLike[] | null;
}

export interface ExpoImagePickerModuleLike {
  requestCameraPermissionsAsync(): Promise<{ granted: boolean }>;
  requestMediaLibraryPermissionsAsync(): Promise<{ granted: boolean }>;
  launchCameraAsync(options?: Record<string, unknown>): Promise<ExpoImagePickerResultLike>;
  launchImageLibraryAsync(options?: Record<string, unknown>): Promise<ExpoImagePickerResultLike>;
  getPendingResultAsync(): Promise<ExpoImagePickerResultLike | { code: string; message: string } | null>;
}

function cargarModuloExpoImagePicker(): ExpoImagePickerModuleLike {
  // Referencia estática literal obligatoria para que Metro incluya expo-image-picker en el bundle.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('expo-image-picker') as ExpoImagePickerModuleLike;
}

function mapearAssetAFoto(asset: ExpoImagePickerAssetLike): FotoCapturada {
  const nombreDesdeUri = asset.uri.split('/').pop() || `evidencia_${Date.now()}.jpg`;
  return {
    uri: asset.uri,
    nombre: asset.fileName || nombreDesdeUri,
    mimeType: asset.mimeType || 'image/jpeg',
    tamanoBytes: asset.fileSize,
    base64: asset.base64 ?? undefined,
  };
}

/**
 * Implementación nativa de captura de cámara y galería sobre `expo-image-picker`.
 */
export class ExpoImagePickerCapturador implements CapturadorFotosPort {
  private readonly pickerMod?: ExpoImagePickerModuleLike;

  constructor(pickerMod?: ExpoImagePickerModuleLike) {
    this.pickerMod = pickerMod;
  }

  private obtenerPicker(): ExpoImagePickerModuleLike {
    return this.pickerMod ?? cargarModuloExpoImagePicker();
  }

  async capturarDesdeCamara(): Promise<FotoCapturada | null> {
    const picker = this.obtenerPicker();
    const permiso = await picker.requestCameraPermissionsAsync();
    if (!permiso.granted) {
      throw new Error('Se requiere permiso de cámara para capturar fotografías de evidencia.');
    }

    const resultado = await picker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsEditing: false,
      exif: false,
    });

    if (resultado.canceled || !resultado.assets || resultado.assets.length === 0) {
      return null;
    }

    return mapearAssetAFoto(resultado.assets[0]);
  }

  async seleccionarDeGaleria(): Promise<FotoCapturada | null> {
    const picker = this.obtenerPicker();
    const permiso = await picker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) {
      throw new Error('Se requiere permiso de galería para seleccionar fotografías de evidencia.');
    }

    const resultado = await picker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsEditing: false,
      exif: false,
    });

    if (resultado.canceled || !resultado.assets || resultado.assets.length === 0) {
      return null;
    }

    return mapearAssetAFoto(resultado.assets[0]);
  }

  async recuperarCapturaPendiente(): Promise<FotoCapturada | null> {
    const picker = this.obtenerPicker();
    if (typeof picker.getPendingResultAsync !== 'function') {
      return null;
    }
    const pendiente = await picker.getPendingResultAsync();
    if (!pendiente || !('canceled' in pendiente) || pendiente.canceled || !pendiente.assets?.length) {
      return null;
    }
    return mapearAssetAFoto(pendiente.assets[0]);
  }
}

let capturadorPorDefecto: CapturadorFotosPort | null = null;

export function obtenerCapturadorFotos(): CapturadorFotosPort {
  if (!capturadorPorDefecto) {
    capturadorPorDefecto = new ExpoImagePickerCapturador();
  }
  return capturadorPorDefecto;
}

export function configurarCapturadorFotos(capturador: CapturadorFotosPort | null): void {
  capturadorPorDefecto = capturador;
}
