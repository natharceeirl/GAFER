import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ACTOR_SISTEMA, ActorDocumento, construirCodigoDocumento, Documento } from '../domain/documento';
import { CLIENTE_CODIGO, ClienteCodigoPort } from '../domain/ports/cliente-codigo.port';
import { DOCUMENTO_REPOSITORY, DocumentoRepository } from '../domain/ports/documento.repository';
import {
  NUMERADOR_CORRELATIVO,
  NumeradorCorrelativoPort,
  TipoDocumento,
} from '../domain/ports/numerador-correlativo.port';
import { TRANSACCION, TransaccionPort } from '../domain/ports/transaccion.port';

/** Año calendario en hora de Lima: solo etiqueta el código, nunca reinicia el contador. */
function anioActual(): number {
  return Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Lima', year: 'numeric' }).format(new Date()));
}

@Injectable()
export class CrearDocumentoUseCase {
  constructor(
    @Inject(DOCUMENTO_REPOSITORY) private readonly repo: DocumentoRepository,
    @Inject(NUMERADOR_CORRELATIVO) private readonly numerador: NumeradorCorrelativoPort,
    @Inject(CLIENTE_CODIGO) private readonly clientes: ClienteCodigoPort,
    @Inject(TRANSACCION) private readonly transaccion: TransaccionPort,
  ) {}

  /**
   * Número y documento se guardan en una sola transacción: si el guardado falla, el número vuelve
   * al contador y la secuencia no queda con huecos.
   */
  async ejecutar(
    clienteId: string,
    tipo: TipoDocumento,
    actor: ActorDocumento = ACTOR_SISTEMA,
    proyectoId: string | null = null,
  ): Promise<Documento> {
    return this.transaccion.ejecutar(async (contexto) => {
      const codigoCliente = await this.clientes.buscarCodigoCorto(clienteId, contexto);
      if (codigoCliente === null) {
        throw new NotFoundException(`Cliente ${clienteId} no encontrado`);
      }
      const numero = await this.numerador.siguienteNumero(clienteId, tipo, contexto);
      const documento = new Documento(randomUUID(), clienteId, numero, {
        tipo,
        proyectoId,
        creadoPor: actor,
        codigo: construirCodigoDocumento({ tipo, codigoCliente, numero, anio: anioActual() }),
      });
      documento.registrarCreacion(actor);
      await this.repo.guardar(documento, contexto);
      return documento;
    });
  }
}
