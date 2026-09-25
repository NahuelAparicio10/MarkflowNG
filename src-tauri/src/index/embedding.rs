use fastembed::{
    InitOptionsUserDefined, Pooling, TextEmbedding, TokenizerFiles, UserDefinedEmbeddingModel,
};
use std::{fs, path::Path};

pub const MODEL_REVISION: &str = "5f1b8cd78bc4fb444dd171e59b18f3a3af89a079";
pub const MODEL_FILES: [&str; 5] = [
    "model.onnx",
    "tokenizer.json",
    "config.json",
    "special_tokens_map.json",
    "tokenizer_config.json",
];

pub fn load_model(path: &Path) -> Result<TextEmbedding, String> {
    let read = |name| {
        fs::read(path.join(name)).map_err(|_| {
            "Local embedding model is missing. Download it in AI settings.".to_string()
        })
    };
    let tokenizer = TokenizerFiles {
        tokenizer_file: read("tokenizer.json")?,
        config_file: read("config.json")?,
        special_tokens_map_file: read("special_tokens_map.json")?,
        tokenizer_config_file: read("tokenizer_config.json")?,
    };
    TextEmbedding::try_new_from_user_defined(
        UserDefinedEmbeddingModel::new(read("model.onnx")?, tokenizer).with_pooling(Pooling::Mean),
        InitOptionsUserDefined::new()
            .with_max_length(512)
            .with_intra_threads(1),
    )
    .map_err(|_| "Could not load the local embedding model.".into())
}

/// No download or HTTP client exists on the inference path.
pub fn embed(model: &mut TextEmbedding, text: &str) -> Result<Vec<f32>, String> {
    model
        .embed(vec![text], Some(1))
        .map_err(|_| "Local embedding failed.".to_string())?
        .pop()
        .ok_or_else(|| "Local embedding returned no vector.".into())
}

/// Explicit provisioning, separate from indexing. Only fixed public model assets are requested.
pub async fn download_model(path: &Path) -> Result<(), String> {
    fs::create_dir_all(path).map_err(|_| "Could not create model cache")?;
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(600))
        .build()
        .map_err(|_| "Could not initialize model download")?;
    for name in MODEL_FILES {
        let target = path.join(name);
        if target.is_file() {
            continue;
        }
        let url = format!(
            "https://huggingface.co/Qdrant/all-MiniLM-L6-v2-onnx/resolve/{MODEL_REVISION}/{name}"
        );
        let bytes = client
            .get(url)
            .send()
            .await
            .map_err(|_| "Model download failed")?
            .error_for_status()
            .map_err(|_| "Model download failed")?
            .bytes()
            .await
            .map_err(|_| "Model download failed")?;
        let temporary = path.join(format!("{name}.partial"));
        fs::write(&temporary, &bytes).map_err(|_| "Could not save model")?;
        fs::rename(temporary, target).map_err(|_| "Could not install model")?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    #[ignore = "requires the pinned embedding model downloaded in AI settings"]
    fn evaluate_real_workspace_retrieval_quality_and_size() {
        let model_path =
            std::env::var_os("MARKFLOW_EVAL_MODEL_DIR").expect("set local eval model path");
        let root = Path::new(env!("CARGO_MANIFEST_DIR")).parent().unwrap();
        let documents = [
            "Context/EXPLORE.md",
            "openspec/changes/ai-assistance/design.md",
            "openspec/changes/ai-assistance/specs/ai-retrieval/spec.md",
        ];
        let mut model = load_model(Path::new(&model_path)).unwrap();
        let mut chunks = Vec::new();
        for file in documents {
            let source = fs::read_to_string(root.join(file)).unwrap();
            for chunk in super::super::chunks::chunk_document(
                file,
                &source,
                super::super::chunks::CHUNK_WORDS,
            )
            .unwrap()
            {
                let vector = embed(
                    &mut model,
                    &format!("{}\n{}", chunk.headings.join(" / "), chunk.text),
                )
                .unwrap();
                chunks.push((chunk, vector));
            }
        }
        let questions = [
            (
                "How does the assistant protect document content?",
                "ai-assistance/design.md",
            ),
            (
                "What phase defines the markdown mapping architecture?",
                "EXPLORE.md",
            ),
            (
                "What is the chunking size ceiling?",
                "ai-assistance/design.md",
            ),
        ];
        let mut correct = 0;
        for (question, expected) in questions {
            let query = embed(&mut model, question).unwrap();
            let ranked = chunks
                .iter()
                .map(|(chunk, vector)| {
                    let dot: f32 = query.iter().zip(vector).map(|(a, b)| a * b).sum();
                    let norm = query.iter().map(|n| n * n).sum::<f32>().sqrt()
                        * vector.iter().map(|n| n * n).sum::<f32>().sqrt();
                    (chunk, dot / norm)
                })
                .collect::<Vec<_>>();
            let top = ranked.iter().max_by(|a, b| a.1.total_cmp(&b.1)).unwrap();
            println!(
                "Q={question} top={} section={:?} cosine={:.3}",
                top.0.file, top.0.headings, top.1
            );
            if top.0.file.contains(expected) {
                correct += 1;
            }
        }
        println!(
            "Recall@1={correct}/{} chunks={}",
            questions.len(),
            chunks.len()
        );
        for name in MODEL_FILES {
            println!(
                "{} bytes={}",
                name,
                fs::metadata(Path::new(&model_path).join(name))
                    .unwrap()
                    .len()
            );
        }
        assert!(
            correct >= 2,
            "retrieval relevance needs review before shipping"
        );
    }
}
