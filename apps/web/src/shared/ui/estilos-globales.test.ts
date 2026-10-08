import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/** Vitest sustituye los `.css` importados por módulos vacíos: se lee el archivo tal cual. */
function leerCss(archivo: string): string {
  return readFileSync(fileURLToPath(new URL(archivo, import.meta.url)), 'utf8');
}

function reglaDe(selector: string, css: string): string {
  const coincidencia = new RegExp(`(?:^|\\n)${selector}\\s*\\{([^}]*)\\}`).exec(css);
  return coincidencia?.[1] ?? '';
}

describe('estilos globales', () => {
  it('el body existe en tokens.css', () => {
    expect(reglaDe('body', leerCss('./tokens.css'))).toContain('background');
  });

  it('el body no conserva el margen por defecto del navegador: sumaría altura al shell y generaría un segundo scroll', () => {
    expect(reglaDe('body', leerCss('./tokens.css'))).toMatch(/margin:\s*0\b/);
  });
});
