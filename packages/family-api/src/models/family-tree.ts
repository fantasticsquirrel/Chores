/** Family Tree domain contracts for household facts, managed media and transfer.
 * This is the public feature entry point; schema ownership stays in cohesive
 * feature modules. Portable DTOs describe data, never authorize an import.
 */
export type * from "./family-tree-core";
export type * from "./family-tree-media";
export type * from "./family-tree-transfer";
export type * from "./family-tree-portable";
