import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Documento } from '../domain/documento';
import { DOCUMENTO_REPOSITORY, DocumentoRepository } from '../domain/ports/documento.repository';
import {
  NUMERADOR_CORRELATIVO,
  NumeradorCorrelativoPort,
  TipoDocumento,
} from '../domain/ports/numerador-correlativo.port';

@Injectable()
export class CrearDocumentoUseCase {
  constructor(
    @Inject(DOCUMENTO_REPOSITORY) private readonly repo: DocumentoRepository,
    @Inject(NUMERADOR_CORRELATIVO) private readonly numerador: NumeradorCorrelativoPort,
  ) {}

  async ejecutar(clienteId: string, tipo: TipoDocumento): Promise<Documento> {
    const numero = await this.numerador.siguienteNumero(clienteId, tipo);
    const documento = new Documento(randomUUID(), clienteId, numero);
    await this.repo.guardar(documento);
    return documento;
  }
}
