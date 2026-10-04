import { ConfiguracionSistema } from '../configuracion-sistema';

export interface ConfiguracionRepository {
  obtener(): Promise<ConfiguracionSistema>;
  guardar(config: ConfiguracionSistema): Promise<void>;
}

export const CONFIGURACION_REPOSITORY = Symbol('CONFIGURACION_REPOSITORY');
