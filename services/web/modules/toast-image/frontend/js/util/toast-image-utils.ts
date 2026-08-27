/**
 * Pure helpers for the Toast Image (TUI Image Editor) module.
 *
 * Kept free of React/browser-context dependencies so they can be unit-tested
 * in Node (`modules/toast-image/test/unit`).
 */

export const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif']

export function fileExtension(name: string): string | null {
  const idx = name.lastIndexOf('.')
  if (idx <= 0 || idx === name.length - 1) {
    return null
  }
  return name.slice(idx + 1).toLowerCase()
}

export function isEditableImage(name: string): boolean {
  const ext = fileExtension(name)
  return !!ext && IMAGE_EXTENSIONS.includes(ext)
}

/**
 * Output format for the edited image. TUI exports either PNG or JPEG; keep
 * the original container type (everything else is stored as JPEG).
 */
export function outputFormatForName(name: string): 'png' | 'jpeg' {
  return fileExtension(name) === 'png' ? 'png' : 'jpeg'
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
    if (sub._id === entityId) return node._id ?? null
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
