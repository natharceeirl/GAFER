import { DomainExceptionFilter } from './domain-exception.filter';
import { ArgumentsHost, BadRequestException, HttpStatus } from '@nestjs/common';

describe('DomainExceptionFilter', () => {
  let filter: DomainExceptionFilter;
  let mockResponse: any;
  let mockRequest: any;
  let mockHost: ArgumentsHost;

  beforeEach(() => {
    filter = new DomainExceptionFilter();

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockRequest = {
      url: '/test-endpoint',
    };

    mockHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    } as any;
  });

  it('debe mapear errores de unicidad/duplicidad a HTTP 409 Conflict', () => {
    const error = new Error('Ya existe un cliente registrado con el RUC: 20508565434');

    filter.catch(error, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.CONFLICT,
        error: 'Conflict',
        message: 'Ya existe un cliente registrado con el RUC: 20508565434',
        path: '/test-endpoint',
      }),
    );
  });

  it('debe mapear errores de entidad no encontrada a HTTP 404 Not Found', () => {
    const error = new Error('No se encontró el cliente con ID: 123');

    filter.catch(error, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.NOT_FOUND,
        error: 'Not Found',
        message: 'No se encontró el cliente con ID: 123',
      }),
    );
  });

  it('debe mapear errores de invariantes de dominio a HTTP 400 Bad Request', () => {
    const error = new Error('El RUC debe tener exactamente 11 dígitos numéricos');

    filter.catch(error, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.BAD_REQUEST,
        error: 'Bad Request',
        message: 'El RUC debe tener exactamente 11 dígitos numéricos',
      }),
    );
  });

  it('debe preservar excepciones HTTP propias de NestJS (ValidationPipe, etc.)', () => {
    const httpEx = new BadRequestException(['El RUC debe ser una cadena válida']);

    filter.catch(httpEx, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.BAD_REQUEST,
        message: ['El RUC debe ser una cadena válida'],
      }),
    );
  });
});
