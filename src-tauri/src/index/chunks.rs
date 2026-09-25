use markdown::{mdast::Node, to_mdast, ParseOptions};
use serde::{Deserialize, Serialize};

/// Soft ceiling: a single oversized block is retained whole, never truncated here.
pub const CHUNK_WORDS: usize = 180;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Chunk {
    pub file: String,
    pub headings: Vec<String>,
    pub line: usize,
    pub text: String,
}

fn text(node: &Node) -> String {
    if let Some(children) = node.children() {
        return children.iter().map(text).collect::<Vec<_>>().join("");
    }
    match node {
        Node::Text(value) => value.value.clone(),
        Node::InlineCode(value) => value.value.clone(),
        Node::Image(value) => value.alt.clone(),
        _ => String::new(),
    }
}

pub fn chunk_document(file: &str, source: &str, ceiling: usize) -> Result<Vec<Chunk>, String> {
    let tree = to_mdast(source, &ParseOptions::gfm()).map_err(|_| "Cannot parse document")?;
    let mut result = Vec::new();
    let mut headings: Vec<(u8, String)> = Vec::new();
    let mut current: Option<Chunk> = None;
    let mut words = 0;
    for node in tree.children().into_iter().flatten() {
        let Some(position) = node.position() else {
            continue;
        };
        let block = source
            .get(position.start.offset..position.end.offset)
            .ok_or("Invalid AST offsets")?;
        if let Node::Heading(heading) = node {
            if let Some(chunk) = current.take() {
                result.push(chunk);
            }
            words = 0;
            while headings
                .last()
                .is_some_and(|(depth, _)| *depth >= heading.depth)
            {
                headings.pop();
            }
            headings.push((heading.depth, text(node)));
        }
        let count = block.split_whitespace().count();
        if words > 0 && words + count > ceiling {
            if let Some(chunk) = current.take() {
                result.push(chunk);
            }
            words = 0;
        }
        let chunk = current.get_or_insert_with(|| Chunk {
            file: file.into(),
            headings: headings.iter().map(|(_, name)| name.clone()).collect(),
            line: position.start.line,
            text: String::new(),
        });
        if !chunk.text.is_empty() {
            chunk.text.push_str("\n\n");
        }
        chunk.text.push_str(block);
        words += count;
    }
    if let Some(chunk) = current {
        result.push(chunk);
    }
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn headings_and_oversized_blocks_keep_their_structure() {
        let input = "# Parent\n\nIntro.\n\n## Child\n\n```rust\n// a very long code block\nlet x = 1;\n```\n\nLast paragraph.";
        let chunks = chunk_document("a.md", input, 5).unwrap();
        assert_eq!(chunks[0].headings, ["Parent"]);
        let code = chunks.iter().find(|c| c.text.contains("```rust")).unwrap();
        assert!(code.text.ends_with("```"));
        assert_eq!(code.headings, ["Parent", "Child"]);
        assert!(chunks.iter().all(|c| c.file == "a.md"));
    }

    #[test]
    fn headingless_and_unicode_documents_preserve_whole_blocks() {
        let chunks =
            chunk_document("a.md", "Primero é.\n\nSegundo ñ.\n\n- one\n- two\n", 2).unwrap();
        assert_eq!(chunks.len(), 3);
        assert_eq!(chunks[1].text, "Segundo ñ.");
        assert_eq!(chunks[2].text, "- one\n- two");
        assert!(chunks.iter().all(|c| c.headings.is_empty()));
    }
}
