// ============================================================
// composeHtmlFromPreviewHtml — Thin HTML bridge
//
// Kept for backward compatibility with existing tests and
// downstream consumers that import the legacy
// `composeHtmlSingleParagraphFromPreviewHtml` function. Internally
// delegates to the presentation core and the HTML adapter.
// ============================================================

import { composeReport } from '../services/clinical/presentation/clinicalPresentation';
import { renderObservationsHtml } from '../services/clinical/presentation/htmlAdapter';

/**
 * Composes the findings section HTML as a SINGLE outer `<p>`,
 * equivalent to the legacy `composeHtmlSingleParagraphFromPreviewHtml`.
 *
 * Routes through `composeReport` so the canonical fallback paragraph
 * (when no organs are renderable) and the defensive organ sort are
 * both applied — single source of truth, no local duplication.
 *
 * @param {Array} organs - ClinicalDocumentModel.organs
 * @returns {string} findings section HTML
 */
export function composeHtmlSingleParagraphFromPreviewHtml(organs) {
  const ir = composeReport({ organs, conclusions: { blocks: [] } });
  return renderObservationsHtml(ir);
}

/**
 * Strips a single outer `<p ...>` wrapper from `previewHtml`.
 * Retained for backward compatibility with legacy callers.
 *
 * @param {string} previewHtml
 * @returns {string}
 */
export function stripPreviewParagraph(previewHtml) {
  if (typeof previewHtml !== 'string' || previewHtml.length === 0) return '';
  const openMatch = previewHtml.match(/^<p [^>]*>/);
  if (!openMatch) return previewHtml;
  return previewHtml.slice(openMatch[0].length, -'</p>'.length);
}

export const __test = {
  stripPreviewParagraph,
};
