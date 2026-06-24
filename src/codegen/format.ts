import type { Plugin } from 'prettier';

/**
 * Pretty-print generated three.js / R3F source with Prettier. Prettier + its parser plugins
 * are dynamically imported so they stay out of the initial bundle (loaded only when the
 * Export panel needs to format code). Falls back to the raw code on any failure.
 */
export async function formatCode(code: string): Promise<string> {
  try {
    const [standalone, babel, estree] = await Promise.all([
      import('prettier/standalone'),
      import('prettier/plugins/babel'),
      import('prettier/plugins/estree'),
    ]);
    return await standalone.format(code, {
      parser: 'babel-ts', // handles both vanilla JS and the R3F JSX output
      plugins: [babel as unknown as Plugin, estree as unknown as Plugin],
      singleQuote: true,
      semi: true,
      printWidth: 100,
    });
  } catch {
    return code;
  }
}
