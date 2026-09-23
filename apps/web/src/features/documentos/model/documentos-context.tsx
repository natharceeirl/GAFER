import { createContext, useContext, useState, type ReactNode } from 'react';
import { DOCUMENTOS_DETALLE_MOCK, DOCUMENTOS_MOCK } from './documentos-mock';
import type { DocumentoDetalle } from './tipos';

interface DocumentosContexto {
  documentos: DocumentoDetalle[];
  actualizar: (documento: DocumentoDetalle) => void;
}

const Contexto = createContext<DocumentosContexto | null>(null);

/** Estado de los documentos compartido entre bandeja, detalle y Dashboard, para que una aprobación se vea en todos. */
export function DocumentosProvider({ children }: { children: ReactNode }) {
  const [documentos, setDocumentos] = useState<DocumentoDetalle[]>(() => DOCUMENTOS_MOCK.map((d) => DOCUMENTOS_DETALLE_MOCK[d.id]));
  return (
    <Contexto.Provider
      value={{ documentos, actualizar: (doc) => setDocumentos((prev) => prev.map((d) => (d.id === doc.id ? doc : d))) }}
    >
      {children}
    </Contexto.Provider>
  );
}

export function useDocumentos(): DocumentosContexto {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error('useDocumentos debe usarse dentro de DocumentosProvider');
  return ctx;
}
