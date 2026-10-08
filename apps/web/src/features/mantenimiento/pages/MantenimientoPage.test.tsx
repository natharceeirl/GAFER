import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MantenimientoPage } from './MantenimientoPage';
import { ConfiguracionProvider } from '../model/configuracion-context';
import { useSesion } from '../../../shared/api/sesion';
import type { Rol } from '../../auth/model/roles';
import { crearEstadoApi, equipoApi, insumoApi, llamadasA, simularApiMantenimiento, type EstadoApi } from '../pruebas/api-mantenimiento-simulada';

const fetchMock = vi.fn();

function montar(rol: Rol, estado: EstadoApi = crearEstadoApi()) {
  simularApiMantenimiento(fetchMock, estado);
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <ConfiguracionProvider>
        <MantenimientoPage rol={rol} />
      </ConfiguracionProvider>
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
      expect(within(nav).getAllByRole('button').map((b) => b.textContent)).toEqual(['Insumos', 'Equipos', 'Personal', 'Director Técnico', 'Catálogos de texto']);
      expect(await screen.findByText('Insumo 1')).toBeInTheDocument();
    });

    it('el Supervisor solo ve catálogos de texto y no consulta insumos ni equipos', () => {
      montar('SUPERVISOR');

      const nav = screen.getByRole('navigation', { name: 'Secciones de mantenimiento' });
      expect(within(nav).getAllByRole('button').map((b) => b.textContent)).toEqual(['Catálogos de texto']);
      expect(screen.queryByRole('button', { name: 'Nuevo insumo' })).toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('si el API rechaza al rol (403) la sección lo dice con claridad y la página sigue usable', async () => {
      montar('ADMINISTRADOR', crearEstadoApi({ prohibido: true }));

      expect(await screen.findByRole('alert')).toHaveTextContent('No tiene permiso para ver los insumos.');
      irA('Equipos');
      expect(await screen.findByText(/No tiene permiso para ver los equipos/)).toBeInTheDocument();
      irA('Catálogos de texto');
      expect(screen.getByText('Tipos de hallazgo')).toBeInTheDocument();
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
