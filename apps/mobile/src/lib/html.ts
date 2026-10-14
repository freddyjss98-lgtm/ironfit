// La planificación (WOD) se guarda como HTML del editor del panel web. En la
// app se muestra como texto: listas con viñetas, saltos de línea y las
// negritas (los títulos de sección, que en la web van en naranja).

const ENTITIES: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
};

const BOLD_ON = '\u0001';
const BOLD_OFF = '\u0002';

export type TextSegment = { text: string; bold: boolean };

export function htmlToSegments(html: string): TextSegment[] {
  const text = html
    .replace(/\r?\n/g, '') // los saltos del código fuente no son saltos visibles
    .replace(/<\s*(b|strong)(\s[^>]*)?>/gi, BOLD_ON)
    .replace(/<\s*\/\s*(b|strong)\s*>/gi, BOLD_OFF)
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\s*li[^>]*>/gi, '\n• ')
    .replace(/<\s*\/\s*(p|div|h[1-6]|ul|ol)\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z#0-9]+;/gi, (e) => ENTITIES[e.toLowerCase()] ?? e)
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n+• /g, '\n• ') // viñetas seguidas, sin línea en blanco entre ellas
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const segments: TextSegment[] = [];
  let bold = false;
  let buf = '';
  for (const ch of text) {
    if (ch === BOLD_ON || ch === BOLD_OFF) {
      if (buf) segments.push({ text: buf, bold });
      buf = '';
      bold = ch === BOLD_ON;
    } else {
      buf += ch;
    }
  }
  if (buf) segments.push({ text: buf, bold });
  return segments;
}
