# MVP Performance Baseline

Measurements were collected on September 24–25, 2026, using Windows 10 Home 19045, an Intel Core i7-6700 (4 cores / 8 logical processors), and 15.9 GiB of RAM.

These results describe one reference machine. They are regression baselines, not universal performance guarantees.

## Reproducible workloads

By default, `npm run perf:generate` creates the following fixtures in the system temporary directory:

- a document with 10,000 repeatable sections (829,414 bytes of Markdown and 10,500 rendered blocks in this run);
- a workspace containing 5,000 Markdown files across 100 directories.

Override fixture sizes with `MARKFLOW_PERF_BLOCKS` and `MARKFLOW_PERF_FILES`.

The browser performance suite is opt-in:

```powershell
$env:MARKFLOW_RUN_PERF='1'
npm run test:e2e -- tests/e2e/performance.spec.ts
```

The Rust scan measurement uses the generated workspace:

```powershell
$env:MARKFLOW_PERF_WORKSPACE="$env:TEMP\markflow-perf-workloads\workspace"
cargo test measure_large_workspace_scan --manifest-path src-tauri/Cargo.toml -- --ignored --nocapture
```

## Results

| Operation | Observed result |
|---|---:|
| Document load through render (browser, 10,500 blocks) | 3,476 ms |
| In-memory workspace scan/tree construction (5,000 files) | 63.4 ms |
| Maximum event-loop delay during that operation | 63.4 ms |
| Debug Rust disk scan (5,100 entries, 11 batches) | 488 ms |

### Packaged startup

Packaged startup measurements were added on September 25, 2026, using the release executable. Each phase is recorded locally only when `MARKFLOW_STARTUP_METRICS_FILE` is defined; Markflow sends no performance telemetry.

Approximate process-to-content time combines the backend-ready duration and the relative webview marker.

```powershell
powershell -ExecutionPolicy Bypass -File scripts/perf/measure-startup.ps1
```

The script refuses to measure while another Markflow process is open, runs three empty samples and three file samples, stops only the processes it created, and verifies the document SHA-256 afterward.

| Operation | Observed result |
|---|---:|
| First empty launch after build (process → first paint) | ~1,710 ms |
| Warm empty launch, two repetitions | ~638–654 ms |
| Warm associated `.md`, process → visible document, five repetitions | ~652–754 ms |

The associated fixture contained spaces and `ñ`. Every measured run reached `startup-document-visible` and preserved the document SHA-256 byte for byte. A second activation while Markflow was already running completed in under five seconds, retained the original process, and produced parsing and visible-document markers in that instance.

Literal Explorer double-click behavior still depends on Windows selecting Markflow as the effective `.md` `UserChoice`.

## Interpretation

The toolbar, Quick Open, and navigation become responsive after the workspace batch, but a 63.4 ms main-thread task exceeds a 16 ms frame budget. The large document also has a visible delay.

These results do not yet justify moving the Markdown core to Rust because the browser test measures the complete parse, mapping, and DOM-rendering pipeline rather than isolated parsing or serialization.

## Regression thresholds

- Measure parsing and serialization independently. Keep each below 16 ms for typical documents before considering a Rust migration.
- Keep main-thread blocking during workspace-tree ingestion below 50 ms, preferably split into tasks below 16 ms.
- Reduce warm rendering of the large fixture below one second through virtualization or progressive rendering before describing it as fast large-document opening.
- Keep warm empty and file startup below 1,000 ms on the reference machine; investigate any median above that threshold.

## Limitations

- Playwright uses the web fixture and deterministic in-memory data. It does not include WebView2 startup, antivirus overhead, disk latency, or native dialogs.
- The Rust scan measurement used a debug build.
- First launch is affected by disk cache, WebView2, and antivirus state. Warm repetitions are not equivalent to clearing the operating-system cache.
- Hardware, power settings, background activity, and filesystem behavior affect results.

Use the same fixture sizes, commands, and environment when comparing future optimizations.
