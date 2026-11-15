// ============================================================
// OrganHtmlPreview — Phase 1B read-only UI consumer
//
// Consumes `organ.previewHtml` (the Phase 1A derived field on
// ClinicalDocumentModel.organs[i]) and renders it as a single-
// paragraph HTML block, matching the byte-for-byte layout produced
// by renderEngine.composeHtmlSingleParagraph.
//
// Directionality (FORBIDDEN to violate):
//
//   renderSegments ──► previewHtml ──► OrganHtmlPreview
//                                          │
//                                          └── (edits) ──► editableObservaciones
//
// The component is read-only. It does NOT receive a value/onChange —
// there is no reverse path from this surface back into previewHtml
// or renderSegments. The EditableObservaciones textarea remains
// the edit surface (see App.jsx). Premature promotion of previewHtml
// to SSoT is forbidden by Phase 1B constraints; that work belongs to
// Phase 2 (hard-gated).
//
// XSS safety: `previewHtml` strings are already escaped at the
// projection point via `escapeHtmlInline` in
// src/services/clinical/narrativeComposer.js. Injecting via
// dangerouslySetInnerHTML is safe because all content has passed
// through the canonical escape pipeline before reaching the model.
// ============================================================

import React from 'react';
import { composeHtmlSingleParagraphFromPreviewHtml } from '../utils/composeHtmlFromPreviewHtml';

/**
 * Read-only findings section rendering from organ.previewHtml.
 *
 * @param {Object} props
 * @param {Array}  props.organs - ClinicalDocumentModel.organs
 * @returns {JSX.Element}
 */
export default function OrganHtmlPreview({ organs }) {
  const html = composeHtmlSingleParagraphFromPreviewHtml(organs);
  return (
    <div
      className="organ-html-preview"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
