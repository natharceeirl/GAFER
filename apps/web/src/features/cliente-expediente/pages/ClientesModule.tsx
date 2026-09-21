import { useState } from 'react';
import { ClientesListPage } from './ClientesListPage';
import { ClienteExpedientePage } from './ClienteExpedientePage';
import type { ClienteFila } from '../model/clientes-mock';

/**
 * Composición local lista↔expediente. No toca app/App.tsx a propósito
 * (entry point compartido con otros módulos en construcción en paralelo).
 */
export function ClientesModule() {
  const [clienteAbierto, setClienteAbierto] = useState<ClienteFila | null>(null);

  if (clienteAbierto) {
    return <ClienteExpedientePage cliente={clienteAbierto} onVolver={() => setClienteAbierto(null)} />;
  }
  return <ClientesListPage onAbrirCliente={setClienteAbierto} />;
}
