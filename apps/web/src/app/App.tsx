import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './providers/query-client';
import { AppShell } from './AppShell';
import { CarteraProvider } from '../features/cliente-expediente/model/cartera-context';
import { OperacionesProvider } from '../features/operaciones/model/operaciones-context';

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <CarteraProvider>
        <OperacionesProvider>
          <AppShell />
        </OperacionesProvider>
      </CarteraProvider>
    </QueryClientProvider>
  );
}
