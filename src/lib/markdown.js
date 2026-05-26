// Convertidor ligero de Markdown a HTML, sin dependencias externas.
// Se usa para renderizar las respuestas guardadas en "Mi Biblioteca"
// (encabezados, negritas, cursivas, listas, tablas, citas, etc.) tanto
// en pantalla como en la ventana de impresión.

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Aplica formato en línea sobre texto YA escapado a nivel de bloque.
function applyInline(text) {
  let t = text;
  // código en línea `código`
  t = t.replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`);
  // negrita **texto** o __texto__
  t = t.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/__([^_]+?)__/g, '<strong>$1</strong>');
  // tachado ~~texto~~
  t = t.replace(/~~([^~]+?)~~/g, '<del>$1</del>');
  // cursiva *texto* o _texto_ (sin pegarse a otro asterisco/guion)
  t = t.replace(/(^|[^*])\*([^*\s][^*]*?)\*/g, '$1<em>$2</em>');
  t = t.replace(/(^|[^_\w])_([^_\s][^_]*?)_/g, '$1<em>$2</em>');
  // enlaces [texto](url) — solo esquemas seguros
  t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, txt, url) =>
    /^(https?:\/\/|mailto:)/i.test(url)
      ? `<a href="${url}" target="_blank" rel="noopener noreferrer">${txt}</a>`
      : m
  );
  return t;
}

function isTableSeparator(line) {
  return /^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)+\|?\s*$/.test(line);
}

function splitRow(line) {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|')) s = s.slice(0, -1);
  return s.split('|').map((c) => c.trim());
}

export function mdToHtml(md) {
  const lines = String(md ?? '').replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let para = [];
  let i = 0;

  const flushPara = () => {
    if (para.length) {
      const text = para.join(' ').trim();
      if (text) out.push(`<p>${applyInline(escapeHtml(text))}</p>`);
      para = [];
    }
  };

  while (i < lines.length) {
    const trimmed = lines[i].trim();

    // línea en blanco
    if (trimmed === '') { flushPara(); i++; continue; }

    // regla horizontal
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) { flushPara(); out.push('<hr>'); i++; continue; }

    // encabezados (# … ######)
    const h = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      flushPara();
      const lvl = h[1].length;
      out.push(`<h${lvl}>${applyInline(escapeHtml(h[2].trim()))}</h${lvl}>`);
      i++;
      continue;
    }

    // tabla (estilo GFM): fila de encabezado + fila separadora
    if (trimmed.includes('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      flushPara();
      const header = splitRow(trimmed);
      i += 2; // saltar la fila separadora
      const rows = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '') {
        rows.push(splitRow(lines[i]));
        i++;
      }
      let table = '<table><thead><tr>';
      table += header.map((c) => `<th>${applyInline(escapeHtml(c))}</th>`).join('');
      table += '</tr></thead><tbody>';
      for (const r of rows) {
        table += '<tr>' + header.map((_, idx) => `<td>${applyInline(escapeHtml(r[idx] ?? ''))}</td>`).join('') + '</tr>';
      }
      table += '</tbody></table>';
      out.push(table);
      continue;
    }

    // cita
    if (/^>\s?/.test(trimmed)) {
      flushPara();
      const quote = [];
      while (i < lines.length && /^>\s?/.test(lines[i].trim())) {
        quote.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      out.push(`<blockquote>${applyInline(escapeHtml(quote.join(' ')))}</blockquote>`);
      continue;
    }

    // listas (ordenadas y no ordenadas)
    const ulItem = trimmed.match(/^[-*+]\s+(.*)$/);
    const olItem = trimmed.match(/^\d+\.\s+(.*)$/);
    if (ulItem || olItem) {
      flushPara();
      const ordered = !!olItem;
      const tag = ordered ? 'ol' : 'ul';
      const items = [];
      while (i < lines.length) {
        const tl = lines[i].trim();
        const m = ordered ? tl.match(/^\d+\.\s+(.*)$/) : tl.match(/^[-*+]\s+(.*)$/);
        if (!m) break;
        items.push(`<li>${applyInline(escapeHtml(m[1]))}</li>`);
        i++;
      }
      out.push(`<${tag}>${items.join('')}</${tag}>`);
      continue;
    }

    // párrafo normal
    para.push(trimmed);
    i++;
  }
  flushPara();
  return out.join('\n');
}
