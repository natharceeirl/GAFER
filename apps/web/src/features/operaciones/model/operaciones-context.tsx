import { createContext, useContext, useState, type ReactNode } from 'react';
import type { FormularioCampo } from './formulario-campo';
import type { DocumentoDetalle } from '../../documentos/model/tipos';

interface OperacionesContexto {
  formularios: Record<string, FormularioCampo>;
  /** Documentos generados al cerrar un formulario; entran a la bandeja de aprobación (§8.3). */
  documentosCampo: DocumentoDetalle[];
  guardarFormulario: (f: FormularioCampo) => void;
  enviarARevision: (f: FormularioCampo, documento: DocumentoDetalle) => void;
}

const Contexto = createContext<OperacionesContexto | null>(null);

export function OperacionesProvider({ children }: { children: ReactNode }) {
  const [formularios, setFormularios] = useState<Record<string, FormularioCampo>>({});
  const [documentosCampo, setDocumentosCampo] = useState<DocumentoDetalle[]>([]);

  function guardarFormulario(f: FormularioCampo) {
    setFormularios((prev) => ({ ...prev, [f.id]: f }));
  }

  function enviarARevision(f: FormularioCampo, documento: DocumentoDetalle) {
    guardarFormulario(f);
    setDocumentosCampo((prev) => [documento, ...prev.filter((d) => d.id !== documento.id)]);
  }

  return (
    <Contexto.Provider value={{ formularios, documentosCampo, guardarFormulario, enviarARevision }}>{children}</Contexto.Provider>
  );
}

export function useOperaciones(): OperacionesContexto {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error('useOperaciones debe usarse dentro de OperacionesProvider');
  return ctx;
}
