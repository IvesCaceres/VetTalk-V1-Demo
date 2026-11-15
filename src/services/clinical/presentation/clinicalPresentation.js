// ============================================================
// Clinical Presentation — Single Source of Truth
//
// The one and only place where the structure of clinical content
// is decided. Produces an INTERMEDIATE REPRESENTATION (IR) that
// downstream adapters translate to their target format (HTML, OOXML,
// text, etc.). No adapter may re-implement any of these algorithms.
//
// IR shape (locked):
//
//   {
//     observations: {
//       paragraphs: Array<{
//         runs: Array<{ text: string, bold: boolean }>,
//         isFallback?: boolean,   // semantic marker: this paragraph
//                                 // represents the canonical fallback
//                                 // ("Sin hallazgos…"). Adapters decide
//                                 // how to render it (italic + gray /
//                                 // italic). The IR carries no visual
//                                 // concept — only the semantic fact.
//       }>,
//     },
//     conclusions: {
//       paragraphs: Array<{ runs: Array<{ text: string, bold: boolean }> }>,
//       pageBreakBefore: boolean,
//     },
//   }
//
// Each `paragraph` is a single visual block. Each `run` is a typed
// text segment inside that block. The bold flag and the optional
// `isFallback` semantic marker are the only knobs in the IR — every
// other presentation decision (margin, font, italic, color, tag
// names) is the adapter's job.
//
// This file is the ONLY place that:
//   - parses edited text (LABEL_PREFIX_RE + state machine)
//   - splits text into paragraphs
//   - escapes clinical characters
//   - composes renderSegments into a paragraph stream
//   - decides joiners between sections ("." for observations)
//   - decides whether a paragraph gets a page break
// ============================================================

import { cleanupInvalidPunctuation } from '../shared/sanitizeClinicalText';

const LABEL_PREFIX_RE = /^([^:\n]+?):\s*(.*)$/;
const INTER_OBSERVATION_SEPARATOR = '. ';
const TERMINAL_PUNCTUATION_RE = /[.;:!?]\s*$/;
const FALLBACK_TEXT = 'Sin hallazgos anormales registrados.';

/**
 * Decide el separador entre el último run previo y el siguiente.
 * Si el texto previo ya termina en puntuación final `[.;:!?]`
 * (posiblemente seguida de espacios), devuelve solo `' '`.
 * Si no, devuelve `INTER_OBSERVATION_SEPARATOR`.
 *
 * Defense en profundidad: defensive defaults. Any non-string, empty,
 * or whitespace-only `previousText` returns `INTER_OBSERVATION_SEPARATOR`.
 */
export function pickSeparator(previousText) {
  if (typeof previousText !== 'string') return INTER_OBSERVATION_SEPARATOR;
  return TERMINAL_PUNCTUATION_RE.test(previousText)
    ? ' '
    : INTER_OBSERVATION_SEPARATOR;
}

/**
 * Defense en profundidad: aplica `cleanupInvalidPunctuation` a cada run
 * sin alterar bold boundaries. Si un joiner futuro olvida el guard de
 * `pickSeparator`, esta pasada elimina los duplicados resultantes.
 *
 * `cleanupInvalidPunctuation` es behavior-neutral: deduplica, no agrega.
 */
function cleanupRuns(runs) {
  return runs.map((run) => {
    if (!run || typeof run.text !== 'string') return run;
    const cleaned = cleanupInvalidPunctuation(run.text);
    return cleaned === run.text ? run : { ...run, text: cleaned };
  });
}

// ── IR types (JSDoc only) ─────────────────────────────────────
//
//   Paragraph = { runs: Run[], isFallback?: boolean }
//   Run      = { text: string, bold: boolean }
//   IR       = { observations: { paragraphs: Paragraph[] },
//                conclusions:  { paragraphs: Paragraph[],
//                                pageBreakBefore: boolean } }

// ── Escape ────────────────────────────────────────────────────

/**
 * Single canonical HTML-text escape. Used by every HTML adapter.
 * XML escape (`escapeXmlText`) is a separate concern and lives in
 * `docxXmlHelpers.js` because OOXML tag boundaries are different.
 *
 * Returns the empty string for any non-string input (including
 * `null`, `undefined`, `0`, `false`). Numeric and boolean values
 * are not stringified into the output.
 */
export function escapeHtmlText(str) {
  if (str == null) return '';
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ── Edited-text parser ────────────────────────────────────────

/**
 * Sections as produced by the edited-text state machine.
 *   - label: string | null  (null for orphan text without `Label:` prefix)
 *   - body:  string         (everything after the label, or the full line)
 */
export function parseEditedText(text) {
  if (typeof text !== 'string' || text.length === 0) return [];
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return [];

  const sections = [];
  let currentLabel = null;
  let currentBody = [];

  for (const line of lines) {
    const m = line.match(LABEL_PREFIX_RE);
    if (m) {
      if (currentLabel !== null || currentBody.length > 0) {
        sections.push({ label: currentLabel, body: currentBody.join(' ') });
      }
      currentLabel = m[1];
      currentBody = [m[2]];
    } else {
      currentBody.push(line);
    }
  }
  if (currentLabel !== null || currentBody.length > 0) {
    sections.push({ label: currentLabel, body: currentBody.join(' ') });
  }

  return sections;
}

// ── Paragraph splitter ────────────────────────────────────────

/**
 * Split a raw text into non-empty trimmed paragraphs. Used by
 * `composeConclusionsFromRaw` and `composeConclusionsFromEditedText`.
 */
export function splitParagraphs(text) {
  if (typeof text !== 'string' || text.length === 0) return [];
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

// ── Render-segments → paragraphs ─────────────────────────────

/**
 * Translate a single organ's `renderSegments[]` into a paragraph IR.
 * Each segment renders as one run; `separatorBefore` is folded into
 * the run text so the run list is the canonical stream.
 */
function segmentsToParagraph(segments) {
  if (!Array.isArray(segments) || segments.length === 0) return null;
  const runs = [];
  for (const seg of segments) {
    if (!seg) continue;
    const text = `${seg.separatorBefore || ''}${seg.text || ''}`;
    if (!text) continue;
    runs.push({ text, bold: !!seg.bold });
  }
  if (runs.length === 0) return null;
  return { runs };
}

/**
 * Join all renderable organs into a SINGLE observations paragraph.
 * Organs are concatenated in the order they appear in the model;
 * each organ's segments become runs, separated by the literal
 * `. ` text run (injecting a synthetic non-bold separator run).
 *
 * Falls back to the legacy `{ label, narrative }` shape when an
 * organ has no `renderSegments`.
 */
function joinOrgansIntoParagraph(organs) {
  const renderable = (organs || []).filter((organ) => {
    if (!organ || organ.state === 'unprocessed') return false;
    if (!organ.label) return false;
    const segments = organ.renderHints?.renderSegments;
    if (Array.isArray(segments) && segments.length > 0) return true;
    const narrative = (organ.narrative || '').trim();
    return Boolean(narrative);
  });

  const runs = [];
  for (const organ of renderable) {
    const segments = organ.renderHints?.renderSegments;
    if (Array.isArray(segments) && segments.length > 0) {
      const para = segmentsToParagraph(segments);
      if (!para) continue;
      if (runs.length > 0) {
        runs.push({
          text: pickSeparator(runs[runs.length - 1]?.text),
          bold: false,
        });
      }
      runs.push(...para.runs);
      continue;
    }
    // Legacy fallback
    const narrative = (organ.narrative || '').trim();
    if (!narrative) continue;
    if (runs.length > 0) {
      runs.push({
        text: pickSeparator(runs[runs.length - 1]?.text),
        bold: false,
      });
    }
    // Canonical per-organ format (matches the snapshot reference):
    //   `<strong>{label}:</strong>` followed by ` {narrative}`.
    // The trailing space lives BETWEEN the runs, not inside the bold
    // run, so removing the bold tag would not produce double-spaces.
    runs.push({ text: `${organ.label}:`, bold: true });
    runs.push({ text: ` ${narrative}`, bold: false });
  }

  if (runs.length === 0) return null;
  return { runs: cleanupRuns(runs) };
}

// ── Public composers ──────────────────────────────────────────

/**
 * Compose observations from the ClinicalDocumentModel's organs.
 * Single active strategy: ALL renderable organs joined into ONE
 * paragraph (the canonical ComposeSingleParagraph).
 */
export function composeObservationsFromModel(organs) {
  const paragraph = joinOrgansIntoParagraph(organs);
  return {
    observations: {
      paragraphs: paragraph ? [paragraph] : [],
    },
  };
}

/**
 * Compose observations from the edited textarea (single paragraph).
 * Mirrors the structured path's single-paragraph shape. Each
 * `Label:` section becomes a bold-prefix + normal-body run pair;
 * sections are joined with the literal `. ` separator.
 */
export function composeObservationsFromEditedText(text) {
  const sections = parseEditedText(text);
  if (sections.length === 0) return { observations: { paragraphs: [] } };

  const runs = [];
  for (let i = 0; i < sections.length; i += 1) {
    const sec = sections[i];
    if (i > 0 && runs.length > 0) {
      runs.push({
        text: pickSeparator(runs[runs.length - 1]?.text),
        bold: false,
      });
    }
    const body = sec.body.trim();
    if (sec.label !== null) {
      runs.push({ text: `${sec.label}: `, bold: true });
      if (body.length > 0) runs.push({ text: body, bold: false });
    } else if (body.length > 0) {
      runs.push({ text: body, bold: false });
    }
  }
  return { observations: { paragraphs: [{ runs: cleanupRuns(runs) }] } };
}

/**
 * Compose conclusions from the model's `blocks[]` array. One
 * paragraph per block. Conclusions always render with a page break
 * before them (mirrors the existing DOCX behavior).
 */
export function composeConclusionsFromBlocks(blocks) {
  const renderable = (blocks || []).filter(
    (b) => typeof b === 'string' && b.trim().length > 0
  );
  const paragraphs = renderable.map((b) => ({
    runs: [{ text: b.trim(), bold: false }],
  }));
  return {
    conclusions: {
      paragraphs,
      pageBreakBefore: paragraphs.length > 0,
    },
  };
}

/**
 * Compose conclusions from the edited textarea. One paragraph per
 * non-empty line. Same page-break-before semantics as the block path.
 */
export function composeConclusionsFromEditedText(text) {
  const lines = splitParagraphs(text);
  const paragraphs = lines.map((line) => ({
    runs: [{ text: line, bold: false }],
  }));
  return {
    conclusions: {
      paragraphs,
      pageBreakBefore: paragraphs.length > 0,
    },
  };
}

/**
 * Compose conclusions from `raw`. Splits on newlines but preserves
 * the original text verbatim inside each run (no trim of internal
 * whitespace — that's a preview-only concern and lives in the
 * preview adapter when needed).
 */
export function composeConclusionsFromRaw(raw) {
  if (typeof raw !== 'string' || raw.length === 0) {
    return { conclusions: { paragraphs: [], pageBreakBefore: false } };
  }
  const lines = raw.split(/\r?\n/).filter((l) => l.length > 0);
  const paragraphs = lines.map((line) => ({
    runs: [{ text: line, bold: false }],
  }));
  return {
    conclusions: {
      paragraphs,
      pageBreakBefore: paragraphs.length > 0,
    },
  };
}

/**
 * Build the single fallback paragraph used when the observations
 * section would otherwise be empty (no renderable organs). The
 * paragraph carries a semantic `isFallback: true` marker so adapters
 * can decide how to render it (HTML: italic + gray; OOXML: italic)
 * without any visual concept leaking into the IR.
 *
 * @returns {{ isFallback: true, runs: Array<{ text: string, bold: false }> }}
 */
function buildFallbackParagraph() {
  return {
    isFallback: true,
    runs: [{ text: FALLBACK_TEXT, bold: false }],
  };
}

// ── Convenience: build the full IR from a model + render context ─

/**
 * Build the full IR (observations + conclusions) from a
 * ClinicalDocumentModel and an explicit render context. Mirrors the
 * explicit `ctx`-driven contract used by `generateDocx` and
 * `ReportPreview`.
 *
 * @param {Object} model   ClinicalDocumentModel
 * @param {Object} [ctx]
 * @param {boolean} [ctx.hasEditedObservaciones]
 * @param {string}  [ctx.editedObservaciones]
 * @param {boolean} [ctx.hasEditedConclusions]
 * @param {string}  [ctx.editedConclusions]
 * @returns {IR}
 */
export function composeReport(model, ctx = {}) {
  // Defensive sort: keep the IR order-stable regardless of caller
  // shape. Built from an immutable copy of the model so the caller's
  // object is never mutated.
  const sortedOrgans = Array.isArray(model?.organs)
    ? [...model.organs].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    : model?.organs;

  const observations = ctx.hasEditedObservaciones === true
    && typeof ctx.editedObservaciones === 'string'
    && ctx.editedObservaciones.length > 0
    ? composeObservationsFromEditedText(ctx.editedObservaciones)
    : composeObservationsFromModel(sortedOrgans);

  const conclusions = ctx.hasEditedConclusions === true
    && typeof ctx.editedConclusions === 'string'
    && ctx.editedConclusions.length > 0
    ? composeConclusionsFromEditedText(ctx.editedConclusions)
    : composeConclusionsFromBlocks(model?.conclusions?.blocks);

  const ir = { ...observations, ...conclusions };

  // Fallback: when the observations section is empty (no renderable
  // organs), substitute the canonical fallback paragraph. The marker
  // `isFallback: true` is the only signal adapters need.
  if (!Array.isArray(ir.observations.paragraphs) || ir.observations.paragraphs.length === 0) {
    ir.observations = { paragraphs: [buildFallbackParagraph()] };
  }

  return ir;
}
