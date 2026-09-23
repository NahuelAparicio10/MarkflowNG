import { Schema } from "@tiptap/pm/model";
import { marks } from "./marks";
import { nodes } from "./nodes";

/**
 * The single ProseMirror schema for the application.
 *
 * The editor mounts on this rather than on a bundled default schema, so that
 * there is exactly one definition of what a document may contain and the
 * mapping never has to reconcile two disagreeing models.
 */
export const schema = new Schema({ nodes, marks });

export { marks } from "./marks";
export { HEADING_LEVELS, nodes } from "./nodes";
export type { HeadingLevel } from "./nodes";
