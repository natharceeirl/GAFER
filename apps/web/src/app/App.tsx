import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './providers/query-client';
import { OperacionesPage } from '../pages/OperacionesPage';

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <OperacionesPage />
    </QueryClientProvider>
  );
}
