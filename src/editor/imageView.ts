import type { Node as PmNode } from "@tiptap/pm/model";
import type { EditorView, NodeView } from "@tiptap/pm/view";
import { loadImageSource } from "../images/imageSource";
import { setImageWidth } from "./images";

/**
 * Draws an image in the editor: resolves its reference against the
 * document's directory, shows a placeholder naming the reference when the
 * file cannot be loaded, and offers a resize handle while selected.
 *
 * The node's attributes are never touched while loading or failing — the
 * placeholder is purely visual, so a missing image is still saved exactly as
 * it was written.
 */
export class ImageView implements NodeView {
	dom: HTMLElement;
	private image: HTMLImageElement;
	private placeholder: HTMLElement;
	private handle: HTMLElement;
	private node: PmNode;
	private loadedSrc: string | null = null;

	constructor(
		node: PmNode,
		private view: EditorView,
		private getPos: () => number | undefined,
		private getDocumentPath: () => string | null,
	) {
		this.node = node;

		this.dom = document.createElement("span");
		this.dom.className = "markflow-image";

		this.image = document.createElement("img");
		this.image.draggable = false;
		this.placeholder = document.createElement("span");
		this.placeholder.className = "markflow-image-missing";
		this.handle = document.createElement("span");
		this.handle.className = "markflow-image-resize";
		this.handle.setAttribute("aria-hidden", "true");
		this.handle.addEventListener("pointerdown", (event) => this.startResize(event));

		this.dom.append(this.image, this.placeholder, this.handle);
		this.render();
	}

	update(node: PmNode): boolean {
		if (node.type !== this.node.type) {
			return false;
		}

		this.node = node;
		this.render();
		return true;
	}

	selectNode() {
		this.dom.classList.add("is-selected");
	}

	deselectNode() {
		this.dom.classList.remove("is-selected");
	}

	/** The resize handle's pointer events are ours, not ProseMirror's. */
	stopEvent(event: Event): boolean {
		return event.target === this.handle;
	}

	ignoreMutation(): boolean {
		return true;
	}

	private render() {
		const { src, alt, title, width } = this.node.attrs as {
			src: string;
			alt: string;
			title: string | null;
			width: number | null;
		};

		this.image.alt = alt;
		this.image.title = title ?? "";
		this.image.style.width = width === null ? "" : `${width}px`;
		this.placeholder.textContent = `Image not found: ${src}`;

		if (src !== this.loadedSrc) {
			this.loadedSrc = src;
			this.setMissing(false);
			this.image.removeAttribute("src");

			loadImageSource(this.getDocumentPath(), src).then(
				(url) => {
					if (this.loadedSrc !== src) {
						return;
					}
					this.image.onerror = () => this.setMissing(true);
					this.image.src = url;
				},
				() => {
					if (this.loadedSrc === src) {
						this.setMissing(true);
					}
				},
			);
		}
	}

	private setMissing(missing: boolean) {
		this.dom.classList.toggle("is-missing", missing);
	}

	private startResize(event: PointerEvent) {
		event.preventDefault();

		const startX = event.clientX;
		const startWidth = this.image.getBoundingClientRect().width;
		const target = event.target as HTMLElement;
		target.setPointerCapture(event.pointerId);

		const move = (moveEvent: PointerEvent) => {
			this.image.style.width = `${Math.max(1, startWidth + moveEvent.clientX - startX)}px`;
		};

		const end = (endEvent: PointerEvent) => {
			target.removeEventListener("pointermove", move);
			target.removeEventListener("pointerup", end);
			target.removeEventListener("pointercancel", end);

			const pos = this.getPos();
			const width = startWidth + endEvent.clientX - startX;
			if (pos === undefined || endEvent.type === "pointercancel" || width === startWidth) {
				this.render();
				return;
			}

			setImageWidth(pos, width)(this.view.state, this.view.dispatch);
		};

		target.addEventListener("pointermove", move);
		target.addEventListener("pointerup", end);
		target.addEventListener("pointercancel", end);
	}
}
