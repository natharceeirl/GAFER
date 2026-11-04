import '@testing-library/jest-dom/vitest';

// Node 22+ define un localStorage experimental vacío (sin --localstorage-file) que tapa al de jsdom.
if (typeof window !== 'undefined' && !window.localStorage) {
  const valores = new Map<string, string>();
  const almacenamiento: Storage = {
    get length() {
      return valores.size;
    },
    clear: () => valores.clear(),
    getItem: (clave) => valores.get(clave) ?? null,
    key: (indice) => [...valores.keys()][indice] ?? null,
    removeItem: (clave) => {
      valores.delete(clave);
    },
    setItem: (clave, valor) => {
      valores.set(clave, String(valor));
    },
  };
  Object.defineProperty(window, 'localStorage', { value: almacenamiento, configurable: true });
  Object.defineProperty(globalThis, 'localStorage', { value: almacenamiento, configurable: true });
}

// jsdom no implementa matchMedia, que usa el selector de tema.
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (consulta: string) =>
    ({
      matches: false,
      media: consulta,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}
