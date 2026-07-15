# Security Rules (always apply)

- **No secrets in the client — ever.** No API keys, OAuth client secrets, or private keys in
  `src/`, `electron/`, or any bundle. Route privileged calls through the backend. The
  `block-secrets` PreToolUse hook enforces this; never disable it.
- **Known pre-existing secrets to remove + rotate** (carried over from the web app):
  - OpenAI key in `src/tools/text/CaptionByAI.jsx` → delete; route captions via backend; rotate the key.
  - Google client secret in `src/tools/photos/googlePhotosPickerUtils.js` → use a PKCE desktop client; rotate.
- **Electron hardening invariants:** context isolation on, node integration off, sandbox on,
  web security on; curated `window.desktop` only; CSP present; navigation guards intact.
- **CSP is currently permissive** (to avoid breaking the first build). Tighten `connect-src` to the
  explicit host list and drop `'unsafe-eval'` once verified — see `electron/main/security.ts`.
- Validate every IPC payload in main. Treat all renderer input as untrusted.
- Never read or write `.env`, `*.p12`, `*.pem`, or signing materials from agent tools.
