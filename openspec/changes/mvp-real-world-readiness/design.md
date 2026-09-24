## Context

Markflow's current AI boundary accepts an OpenAI-compatible endpoint, model, and secret. That is secure but makes acceptance testing depend on a paid API account. OpenCode V2 already supports API-key, OAuth, command, and environment provider connections; its documented TUI flow includes ChatGPT Plus/Pro, while GitHub Copilot offers device OAuth and local Ollama/LM Studio need no account. OpenCode also exposes an experimental local HTTP API for integration discovery, OAuth, model listing, and one-shot generation.

The Windows bundle registers `.md`, but startup only inspects the initial process arguments. Windows can route a later Explorer activation to an existing process, and `UserChoice` can override installer registration. Startup also performs work before the user can interact, without phase-level packaged measurements.

## Goals / Non-Goals

**Goals:**

- Let a user validate AI without buying or pasting an API key when an eligible OpenCode account or local model already exists.
- Keep all provider credentials owned by OpenCode and all service credentials out of the webview.
- Make cold and already-running Explorer activation reliable for arbitrary valid `.md` paths.
- Measure and improve packaged cold/warm time-to-window and time-to-document.
- Preserve direct API and local llama.cpp options as fallbacks.

**Non-Goals:**

- Bypassing provider entitlements, automating consumer websites, importing browser/Warp/OpenCode tokens, or promising that a paid chat subscription grants API usage outside its supported OpenCode method.
- Depending on undocumented Warp storage or UI automation. Warp can be added later only through a documented external API.
- Bundling OpenCode, Ollama, or a model in the Markflow installer.
- Changing Markdown parsing, schema, mapping, or serialization.

## Decisions

1. **Add an OpenCode bridge behind the existing provider interface.** A Rust-side bridge communicates only with a local OpenCode V2 service and exposes a narrow Markflow command surface: health, integrations/accounts, models, OAuth attempt lifecycle, and text generation. The webview never receives the OpenCode service credential or arbitrary OpenCode API access. Alternatives: call vendor APIs directly (rejected because it recreates OAuth/token refresh and forces vendor-specific coupling), import OpenCode's credential database (rejected as unsafe and unsupported), or invoke prompts through shell arguments (rejected because document text can appear in process listings).

2. **Put a transport feasibility gate before feature implementation.** The first task must prove supported local service discovery/authentication and generation against the pinned OpenCode V2 contract. Prefer the official service/client contract through a minimal sidecar or supported registration mechanism; if the only available route requires undocumented credential extraction, pause the implementation rather than weaken isolation. Alternatives: assume a fixed localhost port (rejected because OpenCode service endpoints are dynamic) or embed the full OpenCode SDK immediately (rejected due installer size, lifecycle, and duplicate runtime cost).

3. **Delegate account connection to OpenCode's supported integration methods.** Markflow can begin and display an OAuth/device flow through OpenCode's integration API and poll its attempt status, or instruct the user to finish `/connect`; credentials and refresh tokens remain in OpenCode. UI copy distinguishes entitlement from zero monetary cost and never claims every ChatGPT/Claude subscription works. Alternatives: custom OAuth clients registered by Markflow (rejected until each vendor explicitly supports this product) and token reuse from Warp/OpenCode files (rejected for security and terms risk).

4. **Use capability discovery instead of hard-coded free models.** Markflow lists models returned by the connected OpenCode service and records only the selected provider/model reference. It labels local models and connection provenance, offers a non-document test prompt, and requires the same remote-content consent before real document text is sent. Alternatives: hard-code model names (rejected because catalogs and entitlements change) or silently select the first model (rejected because cost/privacy could be surprising).

5. **Handle every Windows activation in Rust and grant only the exact file.** Add Tauri's supported single-instance/deep activation mechanism so both initial argv and later Explorer opens flow through one validator, canonicalize an existing `.md` file, grant that exact path to the fs scope, then emit it to the ready frontend. Queue events until the frontend acknowledges readiness. Alternatives: disable single-instance behavior (rejected as poor desktop UX), globally allow Downloads/Documents (rejected as excessive authority), or write `UserChoice` directly (rejected because Windows protects it and the installer must not override user intent).

6. **Treat Windows default-app selection as a guided prerequisite, not installer failure.** The installer registers Markflow; settings expose status/help to open Windows Default Apps or “Open with”. Packaged verification covers a fresh association and an existing competing `UserChoice`. Alternatives: force registry ownership (rejected as unreliable and hostile) or claim double-click works whenever registration exists (rejected because observed behavior disproves it).

7. **Measure startup phases before optimizing and defer non-critical work.** Record process start, Rust setup, webview ready, first paint, startup-file authorized, parse complete, and document visible. Provider restore, indexing, editor pre-mounts, and model checks move after first paint unless required for the initial document. Set targets only from packaged cold/warm baselines, then add regression thresholds with machine/workload metadata. Alternatives: optimize development-server timing (rejected as unrepresentative) or add a decorative splash that hides unchanged work (rejected unless it improves measured usable time).

8. **Preserve the round-trip invariant.** AI connection, activation, and startup changes never mutate document AST state. An Explorer-opened file still uses the existing load/save pipeline, and no-edit packaged tests compare file bytes before and after. No schema or serializer change is permitted in this change.

## Risks / Trade-offs

- **OpenCode HTTP API is experimental and versioned behavior can change** → pin a tested compatible V2 range, perform a startup compatibility check, isolate the bridge, and keep direct/local providers available.
- **A local OpenCode service has capabilities Markflow must not expose** → proxy an allowlist in Rust; never return service authorization headers or generic session/filesystem/shell methods to the webview.
- **OAuth availability and subscription entitlement differ by provider/account** → display methods returned by discovery, avoid universal claims, and surface provider errors verbatim only after safe redaction.
- **OpenCode is not installed or running** → detect this without blocking startup and provide concise installation/`/connect` instructions plus Ollama/direct alternatives.
- **Windows association remains overridden by `UserChoice`** → test and explain the OS state; never report successful ownership when Markflow is not the selected default.
- **Startup instrumentation itself adds noise** → use monotonic in-process markers, no network telemetry, repeated samples, and release builds.

## Migration Plan

1. Add the bridge and activation paths behind disabled feature flags; retain existing provider settings unchanged.
2. Complete the OpenCode feasibility/security gate and packaged Explorer reproduction before exposing either feature.
3. Add the OpenCode option as Beta and migrate no credentials; existing device provider selection remains active.
4. Measure release startup, defer proven blockers, and record before/after results.
5. Roll back by disabling the bridge and new activation handler; direct API/local providers and in-app file opening remain available.

## Open Questions

- Which supported OpenCode service-discovery mechanism is practical in a Tauri/Rust release without bundling a Node runtime?
- Does the tested OpenCode V2 version expose one-shot generation with sufficient cancellation and no project filesystem access, or should Markflow use a restricted ephemeral session?
- What cold/warm startup thresholds are realistic on the existing Windows baseline machine after phase-level measurement?
