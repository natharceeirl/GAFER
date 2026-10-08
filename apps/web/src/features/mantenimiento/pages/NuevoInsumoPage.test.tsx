import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NuevoInsumoPage } from './NuevoInsumoPage';
import { useSesion } from '../../../shared/api/sesion';
import type { DatosInsumo } from '../model/insumo-mapper';

const fetchMock = vi.fn();
const URL_SUBIDA = 'http://localhost:9000/gafer-docs/pdf?firma=1';

function json(status: number, cuerpo: unknown) {
  return new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });
}

const inicial: DatosInsumo = {
  nombreComercial: 'Brodifacoum 0.005% bloque',
  principioActivo: 'Brodifacoum',
  presentacion: 'BLOQUE',
  unidadMedida: 'BLOQUE',
  registroDigesa: 'DIG-2451-SA',
  concentracion: '0.005%',
  dosisEstandar: '1 bloque por estación',
  proveedor: '',
  fichaTecnicaKey: 'insumos/ficha-tecnica/a.pdf',
  hojaMsdsKey: 'insumos/hoja-msds/b.pdf',
};

const onRegistrar = vi.fn();
const onCancelar = vi.fn();

function montar(props: Partial<Parameters<typeof NuevoInsumoPage>[0]> = {}) {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
      <NuevoInsumoPage onRegistrar={onRegistrar} onCancelar={onCancelar} {...props} />
    </QueryClientProvider>,
  );
}

const escribir = (etiqueta: string, valor: string) => fireEvent.change(screen.getByLabelText(etiqueta), { target: { value: valor } });
const pdf = (nombre: string) => new File(['%PDF-1.4'], nombre, { type: 'application/pdf' });

describe('NuevoInsumoPage', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    onRegistrar.mockReset();
    onCancelar.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    sessionStorage.clear();
    useSesion.setState({ token: 'jwt', usuario: null });
    fetchMock.mockImplementation(async (url: string) =>
      url === URL_SUBIDA ? new Response(null, { status: 200 }) : json(201, { key: 'k', uploadUrl: URL_SUBIDA, bucket: 'b', expiresInSeconds: 900 }),
    );
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  describe('alta', () => {
    it('al intentar registrar con el formulario vacío marca los campos obligatorios y no envía', () => {
      montar();

      fireEvent.click(screen.getByRole('button', { name: 'Registrar insumo' }));

      expect(screen.getByRole('heading', { name: 'Nuevo insumo' })).toBeInTheDocument();
      expect(screen.getByText(/Hay 9 campos por corregir/)).toBeInTheDocument();
      expect(screen.getByText('Cargue la ficha técnica en formato PDF.')).toBeInTheDocument();
      expect(screen.getByText('Cargue la hoja MSDS en formato PDF.')).toBeInTheDocument();
      expect(onRegistrar).not.toHaveBeenCalled();
    });

    it('con todos los datos y los dos PDF subidos entrega el insumo con las claves de los archivos', async () => {
      montar();
      escribir('Nombre comercial', 'Cipermetrina 25% EC');
      escribir('Principio activo', 'Cipermetrina');
      escribir('Presentación', 'LIQUIDO');
      escribir('Unidad de medida', 'ML');
      escribir('Registro DIGESA', 'DIG-1980-SA');
      escribir('Concentración', '25%');
      escribir('Dosis estándar', '10 ml/L');
      fireEvent.change(screen.getByLabelText('Ficha técnica (PDF)'), { target: { files: [pdf('ficha.pdf')] } });
      await screen.findByText('Archivo cargado: ficha.pdf');
      fireEvent.change(screen.getByLabelText('Hoja de seguridad MSDS (PDF)'), { target: { files: [pdf('msds.pdf')] } });
      await screen.findByText('Archivo cargado: msds.pdf');

      fireEvent.click(screen.getByRole('button', { name: 'Registrar insumo' }));

      expect(onRegistrar).toHaveBeenCalledTimes(1);
      expect(onRegistrar.mock.calls[0][0]).toMatchObject({
        nombreComercial: 'Cipermetrina 25% EC',
        presentacion: 'LIQUIDO',
        unidadMedida: 'ML',
        registroDigesa: 'DIG-1980-SA',
        proveedor: '',
        fichaTecnicaKey: expect.stringMatching(/^insumos\/ficha-tecnica\//),
        hojaMsdsKey: expect.stringMatching(/^insumos\/hoja-msds\//),
      });
    });

    it('las listas de presentación y unidad usan las etiquetas de pantalla, no los códigos', () => {
      montar();
      const presentaciones = within(screen.getByLabelText('Presentación')).getAllByRole('option').map((o) => o.textContent);
      expect(presentaciones).toContain('Líquido');
      expect(presentaciones).not.toContain('LIQUIDO');
      expect(within(screen.getByLabelText('Unidad de medida')).getByRole('option', { name: 'Mililitros (ml)' })).toHaveValue('ML');
    });

    it('no deja guardar mientras se sube un PDF', async () => {
      let terminar = () => {};
      fetchMock.mockImplementation(async (url: string) => {
        if (url === URL_SUBIDA) {
          await new Promise<void>((resolver) => (terminar = resolver));
          return new Response(null, { status: 200 });
        }
        return json(201, { key: 'k', uploadUrl: URL_SUBIDA, bucket: 'b', expiresInSeconds: 900 });
      });
      montar({ inicial });

      fireEvent.change(screen.getByLabelText('Ficha técnica (PDF)'), { target: { files: [pdf('nueva.pdf')] } });

      await screen.findByText('Subiendo nueva.pdf…');
      expect(screen.getByRole('button', { name: 'Guardar insumo' })).toBeDisabled();
      terminar();
      await waitFor(() => expect(screen.getByRole('button', { name: 'Guardar insumo' })).toBeEnabled());
    });

    it('cancelar vuelve sin guardar', () => {
      montar();
      fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
      expect(onCancelar).toHaveBeenCalled();
    });
  });

  describe('edición', () => {
    it('precarga los datos del insumo y guarda los cambios', () => {
      montar({ inicial });

      expect(screen.getByRole('heading', { name: 'Editar insumo' })).toBeInTheDocument();
      expect(screen.getByLabelText('Nombre comercial')).toHaveValue('Brodifacoum 0.005% bloque');
      expect(screen.getByLabelText('Presentación')).toHaveValue('BLOQUE');
      expect(screen.getAllByText('Archivo cargado.')).toHaveLength(2);

      escribir('Concentración', '0.01%');
      fireEvent.click(screen.getByRole('button', { name: 'Guardar insumo' }));

      expect(onRegistrar).toHaveBeenCalledWith({ ...inicial, concentracion: '0.01%' });
    });
  });

  describe('servidor', () => {
    it('muestra los errores del servidor sobre su campo y los quita al corregirlo', () => {
      const { rerender } = montar({ inicial, erroresServidor: { registroDigesa: 'Ya existe un insumo con ese registro DIGESA.' } });

      expect(screen.getByText('Ya existe un insumo con ese registro DIGESA.')).toBeInTheDocument();
      expect(screen.getByLabelText('Registro DIGESA')).toHaveAttribute('aria-invalid', 'true');

      escribir('Registro DIGESA', 'DIG-9999-SA');
      expect(screen.queryByText('Ya existe un insumo con ese registro DIGESA.')).toBeNull();
      rerender(<></>);
    });

    it('muestra el error general y bloquea los botones mientras guarda', () => {
      montar({ inicial, enviando: true, errorGeneral: 'No se pudo conectar con el servidor.' });

      expect(screen.getByRole('alert')).toHaveTextContent('No se pudo conectar con el servidor.');
      expect(screen.getByRole('button', { name: 'Guardando…' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    });
  });
});
