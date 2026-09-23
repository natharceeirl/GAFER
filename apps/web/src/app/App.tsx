import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './providers/query-client';
import { AppShell } from './AppShell';
import { CarteraProvider } from '../features/cliente-expediente/model/cartera-context';
import { ProgramacionProvider } from '../features/programacion/model/programacion-context';
import { DocumentosProvider } from '../features/documentos/model/documentos-context';
import { AuditoriaProvider } from '../features/auditoria/model/auditoria-context';
import { ConfiguracionProvider } from '../features/mantenimiento/model/configuracion-context';

/** Los estados compartidos viven por encima del login para que la demo recorra ambos roles. */
export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ConfiguracionProvider>
        <AuditoriaProvider>
          <CarteraProvider>
            <ProgramacionProvider>
              <DocumentosProvider>
                <AppShell />
              </DocumentosProvider>
            </ProgramacionProvider>
          </CarteraProvider>
        </AuditoriaProvider>
      </ConfiguracionProvider>
    </QueryClientProvider>
  );
}
