import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MantenimientoPage } from './MantenimientoPage';
import { useSesion } from '../../../shared/api/sesion';
import type { Rol } from '../../auth/model/roles';
import { catalogoApi, crearEstadoApi, equipoApi, insumoApi, llamadasA, personalApi, simularApiMantenimiento, type EstadoApi } from '../pruebas/api-mantenimiento-simulada';

const fetchMock = vi.fn();

function montar(rol: Rol, estado: EstadoApi = crearEstadoApi()) {
  simularApiMantenimiento(fetchMock, estado);
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <MantenimientoPage rol={rol} />
    </QueryClientProvider>,
  );
}

const escribir = (etiqueta: string, valor: string) => fireEvent.change(screen.getByLabelText(etiqueta), { target: { value: valor } });
const pdf = (nombre: string) => new File(['%PDF-1.4'], nombre, { type: 'application/pdf' });
const irA = (seccion: string) => fireEvent.click(within(screen.getByRole('navigation', { name: 'Secciones de mantenimiento' })).getByRole('button', { name: seccion }));

async function llenarInsumoNuevo(digesa = 'DIG-1980-SA') {
  escribir('Nombre comercial', 'Cipermetrina 25% EC');
  escribir('Principio activo', 'Cipermetrina');
  escribir('Presentación', 'LIQUIDO');
  escribir('Unidad de medida', 'ML');
  escribir('Registro DIGESA', digesa);
  escribir('Concentración', '25%');
  escribir('Dosis estándar', '10 ml/L');
  fireEvent.change(screen.getByLabelText('Ficha técnica (PDF)'), { target: { files: [pdf('ficha.pdf')] } });
  await screen.findByText('Archivo cargado: ficha.pdf');
  fireEvent.change(screen.getByLabelText('Hoja de seguridad MSDS (PDF)'), { target: { files: [pdf('msds.pdf')] } });
  await screen.findByText('Archivo cargado: msds.pdf');
}

describe('MantenimientoPage', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    sessionStorage.clear();
    useSesion.setState({ token: 'jwt', usuario: null });
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  describe('por rol', () => {
    it('el Administrador ve todas las secciones y abre en insumos', async () => {
      montar('ADMINISTRADOR', crearEstadoApi({ insumos: [insumoApi(1)] }));

      const nav = screen.getByRole('navigation', { name: 'Secciones de mantenimiento' });
      expect(within(nav).getAllByRole('button').map((b) => b.textContent)).toEqual(['Insumos', 'Equipos', 'Personal', 'Configuración', 'Catálogos de texto']);
      expect(await screen.findByText('Insumo 1')).toBeInTheDocument();
    });

    it('el Supervisor ve solo catálogos de texto y configuración, abre en catálogos y no consulta insumos, equipos ni personal', async () => {
      montar('SUPERVISOR', crearEstadoApi({ rol: 'SUPERVISOR', catalogos: [catalogoApi('giros', 'Giros de negocio', ['Energía'])] }));

      const nav = screen.getByRole('navigation', { name: 'Secciones de mantenimiento' });
      expect(within(nav).getAllByRole('button').map((b) => b.textContent)).toEqual(['Catálogos de texto', 'Configuración']);
      expect(await screen.findByRole('heading', { name: 'Giros de negocio' })).toBeInTheDocument();

      irA('Configuración');
      expect(await screen.findByText(/Solo el Administrador puede modificarla/)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Guardar configuración' })).toBeNull();
      expect(fetchMock.mock.calls.map(([url]) => new URL(String(url)).pathname)).not.toContainEqual(expect.stringMatching(/insumos|equipos|personal/));
    });

    it('si el API rechaza al rol (403) la sección lo dice con claridad y la página sigue usable', async () => {
      montar('ADMINISTRADOR', crearEstadoApi({ prohibido: true }));

      expect(await screen.findByRole('alert')).toHaveTextContent('No tiene permiso para ver los insumos.');
      irA('Equipos');
      expect(await screen.findByText(/No tiene permiso para ver los equipos/)).toBeInTheDocument();
      irA('Configuración');
      expect(await screen.findByLabelText('Nombre completo')).toBeInTheDocument();
    });
  });

  describe('insumos', () => {
    it('crea un insumo: sube la ficha y la MSDS, lo guarda con sus claves y vuelve a la lista', async () => {
      const estado = crearEstadoApi();
      montar('ADMINISTRADOR', estado);

      fireEvent.click(await screen.findByRole('button', { name: 'Nuevo insumo' }));
      await llenarInsumoNuevo();
      fireEvent.click(screen.getByRole('button', { name: 'Registrar insumo' }));

      expect(await screen.findByText('Insumo registrado.')).toBeInTheDocument();
      expect(screen.getByText('Cipermetrina 25% EC')).toBeInTheDocument();
      const [alta] = llamadasA(fetchMock, 'POST', '/insumos');
      expect(alta.cuerpo).toMatchObject({
        nombreComercial: 'Cipermetrina 25% EC',
        presentacion: 'LIQUIDO',
        unidadMedida: 'ML',
        proveedor: null,
        fichaTecnicaKey: expect.stringMatching(/^insumos\/ficha-tecnica\/.+\.pdf$/),
        hojaMsdsKey: expect.stringMatching(/^insumos\/hoja-msds\/.+\.pdf$/),
      });
      expect(estado.subidos).toHaveLength(2);
      expect(estado.subidos).toContain((alta.cuerpo as { fichaTecnicaKey: string }).fichaTecnicaKey);
    });

    it('un registro DIGESA repetido (409) se marca en su campo y permite corregirlo', async () => {
      const estado = crearEstadoApi({ insumos: [insumoApi(1, { registroDigesa: 'DIG-1980-SA' })] });
      montar('ADMINISTRADOR', estado);

      fireEvent.click(await screen.findByRole('button', { name: 'Nuevo insumo' }));
      await llenarInsumoNuevo('DIG-1980-SA');
      fireEvent.click(screen.getByRole('button', { name: 'Registrar insumo' }));

      expect(await screen.findByText('Ya existe un insumo con ese registro DIGESA.')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Nuevo insumo' })).toBeInTheDocument();

      escribir('Registro DIGESA', 'DIG-2000-SA');
      fireEvent.click(screen.getByRole('button', { name: 'Registrar insumo' }));

      expect(await screen.findByText('Insumo registrado.')).toBeInTheDocument();
      expect(estado.insumos).toHaveLength(2);
    });

    it('edita un insumo: precarga el formulario, guarda el cambio y lo muestra en la lista', async () => {
      const estado = crearEstadoApi({ insumos: [insumoApi(1)] });
      montar('ADMINISTRADOR', estado);

      fireEvent.click(await screen.findByRole('button', { name: 'Editar insumo Insumo 1' }));
      expect(screen.getByRole('heading', { name: 'Editar insumo' })).toBeInTheDocument();
      expect(screen.getByLabelText('Registro DIGESA')).toHaveValue('DIG-1');
      escribir('Dosis estándar', '2 bloques por estación');
      fireEvent.click(screen.getByRole('button', { name: 'Guardar insumo' }));

      expect(await screen.findByText('Insumo actualizado.')).toBeInTheDocument();
      expect(screen.getByText('2 bloques por estación')).toBeInTheDocument();
      const [cambio] = llamadasA(fetchMock, 'PATCH');
      expect(cambio.url).toMatch(/\/insumos\/00000000-0000-4000-8000-000000000001$/);
      expect(cambio.cuerpo).toMatchObject({ dosisEstandar: '2 bloques por estación', fichaTecnicaKey: 'insumos/ficha-tecnica/1.pdf' });
    });

    it('al editar no deja repetir el registro DIGESA de otro insumo (el API no lo revisa en la edición)', async () => {
      montar('ADMINISTRADOR', crearEstadoApi({ insumos: [insumoApi(1), insumoApi(2)] }));

      fireEvent.click(await screen.findByRole('button', { name: 'Editar insumo Insumo 2' }));
      escribir('Registro DIGESA', 'DIG-1');
      fireEvent.click(screen.getByRole('button', { name: 'Guardar insumo' }));

      expect(await screen.findByText('Ya existe un insumo con ese registro DIGESA.')).toBeInTheDocument();
      expect(llamadasA(fetchMock, 'PATCH')).toHaveLength(0);
    });

    it('cancelar el formulario vuelve a la lista sin guardar nada', async () => {
      montar('ADMINISTRADOR', crearEstadoApi({ insumos: [insumoApi(1)] }));

      fireEvent.click(await screen.findByRole('button', { name: 'Nuevo insumo' }));
      fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

      expect(await screen.findByText('Insumo 1')).toBeInTheDocument();
      expect(llamadasA(fetchMock, 'POST')).toHaveLength(0);
    });

    it('si la subida del PDF falla muestra el error y el reintento deja guardar', async () => {
      const estado = crearEstadoApi({ insumos: [insumoApi(1)], fallosDeSubida: 1 });
      montar('ADMINISTRADOR', estado);

      fireEvent.click(await screen.findByRole('button', { name: 'Editar insumo Insumo 1' }));
      fireEvent.change(screen.getByLabelText('Ficha técnica (PDF)'), { target: { files: [pdf('nueva.pdf')] } });

      expect(await screen.findByText(/No se pudo subir el archivo/)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
      await screen.findByText('Archivo cargado: nueva.pdf');
      fireEvent.click(screen.getByRole('button', { name: 'Guardar insumo' }));

      expect(await screen.findByText('Insumo actualizado.')).toBeInTheDocument();
      expect(estado.insumos[0].fichaTecnicaKey).toMatch(/^insumos\/ficha-tecnica\/.+\.pdf$/);
      expect(estado.insumos[0].fichaTecnicaKey).not.toBe('insumos/ficha-tecnica/1.pdf');
    });
  });

  describe('personal', () => {
    it('registra a una persona y la muestra en la lista, avisando que la clave la asigna el administrador del sistema', async () => {
      const estado = crearEstadoApi();
      montar('ADMINISTRADOR', estado);

      irA('Personal');
      fireEvent.click(await screen.findByRole('button', { name: 'Nueva persona' }));
      expect(screen.getByText(/La clave de acceso no se define en esta pantalla/)).toBeInTheDocument();
      escribir('DNI', '45892312');
      escribir('Nombres', 'Marco Antonio');
      escribir('Apellidos', 'Ipusari Quispe');
      escribir('Cargo', 'TECNICO_OPERADOR');
      escribir('Teléfono', '958123456');
      fireEvent.click(screen.getByRole('button', { name: 'Registrar persona' }));

      expect(await screen.findByText('Persona registrada.')).toBeInTheDocument();
      const fila = screen.getByText('Marco Antonio Ipusari Quispe').closest('tr') as HTMLElement;
      expect(within(fila).getByText('Técnico Operador')).toBeInTheDocument();
      expect(llamadasA(fetchMock, 'POST', '/personal')[0].cuerpo).toEqual({
        dni: '45892312',
        nombres: 'Marco Antonio',
        apellidos: 'Ipusari Quispe',
        cargo: 'TECNICO_OPERADOR',
        telefono: '958123456',
        usuario: null,
      });
    });

    it('edita a una persona y la lista muestra el cambio', async () => {
      montar('ADMINISTRADOR', crearEstadoApi({ personal: [personalApi(1), personalApi(2)] }));

      irA('Personal');
      fireEvent.click(await screen.findByRole('button', { name: 'Editar a Nombre1 Apellido1' }));
      escribir('Teléfono', '999888777');
      fireEvent.click(screen.getByRole('button', { name: 'Guardar persona' }));

      expect(await screen.findByText('Datos de la persona actualizados.')).toBeInTheDocument();
      expect(screen.getByText('999888777')).toBeInTheDocument();
    });
  });

  describe('catálogos de texto', () => {
    it('el Administrador agrega un texto y queda guardado en el servidor', async () => {
      const estado = crearEstadoApi({ catalogos: [catalogoApi('giros', 'Giros de negocio', ['Energía'])] });
      montar('ADMINISTRADOR', estado);

      irA('Catálogos de texto');
      fireEvent.change(await screen.findByLabelText('Nuevo texto en Giros de negocio'), { target: { value: 'Minería' } });
      fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));

      expect(await screen.findByText('Minería')).toBeInTheDocument();
      expect(estado.catalogos[0].items).toEqual(['Energía', 'Minería']);
    });
  });

  describe('equipos', () => {
    it('crea un equipo con los datos obligatorios y aparece operativo en la lista', async () => {
      const estado = crearEstadoApi();
      montar('ADMINISTRADOR', estado);

      irA('Equipos');
      fireEvent.click(await screen.findByRole('button', { name: 'Nuevo equipo' }));
      escribir('Código interno', 'eq-031');
      escribir('Nombre del equipo', 'Detector de humedad');
      escribir('Tipo de equipo', 'MEDICION');
      fireEvent.click(screen.getByRole('button', { name: 'Registrar equipo' }));

      expect(await screen.findByText('Equipo registrado.')).toBeInTheDocument();
      const fila = screen.getByText('Detector de humedad').closest('tr') as HTMLElement;
      expect(within(fila).getByText('EQ-031')).toBeInTheDocument();
      expect(within(fila).getByRole('combobox')).toHaveDisplayValue('Operativo');
      expect(llamadasA(fetchMock, 'POST', '/equipos')[0].cuerpo).toMatchObject({ codigoInterno: 'EQ-031', tipo: 'MEDICION', marcaModelo: null });
    });

    it('un código interno repetido (409) se marca en su campo', async () => {
      montar('ADMINISTRADOR', crearEstadoApi({ equipos: [equipoApi(1, { codigoInterno: 'EQ-031' })] }));

      irA('Equipos');
      fireEvent.click(await screen.findByRole('button', { name: 'Nuevo equipo' }));
      escribir('Código interno', 'EQ-031');
      escribir('Nombre del equipo', 'Detector de humedad');
      escribir('Tipo de equipo', 'MEDICION');
      fireEvent.click(screen.getByRole('button', { name: 'Registrar equipo' }));

      expect(await screen.findByText('Ya existe un equipo con ese código interno.')).toBeInTheDocument();
    });

    it('edita un equipo y lo muestra actualizado', async () => {
      montar('ADMINISTRADOR', crearEstadoApi({ equipos: [equipoApi(1)] }));

      irA('Equipos');
      fireEvent.click(await screen.findByRole('button', { name: 'Editar equipo Equipo 1' }));
      escribir('Marca y modelo (opcional)', 'Jacto XP-20');
      fireEvent.click(screen.getByRole('button', { name: 'Guardar equipo' }));

      expect(await screen.findByText('Equipo actualizado.')).toBeInTheDocument();
      expect(screen.getByText('Jacto XP-20')).toBeInTheDocument();
    });

    it('al volver de un formulario conserva la sección en la que estaba', async () => {
      montar('ADMINISTRADOR');

      irA('Equipos');
      fireEvent.click(await screen.findByRole('button', { name: 'Nuevo equipo' }));
      fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

      await waitFor(() => expect(screen.getByRole('button', { name: 'Nuevo equipo' })).toBeInTheDocument());
    });
  });
});
