/**
 * Pure helpers for the SVG diagram editor module.
 *
 * Kept free of React/browser-context dependencies so they can be
 * unit-tested in Node (`modules/diagram/test/unit`).
 */

/**
 * Companion renderings produced on save. `svg` is only used as the
 * fallback companion (when SVG→PDF conversion fails) so that the user
 * loses nothing.
 */
export type ExportKind = 'png' | 'pdf' | 'svg'

/**
 * Companion file name for a document: `diagram.svg` → `diagram.<kind>`.
 * The fallback `svg` companion must NOT collide with the document itself
 * (both end in `.svg`), so it gets a distinct suffix.
 */
export function companionFileName(docName: string, kind: ExportKind): string {
  const base = (docName || 'diagram.svg').replace(/\.(drawio|svg)$/i, '')
  const safeBase = base || 'diagram'
  if (kind === 'svg') {
    return `${safeBase}.plain.svg`
  }
  return `${safeBase}.${kind}`
}

export interface TreeNode {
  _id?: string
  name?: string
  docs?: TreeNode[]
  fileRefs?: TreeNode[]
  folders?: TreeNode[]
  [key: string]: unknown
}

/** Recursively find the parent folder ID for a given entity in a file tree. */
export function findParentFolderId(
  node: TreeNode,
  entityId: string
): string | null {
  if (node.docs?.some(d => d._id === entityId)) return node._id ?? null
  if (node.fileRefs?.some(f => f._id === entityId)) return node._id ?? null
  for (const sub of node.folders ?? []) {
    const found = findParentFolderId(sub, entityId)
    if (found) return found
  }
  return null
}

export function findFileRefById(node: TreeNode, fileId: string): TreeNode | null {
  const direct = node.fileRefs?.find(f => f._id === fileId)
  if (direct) return direct
  for (const sub of node.folders ?? []) {
    const found = findFileRefById(sub, fileId)
    if (found) return found
  }
  return null
}
