import { invoke } from "@tauri-apps/api/core";

interface AssociationStatus {
	supported: boolean;
	isMarkflow: boolean;
	selected: string | null;
}

export async function checkMarkdownAssociation(): Promise<AssociationStatus | null> {
	try {
		return await invoke<AssociationStatus>("markdown_association_status");
	} catch {
		return null;
	}
}
