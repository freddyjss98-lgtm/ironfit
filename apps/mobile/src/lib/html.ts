// La planificación (WOD) se guarda como HTML del editor del panel web. En la
// app se muestra como texto: saltos de línea, viñetas, negritas y los colores
// que pone el coach (<font color> o style="color: …"), como en la web.

const ENTITIES: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
};

export type TextSegment = { text: string; bold: boolean; color: string | null };

const BLOCK = /^(p|div|h[1-6]|ul|ol)$/;

/** Color legible sobre fondo negro; los muy oscuros (texto pegado de otro lado) se ignoran. */
function readableColor(raw: string | undefined): string | null {
  if (!raw) return null;
  const c = raw.trim().toLowerCase();
  let r: number, g: number, b: number;
  const hex = c.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
  const rgb = c.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].replace(/./g, '$&$&') : hex[1];
    [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  } else if (rgb) {
    [r, g, b] = [rgb[1], rgb[2], rgb[3]].map(Number);
  } else {
    return null;
  }
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance < 0.25 ? null : `rgb(${r}, ${g}, ${b})`;
}

/** Color de un tag: <font color="…"> o style="color: …" (no caret-color, etc.). */
function tagColor(attrs: string): string | null | undefined {
  const font = attrs.match(/\bcolor\s*=\s*["']?([^"'\s>]+)/i);
  const style = attrs.match(/style\s*=\s*["']([^"']*)["']/i)?.[1];
  const css = style?.match(/(?:^|;)\s*color\s*:\s*([^;]+)/i)?.[1];
  const raw = font?.[1] ?? css;
  return raw === undefined ? undefined : readableColor(raw);
}

export function htmlToSegments(html: string): TextSegment[] {
  const segments: TextSegment[] = [];
  // Pila de estilos abiertos: cada inline (b, strong, font, span) aporta lo suyo.
  const stack: { tag: string; bold?: boolean; color?: string | null }[] = [];
  const current = () => {
    let bold = false;
    let color: string | null = null;
    for (const s of stack) {
      if (s.bold) bold = true;
      if (s.color !== undefined) color = s.color;
    }
    return { bold, color };
  };
  const push = (text: string) => {
    if (!text) return;
    const style = current();
    const last = segments[segments.length - 1];
    if (last && last.bold === style.bold && last.color === style.color) last.text += text;
    else segments.push({ text, ...style });
  };
  const newline = () => push('\n');
  // Un bloque (div, p…) empieza y termina en línea propia, sin duplicar saltos.
  const ensureBreak = () => {
    const last = segments[segments.length - 1];
    if (last && !last.text.endsWith('\n')) newline();
  };

  const re = /<\s*(\/?)\s*([a-z0-9]+)([^>]*)>|([^<]+)/gi;
  for (const m of html.replace(/\r?\n/g, '').matchAll(re)) {
    if (m[4] !== undefined) {
      push(m[4].replace(/&[a-z#0-9]+;/gi, (e) => ENTITIES[e.toLowerCase()] ?? e));
      continue;
    }
    const closing = m[1] === '/';
    const tag = m[2].toLowerCase();
    const attrs = m[3] ?? '';

    if (tag === 'br') newline();
    else if (tag === 'li' && !closing) push('\n• ');
    else if (BLOCK.test(tag)) ensureBreak();
    else if (['b', 'strong', 'font', 'span', 'i', 'em', 'u'].includes(tag)) {
      if (closing) {
        const i = stack.map((s) => s.tag).lastIndexOf(tag);
        if (i >= 0) stack.splice(i, 1);
      } else {
        stack.push({ tag, bold: tag === 'b' || tag === 'strong' || undefined, color: tagColor(attrs) });
      }
    }
  }

  // Limpieza, respetando los límites de cada segmento: sin espacios pegados a
  // un salto, como mucho una línea en blanco seguida y viñetas sin líneas en
  // blanco entre ellas (cada <li> ya abre su línea).
  const normalized: TextSegment[] = [];
  let newlines = 0;
  for (const s of segments) {
    let buf = '';
    for (const ch of s.text) {
      if (ch === '\n') {
        buf = buf.replace(/[ \t]+$/, '');
        if (newlines < 2) buf += ch;
        newlines++;
      } else if (newlines > 0 && (ch === ' ' || ch === '\t')) {
        // espacio al inicio de línea: fuera
      } else {
        if (ch === '•' && newlines > 1 && buf.endsWith('\n\n')) buf = buf.slice(0, -1);
        newlines = 0;
        buf += ch;
      }
    }
    if (buf) normalized.push({ ...s, text: buf });
  }
  // Quitar saltos al principio y al final.
  while (normalized[0] && /^\s/.test(normalized[0].text)) {
    normalized[0].text = normalized[0].text.replace(/^\s+/, '');
    if (!normalized[0].text) normalized.shift();
  }
  while (normalized.length && /\s$/.test(normalized[normalized.length - 1].text)) {
    const last = normalized[normalized.length - 1];
    last.text = last.text.replace(/\s+$/, '');
    if (!last.text) normalized.pop();
  }
  return normalized;
}
