import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './providers/query-client';
import { AppShell } from './AppShell';
import { CarteraProvider } from '../features/cliente-expediente/model/cartera-context';
import { ProgramacionProvider } from '../features/programacion/model/programacion-context';

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <CarteraProvider>
        <ProgramacionProvider>
          <AppShell />
        </ProgramacionProvider>
      </CarteraProvider>
    </QueryClientProvider>
  );
}
