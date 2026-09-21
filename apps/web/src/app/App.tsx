import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './providers/query-client';
import { AppShell } from './AppShell';

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppShell />
    </QueryClientProvider>
  );
}
