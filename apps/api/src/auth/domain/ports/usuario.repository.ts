import { Usuario } from '../usuario';

export interface UsuarioRepository {
  buscarPorUsuario(usuario: string): Promise<Usuario | null>;
  buscarPorId(id: string): Promise<Usuario | null>;
}

export const USUARIO_REPOSITORY = Symbol('USUARIO_REPOSITORY');
