## Why

The phase 7 AI implementation cannot be acceptance-tested without manually supplying a paid API credential, Windows Explorer still fails to open associated Markdown files on the user's machine, and packaged startup has perceptible latency. These gaps prevent the otherwise complete MVP from being considered reliable in normal use.

This is a post-phase-7 MVP readiness change: it validates and hardens existing product promises rather than adding cloud, collaboration, or other post-MVP scope.

## What Changes

- Add an OpenCode V2 connection option that discovers or starts the user's local OpenCode service, reuses provider accounts connected through OpenCode's supported OAuth flows, and generates text without exposing or copying OpenCode credentials into Markflow.
- Support a zero-cost validation path through an already connected ChatGPT Plus/Pro account where OpenCode offers it, GitHub Copilot Free where entitled, or automatically discovered local Ollama/LM Studio models; paid API keys remain optional rather than required.
- Treat Warp as unsupported until it exposes a documented external API and authorization contract; do not scrape its storage, tokens, or UI.
- Add provider/model discovery, connection status, a safe test action, actionable errors, privacy disclosure, cancellation, and an explicit fallback to the existing direct API/local llama.cpp provider.
- Fix the complete packaged Windows activation path for `.md` files—including installer registration, quoted paths, fs scope authorization, cold start, and subsequent file-open events—and verify it from Explorer.
- Instrument packaged startup, establish cold/warm baselines, and remove or defer blocking initialization so an empty window and an associated document become usable sooner.

## Capabilities

### New Capabilities
- `opencode-ai-bridge`: Supported discovery, authentication handoff, model selection, generation, privacy boundaries, and failure behavior for a local OpenCode V2 service.
- `application-startup`: Measurable cold/warm startup behavior and non-blocking initialization requirements for the packaged desktop application.

### Modified Capabilities
- `ai-provider`: Add a no-manual-key provider path, provider/model discovery, connection testing, and clear Beta/readiness states while retaining secure direct and local providers.
- `markdown-file-association`: Require real Explorer activation for cold and already-running application instances, including paths outside previously granted fs scopes.

## Impact

Affected areas include `src/ai/`, provider settings and consent UI, a new Rust-side OpenCode service/client boundary, Tauri single-instance/file-open handling, installer configuration, startup initialization, telemetry limited to local timings, and packaged Windows/E2E tests. The OpenCode HTTP API is experimental, so the bridge must be version-gated, least-privileged, optional, and isolated behind the existing provider abstraction.
