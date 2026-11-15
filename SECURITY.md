# Demo security boundaries

This repository is an offline portfolio mockup, not a clinical application or authentication service. Do not enter or attach real information.

- No backend, provider credential, production authentication or cloud storage is included.
- The session and fictional fixtures live in memory; no cookies, localStorage or sessionStorage are used.
- The simulated adapters do not read a microphone, audio file, clipboard, private database or external API.
- The client processes only the fixed synthetic fixture text. Export rebuilds the patient identity from the synthetic fixture and rejects foreign results and template IDs.
- All preview text is supplied through the retained escaping/presentation path. Word XML is escaped, and the generated package contains no external relationships or macros.
- The HTML includes a restrictive Content Security Policy; loopback WebSocket access is permitted for Vite development only. There is no service worker to retain an old production application.
- `.gitignore` excludes environment files, populated databases, documents, backups, logs, dependencies and build output. Review staged files: ignore rules do not sanitize tracked history.

`npm run check:privacy` scans versionable source and generated build files for credential signatures, JWT literals, known integration host patterns, environment files, private-data formats and runtime network/storage/microphone code. Browser tests independently block external hosts. These controls are not an exhaustive identity-registry check or a substitute for manual review.

If a future change adds accounts, cloud storage, dictation capture or AI, it requires a separate architecture/privacy review. Do not enable production features by adding credentials to this mockup.

The previously identified credential exposure in the original V1 deployment is outside this repository. Creating this mockup does not rotate keys, remove older deployments or resolve that incident. No production changes were made during preparation.
