// ============================================================
// HTML Adapter — IR → HTML strings
//
// Translates the clinical presentation IR into HTML strings.
// Knows nothing about clinical concepts; only knows HTML element
// names, escape semantics, and the visual contract (paragraph
// margins, bold runs).
// ============================================================

import { escapeHtmlText } from './clinicalPresentation';

const PARA_STYLE = 'style="margin-bottom: 16px;"';
const PARA_STYLE_SMALL = 'style="margin-bottom: 8px;"';

const FALLBACK_PARA_STYLE = 'style="color: #49454f; font-style: italic;"';

/**
 * Wrap a list of runs into a single paragraph HTML string.
 *
 * When the paragraph carries the semantic `isFallback: true` marker
 * (signalling the canonical "no findings" paragraph produced by the
 * core), the whole paragraph is rendered in italic + gray to match
 * the visual contract of the pre-SSoT renderEngine fallback.
 */
function paragraphToHtml(paragraph, { style = PARA_STYLE } = {}) {
  const paraStyle = paragraph?.isFallback === true ? FALLBACK_PARA_STYLE : style;
  const inner = paragraph.runs
    .map((r) => (r.bold ? `<strong>${escapeHtmlText(r.text)}</strong>` : escapeHtmlText(r.text)))
    .join('');
  return `<p ${paraStyle}>${inner}</p>`;
}

/**
 * Render the observations section of the IR.
 * Returns the empty string if there are no paragraphs.
 */
export function renderObservationsHtml(ir) {
  const paragraphs = ir?.observations?.paragraphs ?? [];
  if (paragraphs.length === 0) return '';
  return paragraphs.map((p) => paragraphToHtml(p)).join('');
}

/**
 * Render the conclusions section of the IR, preceded by a
 * dashed horizontal rule (the visual analog of a Word page break).
 * Returns the empty string if there are no paragraphs.
 */
export function renderConclusionsHtml(ir) {
  const paragraphs = ir?.conclusions?.paragraphs ?? [];
  if (paragraphs.length === 0) return '';
  const html = paragraphs.map((p) => paragraphToHtml(p, { style: PARA_STYLE_SMALL })).join('');
  if (!ir.conclusions.pageBreakBefore) return html;
  return (
    `<hr style="border: none; border-top: 2px dashed #6b7280; margin: 16px 0;" />` +
    html
  );
}

/**
 * Render the full IR (observations + conclusions) into a single
 * HTML fragment. Adapters higher up (e.g. renderEngine) wrap this
 * in a full document template.
 */
export function renderReportHtml(ir) {
  return renderObservationsHtml(ir) + renderConclusionsHtml(ir);
}

/**
 * Render a SINGLE organ's `renderSegments[]` into a per-organ HTML
 * paragraph fragment (`<p style="margin-bottom: 16px;">…</p>`).
 *
 * This is the per-organ projection used by `clinicalDocumentModel.js`
 * to produce `organ.previewHtml`. The logic is identical to how a
 * single organ is folded into the consolidated observations paragraph
 * (so the per-organ preview and the joined preview are visually
 * identical), but kept as a separate entry point because callers
 * need the per-organ HTML carried alongside `renderSegments[]`.
 *
 * Folds `separatorBefore` into the run text (so segments with
 * leading whitespace/punctuation keep their spacing intact) and
 * wraps bold runs in `<strong>`. Returns the empty string for an
 * empty / missing segments array.
 *
 * @param {Array} renderSegments
 * @param {Object} [options]
 * @param {number} [options.marginBottom=16]
 * @returns {string}
 */
export function renderOrganHtml(renderSegments, { marginBottom = 16 } = {}) {
  if (!Array.isArray(renderSegments) || renderSegments.length === 0) return '';
  const runs = [];
  for (const seg of renderSegments) {
    if (!seg) continue;
    const displayText = `${seg.separatorBefore || ''}${seg.text || ''}`;
    if (!displayText) continue;
    runs.push(
      seg.bold
        ? `<strong>${escapeHtmlText(displayText)}</strong>`
        : escapeHtmlText(displayText)
    );
  }
  if (runs.length === 0) return '';
  return `<p style="margin-bottom: ${marginBottom}px;">${runs.join('')}</p>`;
}
