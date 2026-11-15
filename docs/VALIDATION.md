# Validation scope

Validated locally on Windows with Node 24.14.0 and npm. No production environment, real key or patient record was used.

- Unit/demo tests: 12 PASS, including cancellation, fixed-fixture processing, template/result rejection, synthetic DOCX package structure, fictional layout selection and XML escaping.
- Production build: PASS.
- Browser workflow against the production build: PASS, desktop and 390px mobile layout; no page errors or external requests. Checks include local entry, fictional patient, organ selection, simulated dictation/processing, original preview component, DOCX download, template selection, cancellation, reset and logout.
- Browser storage after the workflow: no cookies, localStorage or sessionStorage.
- Dependency audit: zero known vulnerabilities in the resolved npm tree, including development dependencies, on 2026-11-15.
- Privacy/integration source and build checks: PASS.

An inherited flex-layout interaction initially caused mobile overflow; it was corrected only in the new demo styles and rechecked. This was a candidate UI defect, not a production change.

The retained preview utilities and registry originate in V1. The earlier isolated V1 review found two pre-existing field-registry assertions failing in both baseline and P0 copies. Those clinical rewrite expectations were not changed here. The new mockup does not invoke clinical classification or the dictation-rewrite pipeline. Its passing tests must not be presented as a fix or full validation of the original V1 test suite.

Synthetic fixtures and layouts are newly authored. Original documents, private templates, production credentials and data were not transferred. The source allowlist/provenance, file hashes and detailed preparation results are maintained separately from the public candidate.

Limitations: Microsoft Word/LibreOffice rendering, original production authentication, live dictation, AI behavior, Supabase policies and V2 are not tested or claimed. A cached Chromium executable was reused through Playwright; cross-browser/device qualification is not established. License/rights approval and exact-content review remain required before publication.
