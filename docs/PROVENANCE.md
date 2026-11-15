# Original-source provenance

The following presentation components were selectively retained from VetTalk V1 baseline `02c310c87ef6b3c0acc531d37bffa9fc8938649d`. This identifies source provenance, not the currently deployed production commit. No Git objects, branches or tags were imported.

| Source path | Adaptation |
| --- | --- |
| src/index.css | external font import removed; text line endings may be normalized |
| src/components/OrganHtmlPreview.jsx | unchanged; text line endings may be normalized |
| src/utils/composeHtmlFromPreviewHtml.js | unchanged; text line endings may be normalized |
| src/services/clinical/presentation/clinicalPresentation.js | unchanged presentation utility; text line endings may be normalized |
| src/services/clinical/presentation/htmlAdapter.js | unchanged presentation utility; text line endings may be normalized |
| src/services/clinical/shared/sanitizeClinicalText.js | unchanged presentation utility; text line endings may be normalized |
| src/services/clinical/clinicalFieldRegistry.js | unchanged presentation utility; text line endings may be normalized |

All demo adapters, fixture identities, report layouts, document export, tests and demo orchestration were authored for this candidate. The preview dependency closure includes the field registry for presentation metadata; it is not an AI/clinical interpretation service.

Excluded: original App orchestration, backend/AI code, service SDKs, production configuration, environment files, original assets/templates, datasets, screenshots, documents, agent configuration, ignored local state, historical Git and all V2 code. No project license is adopted pending owner rights confirmation.
