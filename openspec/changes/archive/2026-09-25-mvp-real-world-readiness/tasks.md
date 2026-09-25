## 1. Reproduce and baseline

- [x] 1.1 Reproduce the packaged Explorer `forbidden path` failure on a cold launch and while Markflow is already running; capture argv/events, effective `.md` `UserChoice`, and fs-scope state without logging document contents.
- [x] 1.2 Add monotonic release-build markers for process start, Rust setup, webview readiness, first paint, file authorization, parse completion, and document visibility.
- [x] 1.3 Record repeated cold/warm empty-start and associated-file baselines on the documented Windows machine, including antivirus/cache limitations.
- [x] 1.4 Inventory startup work and identify which provider restore, indexing, editor mounting, and model checks occur before first paint.

## 2. OpenCode feasibility and security gate

- [x] 2.1 Pin a tested OpenCode V2 compatibility range and prove a supported service discovery/authentication transport from packaged Tauri without exposing service credentials to the webview.
- [x] 2.2 Prove model discovery, a cancellable synthetic generation, and safe error mapping against an existing OAuth-connected OpenCode account and a local model where available.
- [x] 2.3 Document the minimum OpenCode API allowlist and add negative tests showing that filesystem, shell, generic session, plugin, command, and arbitrary-path access are unreachable through Markflow.
- [x] 2.4 Verify whether Warp publishes a supported external generation/authentication API; keep it excluded and document why if no suitable contract exists.
- [x] 2.5 Pause implementation and update the design instead of reading OpenCode databases/tokens or using shell arguments containing prompts if the supported transport gate fails.

## 3. OpenCode provider bridge

- [ ] 3.1 Implement the Rust-side OpenCode health, compatibility, integration/account, model, OAuth-attempt, generation, and cancellation commands behind the narrow allowlist.
- [x] 3.2 Add an `AiProvider` implementation that routes existing selection and workspace generation through the bridge without changing review-before-apply behavior.
- [x] 3.3 Keep OpenCode service authorization and provider credentials out of frontend state, logs, errors, persisted settings, process arguments, and documents; add focused security tests.
- [x] 3.4 Handle service restart, incompatibility, timeout, cancellation, missing entitlement, unavailable model, and malformed response without changing the document.

## 4. Zero-cost AI onboarding and validation

- [x] 4.1 Redesign provider settings with OpenCode, discovered local model, direct API, and llama.cpp choices; hide endpoint/key fields unless the direct option needs them.
- [ ] 4.2 Implement OpenCode OAuth/device authorization UI from discovered methods, including browser/code handoff, polling, cancellation, and instructions for completing `/connect` externally.
- [x] 4.3 List only discovered usable models, show account/local/cost provenance, require remote-content consent, and persist only the provider/model reference.
- [x] 4.4 Add a cancellable “Test connection” action using synthetic text and actionable authentication, entitlement, compatibility, rate-limit, runtime, and network results.
- [x] 4.5 Label AI as Beta and add a repeatable smoke checklist for connection, selection generation, review/apply/reject, standalone documents, and workspace RAG without requiring purchase of an API key.

## 5. Windows Explorer activation

- [x] 5.1 Route initial process arguments and subsequent single-instance Explorer activations through one Rust path validator and exact-file fs-scope grant.
- [x] 5.2 Queue validated file-open events until frontend readiness, deduplicate activations, focus the existing window, and open each document in reader mode through the normal loader.
- [x] 5.3 Reject missing, malformed, directory, flag, and non-Markdown inputs without broadening scope; test spaces, Unicode, shell metacharacters, and files outside the workspace.
- [x] 5.4 Detect and explain when Windows `UserChoice` overrides installer registration, linking to a supported Default Apps/“Open with” flow without rewriting protected registry state.
- [x] 5.5 Build and install NSIS/MSI packages, then manually verify cold and running-instance Explorer opens plus byte-identical no-edit save behavior.

## 6. Startup improvements

- [x] 6.1 Render an interactive empty shell or startup document before optional AI discovery, provider restoration, indexing, update work, and inactive editor initialization.
- [x] 6.2 Move verified blocking operations off the critical path while preserving error visibility and cancellation during shutdown.
- [x] 6.3 Re-run packaged cold/warm measurements, set evidence-based percentile thresholds, and add the repeatable regression check to project documentation.
- [x] 6.4 Confirm OpenCode missing/slow/incompatible states do not delay reader startup or Explorer document visibility.

## 7. Verification

- [ ] 7.1 Add unit/integration tests for OpenCode compatibility, allowlisting, OAuth lifecycle, model discovery, cancellation, redaction, and provider fallback.
- [ ] 7.2 Add frontend/E2E tests for no-key onboarding, connection testing, consent, Beta states, AI-disabled behavior, and unchanged review-before-apply flows.
- [x] 7.3 Run packaged Windows association and startup benchmarks and record results in `docs/roadmap.md`, `docs/architecture.md`, and the performance baseline.
- [x] 7.4 Run `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`, and Playwright suites.
- [x] 7.5 Run `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`, Rust tests, OpenSpec strict validation, and `git diff --check`.
- [x] 7.6 Run full Markdown/editor round-trip tests and verify AI, activation, and startup changes produce no document diff without an accepted edit.
