# VetTalk V1 — Offline Portfolio Demo

A standalone mockup of a veterinary ultrasound reporting workflow: move from an organ-based dictation demonstration to a report preview and a synthetic Word document.

**SYNTHETIC_DEMO — not for clinical use.** This project does not transcribe real audio, interpret findings, diagnose patients or contact an AI provider. No API keys, accounts or cloud services are required to run the demo. Do not enter real patient, guardian or professional information.

## What this demonstrates

- A responsive React interface inspired by VetTalk V1, retaining its visual styles and original report-presentation component.
- Organ selection and a cancellable, simulated dictation/transcription flow.
- Deterministic mock processing of fixed, fictional findings.
- Read-only fictional patient details and two demo-only template choices.
- Report preview and local DOCX generation, labelled as synthetic and unsuitable for clinical use.
- A temporary local demo session. No password, browser storage or uploaded data is used.

This is a portfolio mockup, not a feature-complete replacement for the original application. The production application **VetTalk V2 is private, separate and not included**. The original private repository, production configuration and shared V1/V2 Git history are not part of this candidate. No AI backend from the isolated P0 correction is included.

## Stack

React 19 and JavaScript/JSX; Vite 7 for local development and builds; `fflate` to create a small DOCX package from scratch; Node's test runner and Playwright for validation. Exact versions are pinned in `package-lock.json`.

There are no Supabase, OpenAI, DeepSeek or Vercel SDKs, production endpoints, external fonts, remotely loaded icons, analytics or service workers. All application state stays in memory. Reloading or leaving the page discards the session.

## Run locally

Use Node.js 22.12+ (Node 24.14.0 was used for validation) and npm:

```sh
npm ci --ignore-scripts
npm run dev
```

Open the loopback URL printed by Vite, select **Entrar a la maqueta**, choose an organ and select **Simular dictado**. Then select **Procesar demostración**, open the preview and download the synthetic DOCX.

```sh
npm test
npm run build
npm run check:privacy
npm run preview
```

Dependency installation needs the public npm registry or a prepared cache. **Application runtime does not need Internet access.** There is no `.env` setup, login account, API subscription or backend to configure. This development server binds to loopback; it is not a production hosting recommendation.

## Browser tests

After building:

```sh
npm run test:e2e
```

Playwright needs a compatible Chromium installation. This validation reused an existing cached Chromium binary without downloading a browser. To reuse an existing executable, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to its absolute path. A fresh machine may need a separate browser installation; no browser is bundled with this repository. The browser test blocks external hosts and checks the production build, not a real clinical deployment.

## Synthetic data and document limitations

Fixtures in `src/demo/fixtures.mjs` were written specifically for this mockup. They are not anonymized real records or extracted report samples. The interface accepts only the fixed synthetic transcription fixtures for processing; it provides no route to submit arbitrary clinical text.

The Word package is generated at runtime by `src/demo/docx.mjs`. No existing DOCX, private template, scanned document, signature or clinical image is shipped. The original read-only presentation component and supporting utilities are reused for the preview; AI and clinical interpretation are not part of the demo contract.

The two template choices are simplified layouts for demonstration, not the original production template editor. Exported documents carry synthetic/nonclinical notices. Package structure, XML and browser download were tested; visual rendering in Microsoft Word and LibreOffice remains unverified.

## Security, provenance and licensing

See [SECURITY.md](SECURITY.md), [source provenance](docs/PROVENANCE.md), [third-party notices](docs/THIRD_PARTY.md) and [validation](docs/VALIDATION.md).

No project-wide MIT license has been adopted. Redistribution rights for the retained original components and the final project license require owner confirmation before publication. Third-party components retain their own licenses and notices. A clean dependency audit is not a guarantee of complete security or clinical validity.

This candidate is prepared locally. Publication and remote repository changes require separate approval.
