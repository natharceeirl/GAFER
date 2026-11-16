import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EstadoTrabajo } from '@gafer/contracts';
import { CambiarEstadoTrabajoServicioUseCase } from './cambiar-estado-trabajo-servicio.usecase';
import { ServicioContratado } from '../domain/servicio-contratado';
import { ServicioContratadoRepository } from '../domain/ports/servicio-contratado.repository';
import { AuditoriaService } from '../../shared/auditoria/auditoria.service';

describe('CambiarEstadoTrabajoServicioUseCase (GAF-99)', () => {
  const ACTOR = { actorId: 'a1b2c3d4-0000-4000-8000-000000000001', actorUsuario: 'ADMIN.GAFER', actorRol: 'ADMINISTRADOR' };
  let repo: jest.Mocked<ServicioContratadoRepository>;
  let auditoria: { registrarEvento: jest.Mock };
  let useCase: CambiarEstadoTrabajoServicioUseCase;

  function servicioEn(estadoTrabajo: EstadoTrabajo) {
    return new ServicioContratado({
      id: 's1',
      proyectoId: 'p1',
      tipoServicio: 'DSF',
      frecuencia: 'MENSUAL',
      areaTotalM2: 100,
      areaTratarM2: 80,
      estadoTrabajo,
    });
  }

  beforeEach(() => {
    repo = { guardar: jest.fn().mockResolvedValue(undefined), buscarPorId: jest.fn(), buscarPorProyectoId: jest.fn() };
    auditoria = { registrarEvento: jest.fn().mockResolvedValue({ id: 'evt-1' }) };
    useCase = new CambiarEstadoTrabajoServicioUseCase(repo, auditoria as unknown as AuditoriaService);
  });

  it('guarda el nuevo estado y registra en la auditoría el actor, el valor anterior, el nuevo y el motivo', async () => {
    repo.buscarPorId.mockResolvedValue(servicioEn('EN_CURSO'));

    const servicio = await useCase.execute({ id: 's1', estado: 'CANCELADO', motivo: 'Cliente suspendió', ...ACTOR });

    expect(servicio.getEstadoTrabajo()).toBe('CANCELADO');
    expect(repo.guardar).toHaveBeenCalledWith(servicio);
    expect(auditoria.registrarEvento).toHaveBeenCalledWith({
      ...ACTOR,
      modulo: 'MANTENIMIENTO',
      accion: 'CAMBIAR_ESTADO_TRABAJO_SERVICIO',
      entidad: 'servicio_contratado',
      entidadId: 's1',
      payloadAnterior: { estadoTrabajo: 'EN_CURSO' },
      payloadNuevo: { estadoTrabajo: 'CANCELADO', motivo: 'Cliente suspendió' },
      detalles: { reapertura: false },
    });
  });

  it('una reapertura queda marcada en la auditoría', async () => {
    repo.buscarPorId.mockResolvedValue(servicioEn('COMPLETADO'));

    await useCase.execute({ id: 's1', estado: 'EN_CURSO', motivo: 'Faltó un ambiente', ...ACTOR });

    expect(auditoria.registrarEvento).toHaveBeenCalledWith(
      expect.objectContaining({
        accion: 'REABRIR_SERVICIO',
        payloadAnterior: { estadoTrabajo: 'COMPLETADO' },
        payloadNuevo: { estadoTrabajo: 'EN_CURSO', motivo: 'Faltó un ambiente' },
        detalles: { reapertura: true },
      }),
    );
  });

  it('sin motivo, iniciar registra el motivo como nulo', async () => {
    repo.buscarPorId.mockResolvedValue(servicioEn('PENDIENTE'));

    await useCase.execute({ id: 's1', estado: 'EN_CURSO', ...ACTOR });

    expect(auditoria.registrarEvento).toHaveBeenCalledWith(
      expect.objectContaining({ payloadNuevo: { estadoTrabajo: 'EN_CURSO', motivo: null } }),
    );
  });

  it('404 si el servicio no existe, sin guardar ni auditar', async () => {
    repo.buscarPorId.mockResolvedValue(null);

    await expect(useCase.execute({ id: 'nada', estado: 'EN_CURSO', ...ACTOR })).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.guardar).not.toHaveBeenCalled();
    expect(auditoria.registrarEvento).not.toHaveBeenCalled();
  });

  it('400 con el mensaje de la regla si la transición no está permitida, sin guardar ni auditar', async () => {
    repo.buscarPorId.mockResolvedValue(servicioEn('COMPLETADO'));

    const error = await useCase.execute({ id: 's1', estado: 'PENDIENTE', ...ACTOR }).catch((e) => e);

    expect(error).toBeInstanceOf(BadRequestException);
    expect(error.getResponse()).toEqual(expect.objectContaining({ message: 'No se puede pasar el servicio de COMPLETADO a PENDIENTE' }));
    expect(repo.guardar).not.toHaveBeenCalled();
    expect(auditoria.registrarEvento).not.toHaveBeenCalled();
  });

  it('400 señalando el campo motivo si se reabre sin motivo', async () => {
    repo.buscarPorId.mockResolvedValue(servicioEn('CANCELADO'));

    const error = await useCase.execute({ id: 's1', estado: 'EN_CURSO', ...ACTOR }).catch((e) => e);

    expect(error).toBeInstanceOf(BadRequestException);
    expect(error.getResponse()).toEqual(
      expect.objectContaining({ errors: [{ path: 'motivo', message: expect.stringMatching(/motivo es obligatorio para reabrir/) }] }),
    );
    expect(repo.guardar).not.toHaveBeenCalled();
  });
});
