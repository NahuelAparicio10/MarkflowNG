# AI runtime and retrieval evaluation

## Local text generation

- **Runtime:** llama.cpp `llama-server`, OpenAI-compatible chat completions over
  loopback. CPU release archive `llama-b11149-bin-win-cpu-x64.zip`: 18,559,583
  bytes compressed; the desktop runtime remains user-managed and is not bundled.
- **Evaluation model:** Qwen2.5-0.5B-Instruct Q4_K_M GGUF, downloaded for this
  evaluation only (491,400,032 bytes on disk). Server: 2 CPU threads, 4,096-token
  context. The app accepts any compatible user-selected GGUF model.
- **Smoke evaluation:** llama.cpp 0.5.0-dev (build 11149), local chat-completions
  returned the exact requested response. The measured run produced 25.9 tokens/s
  on CPU (2 threads) with a 72.7-token/s prompt-processing rate.
- **Privacy boundary:** only literal loopback addresses are accepted for local
  generation. Redirects and proxies are disabled. Documents never go to the
  generation endpoint for embedding.

## Embeddings

- **Runtime/model:** FastEmbed 7.1 / ONNX Runtime, all-MiniLM-L6-v2, pinned to
  Hugging Face revision `5f1b8cd78bc4fb444dd171e59b18f3a3af89a079`, mean pooling,
  512-token model ceiling, one inference thread. FastEmbed is compiled without
  hub or online features; provisioning fetches the five pinned assets explicitly.
- **Measured asset size:** model.onnx 90,387,630 bytes; tokenizer.json 711,661;
  config.json 650; special_tokens_map.json 695; tokenizer_config.json 1,433.
  Total: 91,102,069 bytes (about 86.9 MiB). Model is downloaded on first explicit
  setup, not bundled.
- **Chunk ceiling:** 180 source words (a soft limit). This gives a small coherent
  embedding input while avoiding cuts inside lists, fenced code, tables or other
  AST blocks. A single larger indivisible block remains intact in metadata.
- **Index location:** application data directory, under a path-derived cache key;
  workspace files and ignore rules are untouched.

## Retrieval quality

The workspace fixture (EXPLORE.md plus the AI change's design/specification) and questions are in the ignored Rust evaluation test
`index::embedding::tests::evaluate_real_workspace_retrieval_quality_and_size`.
Run it with `MARKFLOW_EVAL_MODEL_DIR` pointing to the pinned local model folder:

```powershell
$env:MARKFLOW_EVAL_MODEL_DIR = 'path-to-model-folder'
cargo test index::embedding::tests::evaluate_real_workspace_retrieval_quality_and_size -- --ignored --nocapture
```

Measured on 2026-09-24: 66 chunks, correct expected file at Recall@1 **3/3**.
Cosine scores were 0.469 for privacy, 0.465 for phase/mapping, and 0.565 for
chunk-size ceiling. The chunk-size ceiling query ranked an "Open Questions"
section rather than the intended subsection; file Recall@1 does not imply exact
section precision, so returned sections remain explicit for verification. Retrieval remains a
best-effort workspace aid; every answer links back to its source and reports
when indexing is incomplete.
