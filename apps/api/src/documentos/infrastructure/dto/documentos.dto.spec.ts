import { CrearDocumentoSchema, ListarDocumentosQuerySchema, TransicionarDocumentoSchema } from './documentos.dto';

const UUID = '22222222-2222-4222-8222-222222222222';

function mensajes(resultado: { success: boolean; error?: { issues: Array<{ path: Array<string | number>; message: string }> } }) {
  return resultado.error?.issues.map((i) => `${i.path.join('.')}: ${i.message}`) ?? [];
}

describe('DTOs de documentos', () => {
  it('crear exige cliente (UUID) y tipo INFORME o REPORTE', () => {
    expect(CrearDocumentoSchema.safeParse({ clienteId: UUID, tipo: 'INFORME' }).success).toBe(true);
    expect(mensajes(CrearDocumentoSchema.safeParse({ tipo: 'INFORME' }))).toContain('clienteId: El campo clienteId es obligatorio');
    expect(mensajes(CrearDocumentoSchema.safeParse({ clienteId: 'abc', tipo: 'INFORME' }))).toContain('clienteId: El clienteId debe ser un UUID válido');
    expect(mensajes(CrearDocumentoSchema.safeParse({ clienteId: UUID }))).toContain('tipo: El campo tipo es obligatorio y debe ser INFORME o REPORTE');
    expect(mensajes(CrearDocumentoSchema.safeParse({ clienteId: UUID, tipo: 'CERTIFICADO' }))).toContain(
      'tipo: El campo tipo es obligatorio y debe ser INFORME o REPORTE',
    );
  });

  it('transicionar exige un estado conocido y acepta un motivo corto', () => {
    expect(TransicionarDocumentoSchema.safeParse({ nuevoEstado: 'CERRADO', motivo: 'ok' }).success).toBe(true);
    expect(mensajes(TransicionarDocumentoSchema.safeParse({ nuevoEstado: 'EMITIDO' }))).toContain('nuevoEstado: Estado desconocido');
    expect(TransicionarDocumentoSchema.safeParse({ nuevoEstado: 'CERRADO', motivo: 'x'.repeat(501) }).success).toBe(false);
  });

  it('el listado filtra por estado, tipo y cliente, todos opcionales', () => {
    expect(ListarDocumentosQuerySchema.safeParse({}).success).toBe(true);
    expect(ListarDocumentosQuerySchema.safeParse({ estado: 'ENVIADO_A_REVISION', tipo: 'INFORME', clienteId: UUID }).success).toBe(true);
    expect(mensajes(ListarDocumentosQuerySchema.safeParse({ estado: 'PENDIENTE' }))).toContain('estado: Estado desconocido');
  });
});
