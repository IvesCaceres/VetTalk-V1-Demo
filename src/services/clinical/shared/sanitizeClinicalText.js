// ============================================================
// Sanitize Clinical Text — CANONICAL, SINGLE SOURCE
//
// This is the ONLY place where clinical text is modified
// after LLM response. All pipelines (A, B, transcription,
// deepseek, openai) MUST use this module.
//
// Architecture rule:
//   LLM → raw text distribution (NEVER modifies)
//   sanitizeClinicalText → ALL corrections (ALWAYS applied)
//
// Megalia expansions and medical-spelling corrections come from
// the clinicalFieldRegistry — to add or change a correction, edit
// clinicalFieldRegistry.js only.
// ============================================================

import {
  MEGALIA_EXPANSIONS,
  getDictationRewrites,
  getMegaliaExpansion,
} from '../clinicalFieldRegistry';

// ── Helpers ───────────────────────────────────────────────────

function expandMegalia(text, organId) {
  if (!text || !text.toLowerCase().includes('megalia')) return text;
  if (!organId) return text;

  const key = organId.toLowerCase();
  const expansion = MEGALIA_EXPANSIONS[key] ?? getMegaliaExpansion(organId);

  if (expansion) {
    return text.replace(/\bmegalia\b/gi, expansion);
  }

  return text;
}

/**
 * Strips invalid punctuation produced upstream (LLM, ASR, joins).
 * Conservative: only removes duplicates and invalid combinations;
 * NEVER adds punctuation or modifies clinical content.
 *
 * Examples:
 *   ").,"  → ")."
 *   ".,"   → "."
 *   ",,"   → ","
 *   ".."   → "."
 *   " ,"   → ","
 *   " ."   → "."
 *   " . "  → "."
 */
export function cleanupInvalidPunctuation(text) {
  if (!text) return text;
  return text
    .replace(/,\s*,+/g, ',')
    .replace(/\.\s*\.+/g, '.')
    .replace(/\.\s*,/g, '.')
    .replace(/,\s*\./g, '.')
    .replace(/\s+,/g, ',')
    .replace(/\s+\./g, '.');
}

// ── Public API ────────────────────────────────────────────────

/**
 * Applies ALL post-processing corrections to clinical text.
 * This is the ONLY function that should modify LLM output.
 *
 * @param {string} text - Raw text from LLM
 * @param {string} organId - Organ ID for context-aware corrections
 * @returns {string} Sanitized text
 */
export function sanitizeClinicalText(text, organId = '') {
  if (!text || typeof text !== 'string') return text;

  let result = expandMegalia(text, organId);

  getDictationRewrites(organId).forEach(([pattern, replacement]) => {
    result = result.replace(pattern, replacement);
  });

  result = cleanupInvalidPunctuation(result);

  return result.trim();
}

/**
 * Recursively applies sanitizeClinicalText to all string values in an object.
 *
 * @param {Object} obj - Object with string fields from LLM
 * @param {string} organId - Organ ID for context-aware corrections
 * @returns {Object} Object with all strings sanitized
 */
export function sanitizeResult(obj, organId = '') {
  if (!obj || typeof obj !== 'object') return obj;
  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeClinicalText(value, organId);
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeResult(value, organId);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}
